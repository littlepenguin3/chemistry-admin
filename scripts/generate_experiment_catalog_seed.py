from __future__ import annotations

import argparse
import hashlib
import json
import re
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from server.app.domains.catalog_tree.catalog_seed import (
    CATALOG_SEED_VALIDATION_REPORT_PATH,
    CATALOG_TREE_SEED_PATH,
    EXPECTED_CATALOG_COUNTS,
    POINT_CONTENT_EXAMPLES_SEED_PATH,
    validate_catalog_seed,
)

OUTLINE_SOURCE = ROOT / "docs" / "实验目录_整理版.md"
EXAMPLE_SOURCE = ROOT / "docs" / "30点位例子.txt"
OUTLINE_SOURCE_LABEL = "docs/实验目录_整理版.md"
EXAMPLE_SOURCE_LABEL = "docs/30点位例子.txt"


@dataclass(frozen=True)
class ExampleMapping:
    example_number: int
    example_title: str
    target_path: tuple[str, ...]


EXAMPLE_MAPPINGS: tuple[ExampleMapping, ...] = (
    ExampleMapping(1, "第18章 五 焰色反应", ("第18章 碱金属和碱土金属", "五、焰色反应", "锂、钠、钾、钙、锶、钡盐的焰色反应")),
    ExampleMapping(2, "第18章 一 1.钠加热燃烧实验", ("第18章 碱金属和碱土金属", "一、碱金属、碱土金属单质活泼性的比较", "钠加热燃烧实验")),
    ExampleMapping(3, "第18章 一 2.镁条燃烧实验", ("第18章 碱金属和碱土金属", "一、碱金属、碱土金属单质活泼性的比较", "镁条燃烧实验")),
    ExampleMapping(4, "第18章 一 3.钠与水反应", ("第18章 碱金属和碱土金属", "一、碱金属、碱土金属单质活泼性的比较", "钠与水反应")),
    ExampleMapping(5, "第18章 一 5.镁与冷／热水反应", ("第18章 碱金属和碱土金属", "一、碱金属、碱土金属单质活泼性的比较", "镁与冷／热水反应")),
    ExampleMapping(6, "第18章 一 6.钙与水反应", ("第18章 碱金属和碱土金属", "一、碱金属、碱土金属单质活泼性的比较", "钙与水反应")),
    ExampleMapping(7, "第15章 二 （1）亚硝酸的生成与分解", ("第15章 氮族元素", "二、亚硝酸及其盐的性质", "亚硝酸的生成与分解")),
    ExampleMapping(8, "第15章 二 （2）亚硝酸的氧化性", ("第15章 氮族元素", "二、亚硝酸及其盐的性质", "亚硝酸的氧化性")),
    ExampleMapping(9, "第15章 二 （3）亚硝酸的还原性", ("第15章 氮族元素", "二、亚硝酸及其盐的性质", "亚硝酸的还原性")),
    ExampleMapping(10, "NaNO₂ + 对氨基苯磺酸 + 萘胺 | HAc酸性体系", ("第15章 氮族元素", "二、亚硝酸及其盐的性质", "亚硝酸根的检验方法", "NaNO₂ + 对氨基苯磺酸 + 萘胺 | HAc酸性体系")),
    ExampleMapping(11, "NaNO₂ + KI + CCl₄ | H₂SO₄酸性体系", ("第15章 氮族元素", "二、亚硝酸及其盐的性质", "亚硝酸根的检验方法", "NaNO₂ + KI + CCl₄ | H₂SO₄酸性体系")),
    ExampleMapping(12, "浓硝酸 + 硫粉", ("第15章 氮族元素", "三、硝酸及其盐的性质", "硝酸的氧化性", "浓硝酸 + 硫粉")),
    ExampleMapping(13, "浓硝酸 + Na₂S", ("第15章 氮族元素", "三、硝酸及其盐的性质", "硝酸的氧化性", "浓硝酸 + Na2S")),
    ExampleMapping(14, "浓硝酸/稀硝酸 + 铜", ("第15章 氮族元素", "三、硝酸及其盐的性质", "硝酸的氧化性", "浓硝酸/稀硝酸 + 铜")),
    ExampleMapping(15, "FeSO₄·7H₂O + NaNO₃ + 浓硫酸", ("第15章 氮族元素", "三、硝酸及其盐的性质", "硝酸根的检验", "FeSO₄·7H₂O + NaNO₃ + 浓硫酸")),
    ExampleMapping(16, "难溶性硅酸盐的生成——“水中花园”", ("第17章 硼族元素", "一、硼、硅的相似相异性", "难溶性硅酸盐的生成——“水中花园”")),
    ExampleMapping(17, "KI + 浓硫酸 | 湿的醋酸铅试纸", ("第13章 卤族元素", "三、卤素离子的还原性（通风橱内进行）", "利用浓硫酸比较卤素离子的还原性", "KI + 浓硫酸 | 湿的醋酸铅试纸")),
    ExampleMapping(18, "KBr + 浓硫酸 | 湿的KI-淀粉试纸", ("第13章 卤族元素", "三、卤素离子的还原性（通风橱内进行）", "利用浓硫酸比较卤素离子的还原性", "KBr + 浓硫酸 | 湿的KI-淀粉试纸")),
    ExampleMapping(19, "KCl + 浓硫酸 | 湿的pH试纸", ("第13章 卤族元素", "三、卤素离子的还原性（通风橱内进行）", "利用浓硫酸比较卤素离子的还原性", "KCl + 浓硫酸 | 湿的pH试纸")),
    ExampleMapping(20, "NaClO + MnSO₄", ("第13章 卤族元素", "五、卤素含氧酸盐的氧化性", "次氯酸盐的氧化性", "NaClO + MnSO₄")),
    ExampleMapping(21, "NaClO + 品红溶液", ("第13章 卤族元素", "五、卤素含氧酸盐的氧化性", "次氯酸盐的氧化性", "NaClO + 品红溶液")),
    ExampleMapping(22, "NaClO + KI-淀粉 | 酸性体系", ("第13章 卤族元素", "五、卤素含氧酸盐的氧化性", "次氯酸盐的氧化性", "NaClO + KI-淀粉 | 酸性体系")),
    ExampleMapping(23, "KClO₃ + 浓盐酸 | 湿 KI-淀粉试纸", ("第13章 卤族元素", "五、卤素含氧酸盐的氧化性", "氯酸盐的氧化性", "KClO₃ + 浓盐酸 | 湿 KI-淀粉试纸")),
    ExampleMapping(24, "KClO₃ + Na₂SO₃ + AgNO₃", ("第13章 卤族元素", "五、卤素含氧酸盐的氧化性", "氯酸盐的氧化性", "KClO₃ + Na₂SO₃ + AgNO₃")),
    ExampleMapping(25, "KClO₃ + KI + CCl₄", ("第13章 卤族元素", "五、卤素含氧酸盐的氧化性", "氯酸盐的氧化性", "KClO₃ + KI + CCl₄")),
    ExampleMapping(26, "KClO₃ + KI-淀粉 | 酸性体系", ("第13章 卤族元素", "五、卤素含氧酸盐的氧化性", "氯酸盐的氧化性", "KClO₃ + KI-淀粉 | 酸性体系")),
    ExampleMapping(27, "高氯酸盐的氧化性", ("第13章 卤族元素", "五、卤素含氧酸盐的氧化性", "高氯酸盐的氧化性")),
    ExampleMapping(28, "卤化银的感光性", ("第13章 卤族元素", "七、金属卤化物的性质", "卤化银的感光性")),
    ExampleMapping(29, "过氧化氢的酸性", ("第14章 氧族元素", "三、过氧化氢的制备与性质", "过氧化氢的性质", "过氧化氢的酸性")),
    ExampleMapping(30, "H₂O₂ + KI | 酸性体系", ("第14章 氧族元素", "三、过氧化氢的制备与性质", "过氧化氢的性质", "过氧化氢的氧化性", "H₂O₂ + KI | 酸性体系")),
)


