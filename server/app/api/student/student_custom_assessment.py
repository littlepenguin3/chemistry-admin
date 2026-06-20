from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends

from server.app.auth import AuthUser, require_roles
from server.app.domains.assessments.smart_assessment import (
    get_student_custom_assessment_options,
    start_student_custom_assessment,
)
from server.app.student_smart_assessment_schemas import (
    StudentCustomAssessmentOptionsResponse,
    StudentCustomAssessmentStartRequest,
    StudentSmartAssessmentResponse,
)


router = APIRouter(prefix="/api/student", tags=["student-custom-assessment"])
StudentUser = Annotated[AuthUser, Depends(require_roles("student"))]


@router.get("/custom-assessment/options", response_model=StudentCustomAssessmentOptionsResponse)
async def custom_assessment_options(user: StudentUser) -> StudentCustomAssessmentOptionsResponse:
    return get_student_custom_assessment_options(user)


@router.post("/custom-assessment/start", response_model=StudentSmartAssessmentResponse)
async def start_custom_assessment(
    payload: StudentCustomAssessmentStartRequest,
    user: StudentUser,
) -> StudentSmartAssessmentResponse:
    return start_student_custom_assessment(user, payload)
