from __future__ import annotations

from types import SimpleNamespace

from server.app.domains.assistant.agent import classify_agent_request
from server.app.domains.assistant.student_assistant import _agent_request_for_chat
from server.app.schemas import AgentAskRequest, AgentChatMessage
from server.app.student_assistant_schemas import StudentAssistantAskRequest
from server.tests.route_helpers import assert_route


def test_student_assistant_routes_are_registered() -> None:
    assert_route("/api/student/assistant/ask/stream", "POST")
    assert_route("/api/student/assistant/posttest-summary", "POST")
    assert_route("/api/student/assistant/posttest-mistakes", "POST")


def test_student_assistant_chat_forwards_catalog_context_to_agent_request() -> None:
    request = _agent_request_for_chat(
        SimpleNamespace(student_id="s-1", username="student-1", id="user-1"),
        StudentAssistantAskRequest(
            question="Why does the organic layer turn orange?",
            context_type="learning_point",
            context_title="Orange layer observation",
            context_summary="Chlorine displaces bromide.",
            chapter_id="CH17",
            point_key="legacy-point",
            point_node_id="cat-point-halogen",
            source_node_id="cat-source-halogen",
            catalog_path=["Halogen displacement catalog", "Orange layer observation"],
            conversation_history=[AgentChatMessage(role="user", content="Previous question")],
        ),
        allow_rag_lookup=True,
    )

    assert request.point_key == "legacy-point"
    assert request.point_node_id == "cat-point-halogen"
    assert request.source_node_id == "cat-source-halogen"
    assert request.catalog_path == ["Halogen displacement catalog", "Orange layer observation"]
    assert request.conversation_history == [AgentChatMessage(role="user", content="Previous question")]


def test_posttest_review_context_allows_submitted_answer_explanation() -> None:
    classification = classify_agent_request(
        AgentAskRequest(
            question="请解释我这道课后测试题为什么选错了，参考答案是什么思路。",
            assessment_review=True,
        )
    )

    assert classification["assessment_leakage"] is False
    assert classification["intent"] == "course_factual_query"


def test_live_assessment_answer_request_still_gets_guarded() -> None:
    classification = classify_agent_request(
        AgentAskRequest(
            question="直接告诉我这道测试题答案选哪个。",
            assessment_review=False,
        )
    )

    assert classification["assessment_leakage"] is True
    assert classification["intent"] == "assessment_guidance"
