// Task data structure
let tasks = [];
let stages = [];
let currentUser = null;
let showOnlyMyTasks = false;

// API functions
async function fetchCurrentUser() {
    try {
        const response = await fetch('/me');
        if (response.ok) {
            currentUser = await response.json();
        } else {
            window.location.href = '/login';
        }
    } catch (error) {
        console.error('Error fetching user:', error);
    }
}

async function logout() {
    try {
        const response = await fetch('/logout', { method: 'POST' });
        if (response.ok) {
            window.location.href = '/login';
        }
    } catch (error) {
        console.error('Logout error:', error);
    }
}

async function fetchStages() {
    try {
        const response = await fetch('/stages');
        if (!response.ok) throw new Error('Failed to fetch stages');
        stages = await response.json();
    } catch (error) {
        console.error('Error fetching stages:', error);
    }
}

async function fetchTasks() {
    try {
        console.log('Fetching tasks from server...');
        const response = await fetch('/tasks');
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Ошибка сервера (${response.status}): ${errorText}`);
        }
        const data = await response.json();
        if (Array.isArray(data)) {
            tasks = data;
            console.log('Successfully loaded tasks:', tasks.length);
        } else {
            console.error('Data from server is not an array:', data);
            tasks = [];
        }
        renderTasks();
        updateAssigneeFilter();
    } catch (error) {
        console.error('Error in fetchTasks:', error);
        alert('Не удалось загрузить задачи: ' + error.message);
    }
}

async function saveTaskOnServer(task) {
    try {
        console.log('Attempting to save task:', task);
        // Ensure id is a string
        if (task.id) task.id = String(task.id);
        
        const isNew = !tasks.find(t => String(t.id) === String(task.id));
        const url = isNew ? '/tasks' : `/tasks/${task.id}`;
        const method = isNew ? 'POST' : 'PUT';
        
        console.log(`Sending ${method} request to ${url}`);
        
        const response = await fetch(url, {
            method: method,
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(task),
        });
        
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Ошибка сервера (${response.status}): ${errorText}`);
        }
        
        const savedTask = await response.json();
        console.log('Task saved successfully:', savedTask);

        if (isNew) {
            tasks.push(savedTask);
        } else {
            const index = tasks.findIndex(t => String(t.id) === String(savedTask.id));
            if (index !== -1) {
                tasks[index] = savedTask;
            }
        }
        renderTasks();
        updateAssigneeFilter();
    } catch (error) {
        console.error('Error in saveTaskOnServer:', error);
        alert('Ошибка при сохранении задачи: ' + error.message);
    }
}

async function deleteTaskFromServer(id) {
    try {
        const response = await fetch(`/tasks/${id}`, {
            method: 'DELETE',
        });
        
        if (!response.ok) {
            throw new Error('Failed to delete task');
        }
        
        tasks = tasks.filter(t => String(t.id) !== String(id));
        renderTasks();
        updateAssigneeFilter();
    } catch (error) {
        console.error('Error deleting task:', error);
        alert('Ошибка при удалении задачи на сервере');
    }
}

async function saveStageOnServer(stage) {
    try {
        const isNew = !stages.find(s => s.id === stage.id);
        const url = isNew ? '/stages' : `/stages/${stage.id}`;
        const method = isNew ? 'POST' : 'PUT';
        
        const response = await fetch(url, {
            method: method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(stage),
        });
        
        if (!response.ok) throw new Error('Failed to save stage');
        
        await fetchStages();
        await fetchTasks(); // Refresh tasks as some might have changed status if a stage was deleted (though not here)
        renderTasks();
    } catch (error) {
        console.error('Error saving stage:', error);
        alert('Ошибка при сохранении стадии');
    }
}

async function deleteStageFromServer(id) {
    if (!confirm('Вы уверены, что хотите удалить эту стадию? Все задачи из этой стадии будут перемещены в первую доступную стадию.')) return;
    try {
        const response = await fetch(`/stages/${id}`, {
            method: 'DELETE',
        });
        if (!response.ok) throw new Error('Failed to delete stage');
        
        await fetchStages();
        await fetchTasks();
        renderTasks();
    } catch (error) {
        console.error('Error deleting stage:', error);
        alert('Ошибка при удалении стадии');
    }
}

// Sorting state
let sorts = {};

// Gantt state
let currentView = 'kanban';
let currentScale = 'week'; // 'day', 'week', 'month'
let ganttStartDate = new Date(); // Reference date for Gantt view
let assigneeFilter = 'all';

// Drag/Resize state
let isDragging = false;
let isResizing = false;
let dragType = null; // 'left' or 'right'
let activeTaskId = null;
let startX = 0;
let initialStart = null;
let initialEnd = null;

// DOM Elements
let taskModal, closeBtn, addTaskForm, kanbanContainer, kanbanBoardWrapper, ganttContainer, kanbanViewBtn, ganttViewBtn, ganttGridHeader, ganttBody, scaleBtns;
let boardTitleText;
let prevPeriodBtn, nextPeriodBtn, todayBtn, assigneeFilterInput, assigneeDatalist, deleteTaskBtn;
let columns = {};

