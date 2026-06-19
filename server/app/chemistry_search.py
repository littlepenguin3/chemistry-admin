from __future__ import annotations

import json
import re
from functools import lru_cache
from typing import Any

from server.app.infrastructure.settings import ROOT


ALIAS_PATH = ROOT / "data" / "seed" / "search" / "chemical_aliases.json"
STOPWORD_PATH = ROOT / "data" / "seed" / "search" / "chemical_stopwords.txt"

SUBSCRIPT_MAP = str.maketrans("₀₁₂₃₄₅₆₇₈₉", "0123456789")
SUPERSCRIPT_MAP = str.maketrans("⁰¹²³⁴⁵⁶⁷⁸⁹⁺⁻", "0123456789+-")
FULLWIDTH_MAP = str.maketrans("０１２３４５６７８９＋－＝→↑↓", "0123456789+-=→↑↓")
ARROW_VARIANTS = {
    "==": "=",
    "＝": "=",
    "->": "→",
    "-->": "→",
    "=>": "→",
    "⟶": "→",
    "⇌": "⇌",
}

FORMULA_RE = re.compile(r"(?<![A-Za-z0-9])(?:[A-Z][a-z]?\d*){1,8}(?:\([A-Z][a-z]?\d*\)\d*)?(?:[+-]\d*|[²³]?[+-])?(?![a-z])")
COEFFICIENT_RE = re.compile(r"^\d+")
STATE_MARKER_RE = re.compile(r"\((?:aq|s|l|g)\)", re.IGNORECASE)


@lru_cache(maxsize=1)
def chemical_aliases() -> dict[str, list[str]]:
    if not ALIAS_PATH.exists():
        return {}
    raw = json.loads(ALIAS_PATH.read_text(encoding="utf-8-sig"))
    return {normalize_formula(key): [str(item) for item in values] for key, values in raw.items() if isinstance(values, list)}


@lru_cache(maxsize=1)
def domain_stopwords() -> list[str]:
    if not STOPWORD_PATH.exists():
        return []
    return [line.strip() for line in STOPWORD_PATH.read_text(encoding="utf-8-sig").splitlines() if line.strip()]


def normalize_chemistry_text(value: Any) -> str:
    text = str(value or "").strip()
    text = text.translate(SUBSCRIPT_MAP).translate(SUPERSCRIPT_MAP).translate(FULLWIDTH_MAP)
    for source, target in ARROW_VARIANTS.items():
        text = text.replace(source, target)
    text = re.sub(r"\s+", " ", text)
    return text


def normalize_formula(value: Any) -> str:
    text = normalize_chemistry_text(value)
    text = STATE_MARKER_RE.sub("", text)
    text = text.replace("·", "")
    text = re.sub(r"[^A-Za-z0-9()+-]", "", text)
    text = COEFFICIENT_RE.sub("", text)
    return text.upper()


def extract_formulae(value: Any) -> list[str]:
    text = normalize_chemistry_text(value)
    results: list[str] = []
    seen: set[str] = set()
    for match in FORMULA_RE.finditer(text):
        formula = normalize_formula(match.group(0))
        if not formula or formula in seen:
            continue
        seen.add(formula)
        results.append(formula)
    return results


def expand_formula_aliases(formulae: list[str]) -> list[str]:
    aliases = chemical_aliases()
    values: list[str] = []
    seen: set[str] = set()
    for formula in formulae:
        normalized = normalize_formula(formula)
        for value in [normalized, *aliases.get(normalized, [])]:
            text = str(value or "").strip()
            if text and text not in seen:
                values.append(text)
                seen.add(text)
    return values


def extract_reaction_features(*parts: Any) -> list[str]:
    text = normalize_chemistry_text(" ".join(str(part or "") for part in parts))
    feature_checks = [
        ("gas_generation", ["↑", "气体", "气泡", "SO2", "CO2", "H2", "NH3", "刺激性", "sulfur dioxide", "gas"]),
        ("precipitation", ["↓", "沉淀", "浑浊", "析出", "白色固体", "硫沉淀", "precipitation", "precipitate"]),
        ("heating", ["△", "Δ", "加热", "受热", "热水", "酒精灯"]),
        ("color_change", ["褪色", "变色", "颜色", "橙色", "黄色", "蓝色", "紫色", "红棕色"]),
        ("phase_separation", ["分层", "有机层", "水层", "CCl4", "萃取"]),
        ("redox", ["氧化", "还原", "置换", "氧化性", "还原性"]),
    ]
    features: list[str] = []
    for feature, needles in feature_checks:
        if any(needle in text for needle in needles):
            features.append(feature)
    return features


def chemistry_terms_for_document(*parts: Any) -> dict[str, list[str]]:
    text = "\n".join(str(part or "") for part in parts)
    formulae = extract_formulae(text)
    aliases = expand_formula_aliases(formulae)
    return {
        "formulae": formulae,
        "aliases": aliases,
        "reaction_features": extract_reaction_features(text),
        "stopwords": domain_stopwords(),
    }


def normalize_search_query(query: str) -> str:
    normalized = normalize_chemistry_text(query)
    formulae = extract_formulae(normalized)
    if not formulae:
        return normalized
    aliases = expand_formula_aliases(formulae)
    return " ".join([normalized, *formulae, *aliases])
