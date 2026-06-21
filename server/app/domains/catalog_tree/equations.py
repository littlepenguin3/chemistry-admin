from __future__ import annotations

import json
import math
import os
import re
from collections import Counter
from fractions import Fraction
from typing import Any

from sqlalchemy import text

from server.app.chemistry_search import (
    expand_formula_aliases,
    extract_formulae,
    extract_reaction_features,
    normalize_chemistry_text,
)
from server.app.domains.platform.settings import effective_ai_settings
from server.app.infrastructure.settings import get_settings

PARSER_VERSION = "natural-v1"

ELEMENT_SYMBOLS = {
    "H",
    "He",
    "Li",
    "Be",
    "B",
    "C",
    "N",
    "O",
    "F",
    "Ne",
    "Na",
    "Mg",
    "Al",
    "Si",
    "P",
    "S",
    "Cl",
    "Ar",
    "K",
    "Ca",
    "Sc",
    "Ti",
    "V",
    "Cr",
    "Mn",
    "Fe",
    "Co",
    "Ni",
    "Cu",
    "Zn",
    "Ga",
    "Ge",
    "As",
    "Se",
    "Br",
    "Kr",
    "Rb",
    "Sr",
    "Ag",
    "Cd",
    "I",
    "Ba",
    "Hg",
    "Pb",
}

CHINESE_ALIASES = {
    "氯气": "Cl2",
    "氯水": "Cl2",
    "氢气": "H2",
    "氧气": "O2",
    "氮气": "N2",
    "溴水": "Br2",
    "溴": "Br2",
    "碘水": "I2",
    "碘": "I2",
    "氯化氢": "HCl",
    "盐酸": "HCl",
    "水": "H2O",
    "过氧化氢": "H2O2",
    "氢氧化钠": "NaOH",
    "氢氧化钾": "KOH",
    "氢氧化钙": "Ca(OH)2",
    "硫酸": "H2SO4",
    "稀硫酸": "H2SO4",
    "硝酸": "HNO3",
    "碳酸钙": "CaCO3",
    "碳酸钠": "Na2CO3",
    "碳酸氢钠": "NaHCO3",
    "氯化钠": "NaCl",
    "氯化钾": "KCl",
    "溴化钾": "KBr",
    "碘化钾": "KI",
    "硫酸铜": "CuSO4",
    "硫酸亚铁": "FeSO4",
    "高锰酸钾": "KMnO4",
    "二氧化碳": "CO2",
    "二氧化硫": "SO2",
    "氨气": "NH3",
    "氨水": "NH3",
    "淀粉": "starch",
}

STATE_RE = re.compile(r"\((aq|s|l|g)\)$", re.IGNORECASE)
ARROW_RE = re.compile(r"(<=>|⇌|--?>|=>|→|=)")
GROUP_RE = re.compile(r"\(([A-Za-z0-9]+)\)(\d*)")
ELEMENT_RE = re.compile(r"([A-Z][a-z]?)(\d*)")
SPECIES_RE = re.compile(r"^\s*(\d+)?\s*(.*)$")
SUBSCRIPT_DIGITS = str.maketrans("₀₁₂₃₄₅₆₇₈₉", "0123456789")
SUPERSCRIPT_SIGNS = str.maketrans("⁰¹²³⁴⁵⁶⁷⁸⁹⁺⁻", "0123456789+-")


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


def _teacher_warning(message: str) -> str:
    return message


def split_multiline_equations(value: Any) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    for line in str(value or "").splitlines():
        raw_text = line.strip()
        if raw_text:
            rows.append({"raw_text": raw_text, "row_order": len(rows) + 1})
    return rows


def equation_rows_from_inputs(rows: list[Any] | None = None, multiline_text: Any = None) -> list[dict[str, Any]]:
    multiline_rows = split_multiline_equations(multiline_text)
    if multiline_rows:
        return multiline_rows
    normalized_rows: list[dict[str, Any]] = []
    for index, row in enumerate(rows or [], start=1):
        data = _dump_model(row)
        raw_text = _clean(data.get("raw_text"))
        if raw_text:
            normalized_rows.append({"raw_text": raw_text, "row_order": data.get("row_order") or index, "metadata": data.get("metadata") or {}})
    return normalized_rows


