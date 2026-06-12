// Task data structure
let tasks = [
    {
        id: '188',
        title: 'Сделать SOTA на русском и общаге',
        assignee: 'Franz Kiermaier',
        startDate: '2026-06-01',
        endDate: '2026-06-15',
        comment: 'Важная задача для проекта.',
        status: 'planned'
    },
    {
        id: '173',
        title: 'Подать заявку на пилот как юр. лицо в Московском инновационном кластере',
        assignee: 'Ronny Keller',
        startDate: '2026-06-05',
        endDate: '2026-06-20',
        comment: '',
        status: 'in-progress'
    },
    {
        id: '191',
        title: 'Встреча с Шевченко 7 мая',
        assignee: 'Admin',
        startDate: '2026-05-07',
        endDate: '2026-05-07',
        comment: 'Обсуждение планов.',
        status: 'done'
    }
];

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
    
    tasks.forEach(task => {
        const taskCard = createTaskCard(task);
        columns[task.status].appendChild(taskCard);
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

    const statusText = task.status === 'planned' ? 'К работе' : (task.status === 'in-progress' ? 'В работе' : 'Готово');

    card.innerHTML = `
        <div class="task-id">#${task.id}</div>
        <h3>${task.title}</h3>
        <div class="task-details">
            <div class="task-detail-item">
                <i class="fas fa-user-circle"></i>
                <span>${task.assignee}</span>
            </div>
            <div class="task-detail-item">
                <i class="far fa-calendar-alt"></i>
                <span>${formatDate(task.startDate)} - ${formatDate(task.endDate)}</span>
            </div>
        </div>
        ${task.comment ? `<div class="task-comment">${task.comment}</div>` : ''}
        <div class="task-status-badge">${statusText}</div>
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
        
        // Update task status in data
        const taskIndex = tasks.findIndex(t => t.id === taskId);
        if (taskIndex !== -1) {
            tasks[taskIndex].status = newStatus;
            renderTasks();
        }
    }
}

// Modal functions
function openModal(status) {
    document.getElementById('taskStatus').value = status;
    taskModal.style.display = 'block';
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
        
        const newTask = {
            id: Math.floor(Math.random() * 1000).toString(),
            title: document.getElementById('taskTitle').value,
            assignee: document.getElementById('taskAssignee').value,
            startDate: document.getElementById('startDate').value,
            endDate: document.getElementById('endDate').value,
            comment: document.getElementById('taskComment').value,
            status: document.getElementById('taskStatus').value
        };

        tasks.push(newTask);
        renderTasks();
        taskModal.style.display = 'none';
        addTaskForm.reset();
    });
}

// Start the app
initBoard();
