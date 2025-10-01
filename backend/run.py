import sys
import os

# Добавляем текущую директорию в Python path
sys.path.append(os.path.dirname(__file__))

from app.main import app
import uvicorn

if __name__ == "__main__":
    uvicorn.run("app.main:app", host="127.0.0.1", port=8000, reload=True)