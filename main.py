# Main entry point for the task tracker application
# This is a task tracker app
# Created for learning purposes
from fastapi import FastAPI, Request, HTTPException, UploadFile, File, Response, Depends
from fastapi.responses import HTMLResponse, FileResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from pydantic import BaseModel
from typing import List, Optional
import os
import json
import uuid
import shutil
from datetime import datetime

app = FastAPI()

# Пути к файлам
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
TASKS_FILE = os.path.join(BASE_DIR, "tasks.json")
STAGES_FILE = os.path.join(BASE_DIR, "stages.json")
USERS_FILE = os.path.join(BASE_DIR, "users.json")
UPLOAD_DIR = os.path.join(BASE_DIR, "uploads")

if not os.path.exists(UPLOAD_DIR):
    os.makedirs(UPLOAD_DIR)

class User(BaseModel):
    username: str
    displayName: str
    password: str

class LoginData(BaseModel):
    username: str
    password: str

class Stage(BaseModel):
    id: str
    name: str

class Message(BaseModel):
    id: str
    sender: str
    text: str
    timestamp: str

class TaskFile(BaseModel):
    id: str
    name: str
    path: str

class Task(BaseModel):
    id: str
    title: str
    assignee: str
    startDate: str
    endDate: str
    priority: str
    comment: Optional[str] = ""
    status: str
    archived: Optional[bool] = False
    totalTime: Optional[int] = 0  # в секундах
    timerStart: Optional[float] = None  # timestamp начала замера
    messages: Optional[List[Message]] = []
    files: Optional[List[TaskFile]] = []

def load_tasks():
    if not os.path.exists(TASKS_FILE):
        return []
    try:
        with open(TASKS_FILE, "r", encoding="utf-8") as f:
            content = f.read()
            if not content:
                return []
            data = json.loads(content)
            if not isinstance(data, list):
                return []
            return data
    except Exception as e:
        print(f"Error loading tasks: {e}")
        return []

def save_tasks(tasks_list):
    try:
        with open(TASKS_FILE, "w", encoding="utf-8") as f:
            json.dump(tasks_list, f, ensure_ascii=False, indent=4)
    except Exception as e:
        print(f"Error saving tasks: {e}")

def load_stages():
    if not os.path.exists(STAGES_FILE):
        default_stages = [
            {"id": "planned", "name": "К работе"},
            {"id": "in-progress", "name": "В работе"},
            {"id": "done", "name": "Готово"}
        ]
        save_stages(default_stages)
        return default_stages
    try:
        with open(STAGES_FILE, "r", encoding="utf-8") as f:
            content = f.read()
            if not content:
                return []
            return json.loads(content)
    except Exception as e:
        print(f"Error loading stages: {e}")
        return []

def save_stages(stages_list):
    try:
        with open(STAGES_FILE, "w", encoding="utf-8") as f:
            json.dump(stages_list, f, ensure_ascii=False, indent=4)
    except Exception as e:
        print(f"Error saving stages: {e}")

def load_users():
    if not os.path.exists(USERS_FILE):
        return []
    try:
        with open(USERS_FILE, "r", encoding="utf-8") as f:
            content = f.read()
            if not content:
                return []
            return json.loads(content)
    except Exception as e:
        print(f"Error loading users: {e}")
        return []

def save_users(users_list):
    try:
        with open(USERS_FILE, "w", encoding="utf-8") as f:
            json.dump(users_list, f, ensure_ascii=False, indent=4)
    except Exception as e:
        print(f"Error saving users: {e}")

async def get_current_user(request: Request):
    user_id = request.cookies.get("session_id")
    if not user_id:
        return None
    users = load_users()
    return next((u for u in users if u["username"] == user_id), None)

# Подключаем статические файлы (CSS, JS)
app.mount("/static", StaticFiles(directory="static"), name="static")
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")

# Настраиваем шаблоны с абсолютным путем
templates = Jinja2Templates(directory=os.path.join(BASE_DIR, "templates"))

@app.get("/", response_class=HTMLResponse)
async def read_item(request: Request):
    user = await get_current_user(request)
    if not user:
        return RedirectResponse(url="/login")
    return templates.TemplateResponse(
        request=request, name="index.html", context={"user": user}
    )

@app.get("/login", response_class=HTMLResponse)
async def login_page(request: Request):
    return templates.TemplateResponse(request=request, name="login.html")

@app.post("/login")
async def login(data: LoginData, response: Response):
    users = load_users()
    user = next((u for u in users if u["username"] == data.username and u["password"] == data.password), None)
    if not user:
        raise HTTPException(status_code=401, detail="Неверный логин или пароль")
    
    response.set_cookie(key="session_id", value=user["username"], httponly=True)
    return {"status": "success", "user": {"username": user["username"], "displayName": user.get("displayName", user["username"])}}

@app.post("/register")
async def register(user: User, response: Response):
    users = load_users()
    if any(u["username"] == user.username for u in users):
        raise HTTPException(status_code=400, detail="Пользователь с таким логином уже существует")
    
    users.append(user.model_dump())
    save_users(users)
    
    response.set_cookie(key="session_id", value=user.username, httponly=True)
    return {"status": "success", "user": {"username": user.username, "displayName": user.displayName}}

