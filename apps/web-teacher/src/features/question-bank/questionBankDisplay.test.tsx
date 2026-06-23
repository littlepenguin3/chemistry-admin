import { describe, expect, it } from "vitest";

import type { LearningAssistantRuntime } from "../../api/learningAssistant";
import {
  questionWorkbenchGateFromRuntime,
  textbookSectionLabels,
  workbenchEvidenceSectionsFromPackage,
} from "./questionBankDisplay";

function runtimeWithRag(ragRuntime: Record<string, unknown>): LearningAssistantRuntime {
  return {
    checked_at: "2026-06-22T10:00:00Z",
    rag_runtime: {
      rag_enabled: true,
      query_generation_enabled: true,
      textbook_rag_enabled: true,
      textbook_rag_status: "healthy",
      textbook_rag_index: "canonical-rag-chunks-qwen-v1",
      ...ragRuntime,
    } as LearningAssistantRuntime["rag_runtime"],
  };
}

describe("question workbench display helpers", () => {
  it("allows AI workbench actions when textbook RAG is healthy", () => {
    const gate = questionWorkbenchGateFromRuntime(runtimeWithRag({ textbook_rag_status: "healthy" }));

    expect(gate.healthy).toBe(true);
    expect(gate.tone).toBe("ready");
    expect(gate.route).toContain("canonical-rag-chunks-qwen-v1");
    expect(gate.message).toContain("已绑定教材证据");
  });

  it("keeps AI workbench actions available when textbook refresh is stale", () => {
    const gate = questionWorkbenchGateFromRuntime(
      runtimeWithRag({
        textbook_rag_status: "index_stale",
        textbook_rag_message: "教材 chunk 索引需要重建。",
      }),
    );

    expect(gate.healthy).toBe(true);
    expect(gate.tone).toBe("ready");
    expect(gate.message).toContain("已绑定教材证据");
  });

  it("groups workbench evidence by point and textbook section", () => {
    const sections = workbenchEvidenceSectionsFromPackage({
      point_packages: {
        "point-a": {
          point: { point_title: "氯水置换溴离子" },
          sections: {
            principle: {
              sufficient: true,
              sources: [
                { chunk_id: "chunk-1", source_file: "textbook.jsonl" },
                { chunk_id: "chunk-2", source_file: "textbook.jsonl" },
              ],
            },
            safety: {
              sufficient: false,
              missing_reason: "未召回安全提示证据",
              sources: [],
            },
          },
        },
      },
    });

    expect(sections).toHaveLength(2);
    expect(textbookSectionLabels.principle).toBe("实验原理");
    expect(sections[0]).toMatchObject({
      pointKey: "point-a",
      pointTitle: "氯水置换溴离子",
      section: "principle",
      sufficient: true,
      sourceCount: 2,
    });
    expect(sections[1]).toMatchObject({
      section: "safety",
      sufficient: false,
      missingReason: "未召回安全提示证据",
    });
  });

  it("groups workbench evidence from static source refs", () => {
    const sections = workbenchEvidenceSectionsFromPackage({
      source_refs: [
        { chunk_id: "chunk-1", point_node_id: "point-a", evidence_role: "principle", source_file: "textbook.jsonl" },
        { chunk_id: "chunk-2", point_node_id: "point-a", evidence_role: "principle", source_file: "textbook.jsonl" },
        { chunk_id: "chunk-3", point_node_id: "point-a", evidence_role: "safety", source_file: "textbook.jsonl" },
      ],
    });

    expect(sections).toHaveLength(2);
    expect(sections[0]).toMatchObject({ pointKey: "point-a", section: "principle", sourceCount: 2 });
    expect(sections[1]).toMatchObject({ pointKey: "point-a", section: "safety", sourceCount: 1 });
  });
});
