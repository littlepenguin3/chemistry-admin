from __future__ import annotations

from server.app.domains.catalog_tree.common import content_publication_errors
from server.app.domains.catalog_tree.equations import (
    normalize_reaction_equations,
    reaction_derived_terms,
    reaction_principle_text,
)


def test_normalizes_multiple_reaction_equations_for_backend_consumers() -> None:
    rows = normalize_reaction_equations(
        [
            {"raw_text": "Cl₂ + 2 KBr = 2 KCl + Br₂"},
            {"raw_text": "Br2 + 2 I- -> 2 Br- + I2"},
        ]
    )

    assert len(rows) == 2
    assert rows[0]["canonical_display"] == "Cl2 + 2 KBr = 2 KCl + Br2"
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
    assert row["formulae"] == []
    assert row["reactants"] == []
    assert row["reaction_features"] == []


def test_parseable_but_suspected_imbalanced_equation_warns() -> None:
    [row] = normalize_reaction_equations([{"raw_text": "H2 + O2 = H2O"}])

    assert row["validation_status"] == "warning"
    assert "Suspected imbalance; check coefficients and charges" in row["warnings"]
    assert row["formulae"]


def test_equation_mode_publication_uses_normalized_rows_and_text_mode_ignores_rows() -> None:
    valid_rows = normalize_reaction_equations([{"raw_text": "2 H2 + O2 = 2 H2O"}])
    equation_errors = content_publication_errors(
        {"node_id": "cat-point-1", "node_kind": "point", "title": "Hydrogen combustion"},
        {
            "principle_mode": "equation",
            "principle_equation": "",
            "reaction_equations": valid_rows,
            "phenomenon_explanation": "Water forms.",
            "safety_note": "Keep flame small.",
        },
    )
    text_errors = content_publication_errors(
        {"node_id": "cat-point-1", "node_kind": "point", "title": "Text point"},
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

    assert reaction_principle_text(content) == "Cl2 + 2 KBr = 2 KCl + Br2"
    terms = reaction_derived_terms(content)
    assert "CL2" in terms["formulae"]
    assert "not a reaction" not in " ".join(terms["formulae"])
