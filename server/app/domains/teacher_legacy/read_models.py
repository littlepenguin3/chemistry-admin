from __future__ import annotations

from typing import Any

from server.app.domains.analytics.read_models import get_class_dashboard, get_class_weak_points
from server.app.domains.questions.bank import list_catalog_question_bank, list_question_banks
from server.app.domains.roster.classes import list_classes
from server.app.domains.student_legacy.video_points import legacy_student_video_points
from server.app.teacher_legacy_schemas import (
    LegacyTeacherAnalyticsResponse,
    LegacyTeacherClassSummary,
    LegacyTeacherClassesResponse,
    LegacyTeacherEvaluationBand,
    LegacyTeacherEvaluationSystemResponse,
    LegacyTeacherLoopStep,
    LegacyTeacherMetric,
    LegacyTeacherOverviewResponse,
    LegacyTeacherQuestionResourceItem,
    LegacyTeacherQuestionResourcesResponse,
    LegacyTeacherStudentAnalyticsRow,
    LegacyTeacherVideoResourceItem,
    LegacyTeacherVideoResourcesResponse,
    LegacyTeacherWeakPointItem,
    LegacyTeacherWeakPointsResponse,
)


def _as_int(value: Any) -> int:
    try:
        return int(value or 0)
    except (TypeError, ValueError):
        return 0


def _as_float(value: Any) -> float:
    try:
        return float(value or 0)
    except (TypeError, ValueError):
        return 0


def _clean(value: Any) -> str:
    return str(value or "").strip()


def _catalog_question_bank_all() -> dict[str, Any]:
    first_payload = list_catalog_question_bank()
    chapters = first_payload.get("chapters") if isinstance(first_payload.get("chapters"), list) else []
    if not chapters:
        return first_payload
    items: list[dict[str, Any]] = []
    seen: set[str] = set()
    totals: dict[str, Any] = {}
    for chapter in chapters:
        chapter_id = _clean(chapter.get("chapter_id"))
        if not chapter_id:
            continue
        payload = list_catalog_question_bank(chapter_id=chapter_id)
        for item in payload.get("items") or []:
            node_id = _clean(item.get("node_id"))
            if node_id and node_id not in seen:
                seen.add(node_id)
                items.append(item)
    point_items = [item for item in items if item.get("node_kind") == "point"]
    totals = {
        "question_count": sum(_as_int((item.get("counts") or {}).get("question_count")) for item in point_items),
        "published_count": sum(_as_int((item.get("counts") or {}).get("published_count")) for item in point_items),
        "draft_count": sum(_as_int((item.get("counts") or {}).get("draft_count")) for item in point_items),
        "disabled_count": sum(_as_int((item.get("counts") or {}).get("disabled_count")) for item in point_items),
        "choice_count": sum(_as_int((item.get("counts") or {}).get("choice_count")) for item in point_items),
        "true_false_count": sum(_as_int((item.get("counts") or {}).get("true_false_count")) for item in point_items),
        "fill_blank_count": sum(_as_int((item.get("counts") or {}).get("fill_blank_count")) for item in point_items),
        "point_count": len(point_items),
        "directory_count": len(items) - len(point_items),
    }
    return {"chapters": chapters, "items": items, "total": len(items), "totals": totals}


def _question_counts_by_node() -> dict[str, dict[str, int]]:
    payload = _catalog_question_bank_all()
    counts_by_node: dict[str, dict[str, int]] = {}
    for item in payload.get("items") or []:
        node_id = _clean(item.get("node_id"))
        if not node_id:
            continue
        counts = item.get("counts") if isinstance(item.get("counts"), dict) else {}
        counts_by_node[node_id] = {
            "question_count": _as_int(counts.get("question_count")),
            "published_count": _as_int(counts.get("published_count")),
        }
    return counts_by_node


