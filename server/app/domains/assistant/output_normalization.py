from __future__ import annotations

import re


CHEM_MATH_OUTPUT_CONTRACT = (
    "\nChemistry/math formatting contract:\n"
    "- Inline formulas MUST use $...$ and block formulas MUST use $$...$$.\n"
    "- Every chemical formula, ion, and reaction using mhchem MUST use braces: \\ce{...}. Never write loose forms such as \\ceKMnO4, \\ceCl2, \\ceMn^{2+}, or \\ceMnO2.\n"
    "- Whole reaction equations MUST be one mhchem expression, for example $\\ce{Cl2 + 2Br- -> 2Cl- + Br2}$. Do not split one reaction into multiple \\ce fragments.\n"
    "- Use mhchem arrows inside \\ce{...}: ->, <-, <=>. Do not write -->, -- >, \\rightarrow, or plain math arrows for reaction equations.\n"
    "- Use \\mathrm{...} only inside math delimiters for units or roman text, for example $0.1\\,\\mathrm{mol\\cdot L^{-1}}$.\n"
    "- Do NOT emit raw LaTeX commands such as \\mathrm, \\ce, \\ch, \\rightarrow, \\cdot, or \\Delta outside math delimiters.\n"
    "- Do NOT emit HTML line breaks such as <br>; use Markdown lists or tables.\n"
)


_FENCED_BLOCK_RE = re.compile(r"(```[\s\S]*?```)")
_MATH_SPAN_RE = re.compile(r"(\$\$[\s\S]*?\$\$|\$(?:\\.|[^$])+\$)")
_BRACED_CHEM_COMMAND_RE = re.compile(r"\\(?:ce|ch|mathrm|text)\s*\{(?:[^{}]|\{[^{}]*\})*\}")
_UNIT_EXPRESSION_RE = re.compile(r"\d+(?:\.\d+)?\s*(?:\\,)?\s*\\mathrm\s*\{(?:[^{}]|\{[^{}]*\})*\}")
_LOOSE_CHEM_REACTION_RE = re.compile(
    r"\\(ce|ch)\s*(?!\{)([-+A-Za-z0-9\s\\_^{}().·]*?(?:-{1,3}\s*>|=>|<=>|→|⇌)[-+A-Za-z0-9\s\\_^{}().·]*)"
)
_LOOSE_CHEM_COMMAND_RE = re.compile(
    r"\\(ce|ch)\s*(?!\{)((?:[A-Z0-9][A-Za-z0-9+\-().=<>·]*|[_^]\{[^{}]*\}|[_^](?:[+\-]?\d+[+\-]?|[+\-]))+)"
)
_BARE_MATH_COMMAND_RE = re.compile(
    r"\\(?:rightarrow|to|leftarrow|rightleftharpoons|Delta|delta|ominus|cdot|times|pm|circ|alpha|beta|gamma)\b"
)
_BARE_FORMULA_RE = re.compile(
    rf"(?:{_UNIT_EXPRESSION_RE.pattern}|{_BRACED_CHEM_COMMAND_RE.pattern}|{_BARE_MATH_COMMAND_RE.pattern})"
)
_RAW_LATEX_LEAK_RE = re.compile(r"\\(?:ce|ch|mathrm|text|rightarrow|cdot|Delta|ominus|times)\b")


def normalize_math_delimiters(text: str) -> str:
    text = re.sub(r"\\\[([\s\S]*?)\\\]", lambda match: f"$${match.group(1)}$$", text)
    return re.sub(r"\\\(([\s\S]*?)\\\)", lambda match: f"${match.group(1)}$", text)


def normalize_chem_reaction_body(body: str) -> str:
    body = re.sub(r"\\(?:ce|ch)\s*\{([^{}]*)\}", r"\1", body)
    body = _LOOSE_CHEM_COMMAND_RE.sub(lambda match: match.group(2), body)
    body = re.sub(r"-{1,3}\s*>|=>|→", "->", body)
    return re.sub(r"\s+", " ", body).strip()


def normalize_loose_chem_commands(text: str) -> str:
    text = _LOOSE_CHEM_REACTION_RE.sub(
        lambda match: f"\\{match.group(1)}{{{normalize_chem_reaction_body(match.group(2))}}}",
        text,
    )
    return _LOOSE_CHEM_COMMAND_RE.sub(lambda match: f"\\{match.group(1)}{{{match.group(2)}}}", text)


def wrap_bare_formula_commands(text: str) -> str:
    parts = _MATH_SPAN_RE.split(text)
    normalized: list[str] = []
    for index, part in enumerate(parts):
        if not part:
            continue
        if index % 2 == 1:
            normalized.append(part)
            continue
        segment = _BARE_FORMULA_RE.sub(lambda match: f"${match.group(0)}$", normalize_loose_chem_commands(part))
        normalized.append(segment)
    return "".join(normalized)


def normalize_assistant_formula_output(answer: str) -> str:
    if not answer:
        return answer
    blocks = _FENCED_BLOCK_RE.split(answer)
    normalized: list[str] = []
    for index, block in enumerate(blocks):
        if index % 2 == 1:
            normalized.append(block)
            continue
        text = normalize_math_delimiters(block)
        text = normalize_loose_chem_commands(text)
        text = wrap_bare_formula_commands(text)
        normalized.append(text)
    return "".join(normalized)


def has_raw_latex_leak(text: str) -> bool:
    return bool(_RAW_LATEX_LEAK_RE.search(text))
