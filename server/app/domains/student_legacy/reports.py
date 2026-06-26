from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError

from server.app.domains.assessments.reports import (
    create_smart_assessment_report,
    _generated_text,
    _insert_report,
    _model_dump,
    _report_from_row,
    get_student_assessment_report,
    list_student_assessment_reports,
)
from server.app.domains.errors import DomainHTTPException, domain_status
from server.app.infrastructure.database import db_session
from server.app.student_assessment_report_schemas import AssessmentReportGeneratedText, StudentAssessmentReport, StudentAssessmentReportSummary
from server.app.student_legacy_schemas import (
    LegacyAssessmentReportDetail,
    LegacyAssessmentReportListResponse,
    LegacyAssessmentReportSummary,
    LegacyReportGeneratedText,
    LegacyWrongQuestionExplanation,
)
from server.app.student_smart_assessment_schemas import StudentSmartAssessmentReport


LEGACY_FORBIDDEN_TERMS = (
    "TKE",
    "TKT",
    "mastery_score",
    "mastery_prob",
    "Agent",
    "RAG",
    "Atom",
    "chunk",
    "embedding",
    "retrieval",
    "provider",
    "OpenAI",
    "Qwen",
    "BGE",
    "学习助手",
    "智能监控",
    "检索增强",
    "知识检索",
)


def _student_id(user: Any) -> str:
    return str(getattr(user, "student_id", None) or getattr(user, "username", "")).strip().upper()


def _report_type_label(report_type: str) -> str:
    return {
        "smart": "智能测试",
        "custom": "自主测试",
        "point": "点位测评",
        "pretest": "课前测试",
        "posttest": "课后测试",
    }.get(report_type, "测评")


def _report_title(report_type: str) -> str:
    return f"{_report_type_label(report_type)}报告"


def _as_dict_list(value: Any) -> list[dict[str, Any]]:
    if not isinstance(value, list):
        return []
    return [item for item in value if isinstance(item, dict)]


def _experiment_titles(payload: dict[str, Any], wrong_answers: list[dict[str, Any]] | None = None) -> list[str]:
    titles: list[str] = []
    for item in _as_dict_list(payload.get("experiments")):
        title = str(item.get("title") or item.get("experiment_title") or "").strip()
        if title and title not in titles:
            titles.append(title)
    for item in wrong_answers or []:
        title = str(item.get("experiment_title") or "").strip()
        if title and title not in titles:
            titles.append(title)
    return titles


def _join_titles(titles: list[str], fallback: str) -> str:
    if not titles:
        return fallback
    shown = titles[:3]
    suffix = f"等 {len(titles)} 个实验" if len(titles) > len(shown) else ""
    return "、".join(shown) + suffix


def _option_value(option: Any, index: int) -> str:
    if isinstance(option, dict):
        raw = option.get("label") or option.get("key") or option.get("value")
        if raw is not None:
            return str(raw)
    return chr(65 + index)


def _option_text(option: Any, index: int) -> str:
    if isinstance(option, dict):
        raw = option.get("text") or option.get("label") or option.get("value")
        if raw is not None:
            return str(raw)
    return _option_value(option, index)


def _answer_text(value: Any, options: list[Any] | None = None) -> str:
    if value is None or value == "":
        return "未作答"
    if isinstance(value, bool):
        return "正确" if value else "错误"
    if isinstance(value, list):
        return "、".join(_answer_text(item, options) for item in value) or "未作答"
    if isinstance(value, dict):
        for key in ("label", "value", "answer", "text"):
            if value.get(key) is not None:
                return _answer_text(value.get(key), options)
    text_value = str(value).strip()
    lowered = text_value.lower()
    if lowered == "true":
        return "正确"
    if lowered == "false":
        return "错误"
    for index, option in enumerate(options or []):
        marker = _option_value(option, index)
        option_text = _option_text(option, index)
        option_values = {marker, marker.lower(), str(option_text), str(option_text).lower()}
        if isinstance(option, dict):
            for key in ("label", "key", "value"):
                if option.get(key) is not None:
                    option_values.add(str(option.get(key)))
                    option_values.add(str(option.get(key)).lower())
        if text_value in option_values or lowered in option_values:
            return option_text if option_text == marker else f"{marker}. {option_text}"
    return text_value