def _slug_hash(value: str) -> str:
    return hashlib.sha1(value.encode("utf-8")).hexdigest()[:16]


def _chapter_title(chapter_number: int, title: str) -> str:
    return f"第{chapter_number}章 {title.strip()}"


def _seed_key(*, chapter_number: int, path_titles: list[str], display_order: int) -> str:
    payload = f"{chapter_number}\0{'/'.join(path_titles)}\0{display_order}"
    return f"cat-outline-ch{chapter_number}-{_slug_hash(payload)}"


def _display_order(order_by_parent: dict[str, int], parent_key: str) -> int:
    order_by_parent[parent_key] = order_by_parent.get(parent_key, 0) + 1
    return order_by_parent[parent_key]


def parse_catalog_outline(path: Path) -> list[dict[str, Any]]:
    lines = path.read_text(encoding="utf-8-sig").splitlines()
    nodes: list[dict[str, Any]] = []
    by_key: dict[str, dict[str, Any]] = {}
    stack: list[dict[str, Any]] = []
    order_by_parent: dict[str, int] = {}
    current_chapter: dict[str, Any] | None = None
    current_heading: dict[str, Any] | None = None

    def add_node(title: str, line_number: int, *, parent: dict[str, Any] | None, source_kind: str) -> dict[str, Any]:
        if current_chapter is None:
            raise ValueError(f"line {line_number}: catalog node outside chapter")
        path_titles = [current_chapter["chapter_title"]]
        if parent:
            path_titles.extend(list(parent["path_titles"])[1:])
        path_titles.append(title)
        parent_key = str(parent["seed_key"]) if parent else f"chapter:{current_chapter['chapter_number']}"
        display_order = _display_order(order_by_parent, parent_key)
        seed_key = _seed_key(
            chapter_number=int(current_chapter["chapter_number"]),
            path_titles=path_titles,
            display_order=display_order,
        )
        node = {
            "chapter_number": current_chapter["chapter_number"],
            "chapter_id": f"CH{int(current_chapter['chapter_number']):02d}",
            "seed_key": seed_key,
            "parent_seed_key": str(parent["seed_key"]) if parent else None,
            "node_kind": "directory" if source_kind == "heading" else "unknown",
            "title": title,
            "path_titles": path_titles,
            "display_order": display_order,
            "source_doc": OUTLINE_SOURCE_LABEL,
            "source_line": line_number,
            "source_kind": source_kind,
        }
        nodes.append(node)
        by_key[seed_key] = node
        return node

    for line_number, line in enumerate(lines, start=1):
        chapter_match = re.match(r"^#\s*第\s*(\d+)\s*章\s*(.+?)\s*$", line)
        if chapter_match:
            chapter_number = int(chapter_match.group(1))
            current_chapter = {
                "chapter_number": chapter_number,
                "chapter_title": _chapter_title(chapter_number, chapter_match.group(2)),
            }
            current_heading = None
            stack = []
            continue

        heading_match = re.match(r"^##\s+(.+?)\s*$", line)
        if heading_match and current_chapter:
            title = heading_match.group(1).strip()
            if current_chapter["chapter_number"] == 21 and title == "暂无对应实验内容":
                current_heading = None
                stack = []
                continue
            current_heading = add_node(title, line_number, parent=None, source_kind="heading")
            stack = []
            continue

        bullet_match = re.match(r"^(\s*)-\s+(.+?)\s*$", line)
        if not bullet_match or not current_chapter:
            continue
        title = bullet_match.group(2).strip()
        if current_chapter["chapter_number"] == 21 and title == "暂无对应实验内容":
            continue
        depth = len(bullet_match.group(1).replace("\t", "  ")) // 2
        if depth == 0:
            parent = current_heading
        else:
            if depth - 1 >= len(stack):
                raise ValueError(f"line {line_number}: missing parent bullet for {title}")
            parent = stack[depth - 1]
        node = add_node(title, line_number, parent=parent, source_kind="bullet")
        if depth >= len(stack):
            stack.extend([{}] * (depth - len(stack) + 1))
        stack[depth] = node
        stack = stack[: depth + 1]

    parent_keys = {str(node.get("parent_seed_key")) for node in nodes if node.get("parent_seed_key")}
    for node in nodes:
        if node["node_kind"] == "unknown":
            node["node_kind"] = "directory" if node["seed_key"] in parent_keys else "point"
    return nodes


