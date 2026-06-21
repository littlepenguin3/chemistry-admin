from __future__ import annotations

import asyncio

from server.app.api.admin.admin_catalog_tree import admin_catalog_assist_equations, admin_catalog_preview_equations
from server.app.auth import AuthUser
from server.app.catalog_tree_schemas import CatalogEquationAssistRequest, CatalogEquationPreviewRequest
from server.app.domains.catalog_tree.common import content_publication_errors
from server.app.domains.catalog_tree.equations import (
    _sanitize_ai_drafts,
    equation_rows_from_inputs,
    normalize_reaction_equations,
    reaction_derived_terms,
    reaction_principle_text,
)


def _teacher_user() -> AuthUser:
    return AuthUser(
        id="teacher-1",
        username="teacher",
        role="teacher",
        display_name="Teacher",
        status="active",
    )


def test_normalizes_multiple_reaction_equations_for_backend_consumers() -> None:
    rows = normalize_reaction_equations(
        [
            {"raw_text": "Cl₂ + 2 KBr = 2 KCl + Br₂"},
            {"raw_text": "Br2 + 2 I- -> 2 Br- + I2"},
        ]
    )

    assert len(rows) == 2
    assert rows[0]["canonical_display"] == "Cl2 + 2 KBr → 2 KCl + Br2"
    assert rows[0]["canonical_mhchem"] == "\\ce{Cl2 + 2 KBr -> 2 KCl + Br2}"
    assert {"CL2", "KBR", "KCL", "BR2"}.issubset(set(rows[0]["formulae"]))
    assert rows[0]["reactants"]
    assert rows[0]["products"]
    assert rows[0]["validation_status"] in {"valid", "warning"}


def test_invalid_equation_rows_do_not_emit_misleading_derived_fields() -> None:
    [row] = normalize_reaction_equations([{"raw_text": "只观察到橙色分层，没有方程式"}])

    assert row["validation_status"] == "invalid"
    assert row["errors"]
    assert row["canonical_mhchem"] is None
    assert row["suggested_display"] is None
    assert row["formulae"] == []
    assert row["reactants"] == []
    assert row["reaction_features"] == []


def test_parseable_but_suspected_imbalanced_equation_warns() -> None:
    [row] = normalize_reaction_equations([{"raw_text": "H2 + O2 = H2O"}])

    assert row["validation_status"] == "warning"
    assert "当前系数疑似未配平，系统给出可采用的配平建议。" in row["warnings"]
    assert row["suggested_display"] == "2 H2 + O2 → 2 H2O"
    assert row["suggestion_reason"] == "配平建议"
    assert row["formulae"]


def test_loose_casing_no_space_and_equals_are_normalized_with_chinese_diagnostics() -> None:
    [row] = normalize_reaction_equations([{"raw_text": "CL2+2h2 = 2hcl"}])

    assert row["raw_text"] == "CL2+2h2 = 2hcl"
    assert row["canonical_display"] == "Cl2 + 2 H2 → 2 HCl"
    assert row["canonical_mhchem"] == "\\ce{Cl2 + 2 H2 -> 2 HCl}"
    assert row["validation_status"] == "warning"
    assert row["suggested_display"] == "Cl2 + H2 → 2 HCl"
    assert any("CL2" in warning and "Cl2" in warning for warning in row["warnings"])
    assert any("hcl" in warning and "HCl" in warning for warning in row["warnings"])
    assert row["corrections"]


def test_chinese_substance_aliases_are_preview_diagnostics_not_raw_rewrites() -> None:
    [row] = normalize_reaction_equations([{"raw_text": "氯气 + 氢气 = 氯化氢"}])

    assert row["raw_text"] == "氯气 + 氢气 = 氯化氢"
    assert row["canonical_display"] == "Cl2 + H2 → HCl"
    assert row["suggested_display"] == "Cl2 + H2 → 2 HCl"
    assert {"CL2", "H2", "HCL"}.issubset(set(row["formulae"]))
    assert {"氯气", "氢气", "氯化氢"}.issubset({item["alias"] for item in row["metadata"]["alias_mappings"]})
    assert any("识别为" in warning for warning in row["warnings"])


def test_multiline_preview_splits_non_empty_lines_in_order() -> None:
    rows = equation_rows_from_inputs(
        multiline_text="CL2+H2=HCL\n\nCl2 + 2KBr -> 2KCl + Br2",
        rows=[{"raw_text": "stale row should not win"}],
    )

    assert rows == [
        {"raw_text": "CL2+H2=HCL", "row_order": 1},
        {"raw_text": "Cl2 + 2KBr -> 2KCl + Br2", "row_order": 2},
    ]


def test_ai_drafts_are_normalized_before_becoming_adoptable() -> None:
    normalized_rows = normalize_reaction_equations([{"raw_text": "H2 + O2 = H2O"}])
    drafts = _sanitize_ai_drafts(
        [{"row_order": 1, "draft_text": "h2+o2=h2o", "rationale": "AI balance check"}],
        normalized_rows,
    )

    assert len(drafts) == 1
    assert drafts[0]["source"] == "ai"
    assert drafts[0]["row_order"] == 1
    assert drafts[0]["replacement_text"] == "H2 + O2 \u2192 H2O"
    assert drafts[0]["canonical_mhchem"] == "\\ce{H2 + O2 -> H2O}"
    assert drafts[0]["validation_status"] == "warning"
    assert drafts[0]["supplemental"] is False


