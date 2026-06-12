// Task data structure
let tasks = [
    {
        id: '188',
        title: 'Сделать SOTA на русском и общаге',
        assignee: 'Franz Kiermaier',
        startDate: '2026-06-01',
        endDate: '2026-06-15',
        priority: '2',
        comment: 'Важная задача для проекта.',
        status: 'planned'
    },
    {
        id: '173',
        title: 'Подать заявку на пилот как юр. лицо в Московском инновационном кластере',
        assignee: 'Ronny Keller',
        startDate: '2026-06-05',
        endDate: '2026-06-20',
        priority: '3',
        comment: '',
        status: 'in-progress'
    },
    {
        id: '191',
        title: 'Встреча с Шевченко 7 мая',
        assignee: 'Admin',
        startDate: '2026-05-07',
        endDate: '2026-05-07',
        priority: '1',
        comment: 'Обсуждение планов.',
        status: 'done'
    }
];

// Sorting state
let sorts = {
    'planned': 'none',
    'in-progress': 'none',
    'done': 'none'
};

// DOM Elements
const taskModal = document.getElementById('taskModal');
const closeBtn = document.querySelector('.close');
const addTaskForm = document.getElementById('addTaskForm');
const columns = {
    'planned': document.getElementById('planned-tasks'),
    'in-progress': document.getElementById('in-progress-tasks'),
    'done': document.getElementById('done-tasks')
};

// Initialize the board
function initBoard() {
    renderTasks();
    setupEventListeners();
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
initBoard();
