from __future__ import annotations


def is_student_visible_media(upload_status: str, binding_status: str) -> bool:
    return upload_status == "ready" and binding_status == "published"