def _replace_chinese_aliases(value: str) -> tuple[str, list[dict[str, str]], list[str]]:
    text_value = value
    mappings: list[dict[str, str]] = []
    warnings: list[str] = []
    for alias, formula in sorted(CHINESE_ALIASES.items(), key=lambda item: len(item[0]), reverse=True):
        if alias not in text_value:
            continue
        text_value = text_value.replace(alias, formula)
        mappings.append({"alias": alias, "formula": formula})
        warnings.append(_teacher_warning(f"已将“{alias}”识别为 {formula}。"))
    return text_value, mappings, warnings


def _normalize_arrow(arrow: str) -> str:
    if arrow in {"<=>", "⇌"}:
        return "⇌"
    if arrow in {"->", "-->", "=>", "→"}:
        return "→"
    return "="


def _prepare_text(raw_text: str) -> tuple[str, list[dict[str, str]], list[str]]:
    text_value = raw_text.translate(SUBSCRIPT_DIGITS).translate(SUPERSCRIPT_SIGNS)
    text_value = normalize_chemistry_text(text_value)
    text_value, alias_mappings, warnings = _replace_chinese_aliases(text_value)
    text_value = re.sub(r"\s+", " ", text_value.strip())
    text_value = re.sub(r"\s*(<=>|⇌|--?>|=>|→|=)\s*", lambda match: f" {_normalize_arrow(match.group(1))} ", text_value)
    text_value = re.sub(r"\s+", " ", text_value).strip()
    return text_value, alias_mappings, warnings


def _strip_state_and_charge(formula: str) -> str:
    value = STATE_RE.sub("", formula.strip())
    value = re.sub(r"(?<![A-Za-z])\^\{?[0-9+-]+\}?", "", value)
    value = re.sub(r"(?<=[A-Za-z0-9\]])[+-]$", "", value)
    return value


def _canonicalize_formula(value: str) -> tuple[str, bool, bool]:
    original = value
    state = ""
    state_match = STATE_RE.search(value.strip())
    if state_match:
        state = f"({state_match.group(1).lower()})"
        value = STATE_RE.sub("", value.strip())
    trailing_charge = ""
    charge_match = re.search(r"(\^\{?[0-9+-]+\}?|[+-])$", value)
    if charge_match and re.search(r"[A-Za-z0-9)\]]", value[: charge_match.start()]):
        trailing_charge = charge_match.group(1)
        value = value[: charge_match.start()]

    changed = False
    uncertain = False
    result: list[str] = []
    index = 0
    while index < len(value):
        char = value[index]
        if char.isalpha():
            two = value[index : index + 2]
            one = value[index]
            two_symbol = two[:1].upper() + two[1:2].lower()
            one_symbol = one.upper()
            if len(two) == 2 and two_symbol in ELEMENT_SYMBOLS:
                result.append(two_symbol)
                changed = changed or two != two_symbol
                index += 2
                continue
            if one_symbol in ELEMENT_SYMBOLS:
                result.append(one_symbol)
                changed = changed or one != one_symbol
                index += 1
                continue
            uncertain = True
            result.append(char)
            index += 1
            continue
        result.append(char)
        index += 1

    canonical = "".join(result) + trailing_charge + state
    return canonical, changed or canonical != original, uncertain


def _split_reaction(display: str) -> tuple[str, str, str] | None:
    match = ARROW_RE.search(display)
    if not match:
        return None
    left = display[: match.start()].strip()
    right = display[match.end() :].strip()
    return left, _normalize_arrow(match.group(1)), right


def _split_species(side: str) -> list[str]:
    spaced_parts = re.split(r"\s+\+\s+", side)
    if len(spaced_parts) > 1:
        return [_clean(part) for part in spaced_parts if _clean(part)]
    parts = re.split(r"(?<=[A-Za-z0-9)\]])\+(?=\d*[A-Za-z(\u4e00-\u9fff])", side)
    return [_clean(part) for part in parts if _clean(part)]