def teacher_legacy_overview(user: Any) -> LegacyTeacherOverviewResponse:
    videos = legacy_student_video_points(query="", limit=500).items
    banks = list_question_banks()
    classes = list_classes(user)
    question_total = 0
    published_question_total = 0
    for experiment in banks.get("items") or []:
        for bank in experiment.get("banks") or []:
            question_total += _as_int(bank.get("question_count"))
            published_question_total += _as_int(bank.get("published_count"))
    video_point_count = len(videos)
    playable_video_count = sum(1 for item in videos if _as_int(item.published_media_count) > 0)
    recommended_count = sum(1 for item in videos if item.is_recommended)
    student_total = sum(_as_int(item.student_count) for item in classes)
    return LegacyTeacherOverviewResponse(
        metrics=[
            LegacyTeacherMetric(key="video_points", label="实验视频点位", value=video_point_count, unit="个", description="按实验知识单元汇总的学习视频入口"),
            LegacyTeacherMetric(key="playable_points", label="已绑定视频点位", value=playable_video_count, unit="个", description="已有可播放视频资源的点位"),
            LegacyTeacherMetric(key="questions", label="题库题目", value=question_total, unit="题", description="覆盖实验点位的测评题目"),
            LegacyTeacherMetric(key="classes", label="教学班级", value=len(classes), unit="个", description="纳入展示的教学班级"),
            LegacyTeacherMetric(key="students", label="学生人数", value=student_total, unit="人", description="已导入或已注册的学生"),
            LegacyTeacherMetric(key="recommendations", label="推荐学习", value=recommended_count, unit="项", description="教师已配置的推荐学习点位"),
        ],
        loop=[
            LegacyTeacherLoopStep(title="实验视频学习", description="学生先围绕实验点位观看现象、原理和安全提示。"),
            LegacyTeacherLoopStep(title="测评作答", description="系统从题库中按掌握度或自选范围抽题。"),
            LegacyTeacherLoopStep(title="掌握度更新", description="答题结果写入知识追踪模型，形成点位掌握度。"),
            LegacyTeacherLoopStep(title="复习与组卷", description="薄弱点位用于下一轮视频推荐和组卷权重调整。"),
        ],
        resource_summary={
            "question_total": question_total,
            "published_question_total": published_question_total,
            "video_point_total": video_point_count,
            "playable_video_point_total": playable_video_count,
            "class_total": len(classes),
            "student_total": student_total,
        },
    )


def teacher_legacy_video_resources(q: str = "") -> LegacyTeacherVideoResourcesResponse:
    response = legacy_student_video_points(query=q, limit=500)
    counts_by_node = _question_counts_by_node()
    items: list[LegacyTeacherVideoResourceItem] = []
    for item in response.items:
        counts = counts_by_node.get(item.node_id, {})
        published_media_count = _as_int(item.published_media_count)
        items.append(
            LegacyTeacherVideoResourceItem(
                node_id=item.node_id,
                chapter_id=item.chapter_id,
                title=item.title,
                summary=item.summary or item.snippet or "",
                catalog_path=item.catalog_path,
                media_count=_as_int(item.media_count),
                published_media_count=published_media_count,
                question_count=_as_int(counts.get("question_count")),
                published_question_count=_as_int(counts.get("published_count")),
                has_video=published_media_count > 0,
                is_recommended=bool(item.is_recommended),
                resource_status="已绑定视频" if published_media_count > 0 else "待补充视频",
            )
        )
    return LegacyTeacherVideoResourcesResponse(total=response.total, items=items)


def teacher_legacy_question_resources() -> LegacyTeacherQuestionResourcesResponse:
    payload = _catalog_question_bank_all()
    items: list[LegacyTeacherQuestionResourceItem] = []
    for item in payload.get("items") or []:
        counts = item.get("counts") if isinstance(item.get("counts"), dict) else {}
        items.append(
            LegacyTeacherQuestionResourceItem(
                node_id=_clean(item.get("node_id")),
                chapter_id=_clean(item.get("chapter_id")) or None,
                node_kind=_clean(item.get("node_kind")),
                title=_clean(item.get("title")),
                status=_clean(item.get("status")),
                breadcrumb_titles=[_clean(value) for value in (item.get("breadcrumb_titles") or []) if _clean(value)],
                experiment_id=_clean(item.get("experiment_id")) or None,
                question_count=_as_int(counts.get("question_count")),
                published_count=_as_int(counts.get("published_count")),
                draft_count=_as_int(counts.get("draft_count")),
                choice_count=_as_int(counts.get("choice_count")),
                true_false_count=_as_int(counts.get("true_false_count")),
                fill_blank_count=_as_int(counts.get("fill_blank_count")),
                media_count=_as_int(item.get("media_count")),
                published_media_count=_as_int(item.get("published_media_count")),
                point_count=_as_int(item.get("descendant_point_count")),
            )
        )
    totals = payload.get("totals") if isinstance(payload.get("totals"), dict) else {}
    return LegacyTeacherQuestionResourcesResponse(total=len(items), totals=totals, items=items)


def _class_summary(class_item: Any, user: Any) -> LegacyTeacherClassSummary:
    dashboard = get_class_dashboard(class_id=class_item.id, user=user)
    metrics = dashboard.get("metrics") if isinstance(dashboard.get("metrics"), dict) else {}
    return LegacyTeacherClassSummary(
        id=class_item.id,
        class_name=class_item.class_name,
        description=class_item.description,
        status=class_item.status,
        student_count=_as_int(class_item.student_count),
        active_students=_as_int(metrics.get("active_students")),
        completion_rate=round(_as_float(metrics.get("completion_rate")), 2),
        average_score=round(_as_float(metrics.get("average_score")), 2),
        missing_students=_as_int(metrics.get("missing_students")),
    )