def _option_lines(options: list[Any] | None) -> list[str]:
    return [
        f"{_option_value(option, index)}. {_option_text(option, index)}"
        for index, option in enumerate(options or [])
    ]


def _has_forbidden_legacy_term(value: str) -> bool:
    lowered = value.lower()
    return any(term.lower() in lowered for term in LEGACY_FORBIDDEN_TERMS)


def _legacy_safe_text(value: str, fallback: str) -> str:
    text = value.strip()
    if not text or _has_forbidden_legacy_term(text):
        return fallback
    return text


def _fallback_explanation(item: dict[str, Any]) -> str:
    options = item.get("options") if isinstance(item.get("options"), list) else []
    submitted = _answer_text(item.get("submitted_answer"), options)
    correct = _answer_text(item.get("correct_answer"), options)
    experiment = str(item.get("experiment_title") or "相关实验点位").strip()
    return (
        f"本题应先识别题干中的实验现象、试剂和反应条件，再对照参考答案判断。"
        f"你的作答为{submitted}，参考答案为{correct}。建议回看{experiment}，把现象、原理和答案依据连在一起复盘。"
    )


def _legacy_wrong_question(item: dict[str, Any]) -> LegacyWrongQuestionExplanation:
    options = item.get("options") if isinstance(item.get("options"), list) else []
    raw_explanation = str(item.get("explanation") or "")
    fallback = _fallback_explanation(item)
    explanation = _legacy_safe_text(raw_explanation, fallback)
    source = "stored" if raw_explanation.strip() and explanation == raw_explanation.strip() else "fallback"
    return LegacyWrongQuestionExplanation(
        question_id=str(item.get("question_id") or ""),
        stem=str(item.get("stem") or "题目"),
        experiment_title=str(item.get("experiment_title") or ""),
        question_type=str(item.get("question_type") or ""),
        submitted_answer=_answer_text(item.get("submitted_answer"), options),
        correct_answer=_answer_text(item.get("correct_answer"), options),
        explanation=explanation or _fallback_explanation(item),
        explanation_source=source,
        options=_option_lines(options),
    )


def _legacy_summary_text(payload: dict[str, Any]) -> str:
    wrong_answers = _as_dict_list(payload.get("wrong_answers"))
    report_type = str(payload.get("assessment_mode") or "smart")
    correct = int(payload.get("correct_count") or 0)
    total = int(payload.get("total_count") or 0)
    score = round(float(payload.get("score") or 0), 1)
    covered = _join_titles(_experiment_titles(payload, wrong_answers), "本轮覆盖的实验点位")
    recommendation = _legacy_safe_text(str(payload.get("next_recommendation") or ""), "")
    if wrong_answers:
        weak_titles = _join_titles(_experiment_titles({"experiments": []}, wrong_answers), "错题涉及的实验点位")
        return (
            f"本次{_report_type_label(report_type)}覆盖{covered}，得分{score}，答对{correct}/{total}题。"
            f"错题主要集中在{weak_titles}，建议先阅读错题解析，再回看相关实验视频与原理说明。"
            f"{recommendation}"
        )
    return (
        f"本次{_report_type_label(report_type)}覆盖{covered}，得分{score}，答对{correct}/{total}题。"
        f"本轮没有错题，可继续保持当前学习节奏，并尝试更综合的实验测评。{recommendation}"
    )


def _legacy_mistake_text(wrong_answers: list[dict[str, Any]]) -> str:
    if not wrong_answers:
        return "本次测评没有错题。"
    lines = ["本次错题可按以下思路复盘："]
    for index, item in enumerate(wrong_answers, start=1):
        question = _legacy_wrong_question(item)
        lines.append(f"{index}. {question.stem} 参考答案：{question.correct_answer}。{question.explanation}")
    return "\n".join(lines)


