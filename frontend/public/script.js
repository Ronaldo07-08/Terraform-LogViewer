let selectedFile = null;
let currentLogs = []; // Храним все логи для фильтрации
let currentFilter = 'all'; // Текущий активный фильтр

// Обработчик выбора файла
document.getElementById('fileInput').addEventListener('change', function(e) {
    selectedFile = e.target.files[0];
    if (selectedFile) {
        document.getElementById('fileInfo').innerHTML = 
            `<strong>Выбран файл:</strong> ${selectedFile.name} (${(selectedFile.size / 1024).toFixed(2)} KB)`;
        document.getElementById('uploadBtn').disabled = false;
    }
});

// Функция загрузки файла на бэкенд
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
    document.getElementById('result').innerHTML = '';

    try {
        const formData = new FormData();
        formData.append('file', selectedFile);

        // Отправляем файл на бэкенд
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
        // Всегда скрываем лоадер и показываем кнопку
        loader.style.display = 'none';
        btn.disabled = false;
        btn.style.display = 'block';
    }
}

// Функция для отображения таблицы логов
function renderLogTable(logs) {
    const tbody = document.getElementById('log-table-body');
    const tableContainer = document.getElementById('log-table');
    
    tbody.innerHTML = '';
    
    logs.forEach(log => {
        const row = document.createElement('tr');
        row.className = `level-${log.level}`;
        
        // Форматируем timestamp для лучшего отображения
        const formattedTime = formatTimestamp(log.timestamp);
        
        row.innerHTML = `
            <td title="${log.timestamp}">${formattedTime}</td>
            <td>
                <span class="log-badge ${log.level}">${log.level.toUpperCase()}</span>
            </td>
            <td title="${log.resource_type || ''}">${log.resource_type || '-'}</td>
            <td>${log.section || '-'}</td>
            <td title="${log.raw_message}">${log.message}</td>
            <td>${log.tf_req_id || '-'}</td>
        `;
        
        tbody.appendChild(row);
    });
    
    // Показываем таблицу
    tableContainer.style.display = 'block';
    
    // Обновляем счетчик отфильтрованных строк
    updateFilterCounter(logs.length);
}

// Форматирование временной метки
function formatTimestamp(timestamp) {
    try {
        const date = new Date(timestamp);
        return date.toLocaleTimeString() + ' ' + date.toLocaleDateString();
    } catch (e) {
        return timestamp;
    }
}

// Функция фильтрации логов
function filterLogs(filterType) {
    const buttons = document.querySelectorAll('.filter-btn');
    buttons.forEach(btn => btn.classList.remove('active'));
    event.target.classList.add('active');
    
    currentFilter = filterType;
    
    let filteredLogs = [];
    
    switch(filterType) {
        case 'all':
            filteredLogs = currentLogs;
            break;
        case 'error':
            filteredLogs = currentLogs.filter(log => log.level === 'error');
            break;
        case 'warning':
            filteredLogs = currentLogs.filter(log => log.level === 'warning');
            break;
        case 'info':
            filteredLogs = currentLogs.filter(log => log.level === 'info');
            break;
        case 'debug':
            filteredLogs = currentLogs.filter(log => log.level === 'debug');
            break;
        case 'trace':
            filteredLogs = currentLogs.filter(log => log.level === 'trace');
            break;
        case 'resource':
            filteredLogs = currentLogs.filter(log => log.resource_type && log.resource_type !== '-');
            break;
        default:
            filteredLogs = currentLogs;
    }
    
    renderLogTable(filteredLogs);
}

// Функция обновления счетчика отфильтрованных строк
function updateFilterCounter(count) {
    const filterCounter = document.getElementById('filter-counter') || createFilterCounter();
    filterCounter.textContent = `Показано: ${count} из ${currentLogs.length} строк`;
}

// Создание элемента счетчика
function createFilterCounter() {
    const counter = document.createElement('div');
    counter.id = 'filter-counter';
    counter.style.cssText = 'margin: 10px 0; padding: 8px 15px; background: #e3f2fd; border-radius: 20px; font-size: 14px; color: #1976d2; display: inline-block;';
    
    const filterContainer = document.querySelector('#log-table h4');
    filterContainer.parentNode.insertBefore(counter, filterContainer.nextSibling);
    
    return counter;
}