// Initialize the board
async function initBoard() {
    console.log('Initializing board...');
    // Initialize DOM Elements
    taskModal = document.getElementById('taskModal');
    closeBtn = document.querySelector('.close');
    addTaskForm = document.getElementById('addTaskForm');
    kanbanContainer = document.getElementById('kanban-container');
    kanbanBoardWrapper = document.querySelector('.kanban-board-wrapper');
    ganttContainer = document.getElementById('gantt-container');
    kanbanViewBtn = document.getElementById('kanban-view');
    ganttViewBtn = document.getElementById('gantt-view');
    ganttGridHeader = document.getElementById('gantt-grid-header');
    ganttBody = document.getElementById('gantt-body');
    scaleBtns = document.querySelectorAll('.scale-btn');
    boardTitleText = document.getElementById('board-title-text');
    
    prevPeriodBtn = document.getElementById('prev-period');
    nextPeriodBtn = document.getElementById('next-period');
    todayBtn = document.getElementById('today-btn');
    assigneeFilterInput = document.getElementById('assignee-filter');
    assigneeDatalist = document.getElementById('assignee-list');
    deleteTaskBtn = document.getElementById('deleteTaskBtn');

    // Set initial gantt start date to 1st of current month
    ganttStartDate.setDate(1);
    ganttStartDate.setHours(0, 0, 0, 0);

    console.log('Elements found:', {
        kanbanViewBtn: !!kanbanViewBtn,
        ganttViewBtn: !!ganttViewBtn,
        kanbanContainer: !!kanbanContainer,
        ganttContainer: !!ganttContainer,
        prevPeriodBtn: !!prevPeriodBtn,
        nextPeriodBtn: !!nextPeriodBtn,
        todayBtn: !!todayBtn,
        assigneeFilterInput: !!assigneeFilterInput
    });

    await fetchCurrentUser();
    await fetchStages();
    stages.forEach(s => {
        if (!sorts[s.id]) sorts[s.id] = 'none';
    });

    await fetchTasks();
    setupEventListeners();
    
    // Setup custom dropdowns
    setupCustomDropdown('taskAssignee', 'assignee-dropdown');
    setupCustomDropdown('assignee-filter', 'filter-dropdown', (name) => {
        assigneeFilter = name;
        renderGanttChart();
    });
}

// Update assignee filter options
function updateAssigneeFilter() {
    const uniqueAssignees = [...new Set(tasks.map(t => t.assignee))].filter(a => a && a.trim() !== '').sort();
    
    // We'll use these assignees to populate our custom dropdowns
    window.availableAssignees = uniqueAssignees;
}

function setupCustomDropdown(inputId, dropdownId, onSelect) {
    const input = document.getElementById(inputId);
    const dropdown = document.getElementById(dropdownId);
    
    if (!input || !dropdown) return;

    function renderDropdown(filter = '') {
        const assignees = window.availableAssignees || [];
        const filtered = assignees.filter(a => a.toLowerCase().includes(filter.toLowerCase()));
        
        dropdown.innerHTML = '';
        
        if (filtered.length === 0) {
            dropdown.classList.remove('active');
            return;
        }

        filtered.forEach(name => {
            const item = document.createElement('div');
            item.className = 'dropdown-item';
            item.innerHTML = `<i class="fas fa-file-alt"></i> ${name}`;
            item.onclick = () => {
                input.value = name;
                dropdown.classList.remove('active');
                if (onSelect) onSelect(name);
            };
            dropdown.appendChild(item);
        });
        
        dropdown.classList.add('active');
    }

    input.addEventListener('focus', () => renderDropdown(input.value));
    input.addEventListener('input', () => renderDropdown(input.value));
    
    // Close dropdown when clicking outside
    document.addEventListener('click', (e) => {
        if (!input.contains(e.target) && !dropdown.contains(e.target)) {
            dropdown.classList.remove('active');
        }
    });
}

// Switch between Kanban and Gantt views
function switchView(view) {
    console.log('Switching to view:', view);
    currentView = view;
    const addStageBtn = document.getElementById('add-stage-btn');
    if (view === 'kanban') {
        if (kanbanBoardWrapper) kanbanBoardWrapper.style.display = 'flex';
        if (ganttContainer) ganttContainer.style.display = 'none';
        if (kanbanViewBtn) kanbanViewBtn.classList.add('active');
        if (ganttViewBtn) ganttViewBtn.classList.remove('active');
        if (boardTitleText) boardTitleText.textContent = 'Канбан-доска';
        if (addStageBtn) addStageBtn.style.display = 'flex';
        renderTasks();
    } else {
        if (kanbanBoardWrapper) kanbanBoardWrapper.style.display = 'none';
        if (ganttContainer) ganttContainer.style.display = 'flex';
        if (kanbanViewBtn) kanbanViewBtn.classList.remove('active');
        if (ganttViewBtn) ganttViewBtn.classList.add('active');
        if (boardTitleText) boardTitleText.textContent = 'Диаграмма Ганта';
        if (addStageBtn) addStageBtn.style.display = 'none';
        renderGanttChart();
    }
}

