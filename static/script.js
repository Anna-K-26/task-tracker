// Task data structure
let tasks = [
    {
        id: '1',
        title: 'Изучить темы',
        assignee: 'Антон',
        startDate: '2026-06-02',
        endDate: '2026-06-05',
        priority: '2',
        comment: '',
        status: 'planned'
    },
    {
        id: '2',
        title: 'Написать статью',
        assignee: 'Марат',
        startDate: '2026-06-06',
        endDate: '2026-06-10',
        priority: '2',
        comment: '',
        status: 'in-progress'
    },
    {
        id: '3',
        title: 'Опубликовать',
        assignee: 'Арина',
        startDate: '2026-06-09',
        endDate: '2026-06-13',
        priority: '2',
        comment: '',
        status: 'planned'
    },
    {
        id: '4',
        title: 'Целевой рынок',
        assignee: 'Мария',
        startDate: '2026-06-02',
        endDate: '2026-06-07',
        priority: '2',
        comment: '',
        status: 'in-progress'
    },
    {
        id: '5',
        title: 'Целевая аудитория',
        assignee: 'Екатеририна',
        startDate: '2026-06-07',
        endDate: '2026-06-11',
        priority: '2',
        comment: '',
        status: 'planned'
    },
    {
        id: '6',
        title: 'Анализ конкурентов',
        assignee: 'Олег',
        startDate: '2026-06-10',
        endDate: '2026-06-15',
        priority: '2',
        comment: '',
        status: 'planned'
    }
];

// Sorting state
let sorts = {
    'planned': 'none',
    'in-progress': 'none',
    'done': 'none'
};

// Gantt state
let currentView = 'kanban';
let currentScale = 'week'; // 'day', 'week', 'month'

// DOM Elements
let taskModal, closeBtn, addTaskForm, kanbanContainer, ganttContainer, kanbanViewBtn, ganttViewBtn, ganttGridHeader, ganttBody, scaleBtns;
let columns = {};

// Initialize the board
function initBoard() {
    // Initialize DOM Elements
    taskModal = document.getElementById('taskModal');
    closeBtn = document.querySelector('.close');
    addTaskForm = document.getElementById('addTaskForm');
    kanbanContainer = document.getElementById('kanban-container');
    ganttContainer = document.getElementById('gantt-container');
    kanbanViewBtn = document.getElementById('kanban-view');
    ganttViewBtn = document.getElementById('gantt-view');
    ganttGridHeader = document.getElementById('gantt-grid-header');
    ganttBody = document.getElementById('gantt-body');
    scaleBtns = document.querySelectorAll('.scale-btn');

    columns = {
        'planned': document.getElementById('planned-tasks'),
        'in-progress': document.getElementById('in-progress-tasks'),
        'done': document.getElementById('done-tasks')
    };

    renderTasks();
    setupEventListeners();
}

// Switch between Kanban and Gantt views
function switchView(view) {
    currentView = view;
    if (view === 'kanban') {
        kanbanContainer.style.display = 'flex';
        ganttContainer.style.display = 'none';
        kanbanViewBtn.classList.add('active');
        ganttViewBtn.classList.remove('active');
        renderTasks();
    } else {
        kanbanContainer.style.display = 'none';
        ganttContainer.style.display = 'flex';
        kanbanViewBtn.classList.remove('active');
        ganttViewBtn.classList.add('active');
        renderGanttChart();
    }
}

