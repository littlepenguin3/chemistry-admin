from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field


class CatalogNodeCreateRequest(BaseModel):
    chapter_id: str = Field(min_length=1)
    parent_id: str | None = None
    after_node_id: str | None = None
    node_kind: str = Field(default="directory", pattern="^(directory|point)$")
    title: str = Field(min_length=1, max_length=200)
    summary: str | None = None
    teacher_note: str | None = None
    student_description: str | None = None
    card_image_asset_id: str | None = None
    card_icon_key: str | None = Field(default=None, max_length=80)
    card_accent: str | None = Field(default=None, max_length=80)
    card_layout: str | None = Field(default="default", max_length=40)
    card_presentation: dict[str, Any] = Field(default_factory=dict)
    point_card_presentation: dict[str, Any] = Field(default_factory=dict)
    metadata: dict[str, Any] = Field(default_factory=dict)


class CatalogNodeUpdateRequest(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=200)
    summary: str | None = None
    node_kind: str | None = Field(default=None, pattern="^(directory|point)$")
    teacher_note: str | None = None
    student_description: str | None = None
    card_image_asset_id: str | None = None
    card_icon_key: str | None = Field(default=None, max_length=80)
    card_accent: str | None = Field(default=None, max_length=80)
    card_layout: str | None = Field(default=None, max_length=40)
    card_presentation: dict[str, Any] | None = None
    point_card_presentation: dict[str, Any] | None = None
    metadata: dict[str, Any] | None = None


class CatalogNodeMoveRequest(BaseModel):
    parent_id: str | None = None
    display_order: int | None = None


class CatalogNodeReorderItem(BaseModel):
    node_id: str = Field(min_length=1)
    display_order: int


class CatalogNodeReorderRequest(BaseModel):
    items: list[CatalogNodeReorderItem] = Field(default_factory=list)


class CatalogNodeStatusRequest(BaseModel):
    action: str = Field(pattern="^(archive|restore|publish|unpublish)$")
    include_subtree: bool = False


class CatalogPointContentRequest(BaseModel):
    point_title: str = Field(min_length=1, max_length=200)
    teacher_note: str | None = None
    principle_mode: str = Field(default="text", pattern="^(equation|text)$")
    principle_equation: str | None = None
    principle_text: str | None = None
    phenomenon_explanation: str | None = None
    safety_note: str | None = None
    metadata: dict[str, Any] = Field(default_factory=dict)


class CatalogPointPublicationRequest(BaseModel):
    action: str = Field(pattern="^(publish|unpublish|archive)$")


class CatalogPointMediaBindRequest(BaseModel):
    media_asset_id: str = Field(min_length=1)
    title: str | None = None
    status: str = Field(default="draft", pattern="^(draft|published)$")
    metadata: dict[str, Any] = Field(default_factory=dict)


class CatalogPointRelatedLinkRequest(BaseModel):
    target_node_id: str = Field(min_length=1)
    relation_type: str = Field(default="manual", pattern="^(manual|default_override|generated_default)$")
    hidden: bool = False
    sort_order: int = 0
    label: str | None = Field(default=None, max_length=200)
    metadata: dict[str, Any] = Field(default_factory=dict)


class CatalogPointRelatedLinksRequest(BaseModel):
    links: list[CatalogPointRelatedLinkRequest] = Field(default_factory=list)


class CatalogBreadcrumb(BaseModel):
    node_id: str
    title: str
    node_kind: str
    chapter_id: str


class CatalogNodeCard(BaseModel):
    node_id: str
    chapter_id: str
    parent_id: str | None = None
    node_kind: str
    title: str
    summary: str = ""
    status: str
    display_order: int = 0
    teacher_note: str | None = Field(default=None, exclude=True)
    student_description: str = ""
    card_image_asset_id: str | None = None
    card_icon_key: str | None = None
    card_accent: str | None = None
    card_layout: str = "default"
    card_presentation: dict[str, Any] = Field(default_factory=dict)
    point_card_presentation: dict[str, Any] = Field(default_factory=dict)
    actions: list[str] = Field(default_factory=list)
    has_children: bool = False
    descendant_point_count: int = 0
    has_point_content: bool = False
    media_count: int = 0
    published_media_count: int = 0
    validation: dict[str, Any] = Field(default_factory=dict)
    index_state: dict[str, Any] | None = None


class StudentCatalogChapterResponse(BaseModel):
    chapter_id: str
    chapter_title: str
    nodes: list[CatalogNodeCard] = Field(default_factory=list)


class StudentCatalogNodeResponse(BaseModel):
    node: CatalogNodeCard
    breadcrumbs: list[CatalogBreadcrumb] = Field(default_factory=list)
    children: list[CatalogNodeCard] = Field(default_factory=list)


class StudentPointVideo(BaseModel):
    media_id: str
    title: str
    mime_type: str | None = None
    stream_path: str | None = None
    thumbnail_path: str | None = None


class StudentRelatedPoint(BaseModel):
    node_id: str
    title: str
    relation_type: str | None = None
    source_node_id: str | None = None


class StudentPointAssessmentContext(BaseModel):
    point_node_id: str
    chapter_id: str
    source_node_id: str | None = None
    catalog_path: list[CatalogBreadcrumb] = Field(default_factory=list)


class StudentPointDetailResponse(BaseModel):
    node_id: str
    canonical_node_id: str
    source_node_id: str | None = None
    chapter_id: str
    title: str
    summary: str = ""
    point_card_presentation: dict[str, Any] = Field(default_factory=dict)
    breadcrumbs: list[CatalogBreadcrumb] = Field(default_factory=list)
    principle_mode: str = "text"
    principle_equation: str | None = None
    principle_text: str | None = None
    phenomenon_explanation: str | None = None
    safety_note: str | None = None
    videos: list[StudentPointVideo] = Field(default_factory=list)
    has_video: bool = False
    no_video_reason: str | None = None
    related_points: list[StudentRelatedPoint] = Field(default_factory=list)
    assessment_context: StudentPointAssessmentContext