def _parse_example_blocks(path: Path) -> dict[int, dict[str, Any]]:
    lines = path.read_text(encoding="utf-8-sig").splitlines()
    blocks: dict[int, dict[str, Any]] = {}
    current: dict[str, Any] | None = None
    current_field: str | None = None
    expected_number = 1
    field_labels = {
        "实验原理": "principle_text",
        "现象解释": "phenomenon_explanation",
        "安全提示": "safety_note",
    }

    def append_field(field: str, value: str) -> None:
        if current is None:
            return
        current.setdefault(field, [])
        if value.strip():
            current[field].append(value.rstrip())

    for line_number, line in enumerate(lines, start=1):
        start_match = re.match(r"^\s*(\d{1,2})[.．]\s*(.+?)\s*$", line)
        is_expected_heading = False
        if start_match and int(start_match.group(1)) == expected_number:
            heading_title = start_match.group(2).strip()
            is_expected_heading = expected_number > 16 or "第" in heading_title
        if is_expected_heading and start_match:
            if current is not None:
                current["source_line_end"] = line_number - 1
                blocks[int(current["example_number"])] = current
            current = {
                "example_number": expected_number,
                "source_line_start": line_number,
                "example_title_from_source": start_match.group(2).strip(),
                "principle_text": [],
                "phenomenon_explanation": [],
                "safety_note": [],
            }
            current_field = None
            expected_number += 1
            continue
        if current is None:
            continue
        stripped = line.strip()
        header = next((label for label in field_labels if stripped.startswith(label)), None)
        if header:
            current_field = field_labels[header]
            remainder = stripped[len(header) :].lstrip("：:").strip()
            append_field(current_field, remainder)
            continue
        if current_field:
            append_field(current_field, line)
    if current is not None:
        current["source_line_end"] = len(lines)
        blocks[int(current["example_number"])] = current
    return blocks


