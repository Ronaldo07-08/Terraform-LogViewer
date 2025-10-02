const API_BASE_URL = 'http://localhost:8000';
let selectedFile = null;
let currentLogs = [];
let currentFilter = 'all';
let currentModalContent = '';

document.addEventListener('DOMContentLoaded', function() {
    console.log('Terraform LogViewer готов к работе!');

    initializeModal();
    initializeEventListeners();
});

function initializeEventListeners() {
    document.getElementById('fileInput').addEventListener('change', function(e) {
        selectedFile = e.target.files[0];
        if (selectedFile) {
            document.getElementById('fileInfo').innerHTML =
                `<strong>Выбран файл:</strong> ${selectedFile.name} (${(selectedFile.size / 1024).toFixed(2)} KB)`;
            document.getElementById('uploadBtn').disabled = false;
        }
    });

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
}

function initializeModal() {
    const modal = document.getElementById('modal');
    const closeBtn = document.querySelector('.close');
    const modalCloseBtn = document.getElementById('modal-close-btn');
    const modalCopyBtn = document.getElementById('modal-copy-btn');

    closeBtn.addEventListener('click', closeModal);
    modalCloseBtn.addEventListener('click', closeModal);

    modal.addEventListener('click', function(e) {
        if (e.target === modal) {
            closeModal();
        }
    });

    modalCopyBtn.addEventListener('click', function() {
        copyToClipboard(currentModalContent);
        const originalText = modalCopyBtn.textContent;
        modalCopyBtn.textContent = '✓ Скопировано!';
        setTimeout(() => {
            modalCopyBtn.textContent = originalText;
        }, 2000);
    });

    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape' && modal.style.display === 'block') {
            closeModal();
        }
    });
}

function openModal(title, content) {
    const modal = document.getElementById('modal');
    const modalTitle = document.getElementById('modal-title');
    const modalText = document.getElementById('modal-text');

    modalTitle.textContent = title;
    modalText.textContent = content;
    currentModalContent = content;

    modal.style.display = 'block';
    document.body.style.overflow = 'hidden';
}

function closeModal() {
    const modal = document.getElementById('modal');
    modal.style.display = 'none';
    document.body.style.overflow = '';
}

function copyToClipboard(text) {
    navigator.clipboard.writeText(text).then(() => {
        console.log('Текст скопирован: ', text);
    }).catch(err => {
        console.error('Ошибка копирования: ', err);
        const textArea = document.createElement('textarea');
        textArea.value = text;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
    });
}

async function uploadFile() {
    if (!selectedFile) {
        showResult('Пожалуйста, выберите файл', 'error');
        return;
    }

    const btn = document.getElementById('uploadBtn');
    const loader = document.getElementById('loader');

    btn.disabled = true;
    btn.style.display = 'none';
    loader.style.display = 'block';
    document.getElementById('result').innerHTML = '';

    try {
        const formData = new FormData();
        formData.append('file', selectedFile);

        console.log('Отправка файла на бэкенд...');

        const response = await fetch(API_BASE_URL + '/api/upload', {
            method: 'POST',
            body: formData
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`HTTP error! status: ${response.status}, details: ${errorText}`);
        }

        const result = await response.json();
        console.log('Получен ответ от бэкенда:', result);
        showSuccessResult(result);

    } catch (error) {
        console.error('Ошибка загрузки:', error);
        showResult(`Ошибка загрузки: ${error.message}`, 'error');
    } finally {
        loader.style.display = 'none';
        btn.disabled = false;
        btn.style.display = 'block';
    }
}

