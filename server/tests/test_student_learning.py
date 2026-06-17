from __future__ import annotations

import json
from pathlib import Path

from sqlalchemy.exc import SQLAlchemyError

from server.app.auth import AuthUser
from server.app.services.student_learning_service import (
    _areas_for_groups,
    _build_parent_groups,
    _choose_recommendation,
    _learning_groups_for_chapter,
    _latest_pretest_area_id,
    _lowest_mastery_chapter_id,
    _record_learning_event,
    validate_student_learning_experiment_coverage,
    validate_student_learning_profiles,
)
from server.tests.route_helpers import assert_route

ROOT = Path(__file__).resolve().parents[2]


def _experiment(
    experiment_id: str,
    *,
    code: str,
    title: str,
    parent_code: str,
    parent_title: str,
    chapter_id: str,
    display_order: int,
    questions: int = 0,
) -> dict[str, object]:
    return {
        "id": experiment_id,
        "code": code,
        "title": title,
        "summary": f"{title} summary",
        "status": "published",
        "display_order": display_order,
        "metadata": {
            "parent_code": parent_code,
            "parent_title": parent_title,
            "module_display_title": "模块",
            "video_candidates": ["观察点"],
        },
        "chapter_bindings": [{"chapter_id": chapter_id, "coverage_type": "primary", "sort_order": 1}],
        "media_resources": [],
        "published_question_count": questions,
    }


class _FailingSession:
    def __init__(self) -> None:
        self.rolled_back = False

    def execute(self, *_args, **_kwargs):
        raise SQLAlchemyError("missing optional student learning table")

    def rollback(self) -> None:
        self.rolled_back = True


def test_student_learning_routes_are_registered() -> None:
    assert_route("/api/student/learning-home", "GET")
    assert_route("/api/student/learning-page", "GET")
    assert_route("/api/student/experiment-groups/{parent_code}", "GET")
    assert_route("/api/student/experiments/{experiment_id}", "GET")


def test_student_learning_profile_seed_is_valid() -> None:
    result = validate_student_learning_profiles()

    assert result["ok"] is True
    assert result["profile_count"] == 9
    assert result["enabled_profile_count"] == 9


def test_student_learning_experiment_coverage_requires_every_profile_chapter() -> None:
    chapters = ["CH13", "CH14", "CH15", "CH16", "CH17", "CH18", "CH19", "CH20", "CH22"]
    experiments = [
        _experiment(
            f"EXP_{chapter_id}",
            code=f"{index + 1}-1",
            title=f"{chapter_id} experiment",
            parent_code=f"{index + 1}-1",
            parent_title=f"{chapter_id} parent",
            chapter_id=chapter_id,
            display_order=index + 1,
        )
        for index, chapter_id in enumerate(chapters)
    ]

    result = validate_student_learning_experiment_coverage(experiments)

    assert result["ok"] is True
    assert result["covered_experiment_count"] == len(chapters)
    assert result["uncovered_experiment_count"] == 0
    assert result["profiles_without_experiments"] == []


def test_student_learning_experiment_coverage_rejects_unmapped_published_experiments() -> None:
    chapters = ["CH13", "CH14", "CH15", "CH16", "CH17", "CH18", "CH19", "CH20", "CH22"]
    experiments = [
        _experiment(
            f"EXP_{chapter_id}",
            code=f"{index + 1}-1",
            title=f"{chapter_id} experiment",
            parent_code=f"{index + 1}-1",
            parent_title=f"{chapter_id} parent",
            chapter_id=chapter_id,
            display_order=index + 1,
        )
        for index, chapter_id in enumerate(chapters)
    ]
    experiments.append(
        _experiment(
            "EXP_UNMAPPED",
            code="99-1",
            title="Unmapped experiment",
            parent_code="99-1",
            parent_title="Unmapped parent",
            chapter_id="CH99",
            display_order=99,
        )
    )

    result = validate_student_learning_experiment_coverage(experiments)

    assert result["ok"] is False
    assert result["uncovered_experiment_count"] == 1
    assert any("EXP_UNMAPPED" in error for error in result["errors"])


def test_student_learning_seed_covers_all_formal_experiments() -> None:
    data = json.loads((ROOT / "data" / "seed" / "formal_experiments.json").read_text(encoding="utf-8-sig"))
    experiments = [
        experiment
        for experiment in data.get("experiments") or []
        if isinstance(experiment, dict) and str(experiment.get("status") or "published") == "published"
    ]

    result = validate_student_learning_experiment_coverage(experiments)

    assert result["ok"] is True
    assert result["published_experiment_count"] == 77
    assert result["covered_experiment_count"] == 77
    assert result["uncovered_experiment_count"] == 0
    assert result["profiles_without_experiments"] == []


