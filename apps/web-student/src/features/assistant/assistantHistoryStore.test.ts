import { afterEach, describe, expect, it } from "vitest";
import { defaultAssistantContext } from "./assistantContext";
import {
  buildStudentAiHistoryEntry,
  clearActiveStudentAiHistoryId,
  clearStudentAiHistory,
  readStudentAiHistory,
  saveActiveStudentAiHistoryId,
  readActiveStudentAiHistoryId,
  sanitizeStudentAiHistoryTitle,
  upsertStudentAiHistory,
} from "./assistantHistoryStore";

afterEach(() => {
  clearStudentAiHistory();
  clearActiveStudentAiHistoryId();
});

describe("student AI history rich-content ids", () => {
  it("normalizes local message ids without storing rendered artifacts", () => {
    const entry = buildStudentAiHistoryEntry({
      id: "history-rich-content",
      context: defaultAssistantContext(),
      source: "root",
      messages: [
        { role: "user", content: "解释溴水现象" },
        {
          role: "assistant",
          content: "| 试剂 | 现象 |\n|---|---|\n| KBr | $\\ce{Br2}$ |",
        },
      ],
    });

    const saved = upsertStudentAiHistory(entry);
    const restored = readStudentAiHistory(saved.id);

    expect(restored?.messages.map((message) => message.id)).toEqual([
      "history-rich-content-user-1",
      "history-rich-content-assistant-2",
    ]);
    expect(restored?.messages[1]?.content).toContain(String.raw`$\ce{Br2}$`);
    expect(JSON.stringify(restored?.messages)).not.toContain("<svg");
    expect(JSON.stringify(restored?.messages)).not.toContain("artifactId");
  });

  it("stores the active history id separately for route-backed artifact return", () => {
    saveActiveStudentAiHistoryId("history-rich-content");
    expect(readActiveStudentAiHistoryId()).toBe("history-rich-content");
    clearActiveStudentAiHistoryId();
    expect(readActiveStudentAiHistoryId()).toBeNull();
  });

  it("uses a valid generated title for the same local history entry", () => {
    const context = defaultAssistantContext();
    const messages = [
      { role: "user" as const, content: "Why does the CCl4 layer turn orange after adding chlorine water?" },
      { role: "assistant" as const, content: "Bromide is oxidized to bromine." },
    ];
    const initial = buildStudentAiHistoryEntry({
      id: "history-title",
      context,
      source: "root",
      messages,
      createdAt: "2026-06-25T01:00:00.000Z",
    });
    const titled = buildStudentAiHistoryEntry({
      id: initial.id,
      context,
      source: "root",
      messages,
      createdAt: initial.createdAt,
      title: "CCl4 layer color",
    });

    expect(initial.title).toBe("Why does the CCl4 layer turn...");
    expect(titled.title).toBe("CCl4 layer color");
    expect(titled.id).toBe(initial.id);
    expect(titled.createdAt).toBe(initial.createdAt);
    expect(titled.messages.map((message) => message.content)).toEqual(messages.map((message) => message.content));
  });

  it("keeps fallback titles when generated titles are absent or invalid", () => {
    const messages = [{ role: "user" as const, content: "Explain why KI starch paper turns blue." }];

    expect(sanitizeStudentAiHistoryTitle("KI starch blue")).toBe("KI starch blue");
    expect(sanitizeStudentAiHistoryTitle("{\"conversation_title\":\"KI starch blue\"}")).toBe("");
    expect(sanitizeStudentAiHistoryTitle("Please use Markdown")).toBe("");
    expect(
      buildStudentAiHistoryEntry({
        id: "history-invalid-title",
        context: defaultAssistantContext(),
        source: "root",
        messages,
        title: "Please use Markdown",
      }).title,
    ).toBe("Explain why KI starch paper ...");
  });
});
