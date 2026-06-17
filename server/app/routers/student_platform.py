from __future__ import annotations

from typing import Annotated, Any

from fastapi import APIRouter, Depends, HTTPException, status

from server.app.auth import AuthUser, require_roles
from server.app.feedback import create_feedback_record
from server.app.platform_settings import get_ai_configuration_response, get_learning_behavior_settings
from server.app.schemas import FeedbackItem, FeedbackSubmitRequest
from server.app.student_app_schemas import (
    StudentAppConfigResponse,
    StudentAppFeatureFlags,
    StudentFeedbackSubmitRequest,
)


router = APIRouter(prefix="/api/student", tags=["student-platform"])
StudentUser = Annotated[AuthUser, Depends(require_roles("student"))]


def _student_identifier(user: AuthUser) -> str:
    return str(user.student_id or user.username).strip().upper()


@router.get("/app-config", response_model=StudentAppConfigResponse)
def student_app_config(user: StudentUser) -> StudentAppConfigResponse:
    learning = get_learning_behavior_settings()
    ai_config = get_ai_configuration_response(can_edit=False, auto_check=False)
    return StudentAppConfigResponse(
        features=StudentAppFeatureFlags(
            ai_assistant_enabled=learning.learning_features.ai_assistant_enabled,
            feedback_enabled=learning.learning_features.feedback_enabled,
            student_ai_assistant_enabled=ai_config.enabled_features.student_ai_assistant,
            rag_access_enabled=ai_config.enabled_features.rag_access_enabled,
        )
    )


@router.post("/feedback", response_model=FeedbackItem)
def submit_student_feedback(payload: StudentFeedbackSubmitRequest, user: StudentUser) -> dict[str, Any]:
    learning = get_learning_behavior_settings()
    if not learning.learning_features.feedback_enabled:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="学生反馈入口已关闭")

    metadata = dict(payload.metadata or {})
    metadata.update(
        {
            "point_key": payload.point_key,
            "client_student_id_ignored": metadata.get("student_id"),
            "client_class_id_ignored": metadata.get("class_id"),
        }
    )
    metadata.pop("student_id", None)
    metadata.pop("class_id", None)
    feedback = FeedbackSubmitRequest(
        student_id=_student_identifier(user),
        class_id=user.class_id,
        feedback_type=payload.feedback_type,
        content=payload.content,
        chapter_id=payload.chapter_id,
        unit_id=payload.unit_id,
        knowledge_point_id=payload.knowledge_point_id,
        experiment_id=payload.experiment_id,
        page_path=payload.page_path,
        metadata={key: value for key, value in metadata.items() if value is not None},
    )
    return create_feedback_record(feedback)
