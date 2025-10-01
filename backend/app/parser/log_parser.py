import json
import re
import uuid
from typing import Dict, List, Optional, Any


class TerraformLogParser:
    def __init__(self):
        self.plan_section = False
        self.apply_section = False

    def parse_log_file(self, log_text: str) -> Dict[str, Any]:
        """
        Парсит JSON логи Terraform и структурирует данные для фронтенда
        """
        lines = log_text.split('\n')
        parsed_logs = []

        for line_number, line in enumerate(lines, 1):
            if not line.strip():
                continue

            parsed_line = self._parse_json_line(line, line_number)
            if parsed_line:
                parsed_logs.append(parsed_line)

        return {
            "logs": parsed_logs,
            "summary": self._generate_summary(parsed_logs)
        }

    def _parse_json_line(self, line: str, line_number: int) -> Optional[Dict[str, Any]]:
        """
        Парсит одну строку JSON лога
        """
        try:
            # Парсим JSON
            json_data = json.loads(line)

            # Извлекаем основные поля
            level = json_data.get('@level', 'info')
            message = json_data.get('@message', '')
            timestamp = json_data.get('@timestamp', '')

            # Определяем секцию
            self._detect_section(message)

            # Извлекаем дополнительные метаданные
            tf_req_id = self._extract_tf_req_id(json_data, message)
            resource_type = self._extract_resource_type(message)

            # Создаем поисковый индекс
            searchable_text = self._create_searchable_text(json_data, message)

            return {
                "id": str(uuid.uuid4()),
                "line_number": line_number,
                "timestamp": timestamp,
                "level": level,
                "message": message,
                "raw_message": line,
                "section": self._get_current_section(),
                "tf_req_id": tf_req_id,
                "resource_type": resource_type,
                "json_data": json_data,
                "searchable_text": searchable_text,
                "is_read": False  # для функции "пометить как прочитанное"
            }

        except json.JSONDecodeError:
            # Если не JSON, парсим как plain text
            return self._parse_plain_text_line(line, line_number)

    def _detect_section(self, message: str):
        """
        Определяет секцию plan/apply на основе сообщения
        """
        message_lower = message.lower()

        if any(phrase in message_lower for phrase in ['terraform plan', 'running plan', 'plan:']):
            self.plan_section = True
            self.apply_section = False
        elif any(phrase in message_lower for phrase in ['terraform apply', 'running apply', 'apply:']):
            self.apply_section = True
            self.plan_section = False

    def _get_current_section(self) -> str:
        if self.plan_section:
            return "plan"
        elif self.apply_section:
            return "apply"
        else:
            return "general"

    def _extract_tf_req_id(self, json_data: Dict, message: str) -> Optional[str]:
        """
        Извлекает tf_req_id из JSON данных или сообщения
        """
        # Ищем в полях JSON
        for key in json_data:
            if 'req_id' in key.lower() or 'request_id' in key.lower():
                return json_data[key]

        # Ищем в сообщении с помощью regex
        patterns = [
            r'tf_req_id[=:"\s]+([^",\s]+)',
            r'req_id[=:"\s]+([^",\s]+)',
            r'request_id[=:"\s]+([^",\s]+)'
        ]

        for pattern in patterns:
            match = re.search(pattern, message, re.IGNORECASE)
            if match:
                return match.group(1)

        return None

    def _extract_resource_type(self, message: str) -> Optional[str]:
        """
        Извлекает тип ресурса из сообщения
        """
        # Ищем паттерны типа ресурсов Terraform
        patterns = [
            r'(\*?terraform\.\w+)',
            r'(\w+\.\w+\.\w+)',  # aws_instance.web
            r'resource[ "\']+([^"\'\s]+)'  # resource "aws_instance" ...
        ]

        for pattern in patterns:
            match = re.search(pattern, message)
            if match:
                return match.group(1)

        return None

    def _create_searchable_text(self, json_data: Dict, message: str) -> str:
        """
        Создает текст для полнотекстового поиска
        """
        search_parts = []

        # Добавляем все строковые поля из JSON
        for key, value in json_data.items():
            if isinstance(value, str):
                search_parts.append(value)
            elif isinstance(value, (int, float)):
                search_parts.append(str(value))

        # Добавляем обработанное сообщение (без спецсимволов)
        clean_message = re.sub(r'[^\w\s]', ' ', message)
        search_parts.append(clean_message)

        return ' '.join(search_parts).lower()

    def _parse_plain_text_line(self, line: str, line_number: int) -> Dict[str, Any]:
        """
        Парсит не-JSON строки (fallback)
        """
        self._detect_section(line)

        return {
            "id": str(uuid.uuid4()),
            "line_number": line_number,
            "timestamp": None,
            "level": "info",
            "message": line,
            "raw_message": line,
            "section": self._get_current_section(),
            "tf_req_id": None,
            "resource_type": None,
            "json_data": {"raw": line},
            "searchable_text": line.lower(),
            "is_read": False
        }

    def _generate_summary(self, logs: List[Dict]) -> Dict[str, Any]:
        """
        Генерирует сводку для фронтенда
        """
        levels = {}
        sections = {}
        unique_requests = set()

        for log in logs:
            # Статистика по уровням
            level = log.get('level', 'info')
            levels[level] = levels.get(level, 0) + 1

            # Статистика по секциям
            section = log.get('section', 'general')
            sections[section] = sections.get(section, 0) + 1

            # Уникальные request ID
            tf_req_id = log.get('tf_req_id')
            if tf_req_id:
                unique_requests.add(tf_req_id)

        return {
            "total_lines": len(logs),
            "levels": levels,
            "sections": sections,
            "unique_requests": len(unique_requests)
        }