def _canonical_species(species: str) -> tuple[str, str, list[str], bool]:
    match = SPECIES_RE.match(species)
    coefficient = match.group(1) if match else ""
    body = (match.group(2) if match else species).strip()
    canonical_body, changed, uncertain = _canonicalize_formula(body)
    warnings: list[str] = []
    if changed:
        warnings.append(_teacher_warning(f"已将 {body} 识别为 {canonical_body}。"))
    if uncertain:
        warnings.append(_teacher_warning(f"{body} 中有无法确认的元素符号，请检查大小写或写法。"))
    display = f"{coefficient} {canonical_body}".strip() if coefficient else canonical_body
    return display, canonical_body, warnings, uncertain


def _canonical_side(side: str) -> tuple[str, list[str], list[str], bool]:
    displays: list[str] = []
    formulae: list[str] = []
    warnings: list[str] = []
    uncertain = False
    for species in _split_species(side):
        display, formula, species_warnings, species_uncertain = _canonical_species(species)
        displays.append(display)
        formulae.append(formula)
        warnings.extend(species_warnings)
        uncertain = uncertain or species_uncertain
    return " + ".join(displays), formulae, warnings, uncertain


def _mhchem_body(display: str, reversible: bool) -> str:
    body = display.replace("⇌", "<=>").replace("→", "->")
    if not reversible:
        body = body.replace("=", "->")
    body = body.replace("↑", " ^").replace("↓", " v")
    return re.sub(r"\s+", " ", body).strip()


def _species_formula(species: str) -> str:
    match = SPECIES_RE.match(species)
    body = match.group(2) if match else species
    formula = _strip_state_and_charge(body)
    formulae = extract_formulae(formula)
    return formulae[0] if formulae else ""


def _formula_counts(formula: str, coefficient: int = 1) -> Counter[str]:
    text_value = _strip_state_and_charge(formula)
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
        match = SPECIES_RE.match(species)
        coefficient = int(match.group(1) or "1") if match else 1
        formula = _species_formula(match.group(2) if match else species)
        if formula:
            counts.update(_formula_counts(formula, coefficient))
    return counts


def _species_without_coefficients(side: str) -> list[str]:
    species_list: list[str] = []
    for species in _split_species(side):
        match = SPECIES_RE.match(species)
        body = (match.group(2) if match else species).strip()
        if body:
            species_list.append(body)
    return species_list


def _matrix_rref(matrix: list[list[Fraction]]) -> tuple[list[list[Fraction]], list[int]]:
    rows = [row[:] for row in matrix]
    pivot_columns: list[int] = []
    row_index = 0
    column_count = len(rows[0]) if rows else 0
    for column in range(column_count):
        pivot = next((candidate for candidate in range(row_index, len(rows)) if rows[candidate][column]), None)
        if pivot is None:
            continue
        rows[row_index], rows[pivot] = rows[pivot], rows[row_index]
        factor = rows[row_index][column]
        rows[row_index] = [value / factor for value in rows[row_index]]
        for other in range(len(rows)):
            if other == row_index or not rows[other][column]:
                continue
            scale = rows[other][column]
            rows[other] = [value - scale * rows[row_index][idx] for idx, value in enumerate(rows[other])]
        pivot_columns.append(column)
        row_index += 1
        if row_index == len(rows):
            break
    return rows, pivot_columns


