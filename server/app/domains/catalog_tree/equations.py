from __future__ import annotations

import json
import re
from collections import Counter
from typing import Any

from sqlalchemy import text

from server.app.chemistry_search import (
    expand_formula_aliases,
    extract_formulae,
    extract_reaction_features,
    normalize_chemistry_text,
)

PARSER_VERSION = "basic-v1"
ARROW_RE = re.compile(r"(⇌|→|=)")
ELEMENT_RE = re.compile(r"([A-Z][a-z]?)(\d*)")
GROUP_RE = re.compile(r"\(([A-Za-z0-9]+)\)(\d*)")


def _clean(value: Any) -> str:
    return str(value or "").strip()


def _dump_model(value: Any) -> dict[str, Any]:
    if hasattr(value, "model_dump"):
        return value.model_dump()
    return dict(value or {})


def _unique(values: list[str]) -> list[str]:
    seen: set[str] = set()
    results: list[str] = []
    for value in values:
        text_value = _clean(value)
        if text_value and text_value not in seen:
            seen.add(text_value)
            results.append(text_value)
    return results


def _json(value: Any) -> str:
    return json.dumps(value, ensure_ascii=False)


def _mhchem_body(display: str, reversible: bool) -> str:
    body = display
    body = body.replace("⇌", "<=>")
    body = body.replace("→", "->")
    if not reversible:
        body = body.replace("=", "->")
    body = body.replace("↑", " ^")
    body = body.replace("↓", " v")
    return re.sub(r"\s+", " ", body).strip()


def _split_reaction(display: str) -> tuple[str, str, str] | None:
    match = ARROW_RE.search(display)
    if not match:
        return None
    left = display[: match.start()].strip()
    right = display[match.end() :].strip()
    return left, match.group(1), right


def _split_species(side: str) -> list[str]:
    # Split only on reaction plus separators with whitespace, so ionic charge marks such as H+ survive.
    parts = re.split(r"\s+\+\s+", side)
    if len(parts) == 1:
        parts = [part for part in side.split("+") if part.strip()]
    return [_clean(part) for part in parts if _clean(part)]


def _species_formula(species: str) -> str:
    formulae = extract_formulae(species)
    return formulae[0] if formulae else ""


def _formula_counts(formula: str, coefficient: int) -> Counter[str]:
    text_value = formula
    counts: Counter[str] = Counter()
    for group, multiplier_text in GROUP_RE.findall(text_value):
        multiplier = int(multiplier_text or "1")
        for element, count_text in ELEMENT_RE.findall(group):
            counts[element] += int(count_text or "1") * multiplier * coefficient
        text_value = text_value.replace(f"({group}){multiplier_text}", "")
    for element, count_text in ELEMENT_RE.findall(text_value):
        counts[element] += int(count_text or "1") * coefficient
    return counts


def _side_counts(side: str) -> Counter[str]:
    counts: Counter[str] = Counter()
    for species in _split_species(side):
        match = re.match(r"^\s*(\d+)?\s*(.*)$", species)
        coefficient = int(match.group(1) or "1") if match else 1
        formula = _species_formula(match.group(2) if match else species)
        if formula:
            counts.update(_formula_counts(formula, coefficient))
    return counts


def normalize_reaction_equation(row: Any, *, row_order: int) -> dict[str, Any]:
    data = _dump_model(row)
    raw_text = _clean(data.get("raw_text"))
    metadata = data.get("metadata") if isinstance(data.get("metadata"), dict) else {}
    warnings: list[str] = []
    errors: list[str] = []
    display = normalize_chemistry_text(raw_text)
    split = _split_reaction(display)
    reactants: list[str] = []
    products: list[str] = []
    formulae: list[str] = []
    aliases: list[str] = []
    reaction_features: list[str] = []
    canonical_mhchem: str | None = None
    participants: dict[str, Any] = {}

    if not raw_text:
        errors.append("Equation row is empty")
    elif not split:
        errors.append("Unsupported reaction notation: include an equation arrow or equals sign")
    else:
        left, arrow, right = split
        reactants = _unique(_species_formula(species) for species in _split_species(left))
        products = _unique(_species_formula(species) for species in _split_species(right))
        if not reactants or not products:
            warnings.append("Parser could not confidently identify both reactants and products")
        formulae = _unique([*reactants, *products, *extract_formulae(display)])
        aliases = expand_formula_aliases(formulae)
        reaction_features = extract_reaction_features(display)
        participants = {"reactants": reactants, "products": products, "all": formulae, "arrow": arrow}
        canonical_mhchem = f"\\ce{{{_mhchem_body(display, arrow == '⇌')}}}"
        left_counts = _side_counts(left)
        right_counts = _side_counts(right)
        if left_counts and right_counts and left_counts != right_counts:
            warnings.append("Suspected imbalance; check coefficients and charges")

    validation_status = "invalid" if errors else "warning" if warnings else "valid"
    if validation_status == "invalid":
        formulae = []
        aliases = []
        reactants = []
        products = []
        participants = {}
        reaction_features = []
        canonical_mhchem = None

    return {
        "id": data.get("id"),
        "node_id": data.get("node_id"),
        "row_order": int(data.get("row_order") or row_order),
        "raw_text": raw_text,
        "canonical_display": display if validation_status != "invalid" else "",
        "canonical_mhchem": canonical_mhchem,
        "plain_search_text": display,
        "formulae": formulae,
        "aliases": aliases,
        "reactants": reactants,
        "products": products,
        "participants": participants,
        "reaction_features": reaction_features,
        "validation_status": validation_status,
        "warnings": warnings,
        "errors": errors,
        "parser_version": PARSER_VERSION,
        "migrated_from_principle_equation": bool(data.get("migrated_from_principle_equation")),
        "metadata": metadata,
    }


