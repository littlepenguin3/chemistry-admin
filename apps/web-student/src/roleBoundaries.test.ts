import { describe, expect, it } from "vitest";

import apiSource from "./api.ts?raw";
import appSource from "./App.tsx?raw";
import authUtilsSource from "./features/auth/authUtils.ts?raw";
import assistantPanelSource from "./features/assistant/StudentAiChatPanel.tsx?raw";

describe("student console role boundaries", () => {
  it("keeps student routes on student APIs and rejects teacher/operator sessions", () => {
    expect(apiSource).toContain('api<AuthUser>("/api/auth/me")');
    expect(apiSource).not.toContain("/api/admin");
    expect(apiSource).not.toContain("/api/web-admin");
    expect(appSource).toContain('currentUser.role !== "student"');
    expect(authUtilsSource).toContain('response.user.role === "student"');
  });

  it("does not expose teacher notes or raw RAG/chunk traces in student AI metadata rendering", () => {
    expect(apiSource).not.toContain("teacher_note");
    expect(apiSource).not.toContain("chunk_id?:");
    expect(assistantPanelSource).not.toContain("chunk_id");
    expect(assistantPanelSource).not.toContain("score");
    expect(assistantPanelSource).toContain("引用资料");
    expect(assistantPanelSource).not.toMatch(/source\.(title|section)/);
  });
});
