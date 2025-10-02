from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from app.parser.log_parser import TerraformLogParser
import uvicorn
from typing import Optional
from fastapi import Query

app = FastAPI(title="Terraform LogViewer API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

parser = TerraformLogParser()
logs_storage = {}


@app.post("/api/upload")
async def upload_log_file(file: UploadFile = File(...)):
    try:
        print(f"Получен файл: {file.filename}")

        content = await file.read()
        log_text = content.decode('utf-8')

        print(f"Размер файла: {len(log_text)} символов")

        parsed_data = parser.parse_log_file(log_text)

        print(f"Парсинг завершен. Найдено строк: {len(parsed_data.get('logs', []))}")

        log_id = f"log_{len(logs_storage) + 1}"
        logs_storage[log_id] = parsed_data

        # ВАЖНО: Возвращаем logs в ответе
        return {
            "log_id": log_id,
            "message": "File parsed successfully",
            "summary": parsed_data.get("summary", {}),
            "logs": parsed_data.get("logs", [])  # ← ДОБАВЛЕНО!
        }

    except Exception as e:
        print(f"Ошибка при обработке файла: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error processing file: {str(e)}")


@app.get("/api/logs/{log_id}")
async def get_logs(log_id: str):
    if log_id not in logs_storage:
        raise HTTPException(status_code=404, detail="Log not found")
    return logs_storage[log_id]


@app.get("/api/logs/{log_id}/search")
async def search_logs(
        log_id: str,
        resource_type: Optional[str] = Query(None),
        level: Optional[str] = Query(None),
        section: Optional[str] = Query(None),
        time_from: Optional[str] = Query(None),
        time_to: Optional[str] = Query(None),
        search_text: Optional[str] = Query(None)
):
    if log_id not in logs_storage:
        raise HTTPException(status_code=404, detail="Log not found")

    logs_data = logs_storage[log_id].get("logs", [])
    filtered_logs = []

    for log in logs_data:
        if resource_type and log.get("resource_type") != resource_type:
            continue
        if level and log.get("level") != level:
            continue
        if section and log.get("section") != section:
            continue
        if time_from and log.get("timestamp") and log["timestamp"] < time_from:
            continue
        if time_to and log.get("timestamp") and log["timestamp"] > time_to:
            continue
        if search_text and search_text.lower() not in log.get("searchable_text", ""):
            continue
        filtered_logs.append(log)

    return {
        "logs": filtered_logs,
        "total_matches": len(filtered_logs),
        "filters_applied": {
            "resource_type": resource_type,
            "level": level,
            "section": section,
            "time_from": time_from,
            "time_to": time_to,
            "search_text": search_text
        }
    }


@app.patch("/api/logs/{log_id}/mark-read")
async def mark_log_as_read(log_id: str, log_entry_id: str):
    if log_id not in logs_storage:
        raise HTTPException(status_code=404, detail="Log not found")

    for log in logs_storage[log_id].get("logs", []):
        if log.get("id") == log_entry_id:
            log["is_read"] = True
            return {"status": "marked as read"}

    raise HTTPException(status_code=404, detail="Log entry not found")


@app.get("/health")
async def health_check():
    return {"status": "healthy", "service": "Terraform LogViewer API"}


if __name__ == "__main__":
    uvicorn.run("app.main:app", host="127.0.0.1", port=8000, reload=True)