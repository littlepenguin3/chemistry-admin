from __future__ import annotations

from typing import Any

from server.app.domains.assistant.output_normalization import has_raw_latex_leak, normalize_assistant_formula_output


def has_resource_tool_result(context: Any) -> bool:
    for call in context.tool_calls:
        if call.get("name") == "published_resource_lookup" and call.get("result_count", 0) > 0:
            return True
    return False


def count_result(result: Any) -> int:
    if isinstance(result, list):
        return len(result)
    if isinstance(result, dict):
        if "resources" in result and isinstance(result["resources"], list):
            return len(result["resources"])
        if "evidence" in result and isinstance(result["evidence"], list):
            return len(result["evidence"])
        return len(result)
    return 1 if result else 0


def preview_result(result: Any) -> str:
    text = str(result)
    return text[:240]


def normalize_formula_answer(answer: str) -> tuple[str, bool]:
    normalized_answer = normalize_assistant_formula_output(answer)
    return normalized_answer, normalized_answer != answer and has_raw_latex_leak(answer)