// Render Gantt Chart
function renderGanttChart() {
    ganttGridHeader.innerHTML = '';
    ganttBody.innerHTML = '';

    let startDate = new Date(ganttStartDate);
    let endDate, daysToShow;

    if (currentScale === 'day') {
        daysToShow = 15; // Show 15 days
        endDate = new Date(startDate);
        endDate.setDate(startDate.getDate() + daysToShow - 1);
    } else if (currentScale === 'week') {
        daysToShow = 56; // Show 8 weeks (approx 2 months)
        endDate = new Date(startDate);
        endDate.setDate(startDate.getDate() + daysToShow - 1);
    } else {
        // Month scale: show full month of the current ganttStartDate
        startDate = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
        endDate = new Date(startDate.getFullYear(), startDate.getMonth() + 1, 0);
        daysToShow = endDate.getDate();
    }
    
    endDate.setHours(23, 59, 59, 999);

    // Create Header
    const taskHeader = document.createElement('div');
    taskHeader.className = 'gantt-column-task';
    taskHeader.textContent = 'Задача';
    ganttGridHeader.appendChild(taskHeader);

    const timelineHeader = document.createElement('div');
    timelineHeader.className = 'gantt-column-timeline';
    
    // Determine month name(s)
    let monthLabel = startDate.toLocaleString('ru-RU', { month: 'long', year: 'numeric' });
    if (endDate.getMonth() !== startDate.getMonth()) {
        const startMonthName = startDate.toLocaleString('ru-RU', { month: 'long' });
        const endMonthName = endDate.toLocaleString('ru-RU', { month: 'long' });
        monthLabel = `${startMonthName} - ${endMonthName} ${startDate.getFullYear()}`;
    }
    const capitalizedMonth = monthLabel.toUpperCase();
    
    timelineHeader.innerHTML = `
        <div class="gantt-month-header">${capitalizedMonth}</div>
        <div class="gantt-days-header"></div>
    `;
    
    const daysHeader = timelineHeader.querySelector('.gantt-days-header');
    
    if (currentScale === 'week') {
        // Show weeks like in the image: "Нед 1", "Нед 2", etc.
        for (let i = 0; i < 8; i++) {
            const weekStart = new Date(startDate);
            weekStart.setDate(startDate.getDate() + i * 7);
            
            const dayCell = document.createElement('div');
            dayCell.className = 'gantt-day-cell';
            dayCell.style.flexDirection = 'column';
            dayCell.style.height = 'auto';
            
            const dateLabel = document.createElement('div');
            dateLabel.style.fontSize = '10px';
            dateLabel.style.color = '#999';
            dateLabel.textContent = `${weekStart.getDate()}.${weekStart.getMonth() + 1}`;
            
            const weekLabel = document.createElement('div');
            weekLabel.style.fontWeight = 'bold';
            weekLabel.textContent = `Нед ${i + 1}`;
            
            dayCell.appendChild(dateLabel);
            dayCell.appendChild(weekLabel);
            daysHeader.appendChild(dayCell);
        }
    } else {
        for (let i = 0; i < daysToShow; i++) {
            const currentDay = new Date(startDate);
            currentDay.setDate(startDate.getDate() + i);
            
            const dayCell = document.createElement('div');
            dayCell.className = 'gantt-day-cell';
            dayCell.style.flexDirection = 'column';
            dayCell.style.height = 'auto';
            
            const dayName = currentDay.toLocaleString('ru-RU', { weekday: 'short' }).toUpperCase();
            const nameLabel = document.createElement('div');
            nameLabel.style.fontSize = '10px';
            nameLabel.style.color = '#999';
            nameLabel.textContent = dayName;
            
            const dateLabel = document.createElement('div');
            dateLabel.style.fontWeight = 'bold';
            dateLabel.textContent = currentDay.getDate();
            
            dayCell.appendChild(nameLabel);
            dayCell.appendChild(dateLabel);
            
            if (currentDay.getDay() === 0 || currentDay.getDay() === 6) {
                dayCell.style.backgroundColor = '#f5f5f5';
            }
            daysHeader.appendChild(dayCell);
        }
    }
    
    ganttGridHeader.appendChild(timelineHeader);

    // Filter tasks by assignee
    let filteredTasks = assigneeFilter === 'all' 
        ? tasks 
        : tasks.filter(t => t.assignee === assigneeFilter);

    // Filter out archived tasks
    filteredTasks = filteredTasks.filter(t => !t.archived);

    if (showOnlyMyTasks && currentUser) {
        filteredTasks = filteredTasks.filter(t => 
            t.assignee === currentUser.username || 
            t.assignee === currentUser.displayName
        );
    }

    // Render Rows
    filteredTasks.forEach((task, index) => {
        const row = document.createElement('div');
        row.className = 'gantt-row';
        
        const taskInfo = document.createElement('div');
        taskInfo.className = 'gantt-task-info';
        taskInfo.textContent = task.title;
        row.appendChild(taskInfo);
        
        const timelineRow = document.createElement('div');
        timelineRow.className = 'gantt-timeline-row';
        timelineRow.style.backgroundSize = `${100 / daysToShow}% 100%`;
        
        // Calculate bar position and width
        const taskStart = new Date(task.startDate);
        const taskEnd = new Date(task.endDate);
        taskStart.setHours(0,0,0,0);
        taskEnd.setHours(23,59,59,999);
        
        if (taskEnd >= startDate && taskStart <= endDate) {
            const startDiff = Math.max(0, (taskStart - startDate) / (24 * 60 * 60 * 1000));
            const endDiff = Math.min(daysToShow, (taskEnd - startDate) / (24 * 60 * 60 * 1000) + 1);
            const duration = endDiff - startDiff;
            
            if (duration > 0) {
                const cellWidth = 100 / daysToShow;
                const left = startDiff * cellWidth;
                const width = duration * cellWidth;
                
                const bar = document.createElement('div');
                const statusClass = `gantt-bar-${task.status}`;
                bar.className = `gantt-bar ${statusClass}`;
                bar.style.left = `${left}%`;
                bar.style.width = `${width}%`;
                bar.dataset.taskId = task.id;
                
                // Add tooltip
                const tooltipText = `Задача: ${task.title}\nОтветственный: ${task.assignee}${task.comment ? `\nКомментарий: ${task.comment}` : ''}`;
                bar.setAttribute('data-tooltip', tooltipText);
                
                // Add click listener to edit
                bar.addEventListener('click', (e) => {
                    e.stopPropagation();
                    openTaskPanel(task.id);
                });
                
                // Add resize handles
                const resizerLeft = document.createElement('div');
                resizerLeft.className = 'resizer resizer-left';
                const resizerRight = document.createElement('div');
                resizerRight.className = 'resizer resizer-right';
                
                bar.appendChild(resizerLeft);
                bar.appendChild(resizerRight);
                
                // Add assignee avatar and name
                const assigneeInfo = document.createElement('div');
                assigneeInfo.className = 'gantt-assignee';
                assigneeInfo.style.left = `${left + width + 0.5}%`;
                
                // Use initials for avatar if no image
                const initials = task.assignee.split(' ').map(n => n[0]).join('').toUpperCase();
                
                assigneeInfo.innerHTML = `
                    <div class="gantt-avatar">
                        <span>${initials}</span>
                    </div>
                    <span>${task.assignee}</span>
                `;
                
                timelineRow.appendChild(bar);
                timelineRow.appendChild(assigneeInfo);
                
                // Event listeners for resizing
                resizerLeft.addEventListener('mousedown', (e) => startResize(e, task.id, 'left'));
                resizerRight.addEventListener('mousedown', (e) => startResize(e, task.id, 'right'));
            }
        }
        
        row.appendChild(timelineRow);
        ganttBody.appendChild(row);

        // Add connectors for specific tasks to match the image
        if (index < filteredTasks.length - 1) {
            const nextTask = filteredTasks[index + 1];
            const taskStart = new Date(task.startDate);
            const taskEnd = new Date(task.endDate);
            const nextStart = new Date(nextTask.startDate);
            
            if (taskEnd >= startDate && taskStart <= endDate && nextStart >= startDate) {
                const cellWidth = 100 / daysToShow;
                const currentEndPos = (Math.min(daysToShow, (taskEnd - startDate) / (24 * 60 * 60 * 1000) + 1)) * cellWidth;
                const nextStartPos = ((nextStart - startDate) / (24 * 60 * 60 * 1000)) * cellWidth;
                
                // Only connect if it makes sense (next starts after or at current end)
                if (nextStartPos >= currentEndPos - 1) {
                    const connector = document.createElement('div');
                    const stage = stages.find(s => s.id === task.status);
                    const isOrange = stage && (stage.name.toLowerCase().includes('работе') || stage.name.toLowerCase().includes('процесс'));
                    connector.className = `gantt-connector ${isOrange ? 'gantt-connector-orange' : ''}`;
                    
                    // Position the connector
                    connector.style.left = `${currentEndPos - 0.5}%`;
                    connector.style.width = `${nextStartPos - currentEndPos + 0.5}%`;
                    connector.style.top = `25px`; // Middle of current row
                    connector.style.height = `50px`; // Down to next row
                    
                    timelineRow.appendChild(connector);
                }
            }
        }
    });
}

