import { FormEvent, useEffect, useRef, useState } from "react";
import { Bot, CheckCircle2, LoaderCircle, RotateCcw, Send, Sparkles, XCircle } from "lucide-react";
import { StudentAssistantFinalMetadata, errorMessage, streamStudentAssistantAsk } from "../../api";
import { MobileTextArea } from "../../mobile/primitives";
import { AiMarkdownBlock } from "../../shared/markdown/AiMarkdownBlock";
import { defaultAssistantContext, type AssistantContext } from "./assistantContext";
import { assistantContextHint, assistantContextTypeLabel, isGlobalAssistantContext } from "./assistantStarter";
import {
  buildStudentAiHistoryEntry,
  createStudentAiHistoryId,
  type StudentAiChatMessage,
  type StudentAiHistoryEntry,
  type StudentAiHistorySource,
  upsertStudentAiHistory,
} from "./assistantHistoryStore";

export type StudentAiChatPanelVariant = "root" | "detail";

type StudentAiChatPanelProps = {
  context: AssistantContext;
  onResetContext: () => void;
  variant?: StudentAiChatPanelVariant;
  historyEntry?: StudentAiHistoryEntry | null;
  onOpenHistory?: () => void;
  onHistoryChange?: () => void;
};

function assistantStreamPhaseLabel(status: string, hasAnswer: boolean): string {
  if (hasAnswer) return "正在生成回答";
  const text = String(status || "");
  if (text.includes("检索") || text.includes("课程") || text.includes("RAG") || text.includes("资料")) return "正在检索课程资料";
  if (text.includes("判断") || text.includes("安全") || text.includes("问题")) return "正在判断问题范围";
  if (text.includes("返回")) return "正在返回学习建议";
  return "正在生成回答";
}

function normalizeAssistantMetadata(value: unknown): StudentAssistantFinalMetadata | undefined {
  if (!value || typeof value !== "object") return undefined;
  return value as StudentAssistantFinalMetadata;
}

function AssistantSourceSummary({ metadata }: { metadata?: StudentAssistantFinalMetadata }) {
  const sources = Array.isArray(metadata?.sources) ? metadata.sources.slice(0, 3) : [];
  const sourceCount = typeof metadata?.source_count === "number" ? metadata.source_count : sources.length;
  if (!sourceCount && !sources.length) return null;
  return (
    <div className="ai-source-summary">
      <span>引用资料 {sourceCount || sources.length}</span>
    </div>
  );
}

function AssistantSkeleton() {
  return (
    <div className="ai-message-skeleton" aria-hidden="true">
      <span />
      <span />
      <span />
    </div>
  );
}

function historySourceForVariant(variant: StudentAiChatPanelVariant): StudentAiHistorySource {
  return variant === "detail" ? "detail" : "root";
}

function conversationHistory(messages: StudentAiChatMessage[]) {
  return messages.slice(-10).map(({ role, content }) => ({ role, content }));
}

function RootHistoryIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M12 4C9.25 4 6.83 5.39 5.38 7.5H8v2H2v-6h2V6c1.82-2.43 4.73-4 8-4 5.52 0 10 4.48 10 10s-4.48 10-10 10c-4.76 0-8.74-3.33-9.75-7.78l1.95-.44C5.01 17.34 8.19 20 12 20c4.42 0 8-3.58 8-8s-3.58-8-8-8zm-1 4h2v3.59l3.21 3.2-1.42 1.42-3.79-3.8V8z" />
    </svg>
  );
}

function RootNewChatIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <g fill="none" stroke="currentColor" strokeLinejoin="round" strokeWidth="2">
        <path
          d="M11 4H7.2c-1.12 0-1.68 0-2.108.218-.376.192-.682.498-.874.874C4 5.52 4 6.08 4 7.2v9.6c0 1.12 0 1.68.218 2.108.192.376.498.682.874.874C5.52 20 6.08 20 7.2 20h9.6c1.12 0 1.68 0 2.108-.218.376-.192.682-.498.874-.874C20 18.48 20 17.92 20 16.8V13"
          strokeLinecap="round"
        />
        <path
          d="M9 15v-2.586c0-.265.105-.52.293-.707l8.043-8.043c.78-.78 2.047-.78 2.828 0l.172.172c.78.78.78 2.047 0 2.828l-8.043 8.043c-.188.188-.442.293-.707.293H9z"
          strokeLinecap="square"
        />
      </g>
    </svg>
  );
}