def teacher_legacy_classes(user: Any) -> LegacyTeacherClassesResponse:
    classes = list_classes(user)
    return LegacyTeacherClassesResponse(classes=[_class_summary(item, user) for item in classes])


def teacher_legacy_class_analytics(class_id: str, user: Any) -> LegacyTeacherAnalyticsResponse:
    dashboard = get_class_dashboard(class_id=class_id, user=user)
    students: list[LegacyTeacherStudentAnalyticsRow] = []
    for row in dashboard.get("matrix") or []:
        group_states = row.get("experiment_groups") if isinstance(row.get("experiment_groups"), dict) else {}
        evidence_count = 0
        attempt_count = 0
        for state in group_states.values():
            if isinstance(state, dict):
                evidence_count += _as_int(state.get("evidence_count"))
                attempt_count += _as_int(state.get("attempt_count"))
        average_score = round(_as_float(row.get("average_score")), 2)
        students.append(
            LegacyTeacherStudentAnalyticsRow(
                student_id=_clean(row.get("student_id")),
                student_name=_clean(row.get("student_name")) or _clean(row.get("student_id")),
                average_score=average_score,
                evidence_count=evidence_count,
                attempt_count=attempt_count,
                status="需巩固" if average_score and average_score < 60 else "已有记录" if evidence_count or attempt_count else "待开始",
            )
        )
    return LegacyTeacherAnalyticsResponse(
        class_id=_clean(dashboard.get("class_id")) or class_id,
        metrics=dashboard.get("metrics") if isinstance(dashboard.get("metrics"), dict) else {},
        experiment_groups=dashboard.get("experiment_groups") if isinstance(dashboard.get("experiment_groups"), list) else [],
        students=students,
    )


def _weak_item(row: dict[str, Any], fallback_title: str = "薄弱点位") -> LegacyTeacherWeakPointItem:
    return LegacyTeacherWeakPointItem(
        point_node_id=_clean(row.get("point_node_id")) or None,
        point_key=_clean(row.get("point_key")) or None,
        point_title=_clean(row.get("point_title")) or _clean(row.get("stem")) or fallback_title,
        experiment_id=_clean(row.get("experiment_id")) or None,
        experiment_title=_clean(row.get("experiment_title")) or None,
        attempt_count=_as_int(row.get("attempt_count")),
        incorrect_count=_as_int(row.get("incorrect_count")),
        incorrect_rate=round(_as_float(row.get("incorrect_rate")), 2),
        representative_questions=[
            {"question_id": _clean(question.get("question_id")), "stem": _clean(question.get("stem"))}
            for question in (row.get("representative_questions") or [])
            if isinstance(question, dict)
        ],
    )


def teacher_legacy_class_weak_points(class_id: str, user: Any) -> LegacyTeacherWeakPointsResponse:
    payload = get_class_weak_points(class_id=class_id, user=user)
    items = [_weak_item(item, "薄弱题目") for item in (payload.get("items") or []) if isinstance(item, dict)]
    point_items = [_weak_item(item, "薄弱点位") for item in (payload.get("point_items") or []) if isinstance(item, dict)]
    return LegacyTeacherWeakPointsResponse(
        items=items,
        point_items=point_items,
        total=len(items),
        point_total=len(point_items),
    )


def teacher_legacy_evaluation_system() -> LegacyTeacherEvaluationSystemResponse:
    return LegacyTeacherEvaluationSystemResponse(
        evaluated_objects=["实验点位掌握度", "章节实验覆盖", "班级整体达成度", "学生错题复盘状态"],
        evidence_sources=["实验视频学习记录", "智能测评作答结果", "题目正确率与错题分布", "点位复习与再次测评记录"],
        update_mechanism="以实验点位为最小知识单元，学生每次测评都会更新对应点位的掌握度；薄弱点位会在后续组卷和复习建议中获得更高权重。",
        score_bands=[
            LegacyTeacherEvaluationBand(label="优秀", min_score=85, max_score=100, description="能够稳定解释实验现象、反应原理与安全注意事项。"),
            LegacyTeacherEvaluationBand(label="达标", min_score=70, max_score=84.99, description="主要知识点已掌握，个别点位需要通过视频和错题继续巩固。"),
            LegacyTeacherEvaluationBand(label="需巩固", min_score=0, max_score=69.99, description="建议优先复习错题对应的实验点位，再进行下一轮测评。"),
        ],
        outputs=["学生学习报告", "班级学情概览", "薄弱点位排行", "后续组卷权重"],
    )
