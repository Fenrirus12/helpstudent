from __future__ import annotations

import base64
import secrets
from pathlib import Path

from .config import Settings
from .storage import Storage


MAX_CHAT_ATTACHMENTS = 10
MAX_CHAT_ATTACHMENTS_SIZE = 25 * 1024 * 1024


class ChatService:
    def __init__(self, settings: Settings, storage: Storage) -> None:
        self.settings = settings
        self.storage = storage

    def store_attachment(self, payload: dict) -> dict:
        filename = str(payload.get("name", "file")).strip() or "file"
        content_type = str(payload.get("contentType", "application/octet-stream")).strip() or "application/octet-stream"
        content_base64 = str(payload.get("contentBase64", ""))
        raw_bytes = base64.b64decode(content_base64.encode("utf-8"), validate=True)
        if len(raw_bytes) > self.settings.max_attachment_size:
            raise ValueError("Файл слишком большой.")
        suffix = Path(filename).suffix or ""
        stored_name = f"{secrets.token_hex(12)}{suffix}"
        stored_path = self.settings.uploads_dir / stored_name
        stored_path.write_bytes(raw_bytes)
        return {
            "name": filename,
            "contentType": content_type,
            "path": f"/uploads/{stored_name}",
            "size": len(raw_bytes),
        }

    def create_message(self, user_id: int, sender: str, text: str, attachment_payload: dict | list[dict] | None = None) -> dict:
        if isinstance(attachment_payload, dict):
            payloads = [attachment_payload] if attachment_payload.get("contentBase64") else []
        elif isinstance(attachment_payload, list):
            payloads = attachment_payload
        else:
            payloads = []
        if len(payloads) > MAX_CHAT_ATTACHMENTS:
            raise ValueError("Можно приложить не больше 10 файлов.")
        if any(not isinstance(item, dict) or not isinstance(item.get("contentBase64"), str) for item in payloads):
            raise ValueError("Не удалось прочитать один из прикреплённых файлов.")
        encoded_limit = ((MAX_CHAT_ATTACHMENTS_SIZE + 2) // 3) * 4
        if sum(len(item["contentBase64"]) for item in payloads) > encoded_limit:
            raise ValueError("Общий размер файлов не должен превышать 25 МБ.")
        stored: list[dict] = []
        try:
            for payload in payloads:
                stored.append(self.store_attachment(payload))
            if sum(item["size"] for item in stored) > MAX_CHAT_ATTACHMENTS_SIZE:
                raise ValueError("Общий размер файлов не должен превышать 25 МБ.")
            return self.storage.create_message(user_id, sender, text, stored)
        except Exception:
            self._remove_unreferenced_attachments(stored)
            raise

    def delete_message(self, message_id: int, user_id: int, sender: str | None = None) -> dict | None:
        deleted = self.storage.delete_message(message_id, user_id, sender)
        if deleted is not None:
            self._remove_unreferenced_attachments(deleted.get("attachments", []))
        return deleted

    def _remove_unreferenced_attachments(self, attachments: list[dict]) -> None:
        uploads_root = self.settings.uploads_dir.resolve()
        for attachment in attachments:
            path = str(attachment.get("path", ""))
            if not path.startswith("/uploads/") or self.storage.attachment_is_referenced(path):
                continue
            stored_name = Path(path).name
            stored_path = (self.settings.uploads_dir / stored_name).resolve()
            if stored_path.parent == uploads_root and stored_path.exists():
                stored_path.unlink()

    def get_user_messages(self, user_id: int) -> list[dict]:
        return self.storage.list_user_messages(user_id)

    def mark_messages_read(self, user_id: int, reader: str) -> None:
        self.storage.mark_messages_read(user_id, reader)

    def get_admin_chats(self) -> list[dict]:
        return self.storage.list_admin_chats()
