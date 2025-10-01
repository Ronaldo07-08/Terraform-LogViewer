import re
import json
from typing import Dict, List, Optional, Any


class TerraformLogParser:

    def __init__(self):
        self.plan_section = False
        self.apply_section = False

    def parse_log_file(self, log_text: str) -> Dict[str, Any]:
        lines = log_text.split('\n')
        parsed_logs = []

        print(f"Начинаем парсинг {len(lines)} строк...")  # Для отладки

        for line_number, line in enumerate(lines, 1):
            parsed_line = self._parse_single_line(line, line_number)
            if parsed_line:
                parsed_logs.append(parsed_line)

        # Анализируем распарсенные данные
        sections = self._analyze_sections(parsed_logs)
        summary = self._generate_summary(parsed_logs)

        return {
            "logs": parsed_logs,
            "sections": sections,
            "summary": summary,
            "total_lines": len(parsed_logs)
        }

    def _parse_single_line(self, line: str, line_number: int) -> Optional[Dict[str, Any]]:
        if not line.strip():  # Пропускаем пустые строки
            return None

        # Определяем секцию (plan/apply)
        self._detect_section(line)

        timestamp = self._extract_timestamp(line)
        log_level = self._extract_log_level(line)
        tf_req_id = self._extract_tf_req_id(line)
        json_blocks = self._extract_json_blocks(line)

        return {
            "line_number": line_number,
            "raw_text": line,
            "timestamp": timestamp,
            "level": log_level,
            "tf_req_id": tf_req_id,
            "json_blocks": json_blocks,
            "section": self._get_current_section(),
            "has_error": "error" in log_level.lower()
        }

    def _detect_section(self, line: str):
        line_lower = line.lower()

        if 'terraform plan' in line_lower or 'running plan' in line_lower:
            self.plan_section = True
            self.apply_section = False
        elif 'terraform apply' in line_lower or 'running apply' in line_lower:
            self.apply_section = True
            self.plan_section = False
        elif 'apply complete' in line_lower or 'plan complete' in line_lower:
            self.plan_section = False
            self.apply_section = False

    def _get_current_section(self) -> str:
        if self.plan_section:
            return "plan"
        elif self.apply_section:
            return "apply"
        else:
            return "general"

    def _extract_timestamp(self, line: str) -> Optional[str]:
        """
        Эвристическое извлечение временной метки
        """
        timestamp_patterns = [
            r'\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}',  # 2024-01-15T10:30:25 или 2024-01-15 10:30:25
            r'\d{2}:\d{2}:\d{2}',  # 10:30:25
            r'\[\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\]',  # [2024-01-15 10:30:25]
        ]

        for pattern in timestamp_patterns:
            match = re.search(pattern, line)
            if match:
                return match.group()
        return None

    def _extract_log_level(self, line: str) -> str:
        """
        Эвристическое определение уровня логирования
        """
        line_lower = line.lower()

        if any(word in line_lower for word in ['error', 'err:', 'failed', 'failure']):
            return 'error'
        elif any(word in line_lower for word in ['warning', 'warn:', 'deprecated']):
            return 'warning'
        elif any(word in line_lower for word in ['info', 'information']):
            return 'info'
        elif any(word in line_lower for word in ['debug', 'trace']):
            return 'debug'
        else:
            return 'info'  # Уровень по умолчанию

    def _extract_tf_req_id(self, line: str) -> Optional[str]:
        """
        Извлечение tf_req_id для группировки запросов
        """
        patterns = [
            r'tf_req_id[=:"\s]+([^",\s]+)',
            r'req_id[=:"\s]+([^",\s]+)',
            r'request_id[=:"\s]+([^",\s]+)'
        ]

        for pattern in patterns:
            match = re.search(pattern, line, re.IGNORECASE)
            if match:
                return match.group(1)
        return None

    def _extract_json_blocks(self, line: str) -> List[Dict]:
        """
        Извлечение JSON блоков из полей tf_http_req_body и tf_http_res_body
        """
        json_blocks = []

        # Ищем JSON-like структуры
        json_patterns = [
            r'\{[^{}]*"[^"]*"[^{}]*\}',  # Простые JSON объекты
            r'tf_http_req_body[^{]*({[^}]+})',
            r'tf_http_res_body[^{]*({[^}]+})'
        ]

        for pattern in json_patterns:
            matches = re.findall(pattern, line)
            for match in matches:
                try:
                    # Пытаемся распарсить JSON
                    json_data = json.loads(match)
                    json_blocks.append({
                        "raw": match,
                        "parsed": json_data,
                        "size": len(match)
                    })
                except json.JSONDecodeError:
                    # Если не валидный JSON, сохраняем как сырой текст
                    json_blocks.append({
                        "raw": match,
                        "parsed": None,
                        "size": len(match)
                    })

        return json_blocks

    def _analyze_sections(self, logs: List[Dict]) -> Dict[str, Any]:
        """
        Анализ секций лога
        """
        section_lines = {"plan": 0, "apply": 0, "general": 0}

        for log in logs:
            section = log.get("section", "general")
            if section in section_lines:
                section_lines[section] += 1

        return {
            "counts": section_lines,
            "has_plan": section_lines["plan"] > 0,
            "has_apply": section_lines["apply"] > 0
        }

    def _generate_summary(self, logs: List[Dict]) -> Dict[str, Any]:
        """
        Генерация сводки по логам
        """
        error_count = sum(1 for log in logs if log.get("has_error"))
        warning_count = sum(1 for log in logs if log.get("level") == "warning")
        unique_req_ids = len(set(log.get("tf_req_id") for log in logs if log.get("tf_req_id")))

        return {
            "total_lines": len(logs),
            "error_count": error_count,
            "warning_count": warning_count,
            "unique_requests": unique_req_ids,
            "has_json_blocks": any(log.get("json_blocks") for log in logs)
        }