def _legacy_generated_text(value: AssessmentReportGeneratedText | None, fallback: str, mode: str) -> LegacyReportGeneratedText:
    text = _legacy_safe_text(str(getattr(value, "text", "") or ""), fallback)
    source = getattr(value, "source", "fallback")
    if source not in {"ai", "fallback"} or text == fallback:
        source = "fallback"
    raw_mode = str(getattr(value, "mode", "") or mode)
    if source == "ai":
        safe_mode = "ai_generated"
    elif raw_mode.startswith("legacy") or raw_mode in {"fallback", "local_fallback", "no_wrong_answers"}:
        safe_mode = raw_mode
    else:
        safe_mode = "legacy_fallback"
    return LegacyReportGeneratedText(
        text=text,
        source=source,
        mode=safe_mode,
        generated_at=getattr(value, "generated_at", None),
    )


def _legacy_summary_from_current(summary: StudentAssessmentReportSummary) -> LegacyAssessmentReportSummary:
    return LegacyAssessmentReportSummary(
        id=summary.id,
        title=summary.title,
        report_type=summary.report_type,
        source_session_id=summary.source_session_id,
        score=summary.score,
        correct_count=summary.correct_count,
        total_count=summary.total_count,
        correct_rate=summary.correct_rate,
        wrong_count=summary.wrong_count,
        completed_at=summary.completed_at,
    )


def _session_report_payload(row: dict[str, Any]) -> dict[str, Any]:
    report = row.get("report")
    return report if isinstance(report, dict) else {}


def _session_report_type(row: dict[str, Any], payload: dict[str, Any]) -> str:
    report_type = str(payload.get("assessment_mode") or row.get("assessment_mode") or "smart")
    return report_type if report_type in {"smart", "custom", "point"} else "smart"


def _legacy_summary_from_session_row(row: dict[str, Any]) -> LegacyAssessmentReportSummary:
    payload = _session_report_payload(row)
    report_type = _session_report_type(row, payload)
    total_count = int(payload.get("total_count") or row.get("total_count") or 0)
    correct_count = int(payload.get("correct_count") or row.get("correct_count") or 0)
    score = float(payload.get("score") or row.get("score") or 0)
    correct_rate = float(payload.get("correct_rate") or (correct_count / total_count if total_count else 0))
    wrong_answers = _as_dict_list(payload.get("wrong_answers"))
    completed_at = row.get("completed_at") or row.get("updated_at") or datetime.now(timezone.utc)
    return LegacyAssessmentReportSummary(
        id=str(row["id"]),
        title=_report_title(report_type),
        report_type=report_type,
        source_session_id=str(row["id"]),
        score=score,
        correct_count=correct_count,
        total_count=total_count,
        correct_rate=correct_rate,
        wrong_count=len(wrong_answers),
        completed_at=completed_at,
    )


def _legacy_detail_from_session_row(row: dict[str, Any]) -> LegacyAssessmentReportDetail:
    payload = _session_report_payload(row)
    summary = _legacy_summary_from_session_row(row)
    wrong_answers = _as_dict_list(payload.get("wrong_answers"))
    fallback_summary = _legacy_summary_text(payload)
    return LegacyAssessmentReportDetail(
        id=summary.id,
        title=summary.title,
        report_type=summary.report_type,
        source_session_id=summary.source_session_id,
        score=summary.score,
        correct_count=summary.correct_count,
        total_count=summary.total_count,
        correct_rate=summary.correct_rate,
        wrong_count=summary.wrong_count,
        completed_at=summary.completed_at,
        ai_summary=LegacyReportGeneratedText(text=fallback_summary, source="fallback", mode="legacy_session_summary", generated_at=None),
        mistake_explanation=LegacyReportGeneratedText(
            text=_legacy_mistake_text(wrong_answers),
            source="fallback",
            mode="legacy_session_mistake_explanation",
            generated_at=None,
        ),
        next_steps=_legacy_safe_text(str(payload.get("next_recommendation") or ""), fallback_summary),
        covered_experiments=_experiment_titles(payload, wrong_answers),
        wrong_questions=[_legacy_wrong_question(item) for item in wrong_answers],
    )