// Drag and Resize functions
function startResize(e, taskId, type) {
    e.stopPropagation();
    isResizing = true;
    dragType = type;
    activeTaskId = taskId;
    startX = e.clientX;
    
    const task = tasks.find(t => t.id === taskId);
    initialStart = new Date(task.startDate);
    initialEnd = new Date(task.endDate);
    
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', stopDragResize);
}

function handleMouseMove(e) {
    if (!isResizing) return;
    
    const task = tasks.find(t => t.id === activeTaskId);
    if (!task) return;
    
    const diffX = e.clientX - startX;
    
    // Calculate how many days the mouse moved
    // We need the width of one day cell in pixels
    const dayCell = document.querySelector('.gantt-day-cell');
    if (!dayCell) return;
    const dayWidth = dayCell.offsetWidth;
    
    const daysDiff = Math.round(diffX / dayWidth);
    
    if (dragType === 'left') {
        const newStart = new Date(initialStart);
        newStart.setDate(initialStart.getDate() + daysDiff);
        if (newStart <= new Date(task.endDate)) {
            task.startDate = newStart.toISOString().split('T')[0];
        }
    } else if (dragType === 'right') {
        const newEnd = new Date(initialEnd);
        newEnd.setDate(initialEnd.getDate() + daysDiff);
        if (newEnd >= new Date(task.startDate)) {
            task.endDate = newEnd.toISOString().split('T')[0];
        }
    }
    
    renderGanttChart();
}

function stopDragResize() {
    if (activeTaskId) {
        const task = tasks.find(t => t.id === activeTaskId);
        if (task) {
            saveTaskOnServer(task);
        }
    }
    isResizing = false;
    dragType = null;
    activeTaskId = null;
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', stopDragResize);
    renderTasks(); // To update Kanban if needed
}

