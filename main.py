from fastapi import FastAPI, Request, HTTPException
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from pydantic import BaseModel
from typing import List, Optional
import os
import json

app = FastAPI()

# Путь к файлу с задачами
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
TASKS_FILE = os.path.join(BASE_DIR, "tasks.json")

class Task(BaseModel):
    id: str
    title: str
    assignee: str
    startDate: str
    endDate: str
    priority: str
    comment: Optional[str] = ""
    status: str

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

# Подключаем статические файлы (CSS, JS)
app.mount("/static", StaticFiles(directory="static"), name="static")

# Настраиваем шаблоны с абсолютным путем
templates = Jinja2Templates(directory=os.path.join(BASE_DIR, "templates"))

@app.get("/", response_class=HTMLResponse)
async def read_item(request: Request):
    return templates.TemplateResponse(
        request=request, name="index.html"
    )

@app.get("/tasks")
async def get_tasks():
    tasks_data = load_tasks()
    print(f"Returning {len(tasks_data)} tasks")
    return tasks_data

@app.post("/tasks")
async def create_task(task: Task):
    print(f"Creating task: {task.id}")
    tasks_data = load_tasks()
    tasks_data.append(task.dict())
    save_tasks(tasks_data)
    return task

@app.put("/tasks/{task_id}")
async def update_task(task_id: str, updated_task: Task):
    print(f"Updating task: {task_id}")
    tasks_data = load_tasks()
    found = False
    for i, t in enumerate(tasks_data):
        if str(t.get("id")) == str(task_id):
            tasks_data[i] = updated_task.dict()
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

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8000)
