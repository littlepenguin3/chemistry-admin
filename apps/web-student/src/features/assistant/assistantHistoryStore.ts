import type { AgentChatMessage, StudentAssistantFinalMetadata } from "../../api";
import type { AssistantContext } from "./assistantContext";

const STORAGE_KEY = "student-ai-chat-history:v1";
const ACTIVE_HISTORY_KEY = "student-ai-active-history-id:v1";
const MAX_HISTORY_ENTRIES = 30;
const MAX_STORED_MESSAGES = 40;
const GENERATED_TITLE_MIN_VISIBLE_CHARS = 4;
const GENERATED_TITLE_MAX_VISIBLE_CHARS = 18;
const GENERATED_TITLE_REJECT_TERMS = [
  "markdown",
  "json",
  "atom",
  "assistant",
  "prompt",
  "conversation",
  "history",
  "admin",
  "teacher",
  "rag",
  "chunk",
  "trace",
  "debug",
  "guardrail",
  "\u6211\u6b63\u5728\u5b66\u4e60",
  "\u8bf7\u89e3\u91ca",
  "\u8bf7\u7528",
  "\u73b0\u4ee3",
  "\u56de\u7b54",
  "\u8fd9\u4e2a\u5185\u5bb9\u4e3b\u8981",
  "\u9009\u62e9\u5b9e\u9a8c",
  "\u9009\u62e9\u70b9\u4f4d",
  "\u5b66\u751f\u7aef",
  "\u6559\u5e08",
  "\u540e\u53f0",
];

export type StudentAiChatMessage = AgentChatMessage & {
  id?: string;
  thinkingAnimationId?: string;
  metadata?: StudentAssistantFinalMetadata;
  state?: "error";
};

export type StudentAiHistorySource = "root" | "detail";

export type StudentAiHistoryEntry = {
  id: string;
  title: string;
  contextTitle: string;
  contextType: AssistantContext["context_type"];
  contextSummary: string;
  source: StudentAiHistorySource;
  context: AssistantContext;
  messages: StudentAiChatMessage[];
  createdAt: string;
  updatedAt: string;
};

function storage(): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function sessionStorageSafe(): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

function nowIso(): string {
  return new Date().toISOString();
}