// Render all tasks to their respective columns
function renderTasks() {
    if (!kanbanContainer) return;
    
    // Clear kanban container
    kanbanContainer.innerHTML = '';
    columns = {};
    
    // Create columns based on stages
    stages.forEach(stage => {
        const column = document.createElement('div');
        column.className = 'kanban-column';
        column.id = stage.id;
        column.ondrop = drop;
        column.ondragover = allowDrop;
        
        const currentSort = sorts[stage.id] || 'none';
        
        column.innerHTML = `
            <div class="column-header">
                <div class="column-info">
                    <i class="fas fa-ellipsis-v"></i>
                    <h2 id="stage-name-${stage.id}">${stage.name}</h2>
                    <button class="edit-stage-btn" onclick="editStageName('${stage.id}')"><i class="fas fa-edit"></i></button>
                    <button class="delete-stage-btn" onclick="deleteStageFromServer('${stage.id}')"><i class="fas fa-times"></i></button>
                </div>
                <div class="column-actions">
                    <select class="sort-select" onchange="changeSort('${stage.id}', this.value)">
                        <option value="none" ${currentSort === 'none' ? 'selected' : ''}>Сортировка</option>
                        <option value="startDate" ${currentSort === 'startDate' ? 'selected' : ''}>По дате начала</option>
                        <option value="endDate" ${currentSort === 'endDate' ? 'selected' : ''}>По дате окончания</option>
                        <option value="priority" ${currentSort === 'priority' ? 'selected' : ''}>По приоритету</option>
                    </select>
                    <button class="add-task-col-btn" onclick="openModal('${stage.id}')">
                        <i class="fas fa-plus"></i> Добавить задачу
                    </button>
                </div>
            </div>
            <div class="task-list" id="${stage.id}-tasks">
                <!-- Tasks will be added here -->
            </div>
        `;
        
        kanbanContainer.appendChild(column);
        columns[stage.id] = column.querySelector('.task-list');
    });

    // Group tasks by status
    const groupedTasks = {};
    stages.forEach(s => groupedTasks[s.id] = []);
    
    let filteredTasks = tasks.filter(t => !t.archived);
    if (showOnlyMyTasks && currentUser) {
        filteredTasks = tasks.filter(t => 
            t.assignee === currentUser.username || 
            t.assignee === currentUser.displayName
        );
    }

    filteredTasks.forEach(task => {
        if (groupedTasks[task.status]) {
            groupedTasks[task.status].push(task);
        } else {
            // If status doesn't match any stage, put it in the first one
            if (stages.length > 0) {
                groupedTasks[stages[0].id].push(task);
            }
        }
    });

    // Sort tasks in each group
    Object.keys(groupedTasks).forEach(status => {
        const sortType = sorts[status];
        if (sortType && sortType !== 'none') {
            groupedTasks[status].sort((a, b) => {
                if (sortType === 'priority') {
                    return b.priority - a.priority; // High priority first
                } else {
                    return new Date(a[sortType]) - new Date(b[sortType]);
                }
            });
        }
    });

    // Render sorted tasks
    Object.keys(groupedTasks).forEach(status => {
        if (columns[status]) {
            groupedTasks[status].forEach(task => {
                const taskCard = createTaskCard(task);
                columns[status].appendChild(taskCard);
            });
        }
    });

    // If we are in Gantt view, re-render it too
    if (currentView === 'gantt') {
        renderGanttChart();
    }
}

function addNewStage() {
    const name = prompt('Введите название новой стадии:');
    if (name) {
        const id = 'stage-' + Date.now();
        saveStageOnServer({ id, name });
    }
}

function editStageName(id) {
    const stage = stages.find(s => s.id === id);
    if (!stage) return;
    const newName = prompt('Введите новое название стадии:', stage.name);
    if (newName && newName !== stage.name) {
        saveStageOnServer({ ...stage, name: newName });
    }
}

// Create a task card element
function createTaskCard(task) {
    const card = document.createElement('div');
    card.className = 'task-card';
    card.draggable = true;
    card.id = `task-${task.id}`;
    card.dataset.taskId = task.id;
    
    card.addEventListener('dragstart', drag);

    const p = String(task.priority);
    const priorityText = p === '1' ? 'Низкий' : (p === '2' ? 'Средний' : 'Высокий');

    card.innerHTML = `
        <div class="task-id">
            <span>#${task.id}</span>
            <span class="priority-badge priority-${task.priority}">${priorityText}</span>
        </div>
        <h3>${task.title}</h3>
        <div class="task-details">
            <div class="task-detail-item">
                <i class="fas fa-user-circle"></i>
                <span>Ответственный: ${task.assignee}</span>
            </div>
            <div class="task-detail-item">
                <i class="far fa-calendar-alt"></i>
                <span>${formatDate(task.startDate)} - ${formatDate(task.endDate)}</span>
            </div>
        </div>
        ${task.comment ? `<div class="task-comment">${task.comment}</div>` : ''}
        <div class="task-footer">
            <button class="open-btn" onclick="openTaskPanel('${task.id}', event)"><i class="fas fa-external-link-alt"></i> Открыть</button>
            ${task.status !== 'done' ? `<button class="complete-btn" onclick="completeTask('${task.id}', event)"><i class="fas fa-check"></i> Завершить</button>` : ''}
            <button class="archive-btn" onclick="archiveTask('${task.id}', event)"><i class="fas fa-archive"></i> В архив</button>
            <button class="delete-btn" onclick="deleteTask('${task.id}', event)"><i class="fas fa-trash"></i> Удалить</button>
        </div>
    `;

    card.addEventListener('click', (e) => {
        // Only open edit modal if we didn't click a button in the footer
        if (!e.target.closest('.task-footer')) {
            openTaskPanel(task.id);
        }
    });

    return card;
}

function completeTask(id, event) {
    if (event) event.stopPropagation();
    const task = tasks.find(t => String(t.id) === String(id));
    if (task) {
        // Check if endDate is in the future
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const endDate = new Date(task.endDate);
        if (endDate > today) {
            if (!confirm('Дата окончания этой задачи еще не наступила. Вы уверены, что хотите завершить ее?')) {
                return;
            }
        }
        
        // Find the stage named "Готово"
        const doneStage = stages.find(s => s.name.toLowerCase() === 'готово');
        if (doneStage) {
            task.status = doneStage.id;
        } else {
            task.status = 'done'; // Fallback
        }
        
        saveTaskOnServer(task);
    }
}