function renderLogTable(logs) {
    const tbody = document.getElementById('log-table-body');
    const tableContainer = document.getElementById('log-table');

    tbody.innerHTML = '';

    if (logs.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; padding: 20px; color: #666;">Нет данных для отображения</td></tr>';
    } else {
        logs.forEach(log => {
            const row = document.createElement('tr');
            row.className = `level-${log.level}`;

            const formattedTime = formatTimestamp(log.timestamp);
            const shortMessage = truncateMessage(log.message, 150);

            row.innerHTML = `
                <td>${log.line_number}</td>
                <td class="timestamp-cell clickable-cell"
                    onclick="openModal('Временная метка', '${escapeHtml(log.timestamp || 'Нет данных')}')"
                    title="Нажмите для просмотра полного времени">
                    ${formattedTime}
                </td>
                <td>
                    <span class="log-badge ${log.level}">${log.level.toUpperCase()}</span>
                </td>
                <td title="${log.resource_type || ''}">${log.resource_type || '-'}</td>
                <td>${log.section || '-'}</td>
                <td class="message-cell clickable-cell"
                    onclick="openModal('Сообщение', '${escapeHtml(log.message || 'Нет данных')}')"
                    title="Нажмите для просмотра полного сообщения">
                    <div class="message-content">${shortMessage}</div>
                </td>
                <td class="req-id-cell clickable-cell"
                    onclick="openModal('Request ID', '${escapeHtml(log.tf_req_id || 'Нет данных')}')"
                    title="Нажмите для просмотра полного Request ID">
                    ${log.tf_req_id || '-'}
                </td>
            `;

            tbody.appendChild(row);
        });
    }

    tableContainer.style.display = 'block';
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML.replace(/'/g, "\\'").replace(/"/g, '\\"');
}

function truncateMessage(message, maxLength) {
    if (!message) return '-';
    if (message.length <= maxLength) return escapeHtml(message);
    return escapeHtml(message.substring(0, maxLength)) + '...';
}

function formatTimestamp(timestamp) {
    if (!timestamp) return '-';
    try {
        const date = new Date(timestamp);

        if (isNaN(date.getTime())) {
            return timestamp;
        }

        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        const seconds = String(date.getSeconds()).padStart(2, '0');
        const milliseconds = String(date.getMilliseconds()).padStart(3, '0');

        return `${hours}:${minutes}:${seconds}.${milliseconds}`;

    } catch (e) {
        console.error('Ошибка форматирования времени:', e);
        return timestamp;
    }
}

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
        default:
            filteredLogs = currentLogs;
    }

    renderLogTable(filteredLogs);
}

function searchLogs() {
    const searchTerm = document.getElementById('search-input').value.toLowerCase().trim();

    if (!searchTerm) {
        filterLogs(currentFilter);
        return;
    }

    let filteredLogs = applyFilter(currentLogs, currentFilter);

    filteredLogs = filteredLogs.filter(log =>
        (log.searchable_text && log.searchable_text.toLowerCase().includes(searchTerm)) ||
        (log.message && log.message.toLowerCase().includes(searchTerm)) ||
        (log.raw_message && log.raw_message.toLowerCase().includes(searchTerm)) ||
        (log.resource_type && log.resource_type.toLowerCase().includes(searchTerm)) ||
        (log.level && log.level.toLowerCase().includes(searchTerm)) ||
        (log.section && log.section.toLowerCase().includes(searchTerm)) ||
        (log.tf_req_id && log.tf_req_id.toLowerCase().includes(searchTerm))
    );
    
    renderLogTable(filteredLogs);
}

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
        default:
            return logs;
    }
}

function showSuccessResult(data) {
    const resultDiv = document.getElementById('result');
    resultDiv.className = 'result success';
    
    currentLogs = data.logs || [];
    
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
        <p><strong>ID лога:</strong> ${data.log_id}</p>
        <p><strong>Статус:</strong> ${data.message}</p>
        ${statsHtml}
    `;
    
    currentFilter = 'all';
    const buttons = document.querySelectorAll('.filter-btn');
    buttons.forEach(btn => btn.classList.remove('active'));
    document.querySelector('.filter-btn').classList.add('active');
    
    document.getElementById('search-input').value = '';
    renderLogTable(currentLogs);
}

function showResult(message, type) {
    const resultDiv = document.getElementById('result');
    resultDiv.className = `result ${type}`;
    resultDiv.innerHTML = message;
}