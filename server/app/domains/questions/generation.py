from __future__ import annotations

import json
import os
from typing import Any, Callable

from server.app.domains.errors import DomainHTTPException as HTTPException, domain_status as status
from sqlalchemy import text

from server.app.canonical_evidence import load_evidence_source_refs
from server.app.infrastructure.settings import get_settings
from server.app.infrastructure.database import db_session
from server.app.experiment_admin_schemas import GenerationRequest
from server.app.domains.platform.settings import effective_ai_settings
from server.app.domains.catalog.experiments import _ensure_experiment
from server.app.domains.questions.bank import _json, _json_array, _validate_question_payload

OBJECTIVE_TYPES = {"single_choice", "true_false", "fill_blank"}

def _load_generation_sources(
    session: Any,
    *,
    experiment: dict[str, Any],
    prompt: str,
    chapter_ids: list[str],
    knowledge_point_ids: list[str],
    limit: int = 6,
) -> list[dict[str, Any]]:
    if not chapter_ids:
        chapter_ids = [
            row["chapter_id"]
            for row in session.execute(
                text("SELECT chapter_id FROM experiment_chapter_bindings WHERE experiment_id = :experiment_id"),
                {"experiment_id": experiment["id"]},
            )
            .mappings()
            .all()
        ]
    return load_evidence_source_refs(
        session,
        prompt=prompt,
        experiment=experiment,
        chapter_ids=chapter_ids,
        knowledge_point_ids=knowledge_point_ids,
        limit=limit,
    )