def build_point_content_examples(nodes: list[dict[str, Any]], example_source: Path) -> list[dict[str, Any]]:
    blocks = _parse_example_blocks(example_source)
    nodes_by_path = {" / ".join(node["path_titles"]): node for node in nodes}
    examples: list[dict[str, Any]] = []
    errors: list[str] = []
    for mapping in EXAMPLE_MAPPINGS:
        block = blocks.get(mapping.example_number)
        if not block:
            errors.append(f"example {mapping.example_number}: missing source block")
            continue
        target_path_text = " / ".join(mapping.target_path)
        target = nodes_by_path.get(target_path_text)
        if not target:
            errors.append(f"example {mapping.example_number}: target path does not resolve: {target_path_text}")
            continue
        examples.append(
            {
                "example_number": mapping.example_number,
                "example_title": mapping.example_title,
                "example_title_from_source": block["example_title_from_source"],
                "target_seed_key": target["seed_key"],
                "target_path_titles": list(mapping.target_path),
                "target_path": target_path_text,
                "principle_mode": "text",
                "principle_text": "\n".join(block["principle_text"]).strip(),
                "phenomenon_explanation": "\n".join(block["phenomenon_explanation"]).strip(),
                "safety_note": "\n".join(block["safety_note"]).strip(),
                "content_status": "published",
                "source_doc": EXAMPLE_SOURCE_LABEL,
                "source_line_start": block["source_line_start"],
                "source_line_end": block["source_line_end"],
            }
        )
    if errors:
        raise ValueError("Point-content example mapping failed:\n" + "\n".join(errors))
    return examples


def write_json(path: Path, payload: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def generate_catalog_seed(
    *,
    outline_path: Path = OUTLINE_SOURCE,
    example_path: Path = EXAMPLE_SOURCE,
    catalog_path: Path = CATALOG_TREE_SEED_PATH,
    examples_path: Path = POINT_CONTENT_EXAMPLES_SEED_PATH,
    report_path: Path = CATALOG_SEED_VALIDATION_REPORT_PATH,
) -> dict[str, Any]:
    nodes = parse_catalog_outline(outline_path)
    examples = build_point_content_examples(nodes, example_path)
    validation = validate_catalog_seed(nodes, examples)
    catalog_payload = {
        "metadata": {
            "artifact_type": "experiment_catalog_outline_seed",
            "version": "catalog-outline-v1",
            "source_doc": OUTLINE_SOURCE_LABEL,
            "expected_counts": EXPECTED_CATALOG_COUNTS,
            "classification": "## headings and non-leaf bullets are directories; leaf bullets are point nodes.",
        },
        "nodes": nodes,
    }
    examples_payload = {
        "metadata": {
            "artifact_type": "experiment_catalog_point_content_examples",
            "version": "catalog-outline-30-examples-v1",
            "source_doc": EXAMPLE_SOURCE_LABEL,
            "mapping_source": "openspec/changes/replace-legacy-experiment-seeds-with-catalog-outline-seed/design.md",
            "content_status": "published",
        },
        "examples": examples,
    }
    report = {
        **validation,
        "catalog_seed": catalog_path.relative_to(ROOT).as_posix(),
        "point_content_examples_seed": examples_path.relative_to(ROOT).as_posix(),
    }
    write_json(catalog_path, catalog_payload)
    write_json(examples_path, examples_payload)
    write_json(report_path, report)
    return report


def main() -> None:
    parser = argparse.ArgumentParser(description="Generate the canonical experiment catalog outline seed.")
    parser.add_argument("--outline", type=Path, default=OUTLINE_SOURCE)
    parser.add_argument("--examples", type=Path, default=EXAMPLE_SOURCE)
    parser.add_argument("--catalog-output", type=Path, default=CATALOG_TREE_SEED_PATH)
    parser.add_argument("--examples-output", type=Path, default=POINT_CONTENT_EXAMPLES_SEED_PATH)
    parser.add_argument("--report", type=Path, default=CATALOG_SEED_VALIDATION_REPORT_PATH)
    args = parser.parse_args()

    report = generate_catalog_seed(
        outline_path=args.outline,
        example_path=args.examples,
        catalog_path=args.catalog_output,
        examples_path=args.examples_output,
        report_path=args.report,
    )
    sys.stdout.buffer.write((json.dumps(report, ensure_ascii=False, indent=2) + "\n").encode("utf-8"))
    if not report["ok"]:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