function archiveTask(id, event) {
    if (event) event.stopPropagation();
    console.log('Archiving task:', id);
    const task = tasks.find(t => String(t.id) === String(id));
    if (task) {
        task.archived = true;
        saveTaskOnServer(task);
    } else {
        console.error('Task not found for archiving:', id);
    }
}

function unarchiveTask(id) {
    console.log('Unarchiving task:', id);
    const task = tasks.find(t => String(t.id) === String(id));
    if (task) {
        task.archived = false;
        saveTaskOnServer(task);
        // Refresh archive modal if open
        openArchiveModal();
    } else {
        console.error('Task not found for unarchiving:', id);
    }
}

function openArchiveModal() {
    const modal = document.getElementById('archiveModal');
    const list = document.getElementById('archivedTasksList');
    if (!modal || !list) return;

    const archivedTasks = tasks.filter(t => t.archived);
    list.innerHTML = '';

    if (archivedTasks.length === 0) {
        list.innerHTML = '<p class="empty-archive">Архив пуст</p>';
    } else {
        archivedTasks.forEach(task => {
            const item = document.createElement('div');
            item.className = 'archived-task-item';
            item.innerHTML = `
                <div class="archived-task-info">
                    <strong>#${task.id} ${task.title}</strong>
                    <span>${task.assignee} | ${formatDate(task.startDate)} - ${formatDate(task.endDate)}</span>
                </div>
                <div class="archived-task-actions">
                    <button onclick="unarchiveTask('${task.id}')" title="Восстановить"><i class="fas fa-undo"></i></button>
                    <button onclick="deleteTask('${task.id}')" class="delete-btn-small" title="Удалить навсегда"><i class="fas fa-trash"></i></button>
                </div>
            `;
            list.appendChild(item);
        });
    }

    modal.style.display = 'block';
}

function closeArchiveModal() {
    const modal = document.getElementById('archiveModal');
    if (modal) modal.style.display = 'none';
}

function formatDate(dateStr) {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
}

// Drag and Drop functions
function allowDrop(ev) {
    ev.preventDefault();
}

function drag(ev) {
    ev.dataTransfer.setData("text", ev.target.id);
}

function drop(ev) {
    ev.preventDefault();
    const data = ev.dataTransfer.getData("text");
    const draggedElement = document.getElementById(data);
    
    // Find the target column
    let target = ev.target;
    while (target && !target.classList.contains('kanban-column')) {
        target = target.parentElement;
    }

    if (target) {
        const newStatus = target.id;
        const taskId = draggedElement.dataset.taskId;
        const task = tasks.find(t => t.id === taskId);

        if (task) {
            // Check if moving to a stage named "Готово" and endDate is in the future
            const targetStage = stages.find(s => s.id === newStatus);
            if (targetStage && targetStage.name.toLowerCase() === 'готово') {
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                const endDate = new Date(task.endDate);
                if (endDate > today) {
                    if (!confirm('Дата окончания этой задачи еще не наступила. Вы уверены, что хотите переместить ее в "Готово"?')) {
                        return;
                    }
                }
            }

            task.status = newStatus;
            saveTaskOnServer(task);
        }
    }
}

// Sorting logic
function changeSort(columnId, sortType) {
    sorts[columnId] = sortType;
    renderTasks();
}

// Modal functions
function updateStatusOptions() {
    const statusSelect = document.getElementById('taskStatus');
    if (!statusSelect) return;
    statusSelect.innerHTML = '';
    stages.forEach(stage => {
        const option = document.createElement('option');
        option.value = stage.id;
        option.textContent = stage.name;
        statusSelect.appendChild(option);
    });
}

function openModal(status) {
    addTaskForm.reset();
    updateStatusOptions();
    document.getElementById('taskId').value = '';
    document.getElementById('taskStatus').value = status;
    document.querySelector('.modal-content h2').textContent = 'Добавить задачу';
    if (deleteTaskBtn) deleteTaskBtn.style.display = 'none';
    taskModal.style.display = 'block';
}

function editTask(id) {
    const task = tasks.find(t => String(t.id) === String(id));
    if (task) {
        updateStatusOptions();
        document.getElementById('taskId').value = task.id;
        document.getElementById('taskStatus').value = task.status;
        document.getElementById('taskTitle').value = task.title;
        document.getElementById('taskAssignee').value = task.assignee;
        document.getElementById('taskPriority').value = task.priority || '2';
        document.getElementById('startDate').value = task.startDate;
        document.getElementById('endDate').value = task.endDate;
        document.getElementById('taskComment').value = task.comment;
        
        document.querySelector('.modal-content h2').textContent = 'Редактировать задачу';
        if (deleteTaskBtn) deleteTaskBtn.style.display = 'block';
        taskModal.style.display = 'block';
    }
}

function deleteTask(id, event) {
    if (event) event.stopPropagation();
    if (confirm('Вы уверены, что хотите удалить эту задачу?')) {
        deleteTaskFromServer(id);
    }
}

