from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from .parser.log_parser import TerraformLogParser
import uvicorn

# Создаем FastAPI приложение
app = FastAPI(title="Terraform LogViewer API", version="1.0.0")

# Настройка CORS для связи с фронтендом
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],  # URL React приложения
    allow_credentials=True,
    allow_methods=["*"],  # Разрешаем все HTTP методы
    allow_headers=["*"],  # Разрешаем все заголовки
)

# Создаем парсер (наш "мозг" для анализа логов)
parser = TerraformLogParser()

# Временное хранилище в памяти (для демо)
# В реальном проекте использовали бы базу данных
logs_storage = {}

@app.post("/api/upload")
async def upload_log_file(file: UploadFile = File(...)):
    """
    Эндпоинт для загрузки Terraform лог файла
    Принимает файл -> парсит -> возвращает структурированные данные
    """
    try:
        # Читаем содержимое файла
        content = await file.read()
        log_text = content.decode('utf-8')

        # Парсим лог с помощью нашего парсера
        parsed_data = parser.parse_log_file(log_text)

        # Сохраняем в временное хранилище
        log_id = f"log_{len(logs_storage) + 1}"
        logs_storage[log_id] = parsed_data

        return {
            "log_id": log_id,
            "message": "File parsed successfully",
            "summary": parsed_data["summary"],
            "sections": parsed_data["sections"]
        }

    except Exception as e:
        # Если что-то пошло не так - возвращаем ошибку
        raise HTTPException(status_code=500, detail=f"Error processing file: {str(e)}")


@app.get("/api/logs/{log_id}")
async def get_logs(log_id: str):
    """
    Эндпоинт для получения распарсенных логов по ID
    """
    if log_id not in logs_storage:
        raise HTTPException(status_code=404, detail="Log not found")

    return logs_storage[log_id]


@app.get("/health")
async def health_check():
    """
    Простой health-check для проверки работы сервера
    """
    return {"status": "healthy", "service": "Terraform LogViewer API"}


# Запуск сервера (для разработки)
if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)