def test_student_learning_recommendation_tables_are_optional() -> None:
    pretest_session = _FailingSession()
    mastery_session = _FailingSession()

    assert _latest_pretest_area_id(pretest_session, "20240001") is None
    assert pretest_session.rolled_back is True
    assert _lowest_mastery_chapter_id(mastery_session, student_id="20240001", area_id="p") is None
    assert mastery_session.rolled_back is True


def test_student_learning_event_recording_is_best_effort() -> None:
    session = _FailingSession()
    user = AuthUser(
        id="00000000-0000-0000-0000-000000000000",
        username="20240001",
        role="student",
        display_name="Student",
        status="active",
        must_change_password=False,
        student_id="20240001",
    )

    _record_learning_event(session, user=user, event_type="learning_profile_opened", chapter_id="CH13")

    assert session.rolled_back is True


def test_parent_groups_follow_experiment_parent_titles_and_hide_empty_f_area() -> None:
    groups = _build_parent_groups(
        [
            _experiment(
                "EXP_19_1_01",
                code="19-1-01",
                title="氯、溴、碘的置换次序",
                parent_code="19-1",
                parent_title="实验 19-1 卤素",
                chapter_id="CH13",
                display_order=1,
                questions=4,
            ),
            _experiment(
                "EXP_20_2_01",
                code="20-2-01",
                title="氢氧化物的酸碱性",
                parent_code="20-2",
                parent_title="实验 20-2 d 区元素化合物的性质（一）",
                chapter_id="CH20",
                display_order=20,
                questions=2,
            ),
            _experiment(
                "EXP_21_1_01",
                code="21-1-01",
                title="镧系性质",
                parent_code="21-1",
                parent_title="实验 21-1 镧系",
                chapter_id="CH21",
                display_order=99,
            ),
        ]
    )

    assert [group.parent_code for group in groups] == ["19-1", "20-2"]
    assert groups[0].area_id == "p"
    assert groups[0].parent_title == "实验 19-1 卤素"

    areas = {area.area_id: area for area in _areas_for_groups(groups)}
    assert areas["f"].enabled is False
    assert areas["p"].question_count == 4


def test_recommendation_falls_back_when_pretest_area_has_no_experiments() -> None:
    groups = _build_parent_groups(
        [
            _experiment(
                "EXP_19_1_01",
                code="19-1-01",
                title="氯、溴、碘的置换次序",
                parent_code="19-1",
                parent_title="实验 19-1 卤素",
                chapter_id="CH13",
                display_order=1,
            ),
            _experiment(
                "EXP_18_1_01",
                code="19-6-01",
                title="焰色反应",
                parent_code="19-6",
                parent_title="实验 19-6 碱金属和碱土金属",
                chapter_id="CH18",
                display_order=18,
            ),
        ]
    )

    assert _choose_recommendation(groups=groups, pretest_area_id="f", mastery_chapter_id=None) == ("p", "19-1")
    assert _choose_recommendation(groups=groups, pretest_area_id="s", mastery_chapter_id="CH18") == ("s", "19-6")


def test_chapter_learning_groups_follow_parent_experiments_not_property_sections() -> None:
    groups = _learning_groups_for_chapter(
        profile={"title": "17族（卤素）"},
        experiments=[
            _experiment(
                "EXP_19_1_01",
                code="19-1-01",
                title="氯水 + KBr 溶液 + CCl4",
                parent_code="19-1",
                parent_title="实验 19-1 卤素",
                chapter_id="CH13",
                display_order=2,
                questions=3,
            ),
            _experiment(
                "EXP_19_1_02",
                code="19-1-02",
                title="氯水、溴水、碘水分别与 Na2S2O3 溶液反应",
                parent_code="19-1",
                parent_title="实验 19-1 卤素",
                chapter_id="CH13",
                display_order=1,
                questions=2,
            ),
            _experiment(
                "EXP_19_2_01",
                code="19-2-01",
                title="卤化银沉淀",
                parent_code="19-2",
                parent_title="实验 19-2 卤化银",
                chapter_id="CH13",
                display_order=3,
                questions=1,
            ),
        ],
    )

    assert [group.parent_code for group in groups] == ["19-1", "19-2"]
    assert [point.code for point in groups[0].points] == ["19-1-02", "19-1-01"]
    assert {point.property_key for group in groups for point in group.points} == {"chapter"}
