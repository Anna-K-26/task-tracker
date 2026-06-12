// Task data structure
let tasks = [
    {
        id: '1',
        title: 'Briefing',
        tag: 'DUE',
        dueDate: '1/23/2018',
        assignee: 'Franz Kiermaier',
        effort: 2,
        status: 'planned'
    },
    {
        id: '2',
        title: 'Messe-Stand Rückbau',
        tag: 'ON HOLD',
        dueDate: '1/31/2018',
        assignee: 'Ronny Keller',
        effort: 3,
        status: 'planned'
    },
    {
        id: '3',
        title: 'Einladungen verschicken',
        tag: 'DUE',
        dueDate: '1/15/2018',
        assignee: 'Ronny Keller',
        effort: 1,
        status: 'in-progress'
    },
    {
        id: '4',
        title: 'Visitenkarten und Namensschilder erstellen',
        tag: 'DONE',
        dueDate: '1/4/2018',
        assignee: 'Ronny Keller',
        effort: 2,
        status: 'done'
    }
];

// DOM Elements
const taskModal = document.getElementById('taskModal');
const addTaskBtn = document.querySelector('.add-task-btn');
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
    
    // Reset counts
    const counts = { 'planned': 0, 'in-progress': 0, 'done': 0 };

    tasks.forEach(task => {
        const taskCard = createTaskCard(task);
        columns[task.status].appendChild(taskCard);
        counts[task.status]++;
    });

    // Update column counts
    document.querySelector('#planned .count').textContent = counts['planned'];
    document.querySelector('#in-progress .count').textContent = counts['in-progress'];
    document.querySelector('#done .count').textContent = counts['done'];
}

// Create a task card element
function createTaskCard(task) {
    const card = document.createElement('div');
    card.className = 'task-card';
    card.draggable = true;
    card.id = `task-${task.id}`;
    card.dataset.taskId = task.id;
    
    card.addEventListener('dragstart', drag);

    const tagClass = task.tag.toLowerCase().replace(' ', '-');
    const tagDisplay = task.tag === 'DUE' ? 'tag-due' : (task.tag === 'NEW' ? 'tag-new' : 'tag-onhold');

    card.innerHTML = `
        <div class="card-toggle"><i class="fas fa-chevron-left"></i></div>
        <span class="task-tag ${tagDisplay}">${task.tag}</span>
        <h3>${task.title}</h3>
        <div class="task-details">
            <div class="task-detail-item">
                <i class="far fa-calendar-alt"></i>
                <span>Due date: ${task.dueDate}</span>
            </div>
            <div class="task-detail-item">
                <i class="fas fa-user-circle"></i>
                <span>Assigned to: ${task.assignee}</span>
            </div>
        </div>
        <div class="task-footer">
            <div class="task-effort">
                <span>Effort</span>
                <div class="effort-dots">
                    <span class="effort-dot ${task.effort >= 1 ? 'active' : ''}"></span>
                    <span class="effort-dot ${task.effort >= 2 ? 'active' : ''}"></span>
                    <span class="effort-dot ${task.effort >= 3 ? 'active' : ''}"></span>
                </div>
            </div>
            <button class="open-btn"><i class="fas fa-external-link-alt"></i> Open</button>
        </div>
    `;

    return card;
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

// Event Listeners
function setupEventListeners() {
    addTaskBtn.addEventListener('click', () => {
        taskModal.style.display = 'block';
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
        
        const newTask = {
            id: Date.now().toString(),
            title: document.getElementById('taskTitle').value,
            tag: document.getElementById('taskTag').value || 'NEW',
            dueDate: document.getElementById('taskDueDate').value || new Date().toLocaleDateString(),
            assignee: document.getElementById('taskAssignee').value || 'Unassigned',
            effort: parseInt(document.getElementById('taskEffort').value) || 1,
            status: 'planned'
        };

        tasks.push(newTask);
        renderTasks();
        taskModal.style.display = 'none';
        addTaskForm.reset();
    });
}

// Start the app
initBoard();
