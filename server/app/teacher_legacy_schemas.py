from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field


class LegacyTeacherMetric(BaseModel):
    key: str
    label: str
    value: int | float | str
    unit: str = ""
    description: str = ""


class LegacyTeacherLoopStep(BaseModel):
    title: str
    description: str


class LegacyTeacherOverviewResponse(BaseModel):
    metrics: list[LegacyTeacherMetric]
    loop: list[LegacyTeacherLoopStep]
    resource_summary: dict[str, int | float | str]


class LegacyTeacherVideoResourceItem(BaseModel):
    node_id: str
    chapter_id: str | None = None
    title: str
    summary: str = ""
    catalog_path: list[str] = Field(default_factory=list)
    media_count: int = 0
    published_media_count: int = 0
    question_count: int = 0
    published_question_count: int = 0
    has_video: bool = False
    is_recommended: bool = False
    resource_status: str


class LegacyTeacherVideoResourcesResponse(BaseModel):
    total: int
    items: list[LegacyTeacherVideoResourceItem]


class LegacyTeacherQuestionResourceItem(BaseModel):
    node_id: str
    chapter_id: str | None = None
    node_kind: str
    title: str
    status: str
    breadcrumb_titles: list[str] = Field(default_factory=list)
    experiment_id: str | None = None
    question_count: int = 0
    published_count: int = 0
    draft_count: int = 0
    choice_count: int = 0
    true_false_count: int = 0
    fill_blank_count: int = 0
    media_count: int = 0
    published_media_count: int = 0
    point_count: int = 0


class LegacyTeacherQuestionResourcesResponse(BaseModel):
    total: int
    totals: dict[str, Any]
    items: list[LegacyTeacherQuestionResourceItem]


class LegacyTeacherClassSummary(BaseModel):
    id: str
    class_name: str
    description: str | None = None
    status: str
    student_count: int = 0
    active_students: int = 0
    completion_rate: float = 0
    average_score: float = 0
    missing_students: int = 0


class LegacyTeacherClassesResponse(BaseModel):
    classes: list[LegacyTeacherClassSummary]


class LegacyTeacherStudentAnalyticsRow(BaseModel):
    student_id: str
    student_name: str
    average_score: float = 0
    evidence_count: int = 0
    attempt_count: int = 0
    status: str = "not_started"


class LegacyTeacherAnalyticsResponse(BaseModel):
    class_id: str
    metrics: dict[str, Any]
    experiment_groups: list[dict[str, Any]] = Field(default_factory=list)
    students: list[LegacyTeacherStudentAnalyticsRow] = Field(default_factory=list)


class LegacyTeacherWeakPointItem(BaseModel):
    point_node_id: str | None = None
    point_key: str | None = None
    point_title: str
    experiment_id: str | None = None
    experiment_title: str | None = None
    attempt_count: int = 0
    incorrect_count: int = 0
    incorrect_rate: float = 0
    representative_questions: list[dict[str, str]] = Field(default_factory=list)


class LegacyTeacherWeakPointsResponse(BaseModel):
    items: list[LegacyTeacherWeakPointItem] = Field(default_factory=list)
    point_items: list[LegacyTeacherWeakPointItem] = Field(default_factory=list)
    total: int = 0
    point_total: int = 0


class LegacyTeacherEvaluationBand(BaseModel):
    label: str
    min_score: float | None = None
    max_score: float | None = None
    description: str


class LegacyTeacherEvaluationSystemResponse(BaseModel):
    evaluated_objects: list[str]
    evidence_sources: list[str]
    update_mechanism: str
    score_bands: list[LegacyTeacherEvaluationBand]
    outputs: list[str]
