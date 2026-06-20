from __future__ import annotations

from server.app.domains.assessments.posttest import PosttestQuestionCandidate
from server.app.domains.assessments.smart_assessment import (
    _compose_custom_questions,
    _compose_questions,
    _draw_tickets,
    _public_question,
    _validate_submitted_answers,
)
from server.app.domains.errors import DomainHTTPException
from server.app.domains.platform.settings import CustomAssessmentSettings, SmartAssessmentSettings
from server.app.student_smart_assessment_schemas import StudentSmartAssessmentSubmitRequest
from server.tests.route_helpers import assert_route


def _candidate(question_id: str, *, experiment_id: str) -> PosttestQuestionCandidate:
    return PosttestQuestionCandidate(
        id=question_id,
        experiment_id=experiment_id,
        experiment_title=f"Experiment {experiment_id}",
        question_type="single_choice",
        stem=f"Question {question_id}",
        options=[{"label": "A", "text": "A"}, {"label": "B", "text": "B"}],
        answer={"value": "A"},
        explanation="Because A",
        difficulty="basic",
        related_chapter_ids=["CH13"],
        related_knowledge_point_ids=[f"kp_{question_id}"],
    )


def test_student_smart_assessment_routes_are_registered() -> None:
    assert_route("/api/student/smart-assessment/start", "POST")
    assert_route("/api/student/smart-assessment/submit", "POST")
    assert_route("/api/student/custom-assessment/options", "GET")
    assert_route("/api/student/custom-assessment/start", "POST")
    assert_route("/api/admin/classes/{class_id}/smart-assessment-strategy", "GET")
    assert_route("/api/admin/classes/{class_id}/smart-assessment-strategy", "PUT")
    assert_route("/api/admin/classes/{class_id}/smart-assessment-strategy", "DELETE")
    assert_route("/api/admin/classes/{class_id}/custom-assessment-settings", "GET")
    assert_route("/api/admin/classes/{class_id}/custom-assessment-settings", "PUT")
    assert_route("/api/admin/classes/{class_id}/custom-assessment-settings", "DELETE")


def test_public_smart_assessment_question_does_not_expose_answer_or_explanation() -> None:
    public = _public_question(_candidate("q1", experiment_id="EXP_19_1"))
    payload = public.model_dump()

    assert "answer" not in payload
    assert "explanation" not in payload
    assert payload["experiment_id"] == "EXP_19_1"


def test_smart_assessment_ticket_curve_gives_lower_mastery_more_weight() -> None:
    strategy = SmartAssessmentSettings(weak_tendency_percent=100, weak_curve=2, weak_max_bonus=9)

    assert _draw_tickets(strategy, 30) > _draw_tickets(strategy, 80)
    assert _draw_tickets(strategy, 100) == 1


def test_smart_assessment_composition_reserves_untested_ratio() -> None:
    strategy = SmartAssessmentSettings(
        question_count=2,
        untested_ratio_percent=50,
        weak_tendency_percent=100,
        max_questions_per_experiment=1,
    )
    selected, composition, experiment_meta = _compose_questions(
        candidates=[
            _candidate("q-untested", experiment_id="EXP_UNTESTED"),
            _candidate("q-weak", experiment_id="EXP_WEAK"),
            _candidate("q-strong", experiment_id="EXP_STRONG"),
        ],
        mastery={
            "EXP_WEAK": {"mastery_score": 25, "evidence_count": 2},
            "EXP_STRONG": {"mastery_score": 90, "evidence_count": 3},
        },
        strategy=strategy,
        student_id="20240001",
    )

    assert len(selected) == 2
    assert composition.untested_question_count == 1
    assert composition.measured_question_count == 1
    assert any(meta["source"] == "untested" for meta in experiment_meta.values())
    assert any(meta["source"] == "measured" for meta in experiment_meta.values())


def test_custom_assessment_composition_uses_selected_experiments() -> None:
    settings = CustomAssessmentSettings(default_question_count=5, max_question_count=10, max_questions_per_experiment=2)
    selected, composition, experiment_meta = _compose_custom_questions(
        candidates=[
            _candidate("q-a1", experiment_id="EXP_A"),
            _candidate("q-a2", experiment_id="EXP_A"),
            _candidate("q-a3", experiment_id="EXP_A"),
            _candidate("q-b1", experiment_id="EXP_B"),
            _candidate("q-b2", experiment_id="EXP_B"),
            _candidate("q-c1", experiment_id="EXP_C"),
        ],
        selected_experiment_ids=["EXP_A", "EXP_B"],
        settings=settings,
        student_id="20240001",
        requested_question_count=5,
    )

    assert len(selected) == 4
    assert {question.experiment_id for question in selected} == {"EXP_A", "EXP_B"}
    assert composition.custom_question_count == 4
    assert composition.warnings["underfilled"] is True
    assert all(meta["source"] == "custom" for meta in experiment_meta.values())
    assert all(meta["question_count"] <= 2 for meta in experiment_meta.values())


def test_smart_assessment_answers_must_match_session_questions() -> None:
    payload = StudentSmartAssessmentSubmitRequest(
        session_id="00000000-0000-0000-0000-000000000001",
        answers=[
            {"question_id": "q1", "answer": "A"},
            {"question_id": "q1", "answer": "B"},
        ],
    )

    try:
        _validate_submitted_answers(["q1", "q2"], payload)
    except DomainHTTPException as exc:
        assert exc.status_code == 400
    else:
        raise AssertionError("duplicate question ids should be rejected")