// Render Gantt Chart
function renderGanttChart() {
    ganttGridHeader.innerHTML = '';
    ganttBody.innerHTML = '';

    const today = new Date();
    let startDate, endDate, daysToShow;

    if (currentScale === 'day') {
        // Show 7 days starting from today
        startDate = new Date(today);
        startDate.setHours(0, 0, 0, 0);
        daysToShow = 7;
        endDate = new Date(startDate);
        endDate.setDate(startDate.getDate() + daysToShow - 1);
    } else if (currentScale === 'week') {
        // Show 14 days (2 weeks)
        startDate = new Date(today);
        startDate.setDate(today.getDate() - today.getDay() + 1); // Start from Monday
        startDate.setHours(0, 0, 0, 0);
        daysToShow = 14;
        endDate = new Date(startDate);
        endDate.setDate(startDate.getDate() + daysToShow - 1);
    } else {
        // Month scale: show full current month
        startDate = new Date(today.getFullYear(), today.getMonth(), 1);
        endDate = new Date(today.getFullYear(), today.getMonth() + 1, 0);
        daysToShow = endDate.getDate();
    }

    // Create Header
    const taskHeader = document.createElement('div');
    taskHeader.className = 'gantt-column-task';
    taskHeader.textContent = 'Задача';
    ganttGridHeader.appendChild(taskHeader);

    const timelineHeader = document.createElement('div');
    timelineHeader.className = 'gantt-column-timeline';
    
    const monthName = startDate.toLocaleString('ru-RU', { month: 'long' });
    const capitalizedMonth = monthName.charAt(0).toUpperCase() + monthName.slice(1);
    
    timelineHeader.innerHTML = `
        <div class="gantt-month-header">${capitalizedMonth}</div>
        <div class="gantt-days-header"></div>
    `;
    
    const daysHeader = timelineHeader.querySelector('.gantt-days-header');
    
    for (let i = 0; i < daysToShow; i++) {
        const currentDay = new Date(startDate);
        currentDay.setDate(startDate.getDate() + i);
        
        const dayCell = document.createElement('div');
        dayCell.className = 'gantt-day-cell';
        dayCell.textContent = currentDay.getDate();
        if (currentDay.getDay() === 0 || currentDay.getDay() === 6) {
            dayCell.style.backgroundColor = '#f5f5f5';
        }
        daysHeader.appendChild(dayCell);
    }
    
    ganttGridHeader.appendChild(timelineHeader);

    // Render Rows
    tasks.forEach((task, index) => {
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
                const isOrange = task.title === 'Целевой рынок' || task.title === 'Целевая аудитория' || task.title === 'Анализ конкурентов';
                bar.className = `gantt-bar ${isOrange ? 'gantt-bar-orange' : 'gantt-bar-purple'}`;
                bar.style.left = `${left}%`;
                bar.style.width = `${width}%`;
                
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
            }
        }
        
        row.appendChild(timelineRow);
        ganttBody.appendChild(row);

        // Add connectors for specific tasks to match the image
        if (index < tasks.length - 1) {
            const nextTask = tasks[index + 1];
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
                    const isOrange = task.title === 'Целевой рынок' || task.title === 'Целевая аудитория' || task.title === 'Анализ конкурентов';
                    connector.className = `gantt-connector ${isOrange ? 'gantt-connector-orange' : ''}`;
                    
                    // Position the connector
                    // It starts from the end of the current bar and goes down to the start of the next bar
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

// Render all tasks to their respective columns
function renderTasks() {
    // Clear columns
    Object.values(columns).forEach(column => column.innerHTML = '');
    
    // Group tasks by status
    const groupedTasks = {
        'planned': tasks.filter(t => t.status === 'planned'),
        'in-progress': tasks.filter(t => t.status === 'in-progress'),
        'done': tasks.filter(t => t.status === 'done')
    };

    // Sort tasks in each group
    Object.keys(groupedTasks).forEach(status => {
        const sortType = sorts[status];
        if (sortType !== 'none') {
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
        groupedTasks[status].forEach(task => {
            const taskCard = createTaskCard(task);
            columns[status].appendChild(taskCard);
        });
    });

    // If we are in Gantt view, re-render it too
    if (currentView === 'gantt') {
        renderGanttChart();
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

    const priorityText = task.priority === '1' ? 'Low' : (task.priority === '2' ? 'Medium' : 'High');

    card.innerHTML = `
        <div class="task-id">
            <span>#${task.id}</span>
            <span class="priority-badge priority-${task.priority}">${priorityText}</span>
        </div>
        <h3>${task.title}</h3>
        <div class="task-details">
            <div class="task-detail-item">
                <i class="fas fa-user-circle"></i>
                <span>Assigned to: ${task.assignee}</span>
            </div>
            <div class="task-detail-item">
                <i class="far fa-calendar-alt"></i>
                <span>${formatDate(task.startDate)} - ${formatDate(task.endDate)}</span>
            </div>
        </div>
        ${task.comment ? `<div class="task-comment">${task.comment}</div>` : ''}
        <div class="task-footer">
            <button class="open-btn" onclick="editTask('${task.id}')"><i class="fas fa-external-link-alt"></i> Open</button>
            <button class="delete-btn" onclick="deleteTask('${task.id}')"><i class="fas fa-trash"></i> Delete</button>
        </div>
    `;

    return card;
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
            // Check if moving to "Done" and endDate is in the future
            if (newStatus === 'done') {
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
            renderTasks();
        }
    }
}

// Sorting logic
function changeSort(columnId, sortType) {
    sorts[columnId] = sortType;
    renderTasks();
}

// Modal functions
function openModal(status) {
    addTaskForm.reset();
    document.getElementById('taskId').value = '';
    document.getElementById('taskStatus').value = status;
    document.querySelector('.modal-content h2').textContent = 'Добавить задачу';
    taskModal.style.display = 'block';
}

function editTask(id) {
    const task = tasks.find(t => t.id === id);
    if (task) {
        document.getElementById('taskId').value = task.id;
        document.getElementById('taskStatus').value = task.status;
        document.getElementById('taskTitle').value = task.title;
        document.getElementById('taskAssignee').value = task.assignee;
        document.getElementById('taskPriority').value = task.priority || '2';
        document.getElementById('startDate').value = task.startDate;
        document.getElementById('endDate').value = task.endDate;
        document.getElementById('taskComment').value = task.comment;
        
        document.querySelector('.modal-content h2').textContent = 'Редактировать задачу';
        taskModal.style.display = 'block';
    }
}

function deleteTask(id) {
    if (confirm('Вы уверены, что хотите удалить эту задачу?')) {
        tasks = tasks.filter(t => t.id !== id);
        renderTasks();
    }
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
            renderGanttChart();
        });
    });

    closeBtn.addEventListener('click', () => {
        taskModal.style.display = 'none';
    });

    window.addEventListener('click', (event) => {
        if (event.target == taskModal) {
            taskModal.style.display = 'none';
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
            const index = tasks.findIndex(t => t.id === id);
            if (index !== -1) {
                tasks[index] = { ...tasks[index], ...taskData };
            }
        } else {
            // Add new task
            const newTask = {
                id: Math.floor(Math.random() * 1000).toString(),
                ...taskData
            };
            tasks.push(newTask);
        }

        renderTasks();
        taskModal.style.display = 'none';
        addTaskForm.reset();
    });
}

// Start the app
document.addEventListener('DOMContentLoaded', initBoard);
