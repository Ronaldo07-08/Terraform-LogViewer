const API_BASE_URL = 'http://localhost:8000';

let selectedFile = null;

document.addEventListener('DOMContentLoaded', function() {
    initializeEventListeners();
});

function initializeEventListeners() {
    document.getElementById('fileInput').addEventListener('change', handleFileSelect);

    const uploadArea = document.querySelector('.upload-area');

    uploadArea.addEventListener('dragover', (e) => {
        e.preventDefault();
        uploadArea.style.background = '#e9ecef';
    });

    uploadArea.addEventListener('dragleave', () => {
        uploadArea.style.background = '';
    });

    uploadArea.addEventListener('drop', (e) => {
        e.preventDefault();
        uploadArea.style.background = '';

        const files = e.dataTransfer.files;
        if (files.length > 0) {
            document.getElementById('fileInput').files = files;
            selectedFile = files[0];
            updateFileInfo();
        }
    });
}

function handleFileSelect(event) {
    selectedFile = event.target.files[0];
    updateFileInfo();
}

function updateFileInfo() {
    const fileInfo = document.getElementById('fileInfo');
    if (selectedFile) {
        fileInfo.innerHTML =
            `<strong>Выбран файл:</strong> ${selectedFile.name} (${(selectedFile.size / 1024).toFixed(2)} KB)`;
        document.getElementById('uploadBtn').disabled = false;
    }
}

// Основная функция загрузки
async function uploadFile() {
    if (!selectedFile) {
        showResult('Пожалуйста, выберите файл', 'error');
        return;
    }

    const btn = document.getElementById('uploadBtn');
    const loader = document.getElementById('loader');
    
    // Показываем лоадер, скрываем кнопку
    btn.disabled = true;
    btn.style.display = 'none';
    loader.style.display = 'block';
    
    // Очищаем предыдущие результаты
    document.getElementById('result').innerHTML = '';

    try {
        // ТВОЙ СУЩЕСТВУЮЩИЙ КОД ДЛЯ ОТПРАВКИ НА БЭКЕНД
        const formData = new FormData();
        formData.append('file', selectedFile);

        const response = await fetch('http://localhost:8000/api/upload', {
            method: 'POST',
            body: formData
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const result = await response.json();
        showSuccessResult(result);

    } catch (error) {
        showResult(`Ошибка загрузки: ${error.message}`, 'error');
        console.error('Error:', error);
    } finally {
        // Восстанавливаем кнопку, скрываем лоадер
        btn.disabled = false;
        btn.style.display = 'block';
        loader.style.display = 'none';
    }
}

// Функции отображения результатов
function showSuccessResult(data) {
    const resultDiv = document.getElementById('result');
    resultDiv.className = 'result success';

    let statsHtml = '';
    if (data.summary) {
        statsHtml = `
            <div class="stats">
                <h4>📊 Статистика:</h4>
                <ul>
                    <li>Строк обработано: ${data.summary.total_lines || 0}</li>
                    <li>Ошибок: ${data.summary.error_count || 0}</li>
                    <li>Предупреждений: ${data.summary.warning_count || 0}</li>
                    <li>Уникальных запросов: ${data.summary.unique_requests || 0}</li>
                    <li>JSON блоков: ${data.summary.has_json_blocks ? 'Да' : 'Нет'}</li>
                </ul>
            </div>
        `;
    }

    resultDiv.innerHTML = `
        <h3>✅ Файл успешно обработан!</h3>
        <p><strong>ID:</strong> ${data.log_id}</p>
        <p><strong>Статус:</strong> ${data.message}</p>
        ${statsHtml}
        <button onclick="viewLogDetails('${data.log_id}')" style="margin-top: 10px;">
            📋 Посмотреть детали лога
        </button>
    `;
}

function showResult(message, type) {
    const resultDiv = document.getElementById('result');
    resultDiv.className = `result ${type}`;
    resultDiv.innerHTML = message;
}

// Дополнительные функции
async function viewLogDetails(logId) {
    try {
        const response = await fetch(`${API_BASE_URL}/api/logs/${logId}`);
        if (!response.ok) throw new Error('Failed to fetch log details');

        const logData = await response.json();
        showLogDetailsModal(logData);
    } catch (error) {
        showResult(`Ошибка загрузки деталей: ${error.message}`, 'error');
    }
}

function showLogDetailsModal(logData) {
    // Простой вывод в консоль для демонстрации
    console.log('Детали лога:', logData);
    alert(`Детали лога загружены! Проверьте консоль браузера.\n\nСекции: ${JSON.stringify(logData.sections)}\nВсего строк: ${logData.total_lines}`);
}