def _integer_nullspace_vector(matrix: list[list[int]]) -> list[int] | None:
    if not matrix or not matrix[0]:
        return None
    fractions = [[Fraction(value) for value in row] for row in matrix]
    rref, pivots = _matrix_rref(fractions)
    column_count = len(matrix[0])
    free_columns = [column for column in range(column_count) if column not in pivots]
    if not free_columns:
        return None
    solution = [Fraction(0) for _ in range(column_count)]
    free_column = free_columns[-1]
    solution[free_column] = Fraction(1)
    for pivot_row, pivot_column in enumerate(pivots):
        solution[pivot_column] = -sum(rref[pivot_row][column] * solution[column] for column in free_columns)
    denominators = [value.denominator for value in solution if value]
    lcm = 1
    for denominator in denominators:
        lcm = lcm * denominator // math.gcd(lcm, denominator)
    integers = [int(value * lcm) for value in solution]
    if all(value <= 0 for value in integers):
        integers = [-value for value in integers]
    if any(value <= 0 for value in integers):
        return None
    divisor = 0
    for value in integers:
        divisor = math.gcd(divisor, abs(value))
    if divisor > 1:
        integers = [value // divisor for value in integers]
    if max(integers, default=0) > 24:
        return None
    return integers


def _format_balanced_side(species: list[str], coefficients: list[int]) -> str:
    parts: list[str] = []
    for formula, coefficient in zip(species, coefficients, strict=False):
        parts.append(formula if coefficient == 1 else f"{coefficient} {formula}")
    return " + ".join(parts)


def _balance_suggestion(left: str, right: str, arrow: str) -> str | None:
    left_species = _species_without_coefficients(left)
    right_species = _species_without_coefficients(right)
    all_species = [*left_species, *right_species]
    if len(all_species) < 2 or len(all_species) > 8:
        return None
    species_counts = [_formula_counts(species) for species in all_species]
    if any(not counts for counts in species_counts):
        return None
    elements = sorted({element for counts in species_counts for element in counts})
    matrix: list[list[int]] = []
    for element in elements:
        matrix.append(
            [
                *(counts.get(element, 0) for counts in species_counts[: len(left_species)]),
                *(-counts.get(element, 0) for counts in species_counts[len(left_species) :]),
            ]
        )
    coefficients = _integer_nullspace_vector(matrix)
    if not coefficients:
        return None
    left_text = _format_balanced_side(left_species, coefficients[: len(left_species)])
    right_text = _format_balanced_side(right_species, coefficients[len(left_species) :])
    return f"{left_text} {arrow} {right_text}"


def normalize_reaction_equation(row: Any, *, row_order: int) -> dict[str, Any]:
    data = _dump_model(row)
    raw_text = _clean(data.get("raw_text"))
    metadata = data.get("metadata") if isinstance(data.get("metadata"), dict) else {}
    warnings: list[str] = []
    errors: list[str] = []
    corrections: list[str] = []
    alias_mappings: list[dict[str, str]] = []
    display = ""
    reactants: list[str] = []
    products: list[str] = []
    formulae: list[str] = []
    aliases: list[str] = []
    reaction_features: list[str] = []
    canonical_mhchem: str | None = None
    suggested_display: str | None = None
    suggested_mhchem: str | None = None
    suggestion_reason: str | None = None
    participants: dict[str, Any] = {}

    if not raw_text:
        errors.append("请先输入反应式。")
    else:
        prepared, alias_mappings, alias_warnings = _prepare_text(raw_text)
        warnings.extend(alias_warnings)
        split = _split_reaction(prepared)
        if not split:
            errors.append("未找到反应箭头或等号，请使用 =、->、→ 或 ⇌。")
        else:
            left, arrow, right = split
            canonical_left, reactant_species, left_warnings, left_uncertain = _canonical_side(left)
            canonical_right, product_species, right_warnings, right_uncertain = _canonical_side(right)
            warnings.extend(left_warnings)
            warnings.extend(right_warnings)
            display_arrow = "⇌" if arrow == "⇌" else "→" if arrow in {"=", "→"} else arrow
            display = f"{canonical_left} {display_arrow} {canonical_right}"
            if prepared != display:
                corrections.append(_teacher_warning(f"已规范为：{display}"))
            reactants = _unique(_species_formula(species) for species in reactant_species)
            products = _unique(_species_formula(species) for species in product_species)
            if not reactants or not products:
                warnings.append("系统无法稳定识别反应物和生成物，请检查写法。")
            if left_uncertain or right_uncertain:
                warnings.append("部分元素符号识别不确定，请人工确认。")
            formulae = _unique([*reactants, *products, *extract_formulae(display)])
            aliases = expand_formula_aliases(formulae)
            reaction_features = extract_reaction_features(display, raw_text)
            participants = {"reactants": reactants, "products": products, "all": formulae, "arrow": display_arrow}
            canonical_mhchem = f"\\ce{{{_mhchem_body(display, display_arrow == '⇌')}}}"
            left_counts = _side_counts(canonical_left)
            right_counts = _side_counts(canonical_right)
            balanced = _balance_suggestion(canonical_left, canonical_right, display_arrow)
            if left_counts and right_counts and left_counts != right_counts:
                if balanced and balanced != display:
                    warnings.append("当前系数疑似未配平，系统给出可采用的配平建议。")
                    suggested_display = balanced
                    suggested_mhchem = f"\\ce{{{_mhchem_body(balanced, display_arrow == '⇌')}}}"
                    suggestion_reason = "配平建议"
                else:
                    warnings.append("当前系数疑似未配平，请检查配平和电荷。")
            elif corrections:
                suggested_display = display
                suggested_mhchem = canonical_mhchem
                suggestion_reason = "规范写法建议"

    validation_status = "invalid" if errors else "warning" if warnings else "valid"
    if validation_status == "invalid":
        formulae = []
        aliases = []
        reactants = []
        products = []
        participants = {}
        reaction_features = []
        canonical_mhchem = None
        suggested_display = None
        suggested_mhchem = None
        suggestion_reason = None

    metadata = {
        **metadata,
        "alias_mappings": alias_mappings,
        "corrections": corrections,
    }

    return {
        "id": data.get("id"),
        "node_id": data.get("node_id"),
        "canonical_point_id": data.get("canonical_point_id"),
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
        "suggested_display": suggested_display,
        "suggested_mhchem": suggested_mhchem,
        "suggestion_reason": suggestion_reason,
        "corrections": corrections,
    }


def normalize_reaction_equations(rows: list[Any]) -> list[dict[str, Any]]:
    normalized: list[dict[str, Any]] = []
    for index, row in enumerate(rows, start=1):
        data = _dump_model(row)
        if not _clean(data.get("raw_text")):
            continue
        normalized.append(normalize_reaction_equation(data, row_order=index))
    return normalized


def _assist_draft_from_normalized(
    row: dict[str, Any],
    *,
    source: str,
    rationale: str,
    row_order: int | None = None,
    supplemental: bool = False,
) -> dict[str, Any] | None:
    replacement_text = _clean(row.get("canonical_display") or row.get("raw_text"))
    if not replacement_text or row.get("validation_status") == "invalid":
        return None
    canonical_mhchem = row.get("canonical_mhchem")
    return {
        "draft_text": replacement_text,
        "replacement_text": replacement_text,
        "canonical_display": replacement_text,
        "canonical_mhchem": canonical_mhchem,
        "validation_status": row.get("validation_status") or "warning",
        "warnings": row.get("warnings") or [],
        "errors": row.get("errors") or [],
        "formulae": row.get("formulae") or [],
        "source": source,
        "rationale": rationale,
        "row_order": row_order,
        "supplemental": supplemental or row_order is None,
    }


def _ai_settings_ready() -> tuple[Any | None, str | None]:
    settings = effective_ai_settings(get_settings())
    provider = settings.agent_llm_provider
    api_key = settings.agent_llm_api_key or os.getenv("OPENAI_API_KEY", "")
    model = settings.agent_llm_model or os.getenv("OPENAI_MODEL", "")
    if provider not in {"openai", "openai_compatible"}:
        return None, "AI 反应式校对尚未接入；暂时无法生成 AI 建议。"
    if not api_key or not model:
        return None, "AI 接入缺少模型或密钥；暂时无法生成 AI 建议。"
    return settings, None


def _equation_ai_prompt(payload: Any, normalized_rows: list[dict[str, Any]]) -> list[dict[str, str]]:
    point_context = {
        "point_title": _clean(getattr(payload, "point_title", None)),
        "catalog_path_text": _clean(getattr(payload, "catalog_path_text", None)),
        "phenomenon_explanation": _clean(getattr(payload, "phenomenon_explanation", None)),
        "safety_note": _clean(getattr(payload, "safety_note", None)),
    }
    parser_rows = [
        {
            "row_order": row.get("row_order"),
            "raw_text": row.get("raw_text"),
            "canonical_display": row.get("canonical_display"),
            "validation_status": row.get("validation_status"),
            "warnings": row.get("warnings") or [],
            "errors": row.get("errors") or [],
            "formulae": row.get("formulae") or [],
        }
        for row in normalized_rows
    ]
    return [
        {
            "role": "system",
            "content": (
                "你是高中化学实验反应式助手。请基于教师当前输入、点位上下文和 parser_preview 给出 AI 校对建议。"
                "只返回 JSON，不要 Markdown。格式：{\"drafts\":[{\"row_order\":1,\"draft_text\":\"...\",\"rationale\":\"...\"}]}。"
                "draft_text 必须是单行反应式，可使用 →、⇌、↑、↓，不要直接保存，不要编造危险操作步骤。"
                "不要把 parser 的自动规范化或配平猜测直接当作候选；只有你确信应替换或补全时才返回 draft。"
                "如果原始输入为空，可根据点位上下文生成候选反应式；如果不确定，请少给或不给。"
            ),
        },
        {
            "role": "user",
            "content": json.dumps(
                {
                    "mode": _clean(getattr(payload, "mode", "suggest")),
                    "point_context": point_context,
                    "parser_preview": parser_rows,
                    "current_multiline_text": _clean(getattr(payload, "multiline_text", None)),
                },
                ensure_ascii=False,
            ),
        },
    ]


def _sanitize_ai_drafts(raw_drafts: Any, normalized_rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    if not isinstance(raw_drafts, list):
        return []
    valid_orders = {int(row["row_order"]) for row in normalized_rows if row.get("row_order")}
    drafts: list[dict[str, Any]] = []
    seen: set[tuple[int | None, str]] = set()
    for item in raw_drafts[:8]:
        if not isinstance(item, dict):
            continue
        draft_text = _clean(item.get("draft_text"))
        if not draft_text or "\n" in draft_text or len(draft_text) > 300:
            continue
        row_order_raw = item.get("row_order")
        try:
            row_order = int(row_order_raw) if row_order_raw is not None else None
        except (TypeError, ValueError):
            row_order = None
        if row_order is not None and row_order not in valid_orders:
            row_order = None
        normalized = normalize_reaction_equation(
            {"raw_text": draft_text, "row_order": row_order},
            row_order=row_order or len(normalized_rows) + len(drafts) + 1,
        )
        normalized_candidate = _assist_draft_from_normalized(
            normalized,
            source="ai",
            rationale=_clean(item.get("rationale"))[:220] or "AI 已根据点位内容和当前输入给出候选反应式，采用前请核对。",
            row_order=row_order,
            supplemental=row_order is None,
        )
        if not normalized_candidate:
            continue
        key = (row_order, normalized_candidate["canonical_display"])
        if key in seen:
            continue
        seen.add(key)
        drafts.append(normalized_candidate)
    return drafts


def _try_ai_equation_drafts(payload: Any, normalized_rows: list[dict[str, Any]]) -> tuple[list[dict[str, Any]], str | None]:
    settings, unavailable_reason = _ai_settings_ready()
    if settings is None:
        return [], unavailable_reason
    try:
        from openai import OpenAI

        client = OpenAI(api_key=settings.agent_llm_api_key or os.getenv("OPENAI_API_KEY"), base_url=settings.agent_llm_base_url or None)
        response = client.chat.completions.create(
            model=settings.agent_llm_model or os.getenv("OPENAI_MODEL", ""),
            response_format={"type": "json_object"},
            messages=_equation_ai_prompt(payload, normalized_rows),
        )
        content = response.choices[0].message.content or "{}"
        data = json.loads(content)
        drafts = _sanitize_ai_drafts(data.get("drafts"), normalized_rows)
        if drafts:
            return drafts, "AI 已根据当前输入生成建议；采用后会重新渲染预览。"
        return [], "AI 没有发现需要替换的反应式。"
    except Exception as exc:
        return [], f"AI 校对暂时失败：{str(exc)[:160]}。"


def assist_reaction_equations(payload: Any) -> dict[str, Any]:
    rows = equation_rows_from_inputs(getattr(payload, "equations", None), getattr(payload, "multiline_text", None))
    normalized_rows = normalize_reaction_equations(rows)
    ai_drafts, ai_reason = _try_ai_equation_drafts(payload, normalized_rows)
    if ai_drafts:
        return {"available": True, "reason": ai_reason, "drafts": ai_drafts}
    return {
        "available": False,
        "reason": ai_reason or "AI 暂不可用；请先输入反应式，或补充点位现象后再试。",
        "drafts": [],
    }


def _canonical_point_id_for_node(session: Any, node_id: str) -> str | None:
    row = (
        session.execute(
            text("SELECT canonical_point_id FROM experiment_catalog_nodes WHERE id = :node_id"),
            {"node_id": node_id},
        )
        .mappings()
        .first()
    )
    return str(row["canonical_point_id"]) if row and row.get("canonical_point_id") else None


def list_reaction_equations(session: Any, node_id: str, *, canonical_point_id: str | None = None) -> list[dict[str, Any]]:
    canonical_point_id = canonical_point_id or _canonical_point_id_for_node(session, node_id)
    rows = (
        session.execute(
            text(
                """
                SELECT id, node_id, canonical_point_id, row_order, raw_text, canonical_display, canonical_mhchem,
                       plain_search_text, formulae, aliases, reactants, products, participants,
                       reaction_features, validation_status, warnings, errors, parser_version,
                       migrated_from_principle_equation, metadata
                FROM experiment_catalog_point_reaction_equations
                WHERE (:canonical_point_id IS NOT NULL AND canonical_point_id = :canonical_point_id)
                   OR node_id = :node_id
                ORDER BY row_order, created_at, id
                """
            ),
            {"node_id": node_id, "canonical_point_id": canonical_point_id},
        )
        .mappings()
        .all()
    )
    return [normalize_reaction_equation(dict(row), row_order=int(row["row_order"] or index)) for index, row in enumerate(rows, start=1)]


def replace_reaction_equations(
    session: Any,
    *,
    node_id: str,
    equations: list[dict[str, Any]],
    canonical_point_id: str | None = None,
) -> None:
    canonical_point_id = canonical_point_id or _canonical_point_id_for_node(session, node_id)
    session.execute(
        text(
            """
            DELETE FROM experiment_catalog_point_reaction_equations
            WHERE (:canonical_point_id IS NOT NULL AND canonical_point_id = :canonical_point_id)
               OR node_id = :node_id
            """
        ),
        {"node_id": node_id, "canonical_point_id": canonical_point_id},
    )
    for index, equation in enumerate(equations, start=1):
        session.execute(
            text(
                """
                INSERT INTO experiment_catalog_point_reaction_equations (
                  node_id, canonical_point_id, row_order, raw_text, canonical_display, canonical_mhchem, plain_search_text,
                  formulae, aliases, reactants, products, participants, reaction_features,
                  validation_status, warnings, errors, parser_version, migrated_from_principle_equation,
                  metadata, updated_at
                )
                VALUES (
                  :node_id, :canonical_point_id, :row_order, :raw_text, :canonical_display, :canonical_mhchem, :plain_search_text,
                  CAST(:formulae AS jsonb), CAST(:aliases AS jsonb), CAST(:reactants AS jsonb),
                  CAST(:products AS jsonb), CAST(:participants AS jsonb), CAST(:reaction_features AS jsonb),
                  :validation_status, CAST(:warnings AS jsonb), CAST(:errors AS jsonb), :parser_version,
                  :migrated_from_principle_equation, CAST(:metadata AS jsonb), now()
                )
                """
            ),
            {
                "node_id": node_id,
                "canonical_point_id": canonical_point_id,
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