def _legacy_completed_session_rows(user: Any, *, excluded_session_ids: set[str] | None = None, limit: int = 200) -> list[dict[str, Any]]:
    student_id = _student_id(user)
    excluded = excluded_session_ids or set()
    try:
        with db_session() as session:
            rows = [
                dict(row)
                for row in session.execute(
                    text(
                        """
                        SELECT id::text AS id,
                               assessment_mode,
                               report,
                               score,
                               correct_count,
                               total_count,
                               completed_at,
                               updated_at
                        FROM student_smart_assessment_sessions
                        WHERE student_id = :student_id
                          AND status = 'completed'
                          AND report <> '{}'::jsonb
                        ORDER BY completed_at DESC NULLS LAST, updated_at DESC
                        LIMIT :limit
                        """
                    ),
                    {"student_id": student_id, "limit": limit},
                )
                .mappings()
                .all()
            ]
    except SQLAlchemyError:
        return []
    return [row for row in rows if str(row.get("id") or "") not in excluded]


def _legacy_completed_session_row(report_id: str, user: Any) -> dict[str, Any] | None:
    student_id = _student_id(user)
    try:
        with db_session() as session:
            row = (
                session.execute(
                    text(
                        """
                        SELECT id::text AS id,
                               assessment_mode,
                               report,
                               score,
                               correct_count,
                               total_count,
                               completed_at,
                               updated_at
                        FROM student_smart_assessment_sessions
                        WHERE id = CAST(:report_id AS uuid)
                          AND student_id = :student_id
                          AND status = 'completed'
                          AND report <> '{}'::jsonb
                        LIMIT 1
                        """
                    ),
                    {"report_id": report_id, "student_id": student_id},
                )
                .mappings()
                .first()
            )
    except SQLAlchemyError:
        return None
    return dict(row) if row else None


def _legacy_current_report_by_source_session(report_id: str, user: Any) -> StudentAssessmentReport | None:
    student_id = _student_id(user)
    try:
        with db_session() as session:
            row = (
                session.execute(
                    text(
                        """
                        SELECT *
                        FROM student_assessment_reports
                        WHERE source_session_id = CAST(:report_id AS uuid)
                          AND student_id = :student_id
                        ORDER BY completed_at DESC, created_at DESC
                        LIMIT 1
                        """
                    ),
                    {"report_id": report_id, "student_id": student_id},
                )
                .mappings()
                .first()
            )
    except SQLAlchemyError:
        return None
    return _report_from_row(dict(row)) if row else None


def legacy_assessment_report_list(user: Any) -> LegacyAssessmentReportListResponse:
    response = list_student_assessment_reports(user)
    reports = [_legacy_summary_from_current(item) for item in response.reports]
    existing_session_ids = {item.source_session_id for item in reports}
    reports.extend(_legacy_summary_from_session_row(row) for row in _legacy_completed_session_rows(user, excluded_session_ids=existing_session_ids))
    reports.sort(key=lambda item: item.completed_at, reverse=True)
    return LegacyAssessmentReportListResponse(reports=reports[:200])


def legacy_assessment_report_detail_from_report(report: StudentAssessmentReport) -> LegacyAssessmentReportDetail:
    payload = report.payload if isinstance(report.payload, dict) else {}
    wrong_answers = _as_dict_list(payload.get("wrong_answers"))
    fallback_summary = _legacy_summary_text(
        {
            **payload,
            "assessment_mode": report.report_type,
            "score": report.score,
            "correct_count": report.correct_count,
            "total_count": report.total_count,
            "wrong_answers": wrong_answers,
        }
    )
    return LegacyAssessmentReportDetail(
        id=report.id,
        title=report.title,
        report_type=report.report_type,
        source_session_id=report.source_session_id,
        score=report.score,
        correct_count=report.correct_count,
        total_count=report.total_count,
        correct_rate=report.correct_rate,
        wrong_count=report.wrong_count,
        completed_at=report.completed_at,
        ai_summary=_legacy_generated_text(report.summary, fallback_summary, "legacy_summary"),
        mistake_explanation=_legacy_generated_text(
            report.mistake_explanation,
            _legacy_mistake_text(wrong_answers),
            "legacy_mistake_explanation",
        ),
        next_steps=_legacy_safe_text(str(payload.get("next_recommendation") or ""), fallback_summary),
        covered_experiments=_experiment_titles(payload, wrong_answers),
        wrong_questions=[_legacy_wrong_question(item) for item in wrong_answers],
    )