def test_invalid_ai_drafts_are_not_adoptable_and_unmatched_rows_are_supplemental() -> None:
    normalized_rows = normalize_reaction_equations([{"raw_text": "H2 + O2 = H2O"}])
    drafts = _sanitize_ai_drafts(
        [
            {"row_order": 1, "draft_text": "not a reaction"},
            {"row_order": 99, "draft_text": "Cl2 + 2 KBr -> 2 KCl + Br2"},
        ],
        normalized_rows,
    )

    assert len(drafts) == 1
    assert drafts[0]["row_order"] is None
    assert drafts[0]["supplemental"] is True
    assert drafts[0]["canonical_display"] == "Cl2 + 2 KBr \u2192 2 KCl + Br2"

def test_equation_mode_publication_uses_normalized_rows_and_text_mode_ignores_rows() -> None:
    valid_rows = normalize_reaction_equations([{"raw_text": "2 H2 + O2 = 2 H2O"}])
    equation_errors = content_publication_errors(
        {"node_id": "cat-point-1", "canonical_point_id": "cat-canon-1", "node_kind": "point", "title": "Hydrogen combustion"},
        {
            "principle_mode": "equation",
            "principle_equation": "",
            "reaction_equations": valid_rows,
            "phenomenon_explanation": "Water forms.",
            "safety_note": "Keep flame small.",
        },
    )
    text_errors = content_publication_errors(
        {"node_id": "cat-point-1", "canonical_point_id": "cat-canon-1", "node_kind": "point", "title": "Text point"},
        {
            "principle_mode": "text",
            "principle_text": "A descriptive principle is enough in text mode.",
            "reaction_equations": valid_rows,
            "phenomenon_explanation": "Visible change.",
            "safety_note": "Wear goggles.",
        },
    )

    assert equation_errors == []
    assert text_errors == []


def test_reaction_context_helpers_skip_invalid_rows_for_es_and_ai_context() -> None:
    rows = normalize_reaction_equations(
        [
            {"raw_text": "Cl2 + 2 KBr = 2 KCl + Br2"},
            {"raw_text": "not a reaction"},
        ]
    )
    content = {"principle_mode": "equation", "principle_equation": "legacy", "reaction_equations": rows}

    assert reaction_principle_text(content) == "Cl2 + 2 KBr → 2 KCl + Br2"
    terms = reaction_derived_terms(content)
    assert "CL2" in terms["formulae"]
    assert "not a reaction" not in " ".join(terms["formulae"])


def test_preview_route_prefers_multiline_text_and_keeps_response_authoritative() -> None:
    response = asyncio.run(
        admin_catalog_preview_equations(
            CatalogEquationPreviewRequest(
                multiline_text="H2 + O2 = H2O\nnot a reaction",
                equations=[{"raw_text": "Cl2 = Cl2"}],
            ),
            user=_teacher_user(),
        )
    )

    assert response.ok is False
    assert [row.raw_text for row in response.equations] == ["H2 + O2 = H2O", "not a reaction"]
    assert response.equations[0].suggested_display == "2 H2 + O2 → 2 H2O"
    assert response.equations[1].formulae == []


def test_assist_route_returns_drafts_or_unavailable_without_saving(monkeypatch) -> None:
    monkeypatch.setattr(
        "server.app.domains.catalog_tree.equations._try_ai_equation_drafts",
        lambda payload, normalized_rows: ([], "AI 未配置，无法校对。"),
    )
    draft_response = asyncio.run(
        admin_catalog_assist_equations(
            CatalogEquationAssistRequest(mode="suggest", multiline_text="H2 + O2 = H2O", point_title="氢气燃烧"),
            user=_teacher_user(),
        )
    )
    unavailable_response = asyncio.run(
        admin_catalog_assist_equations(
            CatalogEquationAssistRequest(mode="generate", multiline_text="", point_title="氢气燃烧"),
            user=_teacher_user(),
        )
    )

    assert draft_response.available is False
    assert draft_response.drafts == []
    assert "AI 未配置" in (draft_response.reason or "")
    assert unavailable_response.available is False
    assert unavailable_response.drafts == []
    assert "AI 未配置" in (unavailable_response.reason or "")


def test_assist_route_prefers_ai_candidates_after_parser_preview(monkeypatch) -> None:
    def fake_ai(payload, normalized_rows):
        assert normalized_rows[0]["canonical_display"] == "H2 + O2 → H2O"
        return (
            [{"draft_text": "2 H2 + O2 → 2 H2O", "source": "ai", "rationale": "已补齐配平。", "row_order": 1}],
            "AI 已根据当前输入生成建议；采用后会重新渲染预览。",
        )

    monkeypatch.setattr("server.app.domains.catalog_tree.equations._try_ai_equation_drafts", fake_ai)

    response = asyncio.run(
        admin_catalog_assist_equations(
            CatalogEquationAssistRequest(mode="suggest", multiline_text="H2 + O2 = H2O", point_title="氢气燃烧"),
            user=_teacher_user(),
        )
    )

    assert response.available is True
    assert response.drafts[0].source == "ai"
    assert response.drafts[0].row_order == 1