function text(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function visibleCharCount(value: string): number {
  return value.replace(/\s+/g, "").length;
}

export function sanitizeStudentAiHistoryTitle(value: unknown): string {
  if (typeof value !== "string") return "";
  const raw = value.trim();
  if (!raw || raw.includes("\n") || raw.includes("\r")) return "";
  if (/```|[{}\[\]<>`#*|]/.test(raw)) return "";
  const withoutListMarker = raw.replace(/^(?:[-*]|\d+[.)])\s*/, "").trim();
  const cleaned = withoutListMarker.replace(/^[\s"'`_*#\-:：,，.。;；!?！？()[\]{}<>【】《》]+|[\s"'`_*#\-:：,，.。;；!?！？()[\]{}<>【】《》]+$/g, "");
  const normalized = cleaned.replace(/\s+/g, " ").trim();
  const visibleLength = visibleCharCount(normalized);
  if (visibleLength < GENERATED_TITLE_MIN_VISIBLE_CHARS || visibleLength > GENERATED_TITLE_MAX_VISIBLE_CHARS) return "";
  const lower = normalized.toLowerCase();
  const compact = lower.replace(/\s+/g, "");
  if (GENERATED_TITLE_REJECT_TERMS.some((term) => lower.includes(term.toLowerCase()) || compact.includes(term.toLowerCase().replace(/\s+/g, "")))) {
    return "";
  }
  return normalized;
}

export function createStudentAiMessageId(role: AgentChatMessage["role"] = "assistant"): string {
  if (typeof globalThis.crypto?.randomUUID === "function") return `${role}-${globalThis.crypto.randomUUID()}`;
  return `${role}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function fallbackMessageId(historyId: string, index: number, role: AgentChatMessage["role"]): string {
  return `${historyId || "legacy"}-${role}-${index + 1}`;
}

function messagesFrom(value: unknown, historyId = ""): StudentAiChatMessage[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((message): message is StudentAiChatMessage => {
      if (!message || typeof message !== "object") return false;
      const role = (message as StudentAiChatMessage).role;
      return (role === "user" || role === "assistant") && typeof (message as StudentAiChatMessage).content === "string";
    })
    .slice(-MAX_STORED_MESSAGES)
    .map((message, index) => ({
      ...message,
      id: text(message.id) || fallbackMessageId(historyId, index, message.role),
    }));
}

function contextFrom(value: unknown): AssistantContext | null {
  if (!value || typeof value !== "object") return null;
  const context = value as AssistantContext;
  if (!context.context_type || !context.context_title) return null;
  return {
    ...context,
    context_summary: text(context.context_summary),
    prompts: Array.isArray(context.prompts) ? context.prompts.filter((prompt): prompt is string => typeof prompt === "string") : [],
  };
}

function normalizeEntry(value: unknown): StudentAiHistoryEntry | null {
  if (!value || typeof value !== "object") return null;
  const entry = value as StudentAiHistoryEntry;
  const id = text(entry.id);
  const context = contextFrom(entry.context);
  const messages = messagesFrom(entry.messages, id);
  if (!id || !context || !messages.length) return null;
  return {
    id,
    title: text(entry.title) || historyTitleFromMessages(messages),
    contextTitle: text(entry.contextTitle) || context.context_title,
    contextType: context.context_type,
    contextSummary: text(entry.contextSummary) || text(context.context_summary),
    source: entry.source === "detail" ? "detail" : "root",
    context,
    messages,
    createdAt: text(entry.createdAt) || nowIso(),
    updatedAt: text(entry.updatedAt) || nowIso(),
  };
}

function readAll(): StudentAiHistoryEntry[] {
  const local = storage();
  if (!local) return [];
  try {
    const parsed = JSON.parse(local.getItem(STORAGE_KEY) || "[]") as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map(normalizeEntry)
      .filter((entry): entry is StudentAiHistoryEntry => Boolean(entry))
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
      .slice(0, MAX_HISTORY_ENTRIES);
  } catch {
    return [];
  }
}

function writeAll(entries: StudentAiHistoryEntry[]): void {
  const local = storage();
  if (!local) return;
  try {
    local.setItem(STORAGE_KEY, JSON.stringify(entries.slice(0, MAX_HISTORY_ENTRIES)));
  } catch {
    // Local history is a convenience layer; quota/private-mode failures should not block chat.
  }
}

export function createStudentAiHistoryId(): string {
  if (typeof globalThis.crypto?.randomUUID === "function") return globalThis.crypto.randomUUID();
  return `student-ai-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function historyTitleFromMessages(messages: StudentAiChatMessage[]): string {
  const firstQuestion = messages.find((message) => message.role === "user" && message.content.trim())?.content.trim();
  if (!firstQuestion) return "新的 Atom 对话";
  const compact = firstQuestion.replace(/\s+/g, " ");
  return compact.length > 28 ? `${compact.slice(0, 28)}...` : compact;
}

export function buildStudentAiHistoryEntry({
  id,
  context,
  messages,
  source,
  createdAt,
  title,
}: {
  id: string;
  context: AssistantContext;
  messages: StudentAiChatMessage[];
  source: StudentAiHistorySource;
  createdAt?: string;
  title?: unknown;
}): StudentAiHistoryEntry {
  const timestamp = nowIso();
  const generatedTitle = sanitizeStudentAiHistoryTitle(title);
  return {
    id,
    title: generatedTitle || historyTitleFromMessages(messages),
    contextTitle: context.context_title,
    contextType: context.context_type,
    contextSummary: context.context_summary,
    source,
    context,
    messages: messagesFrom(messages, id),
    createdAt: createdAt || timestamp,
    updatedAt: timestamp,
  };
}

export function listStudentAiHistory(): StudentAiHistoryEntry[] {
  return readAll();
}

export function readStudentAiHistory(id: string): StudentAiHistoryEntry | null {
  return readAll().find((entry) => entry.id === id) || null;
}

export function upsertStudentAiHistory(entry: StudentAiHistoryEntry): StudentAiHistoryEntry {
  const normalized = normalizeEntry(entry) || entry;
  const entries = [normalized, ...readAll().filter((item) => item.id !== normalized.id)].slice(0, MAX_HISTORY_ENTRIES);
  writeAll(entries);
  return normalized;
}

export function deleteStudentAiHistory(id: string): void {
  writeAll(readAll().filter((entry) => entry.id !== id));
}

export function clearStudentAiHistory(): void {
  writeAll([]);
  clearActiveStudentAiHistoryId();
}

export function saveActiveStudentAiHistoryId(id: string): void {
  const session = sessionStorageSafe();
  if (!session || !id.trim()) return;
  try {
    session.setItem(ACTIVE_HISTORY_KEY, id);
  } catch {
    // Active history restoration is a convenience layer only.
  }
}

export function readActiveStudentAiHistoryId(): string | null {
  const session = sessionStorageSafe();
  if (!session) return null;
  try {
    const value = session.getItem(ACTIVE_HISTORY_KEY);
    return value && value.trim() ? value : null;
  } catch {
    return null;
  }
}

export function clearActiveStudentAiHistoryId(): void {
  const session = sessionStorageSafe();
  if (!session) return;
  try {
    session.removeItem(ACTIVE_HISTORY_KEY);
  } catch {
    // Ignore private-mode/session-storage failures.
  }
}