export function StudentAiChatPanel({
  context,
  onResetContext,
  variant = "detail",
  historyEntry = null,
  onOpenHistory,
  onHistoryChange,
}: StudentAiChatPanelProps) {
  const [messages, setMessages] = useState<StudentAiChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("idle");
  const [activeContext, setActiveContext] = useState<AssistantContext>(context);
  const [activeHistoryId, setActiveHistoryId] = useState<string | null>(null);
  const [activeHistoryCreatedAt, setActiveHistoryCreatedAt] = useState<string | undefined>();
  const streamRef = useRef<HTMLDivElement>(null);

  const contextPath = activeContext.catalog_path?.filter(Boolean).join(" / ") || "";
  const contextMeta = [
    assistantContextTypeLabel(activeContext),
    activeContext.chapter_id,
    activeContext.point_node_id ? "已绑定点位" : "",
    contextPath,
  ]
    .filter(Boolean)
    .join(" · ");
  const isRootVariant = variant === "root";
  const isGlobalContext = isGlobalAssistantContext(activeContext);

  useEffect(() => {
    if (historyEntry) {
      setActiveContext(historyEntry.context);
      setMessages(historyEntry.messages);
      setInput("");
      setStatus("idle");
      setLoading(false);
      setActiveHistoryId(historyEntry.id);
      setActiveHistoryCreatedAt(historyEntry.createdAt);
      return;
    }
    setActiveContext(context);
    setMessages([]);
    setInput("");
    setStatus("idle");
    setLoading(false);
    setActiveHistoryId(null);
    setActiveHistoryCreatedAt(undefined);
  }, [
    historyEntry?.id,
    context.context_type,
    context.context_title,
    context.experiment_id,
    context.chapter_id,
    context.point_node_id,
    context.source_node_id,
    JSON.stringify(context.catalog_path || []),
  ]);

  useEffect(() => {
    if (!streamRef.current) return;
    if (typeof streamRef.current.scrollTo === "function") {
      streamRef.current.scrollTo({ top: streamRef.current.scrollHeight });
      return;
    }
    streamRef.current.scrollTop = streamRef.current.scrollHeight;
  }, [messages, loading]);

  const persistConversation = (
    nextMessages: StudentAiChatMessage[],
    nextContext: AssistantContext,
    historyId: string,
    createdAt?: string,
  ): StudentAiHistoryEntry => {
    const saved = upsertStudentAiHistory(
      buildStudentAiHistoryEntry({
        id: historyId,
        context: nextContext,
        messages: nextMessages,
        source: historySourceForVariant(variant),
        createdAt,
      }),
    );
    setActiveHistoryId(saved.id);
    setActiveHistoryCreatedAt(saved.createdAt);
    onHistoryChange?.();
    return saved;
  };

  const handleResetContext = () => {
    setActiveContext(defaultAssistantContext());
    setMessages([]);
    setInput("");
    setLoading(false);
    setStatus("idle");
    setActiveHistoryId(null);
    setActiveHistoryCreatedAt(undefined);
    onResetContext();
  };

  const submitQuestion = async (questionText?: string, overrideContext?: AssistantContext) => {
    const question = (questionText || input).trim();
    if (!question || loading) return;
    const requestContext = overrideContext || activeContext;
    const baseMessages = messages;
    const userMessage: StudentAiChatMessage = { role: "user", content: question };
    const assistantDraft: StudentAiChatMessage = { role: "assistant", content: "" };
    const nextMessages: StudentAiChatMessage[] = [...baseMessages, userMessage, assistantDraft];
    const historyId = activeHistoryId || createStudentAiHistoryId();
    const createdAt = activeHistoryCreatedAt;
    setActiveContext(requestContext);
    setMessages(nextMessages);
    setInput("");
    setLoading(true);
    setStatus("streaming");
    const initialHistory = persistConversation(nextMessages, requestContext, historyId, createdAt);
    const createdAtForFinal = initialHistory.createdAt;

    let answer = "";
    let finalMetadata: StudentAssistantFinalMetadata | undefined;
    try {
      await streamStudentAssistantAsk(
        {
          ...requestContext,
          question,
          conversation_history: conversationHistory(baseMessages),
        },
        (event) => {
          if (event.event === "status" && typeof event.message === "string") {
            setStatus(event.message);
            return;
          }
          if (event.event === "delta" && typeof event.delta === "string") {
            answer += event.delta;
            setMessages((current) => {
              const updated = [...current];
              const last = updated[updated.length - 1];
              if (last?.role === "assistant") updated[updated.length - 1] = { ...last, content: answer };
              return updated;
            });
            return;
          }
          if (event.event === "replace" && typeof event.answer === "string") {
            answer = event.answer;
            setMessages((current) => {
              const updated = [...current];
              const last = updated[updated.length - 1];
              if (last?.role === "assistant") updated[updated.length - 1] = { ...last, content: answer };
              return updated;
            });
            return;
          }
          if (event.event === "error") {
            throw new Error(typeof event.message === "string" ? event.message : "AI 请求失败");
          }
          if (event.event === "final") {
            finalMetadata = normalizeAssistantMetadata(event.response);
            if (finalMetadata && typeof finalMetadata.text === "string" && !answer.trim()) {
              answer = finalMetadata.text;
            }
            setStatus("ai");
            setMessages((current) => {
              const updated = [...current];
              const last = updated[updated.length - 1];
              if (last?.role === "assistant") updated[updated.length - 1] = { ...last, content: answer || last.content, metadata: finalMetadata };
              return updated;
            });
          }
        },
      );
      if (!answer.trim()) answer = "AI 暂时没有生成有效回答。";
      const finalMessages: StudentAiChatMessage[] = [...baseMessages, userMessage, { role: "assistant", content: answer, metadata: finalMetadata }];
      setMessages(finalMessages);
      setStatus("ai");
      persistConversation(finalMessages, requestContext, historyId, createdAtForFinal);
    } catch (requestError) {
      const message = errorMessage(requestError);
      const errorMessages: StudentAiChatMessage[] = [...baseMessages, userMessage, { role: "assistant", content: message }];
      setStatus("error");
      setMessages(errorMessages);
      persistConversation(errorMessages, requestContext, historyId, createdAtForFinal);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void submitQuestion();
  };

  return (
    <section className={`ai-chat-panel ${variant}`} role="region" aria-label="AI 学习助手对话">
      <header className={`ai-chat-head ${variant}`}>
        <div>
          <span>
            <Sparkles size={14} />
            {isRootVariant ? "课程 AI" : "当前上下文"}
          </span>
          <h2>{isRootVariant ? "AI 学习助手" : activeContext.context_title}</h2>
          <small>
            <b>{isRootVariant ? activeContext.context_title : contextMeta}</b>
            {isRootVariant && contextMeta ? <span>{contextMeta}</span> : null}
            <span>{assistantContextHint(activeContext)}</span>
          </small>
        </div>
        {isRootVariant ? (
          <div className="ai-root-actions" aria-label="AI 对话操作">
            {onOpenHistory ? (
              <button type="button" className="ai-root-icon-action ai-history-action" onClick={onOpenHistory} aria-label="查看 AI 历史记录">
                <RootHistoryIcon />
              </button>
            ) : null}
            <button type="button" className="ai-root-icon-action ai-new-chat-action" onClick={handleResetContext} aria-label="新建 AI 对话">
              <RootNewChatIcon />
            </button>
          </div>
        ) : !isRootVariant && !isGlobalContext ? (
          <button type="button" onClick={handleResetContext} aria-label="切回全局课程对话">
            <RotateCcw size={16} />
          </button>
        ) : null}
      </header>

      <div className="ai-chat-stream" aria-live="polite" ref={streamRef}>
        {!messages.length ? (
          <div className={`ai-chat-empty ${variant}`}>
            <Sparkles size={18} />
            <strong>{isRootVariant ? "今天想梳理哪块化学内容？" : "围绕当前页面继续问"}</strong>
            <span>{isRootVariant ? "可以聊实验现象、方程式、复习疑点。" : activeContext.context_summary || "当前页面上下文会带入这次对话。"}</span>
          </div>
        ) : null}
        {messages.map((message, index) => {
          const isActiveAssistant = message.role === "assistant" && loading && index === messages.length - 1;
          const isLastError = message.role === "assistant" && status === "error" && index === messages.length - 1;
          const assistantState = isLastError ? "error" : isActiveAssistant ? "running" : "done";
          return (
            <div className={`ai-message ${message.role} ${message.role === "assistant" ? assistantState : ""}`} key={`${message.role}-${index}`}>
              {message.role === "assistant" ? (
                <>
                  <div className="ai-message-meta">
                    <span>
                      <Bot size={14} />
                      学习助手
                    </span>
                    <em>
                      {isLastError ? <XCircle size={13} /> : isActiveAssistant ? <LoaderCircle className="spin" size={13} /> : <CheckCircle2 size={13} />}
                      {isLastError ? "失败" : isActiveAssistant ? "生成中" : "完成"}
                    </em>
                  </div>
                  {isActiveAssistant ? (
                    <div className="ai-stream-progress">
                      <span aria-hidden="true">
                        <i />
                        <i />
                        <i />
                      </span>
                      <strong>{assistantStreamPhaseLabel(status, Boolean(message.content.trim()))}</strong>
                    </div>
                  ) : null}
                  {message.content.trim() ? <AiMarkdownBlock text={message.content} /> : isActiveAssistant ? <AssistantSkeleton /> : null}
                  <AssistantSourceSummary metadata={message.metadata} />
                </>
              ) : (
                message.content
              )}
            </div>
          );
        })}
      </div>

      {messages.length && activeContext.prompts.length ? (
        <div className="ai-quick-prompts" aria-label="快捷问题">
          {activeContext.prompts.map((prompt) => (
            <button type="button" key={prompt} disabled={loading} onClick={() => void submitQuestion(prompt)}>
              {prompt}
            </button>
          ))}
        </div>
      ) : null}

      <form className="ai-chat-compose" onSubmit={handleSubmit}>
        <MobileTextArea
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder="随便问点什么"
          aria-label="向 AI 提问"
          rows={1}
          maxLength={1600}
          disabled={loading}
        />
        <button type="submit" disabled={!input.trim() || loading} aria-label="发送问题">
          {loading ? <LoaderCircle className="spin" size={17} /> : <Send size={17} />}
        </button>
      </form>
    </section>
  );
}
