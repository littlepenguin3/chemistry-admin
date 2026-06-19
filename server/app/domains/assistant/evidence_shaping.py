from __future__ import annotations

from typing import Any

from server.app.schemas import RagSource
from server.app.domains.assistant.rag_sources import _asset_url, _source_asset_markdown, source_to_dict


def build_figure_evidence_items(context: Any, evidence: list[dict[str, Any]]) -> list[dict[str, Any]]:
    candidates = [*evidence, *[source_to_dict(source) for source in context.sources]]
    result: list[dict[str, Any]] = []
    seen: set[str] = set()
    for item in candidates:
        assets = item.get("assets") or []
        if not assets:
            continue
        chunk_id = str(item.get("chunk_id") or item.get("id") or item.get("caption") or len(result))
        if chunk_id in seen:
            continue
        seen.add(chunk_id)
        result.append(
            {
                "source_file": item.get("source_file"),
                "page_number": item.get("page_number"),
                "caption": item.get("caption") or item.get("text_preview"),
                "content_type": item.get("content_type"),
                "asset_count": len(assets),
                "asset_files": [
                    {
                        "file_name": asset.get("file_name"),
                        "kind": asset.get("kind"),
                        "path": asset.get("path"),
                        "url": _asset_url(asset.get("path")),
                        "markdown": _source_asset_markdown(asset, item.get("caption") or item.get("text_preview")),
                    }
                    for asset in assets[:3]
                    if isinstance(asset, dict) and asset.get("path")
                ],
            }
        )
    return result[:3]


def merge_sources(existing: list[RagSource], incoming: list[RagSource]) -> list[RagSource]:
    result = list(existing)
    seen = {source.chunk_id for source in result}
    for source in incoming:
        if source.chunk_id not in seen:
            seen.add(source.chunk_id)
            result.append(source)
    return result[:8]


def rag_trace_payload(context: Any) -> dict[str, Any]:
    payload: dict[str, Any] = {}
    if context.rag_traces:
        payload.update({"runs": context.rag_traces, "latest": context.rag_traces[-1]})
    if context.point_evidence:
        payload["point_context"] = context.point_evidence
    return payload
