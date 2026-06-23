from __future__ import annotations

from dataclasses import replace

from server.app.infrastructure.settings import Settings
import server.app.domains.questions.workbench as question_workbench_service
from server.app.domains.questions.workbench import _question_workbench_rag_gate


def _ai_settings(**overrides):
    values = {
        "agent_llm_provider": "openai",
        "agent_llm_base_url": "https://api.deepseek.com",
        "agent_llm_model": "deepseek-chat",
        "agent_llm_api_key": "configured",
    }
    values.update(overrides)
    return replace(Settings(), **values)


def test_question_workbench_gate_blocks_when_question_bank_assistant_disabled(monkeypatch):
    monkeypatch.setattr(question_workbench_service, "get_settings", lambda: _ai_settings())
    monkeypatch.setattr(question_workbench_service, "effective_ai_settings", lambda settings: settings)
    monkeypatch.setattr(question_workbench_service, "ai_feature_enabled", lambda name: False if name == "question_bank_assistant" else True)

    gate = _question_workbench_rag_gate()

    assert gate["healthy"] is False
    assert gate["reason_code"] == "question_bank_assistant_disabled"


def test_question_workbench_gate_blocks_when_llm_is_not_configured(monkeypatch):
    monkeypatch.setattr(question_workbench_service, "get_settings", lambda: _ai_settings(agent_llm_api_key=""))
    monkeypatch.setattr(question_workbench_service, "effective_ai_settings", lambda settings: settings)
    monkeypatch.setattr(question_workbench_service, "ai_feature_enabled", lambda name: True)

    gate = _question_workbench_rag_gate()

    assert gate["healthy"] is False
    assert gate["reason_code"] == "llm_not_configured"


def test_question_workbench_gate_allows_generation_without_live_rag_probe(monkeypatch):
    monkeypatch.setattr(question_workbench_service, "get_settings", lambda: _ai_settings(rag_bge_service_url="http://bge.local"))
    monkeypatch.setattr(question_workbench_service, "effective_ai_settings", lambda settings: settings)
    monkeypatch.setattr(question_workbench_service, "ai_feature_enabled", lambda name: True)

    gate = _question_workbench_rag_gate()

    assert gate["healthy"] is True
    assert gate["bge_status"] == "not_required"
    assert gate["bge_metrics"]["service"] == "precomputed-catalog-node-evidence"
