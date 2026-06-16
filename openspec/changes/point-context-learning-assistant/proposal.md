## Why

Students enter the learning assistant from a concrete chapter and often from a video-point learning context. The assistant currently treats RAG as the main evidence path and lets the policy gate classify only the latest text, which causes short follow-ups and point-explanation prompts to be misclassified as out-of-scope or platform-resource requests.

The assistant needs a stable point-context layer: chapter, experiment, video point, and bound experiment-textbook evidence must remain available even when hybrid RAG is disabled, while RAG stays an optional enhancement for broader theory, figures, and supporting material.

## What Changes

- Add structured point context to learning assistant requests, including optional `point_key` and point prompt metadata.
- Build a fixed point evidence package before optional RAG lookup, using the manual-reviewed video-point evidence bindings as the primary source.
- Make the policy gate context-aware by giving it recent conversation context or a resolved question, so short follow-ups inherit the prior course/point context.
- Narrow the platform-resource rail to published resource availability questions only, instead of treating every mention of video/material/resource as a resource request.
- Update the admin debug console so empty chat starts with centered video-point prompt suggestions and sends structured point context when a suggestion is selected.
- Preserve current safety, assessment, and out-of-course protections.

## Capabilities

### New Capabilities
- `point-context-learning-assistant`: Defines fixed chapter/experiment/video-point evidence behavior that is independent of optional RAG lookup.

### Modified Capabilities
- `student-chat-guardrails`: Policy classification must use resolved multi-turn context and must distinguish platform resource availability from point/content explanation.
- `learning-assistant-debug-console`: Debug console prompt suggestions must carry structured point context and expose point-context diagnostics.

## Impact

- Backend schemas: learning assistant and agent request models add optional `point_key` and resolved-context diagnostics.
- Backend agent: manual-reviewed point evidence loading, point evidence package assembly, policy-gate payload, local classifier, tool routing, and response diagnostics change.
- Admin API: `/api/admin/learning-assistant/ask` and `/ask/stream` pass point context through to the agent.
- Admin web: point prompt cards send structured point metadata and show clearer diagnostics for point context versus supplemental RAG.
- Tests: guardrail classification, RAG-disabled point explanation, resource availability query, and multi-turn follow-up coverage need targeted tests.
