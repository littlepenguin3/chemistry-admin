from __future__ import annotations

from dataclasses import dataclass
from typing import Any

import pytest

from server.app.domains import student_video_saves as saves_service
from server.app.student_video_save_schemas import StudentVideoPersonalState, StudentVideoSaveRequest
from server.tests.route_helpers import assert_route


@dataclass
class _Student:
    id: str = "00000000-0000-0000-0000-000000000123"


class _SessionContext:
    def __init__(self, session: "_FakeSession") -> None:
        self.session = session

    def __enter__(self) -> "_FakeSession":
        return self.session

    def __exit__(self, *_args: object) -> None:
        return None


class _FakeSession:
    def __init__(self) -> None:
        self.executed: list[dict[str, Any]] = []

    def execute(self, statement: Any, params: dict[str, Any]) -> None:
        self.executed.append({"statement": str(statement), "params": params})


def test_student_video_save_routes_are_registered() -> None:
    assert_route("/api/student/video-saves/{save_type}", "PUT")
    assert_route("/api/student/video-saves/{save_type}", "DELETE")
    assert_route("/api/student/video-saves/favorite/feed", "GET")


def test_normalize_save_type_accepts_aliases_and_rejects_unknown() -> None:
    assert saves_service.normalize_save_type("watch-later") == "watch_later"
    assert saves_service.normalize_save_type("favorite") == "favorite"
    with pytest.raises(Exception):
        saves_service.normalize_save_type("like")


def test_set_student_video_save_uses_independent_upsert_and_archive_paths(monkeypatch: pytest.MonkeyPatch) -> None:
    fake_session = _FakeSession()
    visible = {
        "placement_node_id": "cat-point-halogen",
        "canonical_point_id": "cat-canon-halogen",
        "media_asset_id": "00000000-0000-0000-0000-000000000001",
    }

    def personal_state(_session: Any, _user: Any, *, placement_node_id: str, media_id: str) -> StudentVideoPersonalState:
        last_type = fake_session.executed[-1]["params"]["save_type"]
        return StudentVideoPersonalState(
            watch_later=last_type == "watch_later",
            favorite=last_type == "favorite",
        )

    monkeypatch.setattr(saves_service, "db_session", lambda: _SessionContext(fake_session))
    monkeypatch.setattr(saves_service, "_visible_point_media", lambda *_args, **_kwargs: visible)
    monkeypatch.setattr(saves_service, "personal_state_for_item", personal_state)

    payload = StudentVideoSaveRequest(
        placement_node_id="cat-point-halogen",
        canonical_point_id="cat-canon-halogen",
        media_id="00000000-0000-0000-0000-000000000001",
        source="unit_test",
    )

    watch_later = saves_service.set_student_video_save(_Student(), save_type="watch_later", payload=payload, active=True)
    favorite = saves_service.set_student_video_save(_Student(), save_type="favorite", payload=payload, active=True)
    removed_watch_later = saves_service.set_student_video_save(_Student(), save_type="watch_later", payload=payload, active=False)

    assert watch_later.save_type == "watch_later"
    assert watch_later.active is True
    assert watch_later.personal_state.watch_later is True
    assert favorite.save_type == "favorite"
    assert favorite.active is True
    assert favorite.personal_state.favorite is True
    assert removed_watch_later.save_type == "watch_later"
    assert removed_watch_later.active is False
    assert [call["params"]["save_type"] for call in fake_session.executed] == ["watch_later", "favorite", "watch_later"]
    assert "INSERT INTO student_video_saves" in fake_session.executed[0]["statement"]
    assert "INSERT INTO student_video_saves" in fake_session.executed[1]["statement"]
    assert "UPDATE student_video_saves" in fake_session.executed[2]["statement"]