def normalize_reaction_equations(rows: list[Any]) -> list[dict[str, Any]]:
    normalized: list[dict[str, Any]] = []
    for index, row in enumerate(rows, start=1):
        data = _dump_model(row)
        if not _clean(data.get("raw_text")):
            continue
        normalized.append(normalize_reaction_equation(data, row_order=index))
    return normalized


def list_reaction_equations(session: Any, node_id: str) -> list[dict[str, Any]]:
    rows = (
        session.execute(
            text(
                """
                SELECT id, node_id, row_order, raw_text, canonical_display, canonical_mhchem,
                       plain_search_text, formulae, aliases, reactants, products, participants,
                       reaction_features, validation_status, warnings, errors, parser_version,
                       migrated_from_principle_equation, metadata
                FROM experiment_catalog_point_reaction_equations
                WHERE node_id = :node_id
                ORDER BY row_order, created_at, id
                """
            ),
            {"node_id": node_id},
        )
        .mappings()
        .all()
    )
    return [normalize_reaction_equation(dict(row), row_order=int(row["row_order"] or index)) for index, row in enumerate(rows, start=1)]


def replace_reaction_equations(session: Any, *, node_id: str, equations: list[dict[str, Any]]) -> None:
    session.execute(
        text("DELETE FROM experiment_catalog_point_reaction_equations WHERE node_id = :node_id"),
        {"node_id": node_id},
    )
    for index, equation in enumerate(equations, start=1):
        session.execute(
            text(
                """
                INSERT INTO experiment_catalog_point_reaction_equations (
                  node_id, row_order, raw_text, canonical_display, canonical_mhchem, plain_search_text,
                  formulae, aliases, reactants, products, participants, reaction_features,
                  validation_status, warnings, errors, parser_version, migrated_from_principle_equation,
                  metadata, updated_at
                )
                VALUES (
                  :node_id, :row_order, :raw_text, :canonical_display, :canonical_mhchem, :plain_search_text,
                  CAST(:formulae AS jsonb), CAST(:aliases AS jsonb), CAST(:reactants AS jsonb),
                  CAST(:products AS jsonb), CAST(:participants AS jsonb), CAST(:reaction_features AS jsonb),
                  :validation_status, CAST(:warnings AS jsonb), CAST(:errors AS jsonb), :parser_version,
                  :migrated_from_principle_equation, CAST(:metadata AS jsonb), now()
                )
                """
            ),
            {
                "node_id": node_id,
                "row_order": int(equation.get("row_order") or index),
                "raw_text": equation.get("raw_text") or "",
                "canonical_display": equation.get("canonical_display") or None,
                "canonical_mhchem": equation.get("canonical_mhchem") or None,
                "plain_search_text": equation.get("plain_search_text") or "",
                "formulae": _json(equation.get("formulae") or []),
                "aliases": _json(equation.get("aliases") or []),
                "reactants": _json(equation.get("reactants") or []),
                "products": _json(equation.get("products") or []),
                "participants": _json(equation.get("participants") or {}),
                "reaction_features": _json(equation.get("reaction_features") or []),
                "validation_status": equation.get("validation_status") or "warning",
                "warnings": _json(equation.get("warnings") or []),
                "errors": _json(equation.get("errors") or []),
                "parser_version": equation.get("parser_version") or PARSER_VERSION,
                "migrated_from_principle_equation": bool(equation.get("migrated_from_principle_equation")),
                "metadata": _json(equation.get("metadata") or {}),
            },
        )


def active_reaction_equations(content: dict[str, Any] | None) -> list[dict[str, Any]]:
    if not content or content.get("principle_mode") != "equation":
        return []
    return [row for row in content.get("reaction_equations") or [] if row.get("validation_status") != "invalid"]


def reaction_principle_text(content: dict[str, Any] | None) -> str:
    rows = active_reaction_equations(content)
    parts = [_clean(row.get("canonical_display") or row.get("raw_text")) for row in rows]
    parts = [part for part in parts if part]
    if parts:
        return "\n".join(parts)
    return _clean((content or {}).get("principle_equation"))


def reaction_derived_terms(content: dict[str, Any] | None) -> dict[str, list[str]]:
    rows = active_reaction_equations(content)
    return {
        "formulae": _unique([formula for row in rows for formula in row.get("formulae", [])]),
        "aliases": _unique([alias for row in rows for alias in row.get("aliases", [])]),
        "reaction_features": _unique([feature for row in rows for feature in row.get("reaction_features", [])]),
    }
