from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

from server.app.infrastructure.settings import Settings
from server.app.repositories import RepositoryProvider
from server.app.schemas import AgentAskRequest, AgentAskResponse
from server.app.domains.assistant.evidence_shaping import rag_trace_payload
from server.app.domains.assistant.output_guardrails import count_result, preview_result


@dataclass
class StudentAIPolicyDecision:
    mode: str = "normal_answer"
    reason: str = ""
    evidence_required: bool = False
    student_guidance: str = ""
    allowed_tools: tuple[str, ...] = field(default_factory=tuple)
    valid: bool = True
    raw: dict[str, Any] = field(default_factory=dict)

    def as_dict(self) -> dict[str, Any]:
        return {
            "mode": self.mode,
            "reason": self.reason,
            "evidence_required": self.evidence_required,
            "student_guidance": self.student_guidance,
            "allowed_tools": list(self.allowed_tools),
            "valid": self.valid,
        }


@dataclass
class AgentRunContext:
    request: AgentAskRequest
    repositories: RepositoryProvider
    policy: Any
    classification: dict[str, Any]
    settings: Settings | None = None
    policy_decision: StudentAIPolicyDecision = field(default_factory=StudentAIPolicyDecision)
    tool_calls: list[dict[str, Any]] = field(default_factory=list)
    sources: list[Any] = field(default_factory=list)
    rag_traces: list[dict[str, Any]] = field(default_factory=list)
    point_evidence: dict[str, Any] = field(default_factory=dict)
    guardrail_decisions: list[dict[str, Any]] = field(default_factory=list)
    mode: str = "local"

    def record_tool(self, name: str, arguments: dict[str, Any], result: Any) -> None:
        self.tool_calls.append(
            {
                "name": name,
                "arguments": arguments,
                "result_count": count_result(result),
                "result_preview": preview_result(result),
            }
        )

    def add_guardrail(self, code: str, action: str, reason: str) -> None:
        self.guardrail_decisions.append({"code": code, "action": action, "reason": reason})


def create_agent_context(
    *,
    request: AgentAskRequest,
    repositories: RepositoryProvider,
    policy: Any,
    classification: dict[str, Any],
    settings: Settings | None,
) -> AgentRunContext:
    return AgentRunContext(
        request=request,
        repositories=repositories,
        policy=policy,
        classification=classification,
        settings=settings,
    )


def build_agent_response(context: AgentRunContext, answer: str) -> AgentAskResponse:
    return AgentAskResponse(
        answer=answer,
        sources=context.sources,
        mode=context.mode,
        classification=context.classification,
        tool_calls=context.tool_calls,
        guardrail_decisions=context.guardrail_decisions,
        rag_trace=rag_trace_payload(context),
        review_required=True,
    )


def dump_agent_response(response: AgentAskResponse) -> dict[str, Any]:
    if hasattr(response, "model_dump"):
        return response.model_dump()
    return response.dict()


def chunk_stream_text(text: str, chunk_size: int = 18) -> list[str]:
    if not text:
        return []
    return [text[index : index + chunk_size] for index in range(0, len(text), chunk_size)]