function openTaskPanel(id, event) {
    if (event) event.stopPropagation();
    const task = tasks.find(t => String(t.id) === String(id));
    if (!task) return;

    let panel = document.getElementById('taskSidePanel');
    if (!panel) {
        panel = document.createElement('div');
        panel.id = 'taskSidePanel';
        panel.className = 'side-panel';
        document.body.appendChild(panel);
    }

    const p = String(task.priority);
    const priorityText = p === '1' ? 'Низкий' : (p === '2' ? 'Средний' : 'Высокий');

    panel.innerHTML = `
        <div class="side-panel-header">
            <h2>Информация о задаче</h2>
            <div style="display: flex; align-items: center;">
                <button class="close-panel-btn" onclick="closeTaskPanel()">&times;</button>
            </div>
        </div>
        <div class="side-panel-content">
            <div class="panel-section">
                <div class="panel-item">
                    <label>ID:</label>
                    <span>#${task.id}</span>
                </div>
                <div class="panel-item">
                    <label>Название:</label>
                    <input type="text" id="panelTitleInput" class="panel-input" value="${task.title}" maxlength="100">
                </div>
                <div class="panel-item">
                    <label>Статус:</label>
                    <select id="panelStatusInput" class="panel-input">
                        ${stages.map(s => `<option value="${s.id}" ${s.id === task.status ? 'selected' : ''}>${s.name}</option>`).join('')}
                    </select>
                </div>
                <div class="panel-item">
                    <label>Приоритет:</label>
                    <select id="panelPriorityInput" class="panel-input">
                        <option value="1" ${task.priority == '1' ? 'selected' : ''}>Низкий</option>
                        <option value="2" ${task.priority == '2' ? 'selected' : ''}>Средний</option>
                        <option value="3" ${task.priority == '3' ? 'selected' : ''}>Высокий</option>
                    </select>
                </div>
                <div class="panel-item">
                    <label>Ответственный:</label>
                    <div class="custom-select-container">
                        <input type="text" id="panelAssigneeInput" class="panel-input" value="${task.assignee}" autocomplete="off" maxlength="50">
                        <div id="panel-assignee-dropdown" class="custom-dropdown"></div>
                    </div>
                </div>
                <div class="panel-item">
                    <label>Дата начала:</label>
                    <input type="date" id="panelStartDateInput" class="panel-input" value="${task.startDate}">
                </div>
                <div class="panel-item">
                    <label>Дата окончания:</label>
                    <input type="date" id="panelEndDateInput" class="panel-input" value="${task.endDate}">
                </div>
                <div class="panel-item">
                    <label>Комментарий:</label>
                    <textarea id="panelCommentInput" class="panel-comment-edit" placeholder="Добавьте комментарий..." maxlength="500">${task.comment || ''}</textarea>
                </div>
                <button class="save-task-panel-btn" onclick="saveTaskFromPanel('${task.id}')">
                    <i class="fas fa-save"></i> Сохранить изменения
                </button>
            </div>

            <div class="panel-section">
                <h3><i class="fas fa-paperclip"></i> Вложения</h3>
                <div id="fileList" class="file-list">
                    ${(task.files || []).map(file => `
                        <div class="file-item">
                            <a href="${file.path}" target="_blank"><i class="fas fa-file"></i> ${file.name}</a>
                            <button class="delete-file-btn" onclick="deleteFile('${task.id}', '${file.id}')"><i class="fas fa-trash"></i></button>
                        </div>
                    `).join('')}
                </div>
                <div class="file-upload-container">
                    <input type="file" id="fileInput" style="display: none" onchange="uploadFile('${task.id}')">
                    <button class="add-file-btn" onclick="document.getElementById('fileInput').click()">
                        <i class="fas fa-plus"></i> Прикрепить файл
                    </button>
                </div>
            </div>

            <div class="panel-section">
                <h3><i class="fas fa-comments"></i> Чат</h3>
                <div id="chatMessages" class="chat-messages">
                    ${(task.messages || []).map(msg => `
                        <div class="chat-message">
                            <div class="message-info">
                                <span class="message-sender">${msg.sender}</span>
                                <span class="message-time">${msg.timestamp}</span>
                            </div>
                            <div class="message-text">${msg.text}</div>
                        </div>
                    `).join('')}
                </div>
                <div class="chat-input-container">
                    <textarea id="chatInput" placeholder="Напишите сообщение..."></textarea>
                    <button class="send-message-btn" onclick="sendMessage('${task.id}')">
                        <i class="fas fa-paper-plane"></i>
                    </button>
                </div>
            </div>
        </div>
    `;

    panel.classList.add('active');
    
    // Setup custom dropdown for assignee in panel
    setupCustomDropdown('panelAssigneeInput', 'panel-assignee-dropdown');

    // Scroll chat to bottom
    const chatMessages = panel.querySelector('#chatMessages');
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

async function uploadFile(taskId) {
    const fileInput = document.getElementById('fileInput');
    if (!fileInput.files.length) return;
    
    const formData = new FormData();
    formData.append('file', fileInput.files[0]);
    
    try {
        const response = await fetch(`/tasks/${taskId}/files`, {
            method: 'POST',
            body: formData
        });
        
        if (!response.ok) throw new Error('Upload failed');
        
        await fetchTasks(); // Refresh tasks
        openTaskPanel(taskId); // Refresh panel
    } catch (error) {
        console.error('Error uploading file:', error);
        alert('Ошибка при загрузке файла');
    }
}

async function deleteFile(taskId, fileId) {
    if (!confirm('Удалить этот файл?')) return;
    
    try {
        const response = await fetch(`/tasks/${taskId}/files/${fileId}`, {
            method: 'DELETE'
        });
        
        if (!response.ok) throw new Error('Delete failed');
        
        await fetchTasks();
        openTaskPanel(taskId);
    } catch (error) {
        console.error('Error deleting file:', error);
        alert('Ошибка при удалении файла');
    }
}

async function sendMessage(taskId) {
    const input = document.getElementById('chatInput');
    const text = input.value.trim();
    if (!text) return;
    
    const message = {
        id: Date.now().toString(),
        sender: currentUser ? (currentUser.displayName || currentUser.username) : 'Гость',
        text: text,
        timestamp: new Date().toLocaleString('ru-RU', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' })
    };
    
    try {
        const response = await fetch(`/tasks/${taskId}/messages`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(message)
        });
        
        if (!response.ok) throw new Error('Failed to send message');
        
        input.value = '';
        await fetchTasks();
        openTaskPanel(taskId);
    } catch (error) {
        console.error('Error sending message:', error);
        alert('Ошибка при отправке сообщения');
    }
}

async function saveTaskFromPanel(taskId) {
    const task = tasks.find(t => String(t.id) === String(taskId));
    if (!task) return;

    const title = document.getElementById('panelTitleInput').value.trim();
    const status = document.getElementById('panelStatusInput').value;
    const priority = document.getElementById('panelPriorityInput').value;
    const assignee = document.getElementById('panelAssigneeInput').value.trim();
    const startDate = document.getElementById('panelStartDateInput').value;
    const endDate = document.getElementById('panelEndDateInput').value;
    const comment = document.getElementById('panelCommentInput').value.trim();

    if (!title || !assignee || !startDate || !endDate) {
        alert('Пожалуйста, заполните все обязательные поля');
        return;
    }

    const updatedTask = {
        ...task,
        title,
        status,
        priority,
        assignee,
        startDate,
        endDate,
        comment
    };

    await saveTaskOnServer(updatedTask);
    // Panel will be refreshed by renderTasks -> fetchTasks if we want, 
    // but here we just need to make sure the board is updated.
    // saveTaskOnServer already calls fetchTasks() and renderTasks().
}

function closeTaskPanel() {
    const panel = document.getElementById('taskSidePanel');
    if (panel) panel.classList.remove('active');
}

// Event Listeners
function setupEventListeners() {
    kanbanViewBtn.addEventListener('click', () => switchView('kanban'));
    ganttViewBtn.addEventListener('click', () => switchView('gantt'));

    scaleBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            scaleBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentScale = btn.dataset.scale;
            
            // Adjust ganttStartDate when scale changes to keep it sensible
            ganttStartDate.setDate(1);
            ganttStartDate.setHours(0, 0, 0, 0);
            
            renderGanttChart();
        });
    });

    prevPeriodBtn.addEventListener('click', () => {
        if (currentScale === 'day') {
            ganttStartDate.setDate(ganttStartDate.getDate() - 15);
        } else if (currentScale === 'week') {
            ganttStartDate.setDate(ganttStartDate.getDate() - 28);
        } else {
            ganttStartDate.setMonth(ganttStartDate.getMonth() - 1);
            ganttStartDate.setDate(1);
        }
        renderGanttChart();
    });

    nextPeriodBtn.addEventListener('click', () => {
        if (currentScale === 'day') {
            ganttStartDate.setDate(ganttStartDate.getDate() + 15);
        } else if (currentScale === 'week') {
            ganttStartDate.setDate(ganttStartDate.getDate() + 28);
        } else {
            ganttStartDate.setMonth(ganttStartDate.getMonth() + 1);
            ganttStartDate.setDate(1);
        }
        renderGanttChart();
    });

    todayBtn.addEventListener('click', () => {
        ganttStartDate = new Date();
        ganttStartDate.setDate(1); // Start from 1st
        ganttStartDate.setHours(0, 0, 0, 0);
        renderGanttChart();
    });

    const myTasksFilterBtn = document.getElementById('myTasksFilter');
    if (myTasksFilterBtn) {
        myTasksFilterBtn.addEventListener('click', () => {
            showOnlyMyTasks = !showOnlyMyTasks;
            myTasksFilterBtn.classList.toggle('active', showOnlyMyTasks);
            renderTasks();
        });
    }

    assigneeFilterInput.addEventListener('input', (e) => {
        assigneeFilter = e.target.value.trim() || 'all';
        if (assigneeFilter === '') assigneeFilter = 'all';
        // Dropdown handles the filtering now, but we still need this for manual entry
        renderGanttChart();
    });

    if (deleteTaskBtn) {
        deleteTaskBtn.addEventListener('click', () => {
            const id = document.getElementById('taskId').value;
            if (id) {
                deleteTask(id);
                taskModal.style.display = 'none';
            }
        });
    }

    closeBtn.addEventListener('click', () => {
        taskModal.style.display = 'none';
    });

    window.addEventListener('click', (event) => {
        if (event.target == taskModal) {
            taskModal.style.display = 'none';
        }
        const archiveModal = document.getElementById('archiveModal');
        if (event.target == archiveModal) {
            archiveModal.style.display = 'none';
        }
    });

    addTaskForm.addEventListener('submit', (e) => {
        e.preventDefault();
        
        const id = document.getElementById('taskId').value;
        const taskData = {
            title: document.getElementById('taskTitle').value,
            assignee: document.getElementById('taskAssignee').value,
            priority: document.getElementById('taskPriority').value,
            startDate: document.getElementById('startDate').value,
            endDate: document.getElementById('endDate').value,
            comment: document.getElementById('taskComment').value,
            status: document.getElementById('taskStatus').value
        };

        if (id) {
            // Edit existing task
            const index = tasks.findIndex(t => String(t.id) === String(id));
            if (index !== -1) {
                const updatedTask = { ...tasks[index], ...taskData };
                saveTaskOnServer(updatedTask);
            }
        } else {
            // Add new task
            const newTask = {
                id: Math.floor(Math.random() * 1000).toString(),
                ...taskData
            };
            saveTaskOnServer(newTask);
        }

        taskModal.style.display = 'none';
        addTaskForm.reset();
    });
}

// Start the app
console.log('Script loaded, readyState:', document.readyState);
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initBoard);
} else {
    initBoard();
}
