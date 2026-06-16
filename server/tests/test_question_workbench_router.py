from __future__ import annotations

from server.app.admin_main import app


def _routes_for(path: str, method: str) -> list[object]:
    return [
        route
        for route in app.routes
        if getattr(route, "path", "") == path and method in getattr(route, "methods", set())
    ]


def test_question_workbench_routes_stay_registered() -> None:
    assert len(_routes_for("/api/admin/question-banks/workbench-sessions", "POST")) == 1
    assert len(_routes_for("/api/admin/question-banks/workbench-sessions/{session_id}", "GET")) == 1
    assert len(_routes_for("/api/admin/question-banks/workbench-sessions/{session_id}/messages", "POST")) == 1
    assert len(_routes_for("/api/admin/question-banks/workbench-sessions/{session_id}/messages/stream", "POST")) == 1
    assert len(_routes_for("/api/admin/question-banks/workbench-candidates/{candidate_id}/reject", "POST")) == 1
    assert len(_routes_for("/api/admin/question-banks/workbench-candidates/{candidate_id}/publish", "POST")) == 1