def _local_generated_questions(
    *,
    experiment: dict[str, Any],
    request: GenerationRequest,
    source_refs: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    valid_types = [item for item in request.question_types if item in OBJECTIVE_TYPES] or ["single_choice"]
    questions: list[dict[str, Any]] = []
    for index in range(request.count):
        q_type = valid_types[index % len(valid_types)]
        title = experiment["title"]
        code = experiment["code"]
        common = {
            "difficulty": request.difficulty or "basic",
            "source_refs": source_refs,
            "related_chapter_ids": request.chapter_ids,
            "related_knowledge_point_ids": request.knowledge_point_ids,
            "source_chunk_ids": [item["chunk_id"] for item in source_refs if item.get("chunk_id")],
            "status": "draft",
        }
        if q_type == "single_choice":
            questions.append(
                {
                    **common,
                    "question_type": "single_choice",
                    "stem": f"关于{title}，以下哪一项最适合作为学习关注点？",
                    "options": [
                        {"label": "A", "text": "实验现象、反应结论与安全注意事项"},
                        {"label": "B", "text": "与该实验无关的生活常识"},
                        {"label": "C", "text": "未发布视频的播放地址"},
                        {"label": "D", "text": "学生个人账号密码"},
                    ],
                    "answer": {"value": "A"},
                    "explanation": "题目由本地生成器产生，需教师结合实验资料核验后再发布。",
                }
            )
        elif q_type == "true_false":
            questions.append(
                {
                    **common,
                    "question_type": "true_false",
                    "stem": f"{title}应作为一个具体实验点管理，并可在该实验下绑定多个视频资源。",
                    "options": [],
                    "answer": {"value": True},
                    "explanation": "正式目录以具体实验点为后台实验主实体，教师发布前仍需核验表述。",
                }
            )
        else:
            questions.append(
                {
                    **common,
                    "question_type": "fill_blank",
                    "stem": f"{title}对应的正式实验编号是____。",
                    "options": [],
                    "answer": {"accepted_answers": [code], "match": "normalized_exact"},
                    "explanation": "本题检查实验编号识别，可作为导入后基础题。",
                }
            )
    return questions

def _try_openai_generation(
    *,
    experiment: dict[str, Any],
    request: GenerationRequest,
    source_refs: list[dict[str, Any]],
) -> list[dict[str, Any]] | None:
    settings = effective_ai_settings(get_settings())
    if settings.agent_llm_provider == "disabled":
        return None
    api_key = settings.agent_llm_api_key or os.getenv("OPENAI_API_KEY", "")
    model = settings.agent_llm_model or os.getenv("OPENAI_MODEL", "gpt-4.1-mini")
    if not api_key:
        return None
    try:
        from openai import OpenAI

        client = OpenAI(api_key=api_key, base_url=settings.agent_llm_base_url or None)
        response = client.chat.completions.create(
            model=model,
            response_format={"type": "json_object"},
            messages=[
                {
                    "role": "system",
                    "content": (
                        "You generate teacher-reviewed objective chemistry experiment questions. "
                        "Return JSON only: {\"questions\":[...]}. "
                        "Allowed question_type values: single_choice, true_false, fill_blank. "
                        "Do not publish, do not include unsafe operational details beyond classroom-safe theory."
                    ),
                },
                {
                    "role": "user",
                    "content": json.dumps(
                        {
                            "experiment": {
                                "id": experiment["id"],
                                "code": experiment["code"],
                                "title": experiment["title"],
                                "summary": experiment.get("summary"),
                            },
                            "prompt": request.prompt,
                            "question_types": request.question_types,
                            "count": request.count,
                            "difficulty": request.difficulty,
                            "sources": source_refs,
                        },
                        ensure_ascii=False,
                    ),
                },
            ],
        )
        content = response.choices[0].message.content or "{}"
        data = json.loads(content)
        rows = data.get("questions") or []
        return rows if isinstance(rows, list) else None
    except Exception:
        return None

def _question_source_chunk_ids(source_refs: list[dict[str, Any]], source_audit: dict[str, Any] | None = None) -> list[str]:
    seen: set[str] = set()
    values: list[str] = []
    for raw in [
        *((source_audit or {}).get("canonical_chunk_ids") or []),
        *((source_audit or {}).get("supporting_theory_chunk_ids") or []),
        *[item.get("chunk_id") for item in source_refs if isinstance(item, dict)],
    ]:
        value = str(raw or "").strip()
        if value and value not in seen:
            seen.add(value)
            values.append(value)
    return values


EvidencePackageLoader = Callable[..., dict[str, Any]]

CATALOG_NODE_EVIDENCE_REQUIRED_DETAIL = (
    "Fresh catalog-node evidence is required for AI question generation. "
    "Legacy experiment_id/point_key evidence and generic canonical RAG refs are not valid after the catalog reset."
)


def _as_string_list(value: Any) -> list[str]:
    if not isinstance(value, list):
        return []
    return [str(item).strip() for item in value if str(item or "").strip()]


def _catalog_node_evidence_ready(
    evidence_package: dict[str, Any] | None,
    *,
    target_point_node_ids: list[str] | None = None,
) -> bool:
    if not isinstance(evidence_package, dict):
        return False
    mode = str(evidence_package.get("mode") or "").strip()
    contract = str(evidence_package.get("evidence_contract") or "").strip()
    diagnostics = evidence_package.get("diagnostics") if isinstance(evidence_package.get("diagnostics"), dict) else {}
    strategy = str(diagnostics.get("source_strategy") or "").strip()
    if "catalog_node_evidence" not in {mode, contract, strategy}:
        return False

    package_node_ids = {
        *_as_string_list(evidence_package.get("target_point_node_ids")),
        *_as_string_list(evidence_package.get("catalog_node_ids")),
        *_as_string_list(evidence_package.get("point_node_ids")),
        *_as_string_list(diagnostics.get("target_point_node_ids")),
        *_as_string_list(diagnostics.get("catalog_node_ids")),
    }
    requested_node_ids = set(_as_string_list(target_point_node_ids or []))
    if requested_node_ids and not requested_node_ids.issubset(package_node_ids):
        return False
    if not package_node_ids:
        return False
    source_refs = evidence_package.get("source_refs")
    return isinstance(source_refs, list) and bool(source_refs)


def generate_question_drafts(
    *,
    payload: GenerationRequest,
    user: Any,
    rag_gate: dict[str, Any],
    evidence_loader: EvidencePackageLoader,
) -> dict[str, Any]:
    with db_session() as session:
        experiment = _ensure_experiment(session, payload.experiment_id)
        evidence_package = evidence_loader(
            session,
            experiment=experiment,
            prompt=payload.prompt,
            target_question={
                "related_chapter_ids": payload.chapter_ids,
                "related_knowledge_point_ids": payload.knowledge_point_ids,
            },
            target_points=[],
            rag_gate=rag_gate,
        )
        source_refs = list(evidence_package.get("source_refs") or [])
        if not source_refs:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="No usable evidence was found for this experiment context; AI question generation is blocked.",
            )
        if not _catalog_node_evidence_ready(evidence_package):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=CATALOG_NODE_EVIDENCE_REQUIRED_DETAIL,
            )
        warning = "" if source_refs else "当前实验资料尚未充分入库，已使用实验目录与理论章节信息生成草稿，发布前必须人工核验。"
        ai_settings = effective_ai_settings(get_settings())
        generated = _try_openai_generation(experiment=experiment, request=payload, source_refs=source_refs)
        mode = "openai_sdk" if generated else "local_template"
        if not generated:
            generated = _local_generated_questions(experiment=experiment, request=payload, source_refs=source_refs)
        generation_id = str(
            session.execute(
                text(
                    """
                    INSERT INTO experiment_question_generations (
                      experiment_id, prompt, question_types, difficulty, requested_count,
                      provider, model, mode, rag_sources, warning, status, created_by, metadata
                    )
                    VALUES (
                      :experiment_id, :prompt, :question_types, :difficulty, :requested_count,
                      :provider, :model, :mode, CAST(:rag_sources AS jsonb),
                      :warning, 'draft', CAST(:created_by AS uuid), CAST(:metadata AS jsonb)
                    )
                    RETURNING id
                    """
                ),
                {
                    "experiment_id": payload.experiment_id,
                    "prompt": payload.prompt,
                    "question_types": payload.question_types,
                    "difficulty": payload.difficulty,
                    "requested_count": payload.count,
                    "provider": "openai" if mode == "openai_sdk" else "local",
                    "model": ai_settings.agent_llm_model or os.getenv("OPENAI_MODEL", ""),
                    "mode": mode,
                    "rag_sources": _json_array(source_refs),
                    "warning": warning,
                    "created_by": user.id,
                    "metadata": _json(
                        {
                            "chapter_ids": payload.chapter_ids,
                            "knowledge_point_ids": payload.knowledge_point_ids,
                            "rag_gate": rag_gate,
                            "evidence_package": evidence_package,
                        }
                    ),
                },
            ).scalar_one()
        )
        drafts: list[dict[str, Any]] = []
        for row in generated[: payload.count]:
            row_payload = {
                **row,
                "difficulty": row.get("difficulty") or payload.difficulty or "basic",
                "source_refs": row.get("source_refs") or source_refs,
                "status": "draft",
            }
            normalized, errors = _validate_question_payload(row_payload)
            draft = dict(
                session.execute(
                    text(
                        """
                        INSERT INTO experiment_question_drafts (
                          generation_id, experiment_id, payload, validation_errors, status
                        )
                        VALUES (
                          CAST(:generation_id AS uuid), :experiment_id,
                          CAST(:payload AS jsonb), CAST(:errors AS jsonb), 'draft'
                        )
                        RETURNING *
                        """
                    ),
                    {
                        "generation_id": generation_id,
                        "experiment_id": payload.experiment_id,
                        "payload": _json(normalized or row_payload),
                        "errors": _json_array(errors),
                    },
                )
                .mappings()
                .one()
            )
            drafts.append(draft)
    return {
        "generation_id": generation_id,
        "mode": mode,
        "warning": warning,
        "source_refs": source_refs,
        "evidence_package": evidence_package,
        "drafts": drafts,
    }
