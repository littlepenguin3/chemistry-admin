from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, Path, Query

from server.app.auth import AuthUser, require_roles
from server.app.domains.assessments.smart_assessment import submit_student_smart_assessment
from server.app.domains.student_legacy.reports import (
    create_legacy_smart_assessment_report,
    legacy_assessment_report_detail,
    legacy_assessment_report_list,
)
from server.app.domains.student_legacy.video_points import legacy_student_video_points
from server.app.student_legacy_schemas import LegacyAssessmentReportDetail, LegacyAssessmentReportListResponse, LegacyStudentVideoPointResponse
from server.app.student_smart_assessment_schemas import StudentSmartAssessmentSubmitRequest, StudentSmartAssessmentSubmitResponse


router = APIRouter(prefix="/api/student/legacy", tags=["student-legacy"])
StudentUser = Annotated[AuthUser, Depends(require_roles("student"))]


@router.get("/video-points", response_model=LegacyStudentVideoPointResponse)
def legacy_video_points(
    user: StudentUser,
    q: Annotated[str, Query(max_length=120)] = "",
    limit: Annotated[int, Query(ge=1, le=500)] = 200,
) -> LegacyStudentVideoPointResponse:
    return legacy_student_video_points(query=q, limit=limit)


@router.get("/reports", response_model=LegacyAssessmentReportListResponse)
def legacy_reports(user: StudentUser) -> LegacyAssessmentReportListResponse:
    return legacy_assessment_report_list(user)


@router.get("/reports/{report_id}", response_model=LegacyAssessmentReportDetail)
async def legacy_report_detail(
    report_id: Annotated[str, Path(min_length=1, max_length=120)],
    user: StudentUser,
) -> LegacyAssessmentReportDetail:
    return await legacy_assessment_report_detail(report_id, user)


@router.post("/smart-assessment/submit", response_model=StudentSmartAssessmentSubmitResponse)
async def legacy_submit_smart_assessment(
    payload: StudentSmartAssessmentSubmitRequest,
    user: StudentUser,
) -> StudentSmartAssessmentSubmitResponse:
    response = submit_student_smart_assessment(user, payload)
    response.assessment_report = await create_legacy_smart_assessment_report(user, response.report)
    return response