def _smart_report_from_payload(payload: dict[str, Any], *, session_id: str | None = None) -> StudentSmartAssessmentReport | None:
    if session_id and not payload.get("session_id"):
        payload = {**payload, "session_id": session_id}
    try:
        return StudentSmartAssessmentReport.model_validate(payload)
    except Exception:
        return None


async def _create_report_from_smart_payload(payload: dict[str, Any], user: Any, *, session_id: str | None = None) -> StudentAssessmentReport | None:
    report = _smart_report_from_payload(payload, session_id=session_id)
    if report is None:
        return None
    try:
        return await create_smart_assessment_report(user, report)
    except Exception:
        return None


async def _create_report_from_completed_session(row: dict[str, Any], user: Any) -> StudentAssessmentReport | None:
    return await _create_report_from_smart_payload(
        _session_report_payload(row),
        user,
        session_id=str(row.get("id") or ""),
    )


def _needs_ai_hydration(report: StudentAssessmentReport) -> bool:
    if report.report_type not in {"smart", "custom", "point"}:
        return False
    summary_is_ai = getattr(report.summary, "source", "") == "ai"
    mistake_is_ai = getattr(report.mistake_explanation, "source", "") == "ai"
    return not summary_is_ai or (int(report.wrong_count or 0) > 0 and not mistake_is_ai)


async def legacy_assessment_report_detail(report_id: str, user: Any) -> LegacyAssessmentReportDetail:
    try:
        report = get_student_assessment_report(report_id, user)
        return legacy_assessment_report_detail_from_report(report)
    except DomainHTTPException as exc:
        if exc.status_code != domain_status.HTTP_404_NOT_FOUND:
            raise
    report = _legacy_current_report_by_source_session(report_id, user)
    if report:
        return legacy_assessment_report_detail_from_report(report)
    row = _legacy_completed_session_row(report_id, user)
    if row:
        return _legacy_detail_from_session_row(row)
    raise DomainHTTPException(status_code=domain_status.HTTP_404_NOT_FOUND, detail="Report not found")


async def create_legacy_smart_assessment_report(user: Any, report: StudentSmartAssessmentReport) -> Any:
    try:
        return await create_smart_assessment_report(user, report)
    except Exception:
        pass

    payload = _model_dump(report)
    wrong_answers = _as_dict_list(payload.get("wrong_answers"))
    report_type = str(payload.get("assessment_mode") or "smart")
    if report_type not in {"smart", "custom", "point"}:
        report_type = "smart"
    return _insert_report(
        student_id=_student_id(user),
        class_id=getattr(user, "class_id", None),
        report_type=report_type,
        source_session_id=str(report.session_id),
        source_table="student_smart_assessment_sessions",
        title=_report_title(report_type),
        score=float(report.score),
        correct_count=int(report.correct_count),
        total_count=int(report.total_count),
        correct_rate=float(report.correct_rate),
        wrong_count=len(wrong_answers),
        summary=_generated_text(_legacy_summary_text(payload), mode="legacy_local_summary"),
        mistake_explanation=_generated_text(_legacy_mistake_text(wrong_answers), mode="legacy_local_explanation"),
        prompt_snapshot={
            "source": "legacy_local",
            "supported_inputs": ["score", "correct_count", "total_count", "experiments", "wrong_answers", "next_recommendation"],
        },
        payload=payload,
        completed_at=datetime.now(timezone.utc),
    )