// Функция поиска по логам
function searchLogs() {
    const searchTerm = document.getElementById('search-input').value.toLowerCase().trim();
    
    if (!searchTerm) {
        // Если поиск пустой, возвращаем текущий активный фильтр
        applyCurrentFilter();
        return;
    }
    
    // Сначала применяем текущий фильтр, затем поиск
    let filteredLogs = applyFilter(currentLogs, currentFilter);
    
    // Затем применяем поиск
    filteredLogs = filteredLogs.filter(log => 
        log.searchable_text.toLowerCase().includes(searchTerm) ||
        log.message.toLowerCase().includes(searchTerm) ||
        (log.resource_type && log.resource_type.toLowerCase().includes(searchTerm)) ||
        log.level.toLowerCase().includes(searchTerm) ||
        log.section.toLowerCase().includes(searchTerm) ||
        (log.tf_req_id && log.tf_req_id.toLowerCase().includes(searchTerm))
    );
    
    renderLogTable(filteredLogs);
}

// Функция применения текущего фильтра
function applyCurrentFilter() {
    const filteredLogs = applyFilter(currentLogs, currentFilter);
    renderLogTable(filteredLogs);
}

// Вспомогательная функция для применения фильтра
function applyFilter(logs, filterType) {
    switch(filterType) {
        case 'all':
            return logs;
        case 'error':
            return logs.filter(log => log.level === 'error');
        case 'warning':
            return logs.filter(log => log.level === 'warning');
        case 'info':
            return logs.filter(log => log.level === 'info');
        case 'debug':
            return logs.filter(log => log.level === 'debug');
        case 'trace':
            return logs.filter(log => log.level === 'trace');
        case 'resource':
            return logs.filter(log => log.resource_type && log.resource_type !== '-');
        default:
            return logs;
    }
}

// Функция показа успешного результата
function showSuccessResult(data) {
    const resultDiv = document.getElementById('result');
    resultDiv.className = 'result success';
    
    // Сохраняем логи для фильтрации
    currentLogs = data.logs || [];
    
    // Статистика из нового формата
    const summary = data.summary || {};
    const levels = summary.levels || {};
    
    const statsHtml = `
        <div class="stats">
            <div class="stat-card">
                <div class="stat-number">${summary.total_lines || 0}</div>
                <div>Всего строк</div>
            </div>
            <div class="stat-card success">
                <div class="stat-number">${levels.info || 0}</div>
                <div>Инфо</div>
            </div>
            <div class="stat-card warning">
                <div class="stat-number">${levels.warning || 0}</div>
                <div>Предупреждений</div>
            </div>
            <div class="stat-card error">
                <div class="stat-number">${levels.error || 0}</div>
                <div>Ошибок</div>
            </div>
            <div class="stat-card">
                <div class="stat-number">${summary.unique_requests || 0}</div>
                <div>Запросов</div>
            </div>
        </div>
    `;

    resultDiv.innerHTML = `
        <h3>✅ Файл успешно обработан!</h3>
        <p><strong>Статус:</strong> Данные получены от бэкенда</p>
        ${statsHtml}
    `;
    
    // Сбрасываем фильтр на "все" при новой загрузке
    currentFilter = 'all';
    const buttons = document.querySelectorAll('.filter-btn');
    buttons.forEach(btn => btn.classList.remove('active'));
    document.querySelector('.filter-btn').classList.add('active');
    
    // Очищаем поле поиска
    document.getElementById('search-input').value = '';
    
    // Показываем таблицу с логами
    renderLogTable(currentLogs);
}

// Функция показа сообщения
function showResult(message, type) {
    const resultDiv = document.getElementById('result');
    resultDiv.className = `result ${type}`;
    resultDiv.innerHTML = message;
}

// Drag and drop поддержка
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
        document.getElementById('fileInfo').innerHTML = 
            `<strong>Выбран файл:</strong> ${selectedFile.name} (${(selectedFile.size / 1024).toFixed(2)} KB)`;
        document.getElementById('uploadBtn').disabled = false;
    }
});

// Автозапуск при загрузке страницы
document.addEventListener('DOMContentLoaded', function() {
    console.log('Terraform LogViewer готов к работе!');
    console.log('Бэкенд API: http://localhost:8000/api/upload');
});