@app.post("/logout")
async def logout(response: Response):
    response.delete_cookie("session_id")
    return {"status": "success"}

@app.get("/me")
async def get_me(request: Request):
    user = await get_current_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return {"username": user["username"], "displayName": user.get("displayName", user["username"])}

@app.get("/tasks", response_model=List[Task])
async def get_tasks():
    tasks_data = load_tasks()
    print(f"Returning {len(tasks_data)} tasks")
    return tasks_data

@app.post("/tasks")
async def create_task(task: Task):
    print(f"Creating task: {task.id}")
    tasks_data = load_tasks()
    tasks_data.append(task.model_dump())
    save_tasks(tasks_data)
    return task

@app.put("/tasks/{task_id}")
async def update_task(task_id: str, updated_task: Task):
    print(f"Updating task: {task_id}")
    tasks_data = load_tasks()
    found = False
    for i, t in enumerate(tasks_data):
        if str(t.get("id")) == str(task_id):
            tasks_data[i] = updated_task.model_dump()
            found = True
            break
    
    if found:
        save_tasks(tasks_data)
        return updated_task
    
    print(f"Task {task_id} not found for update")
    raise HTTPException(status_code=404, detail="Task not found")

@app.delete("/tasks/{task_id}")
async def delete_task(task_id: str):
    print(f"Deleting task: {task_id}")
    tasks = load_tasks()
    new_tasks = [t for t in tasks if str(t["id"]) != str(task_id)]
    if len(new_tasks) == len(tasks):
        print(f"Task {task_id} not found for deletion")
        raise HTTPException(status_code=404, detail="Task not found")
    save_tasks(new_tasks)
    return {"status": "success"}

@app.get("/stages")
async def get_stages():
    return load_stages()

@app.post("/stages")
async def create_stage(stage: Stage):
    stages = load_stages()
    stages.append(stage.model_dump())
    save_stages(stages)
    return stage

@app.put("/stages/{stage_id}")
async def update_stage(stage_id: str, updated_stage: Stage):
    stages = load_stages()
    found = False
    for i, s in enumerate(stages):
        if s["id"] == stage_id:
            stages[i] = updated_stage.model_dump()
            found = True
            break
    if found:
        save_stages(stages)
        return updated_stage
    raise HTTPException(status_code=404, detail="Stage not found")

@app.delete("/stages/{stage_id}")
async def delete_stage(stage_id: str):
    stages = load_stages()
    new_stages = [s for s in stages if s["id"] != stage_id]
    if len(new_stages) == len(stages):
        raise HTTPException(status_code=404, detail="Stage not found")
    
    # Also update tasks that had this status to the first available status or a default one
    tasks = load_tasks()
    remaining_stage_id = new_stages[0]["id"] if new_stages else "planned"
    for t in tasks:
        if t["status"] == stage_id:
            t["status"] = remaining_stage_id
    save_tasks(tasks)
    
    save_stages(new_stages)
    return {"status": "success"}

# Эндпоинты для файлов
@app.post("/tasks/{task_id}/files")
async def upload_file(task_id: str, file: UploadFile = File(...)):
    tasks = load_tasks()
    task_index = next((i for i, t in enumerate(tasks) if str(t["id"]) == task_id), None)
    if task_index is None:
        raise HTTPException(status_code=404, detail="Task not found")
    
    file_id = str(uuid.uuid4())
    file_extension = os.path.splitext(file.filename)[1]
    file_name = f"{file_id}{file_extension}"
    file_path = os.path.join(UPLOAD_DIR, file_name)
    
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
    
    new_file = {
        "id": file_id,
        "name": file.filename,
        "path": f"/uploads/{file_name}"
    }
    
    if "files" not in tasks[task_index]:
        tasks[task_index]["files"] = []
    tasks[task_index]["files"].append(new_file)
    save_tasks(tasks)
    
    return new_file

@app.delete("/tasks/{task_id}/files/{file_id}")
async def delete_file(task_id: str, file_id: str):
    tasks = load_tasks()
    task_index = next((i for i, t in enumerate(tasks) if str(t["id"]) == task_id), None)
    if task_index is None:
        raise HTTPException(status_code=404, detail="Task not found")
    
    files = tasks[task_index].get("files", [])
    file_to_delete = next((f for f in files if f["id"] == file_id), None)
    if not file_to_delete:
        raise HTTPException(status_code=404, detail="File not found")
    
    # Удаляем физический файл
    file_path = os.path.join(BASE_DIR, file_to_delete["path"].lstrip("/"))
    if os.path.exists(file_path):
        os.remove(file_path)
    
    tasks[task_index]["files"] = [f for f in files if f["id"] != file_id]
    save_tasks(tasks)
    
    return {"status": "success"}

# Эндпоинты для чата
@app.post("/tasks/{task_id}/messages")
async def add_message(task_id: str, message: Message):
    tasks = load_tasks()
    task_index = next((i for i, t in enumerate(tasks) if str(t["id"]) == task_id), None)
    if task_index is None:
        raise HTTPException(status_code=404, detail="Task not found")
    
    if "messages" not in tasks[task_index]:
        tasks[task_index]["messages"] = []
    tasks[task_index]["messages"].append(message.model_dump())
    save_tasks(tasks)
    
    return message

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8000)
