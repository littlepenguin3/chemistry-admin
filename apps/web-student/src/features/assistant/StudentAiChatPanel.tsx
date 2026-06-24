import {
  type ChangeEvent,
  type CSSProperties,
  type FormEvent,
  type PointerEvent,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { useNavigate } from "@tanstack/react-router";
import { Atom, CheckCircle2, Copy, FlaskConical, LoaderCircle, Plus, RotateCcw, Send, ThumbsDown, ThumbsUp, X, XCircle } from "lucide-react";
import LottieImport, { type LottieRefCurrentProps } from "lottie-react";
import { type StudentAssistantStreamEvent, StudentAssistantFinalMetadata, errorMessage, streamStudentAssistantAsk } from "../../api";
import atomThinkingVariant1Animation from "../../assets/lottie/atom-thinking-variant-1.json";
import atomThinkingVariant2Animation from "../../assets/lottie/atom-thinking-variant-2.json";
import atomThinkingAnimation from "../../assets/lottie/atom-thinking.json";
import { MobileTextArea } from "../../mobile/primitives";
import { AiMessageMarkdown } from "../../shared/markdown/AiMessageMarkdown";
import type { AiRichContentArtifact } from "../../shared/markdown/aiRichContentArtifacts";
import { useSmoothAssistantStream } from "../../shared/markdown/useSmoothAssistantStream";
import { AtomContextPickerSheet } from "./AtomContextPickerSheet";
import { defaultAssistantContext, isPointAssistantContext, type AssistantContext } from "./assistantContext";
import {
  assistantContextHint,
  assistantContextTypeLabel,
  assistantStarterIntents,
  buildStarterQuestion,
  isGlobalAssistantContext,
  type AssistantStarterIntentId,
} from "./assistantStarter";
import {
  buildStudentAiHistoryEntry,
  clearActiveStudentAiHistoryId,
  createStudentAiHistoryId,
  createStudentAiMessageId,
  saveActiveStudentAiHistoryId,
  sanitizeStudentAiHistoryTitle,
  type StudentAiChatMessage,
  type StudentAiHistoryEntry,
  type StudentAiHistorySource,
  upsertStudentAiHistory,
} from "./assistantHistoryStore";

const Lottie = (
  typeof LottieImport === "function"
    ? LottieImport
    : (LottieImport as unknown as { default: typeof LottieImport }).default
) as typeof LottieImport;

export type StudentAiChatPanelVariant = "root" | "detail";

type StudentAiChatPanelProps = {
  context: AssistantContext;
  resetContext?: AssistantContext;
  onResetContext: () => void;
  variant?: StudentAiChatPanelVariant;
  fullControls?: boolean;
  historyEntry?: StudentAiHistoryEntry | null;
  onOpenHistory?: () => void;
  onHistoryChange?: () => void;
};

type AssistantTurnFeedback = "positive" | "negative";
type AssistantStreamPhaseKey = string;
type AssistantVisibleThinking = {
  source: "reasoning_summary" | "agent_trace";
  message: string;
  sequence?: number;
};

type AssistantStreamPhase = {
  key: AssistantStreamPhaseKey;
  label: string;
};

const ASSISTANT_THINKING_PHASE_MIN_VISIBLE_MS = 1400;
const ASSISTANT_THINKING_TRANSITION_MS = 420;
const ATOM_THINKING_STROKE_COLOR = [0, 0.345, 0.149, 1];

type AtomThinkingAnimationId = "core" | "pulse" | "orbit";
type AtomThinkingAnimationDefinition = {
  id: AtomThinkingAnimationId;
  label: string;
  speed: number;
  animationData: unknown;
};

function cloneLottieWithStrokeColor<T>(animationData: T): T {
  const cloned = JSON.parse(JSON.stringify(animationData)) as T;
  const tintStroke = (value: unknown) => {
    if (!value || typeof value !== "object") return;
    const record = value as { ty?: unknown; c?: { k?: unknown } };
    if (record.ty === "st" && record.c && Array.isArray(record.c.k)) {
      record.c.k = ATOM_THINKING_STROKE_COLOR;
    }
    for (const child of Object.values(value as Record<string, unknown>)) {
      if (Array.isArray(child)) child.forEach(tintStroke);
      else tintStroke(child);
    }
  };
  tintStroke(cloned);
  return cloned;
}

const ATOM_THINKING_ANIMATIONS: readonly AtomThinkingAnimationDefinition[] = [
  {
    id: "core",
    label: "基础轨道",
    speed: 0.618,
    animationData: cloneLottieWithStrokeColor(atomThinkingAnimation),
  },
  {
    id: "pulse",
    label: "脉冲收束",
    speed: 1.43,
    animationData: cloneLottieWithStrokeColor(atomThinkingVariant1Animation),
  },
  {
    id: "orbit",
    label: "轨道旋转",
    speed: 1.013,
    animationData: cloneLottieWithStrokeColor(atomThinkingVariant2Animation),
  },
];

function randomAtomThinkingAnimationId(): AtomThinkingAnimationId {
  const index = Math.floor(Math.random() * ATOM_THINKING_ANIMATIONS.length);
  return ATOM_THINKING_ANIMATIONS[index]?.id ?? "core";
}

function atomThinkingAnimationById(animationId?: string): AtomThinkingAnimationDefinition {
  return ATOM_THINKING_ANIMATIONS.find((animation) => animation.id === animationId) || ATOM_THINKING_ANIMATIONS[0];
}

function assistantStreamPhase(status: string, hasAnswer: boolean): AssistantStreamPhase {
  if (hasAnswer) return { key: "outputting", label: "正在输出回答" };
  const text = String(status || "");
  if (text.includes("检索") || text.includes("课程") || text.includes("RAG") || text.includes("资料") || text.includes("证据")) {
    return { key: "retrieval", label: "正在检索课程资料" };
  }
  if (text.includes("判断") || text.includes("安全") || text.includes("问题") || text.includes("策略")) {
    return { key: "scope", label: "正在判断问题范围" };
  }
  if (text.includes("返回")) return { key: "returning", label: "正在返回学习建议" };
  return { key: "generating", label: "正在组织回答" };
}

function assistantStreamPhaseLabel(status: string, hasAnswer: boolean): string {
  return assistantStreamPhase(status, hasAnswer).label;
}

function normalizeVisibleThinkingEvent(event: StudentAssistantStreamEvent): AssistantVisibleThinking | null {
  if (event.event !== "thinking") return null;
  if (event.source !== "reasoning_summary" && event.source !== "agent_trace") return null;
  const message = typeof event.message === "string" ? event.message.trim() : "";
  if (!message || message.length > 48) return null;
  return {
    source: event.source,
    message,
    sequence: typeof event.sequence === "number" ? event.sequence : undefined,
  };
}

function assistantVisibleThinkingPhase(thinking: AssistantVisibleThinking | null, status: string, hasAnswer: boolean): AssistantStreamPhase {
  if (hasAnswer) return assistantStreamPhase(status, hasAnswer);
  if (thinking) {
    const sequenceKey = typeof thinking.sequence === "number" ? thinking.sequence : thinking.message;
    return { key: `thinking-${thinking.source}-${sequenceKey}`, label: thinking.message };
  }
  return assistantStreamPhase(status, hasAnswer);
}

function normalizeAssistantMetadata(value: unknown): StudentAssistantFinalMetadata | undefined {
  if (!value || typeof value !== "object") return undefined;
  return value as StudentAssistantFinalMetadata;
}

function assistantMessageMetadata(metadata?: StudentAssistantFinalMetadata): StudentAssistantFinalMetadata | undefined {
  if (!metadata) return undefined;
  const { conversation_title: _conversationTitle, ...messageMetadata } = metadata;
  return messageMetadata;
}

function suggestedPromptsFromMetadata(metadata?: StudentAssistantFinalMetadata): QuickPrompt[] {
  const rawPrompts = metadata?.suggested_prompts;
  if (!Array.isArray(rawPrompts)) return [];
  const seen = new Set<string>();
  const prompts: QuickPrompt[] = [];
  for (const rawPrompt of rawPrompts) {
    if (typeof rawPrompt !== "string") continue;
    const prompt = rawPrompt.trim();
    if (!prompt) continue;
    const key = prompt.replace(/\s+/g, "").toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    prompts.push({ label: prompt, question: prompt });
    if (prompts.length >= 5) break;
  }
  return prompts;
}

function latestSuggestedPrompts(messages: StudentAiChatMessage[], loading: boolean, status: string): QuickPrompt[] {
  if (loading || status === "error") return [];
  const latestAssistantMessage = [...messages].reverse().find((message) => message.role === "assistant");
  if (latestAssistantMessage?.state === "error") return [];
  return suggestedPromptsFromMetadata(latestAssistantMessage?.metadata);
}

const boundContextPromptOrder = ["observe", "phenomenon", "principle", "design", "compare", "mistake"];
const boundContextPromptLabels: Partial<Record<AssistantStarterIntentId, string>> = {
  observe: "该实验中观察什么",
  phenomenon: "该实验中现象说明什么",
  principle: "该实验背后原理",
  design: "该实验为什么这样设计",
  compare: "和其他点位对比",
  mistake: "该实验易错点",
};

function boundContextStarterPrompts(context: AssistantContext): QuickPrompt[] {
  const intents = assistantStarterIntents(context);
  return boundContextPromptOrder
    .map((id) => intents.find((intent) => intent.id === id))
    .filter((intent): intent is NonNullable<typeof intent> => Boolean(intent?.buildQuestion))
    .map((intent) => ({ label: boundContextPromptLabels[intent.id] || intent.label, question: buildStarterQuestion(intent, context) }))
    .filter((prompt) => Boolean(prompt.question));
}

function experimentPlaceholderTitle(title: string): string {
  const trimmed = title.trim();
  if (!trimmed) return "这个实验";
  return trimmed.endsWith("实验") ? trimmed : `${trimmed}实验`;
}

function streamEventDebugSnapshot(event?: StudentAssistantStreamEvent): Record<string, unknown> | undefined {
  if (!event) return undefined;
  if (event.event === "thinking") {
    return {
      event: event.event,
      source: event.source,
      phase: event.phase,
      sequence: event.sequence,
      messageLength: typeof event.message === "string" ? event.message.length : undefined,
    };
  }
  if (event.event === "delta") {
    return {
      event: event.event,
      deltaLength: typeof event.delta === "string" ? event.delta.length : undefined,
    };
  }
  if (event.event === "replace") {
    return {
      event: event.event,
      answerLength: typeof event.answer === "string" ? event.answer.length : undefined,
    };
  }
  if (event.event === "final" && event.response && typeof event.response === "object") {
    const response = event.response as StudentAssistantFinalMetadata;
    return {
      event: event.event,
      mode: typeof response.mode === "string" ? response.mode : undefined,
      responseKeys: Object.keys(response),
      answerLength: typeof response.answer === "string" ? response.answer.length : undefined,
      suggestedPromptCount: Array.isArray(response.suggested_prompts) ? response.suggested_prompts.length : undefined,
      sourceCount: typeof response.source_count === "number" ? response.source_count : undefined,
    };
  }
  if (event.event === "error") {
    return {
      event: event.event,
      message: typeof event.message === "string" ? event.message : undefined,
    };
  }
  return { event: event.event };
}

function safeAssistantSourceCount(metadata?: StudentAssistantFinalMetadata): number {
  if (typeof metadata?.source_count === "number" && Number.isFinite(metadata.source_count) && metadata.source_count > 0) {
    return Math.floor(metadata.source_count);
  }
  return Array.isArray(metadata?.sources) ? metadata.sources.length : 0;
}

async function copyAssistantText(text: string): Promise<void> {
  if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.left = "-9999px";
  textarea.style.top = "0";
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand("copy");
  textarea.remove();
}

function AssistantSourceSummary({ metadata }: { metadata?: StudentAssistantFinalMetadata }) {
  const sourceCount = safeAssistantSourceCount(metadata);
  if (!sourceCount) return null;
  return (
    <div className="ai-source-summary">
      <span>引用资料 {sourceCount}</span>
    </div>
  );
}

function AssistantTurnActions({
  turnKey,
  content,
  metadata,
  feedback,
  copied,
  onFeedback,
  onCopy,
}: {
  turnKey: string;
  content: string;
  metadata?: StudentAssistantFinalMetadata;
  feedback?: AssistantTurnFeedback;
  copied: boolean;
  onFeedback: (turnKey: string, feedback: AssistantTurnFeedback) => void;
  onCopy: (turnKey: string, content: string) => Promise<void>;
}) {
  const sourceCount = safeAssistantSourceCount(metadata);
  return (
    <div className="ai-message-actions" aria-label="Atom answer actions">
      <div className="ai-message-action-group">
        <button
          type="button"
          className={`ai-message-action${feedback === "positive" ? " selected" : ""}`}
          aria-label="Mark Atom answer helpful"
          aria-pressed={feedback === "positive"}
          title="Helpful"
          onClick={() => onFeedback(turnKey, "positive")}
        >
          <ThumbsUp size={18} />
        </button>
        <button
          type="button"
          className={`ai-message-action${feedback === "negative" ? " selected" : ""}`}
          aria-label="Mark Atom answer unhelpful"
          aria-pressed={feedback === "negative"}
          title="Unhelpful"
          onClick={() => onFeedback(turnKey, "negative")}
        >
          <ThumbsDown size={18} />
        </button>
        <button
          type="button"
          className={`ai-message-action${copied ? " copied" : ""}`}
          aria-label={copied ? "Atom answer copied" : "Copy Atom answer"}
          title={copied ? "Copied" : "Copy"}
          onClick={() => void onCopy(turnKey, content)}
        >
          <Copy size={18} />
        </button>
      </div>
      {sourceCount > 0 ? (
        <span className="ai-message-citation" aria-label={`Citation count ${sourceCount}`}>
          引用资料 {sourceCount}
        </span>
      ) : null}
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

function usePrefersReducedMotion() {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(() => {
    if (typeof window === "undefined" || !window.matchMedia) return false;
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  });

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const handleChange = () => setPrefersReducedMotion(media.matches);
    handleChange();
    if (typeof media.addEventListener === "function") {
      media.addEventListener("change", handleChange);
      return () => media.removeEventListener("change", handleChange);
    }
    media.addListener(handleChange);
    return () => media.removeListener(handleChange);
  }, []);

  return prefersReducedMotion;
}

function AtomThinkingMark({ animationId }: { animationId?: string }) {
  const prefersReducedMotion = usePrefersReducedMotion();
  const atomLottieRef = useRef<LottieRefCurrentProps>(null);
  const animation = atomThinkingAnimationById(animationId);

  useEffect(() => {
    if (prefersReducedMotion) return;
    atomLottieRef.current?.setSpeed(animation.speed);
  }, [animation.id, animation.speed, prefersReducedMotion]);

  return (
    <span
      className="ai-thinking-atom-mark"
      aria-hidden="true"
      data-animation-id={animation.id}
      data-motion={prefersReducedMotion ? "reduced" : "looping"}
    >
      {prefersReducedMotion ? (
        <Atom className="ai-thinking-atom-static" size={30} strokeWidth={2.15} />
      ) : (
        <Lottie
          key={animation.id}
          lottieRef={atomLottieRef}
          className="ai-thinking-lottie"
          animationData={animation.animationData}
          loop
          autoplay
        />
      )}
    </span>
  );
}

function AssistantThinkingLine({ phase, animationId }: { phase: AssistantStreamPhase; animationId?: string }) {
  const [currentPhase, setCurrentPhase] = useState(phase);
  const [outgoingPhase, setOutgoingPhase] = useState<AssistantStreamPhase | null>(null);
  const currentPhaseRef = useRef(phase);
  const queuedPhaseRef = useRef<AssistantStreamPhase | null>(null);
  const currentPhaseStartedRef = useRef(Date.now());
  const clearOutgoingRef = useRef<number | null>(null);

  const applyQueuedPhaseRef = useRef<number | null>(null);
  const startPhaseTransition = useCallback((nextPhase: AssistantStreamPhase) => {
    const previousPhase = currentPhaseRef.current;
    if (nextPhase.key === previousPhase.key) {
      if (nextPhase.label !== previousPhase.label) {
        currentPhaseRef.current = nextPhase;
        setCurrentPhase(nextPhase);
      }
      return;
    }

    if (clearOutgoingRef.current !== null) window.clearTimeout(clearOutgoingRef.current);
    setOutgoingPhase(previousPhase);
    currentPhaseRef.current = nextPhase;
    currentPhaseStartedRef.current = Date.now();
    setCurrentPhase(nextPhase);
    clearOutgoingRef.current = window.setTimeout(() => {
      setOutgoingPhase(null);
      clearOutgoingRef.current = null;
    }, ASSISTANT_THINKING_TRANSITION_MS);
  }, []);

  useEffect(() => {
    const previousPhase = currentPhaseRef.current;
    if (phase.key === previousPhase.key) {
      queuedPhaseRef.current = null;
      if (applyQueuedPhaseRef.current !== null) {
        window.clearTimeout(applyQueuedPhaseRef.current);
        applyQueuedPhaseRef.current = null;
      }
      if (phase.label !== previousPhase.label) {
        currentPhaseRef.current = phase;
        setCurrentPhase(phase);
      }
      return;
    }

    queuedPhaseRef.current = phase;
    if (applyQueuedPhaseRef.current !== null) window.clearTimeout(applyQueuedPhaseRef.current);
    const elapsed = Date.now() - currentPhaseStartedRef.current;
    const remaining = Math.max(0, ASSISTANT_THINKING_PHASE_MIN_VISIBLE_MS - elapsed);
    if (remaining === 0) {
      queuedPhaseRef.current = null;
      startPhaseTransition(phase);
      return;
    }

    applyQueuedPhaseRef.current = window.setTimeout(() => {
      applyQueuedPhaseRef.current = null;
      const queuedPhase = queuedPhaseRef.current;
      queuedPhaseRef.current = null;
      if (queuedPhase) startPhaseTransition(queuedPhase);
    }, remaining);
  }, [phase.key, phase.label, startPhaseTransition]);

  useEffect(() => {
    return () => {
      if (applyQueuedPhaseRef.current !== null) {
        window.clearTimeout(applyQueuedPhaseRef.current);
        applyQueuedPhaseRef.current = null;
      }
      if (clearOutgoingRef.current !== null) {
        window.clearTimeout(clearOutgoingRef.current);
        clearOutgoingRef.current = null;
      }
    };
  }, []);

  return (
    <div className="ai-thinking-line" role="status" aria-live="polite" aria-atomic="true" aria-label={currentPhase.label}>
      <AtomThinkingMark animationId={animationId} />
      <span className="ai-thinking-text-stack" aria-hidden="true">
        {outgoingPhase ? (
          <span className="ai-thinking-text outgoing" key={`out-${outgoingPhase.key}`}>
            {outgoingPhase.label}
          </span>
        ) : null}
        <span className={`ai-thinking-text current${outgoingPhase ? " incoming" : ""}`} key={`current-${currentPhase.key}`}>
          {currentPhase.label}
        </span>
      </span>
    </div>
  );
}

function historySourceForVariant(variant: StudentAiChatPanelVariant): StudentAiHistorySource {
  return variant === "detail" ? "detail" : "root";
}

function conversationHistory(messages: StudentAiChatMessage[]) {
  return messages.slice(-10).map(({ role, content }) => ({ role, content }));
}

const ROOT_COMPOSER_COMPACT_INPUT_HEIGHT = 36;
const ROOT_COMPOSER_COMPACT_THRESHOLD = 48;
const ROOT_COMPOSER_CONTROL_SIZE = 42;
const ROOT_COMPOSER_COMPACT_INLINE_PADDING = 14;
const ROOT_COMPOSER_COMPACT_MEASURE_FALLBACK_WIDTH = 260;
const ROOT_COMPOSER_COMPACT_MIN_TEXT_LANE_WIDTH = 80;
const ROOT_COMPOSER_EXPANDED_PADDING_TOP = 13;
const ROOT_COMPOSER_EXPANDED_PADDING_BOTTOM = 10;
const ROOT_COMPOSER_EXPANDED_MIN_INPUT_HEIGHT = 68;
const ROOT_COMPOSER_WORKBENCH_HEIGHT = 56;
const ROOT_COMPOSER_MAX_HEIGHT_RATIO = 0.618;
const DETAIL_COMPOSER_MIN_HEIGHT = 58;
const DETAIL_COMPOSER_MAX_HEIGHT = 112;

type ComposerTextareaMetrics = {
  height: number;
  maxHeight: number;
  scrollable: boolean;
  expanded: boolean;
};

type QuickPrompt = {
  label: string;
  question: string;
};

function initialComposerTextareaMetrics(variant: StudentAiChatPanelVariant): ComposerTextareaMetrics {
  if (variant === "root") {
    return {
      height: ROOT_COMPOSER_COMPACT_INPUT_HEIGHT,
      maxHeight: ROOT_COMPOSER_COMPACT_INPUT_HEIGHT,
      scrollable: false,
      expanded: false,
    };
  }
  return {
    height: DETAIL_COMPOSER_MIN_HEIGHT,
    maxHeight: DETAIL_COMPOSER_MAX_HEIGHT,
    scrollable: false,
    expanded: false,
  };
}

function measureTextareaScrollHeight(textarea: HTMLTextAreaElement, minHeight: number) {
  const previousHeight = textarea.style.height;
  textarea.style.height = "auto";
  const naturalHeight = textarea.scrollHeight || minHeight;
  textarea.style.height = previousHeight;
  return naturalHeight;
}

function measureRootCompactScrollHeight(
  measureTextarea: HTMLTextAreaElement | null,
  composer: HTMLFormElement | null,
  value: string,
  fallbackHeight: number,
) {
  if (!measureTextarea) return fallbackHeight;

  const composerWidth = composer?.getBoundingClientRect().width || composer?.clientWidth || ROOT_COMPOSER_COMPACT_MEASURE_FALLBACK_WIDTH;
  const compactTextLaneWidth = Math.max(
    ROOT_COMPOSER_COMPACT_MIN_TEXT_LANE_WIDTH,
    Math.floor(composerWidth - ROOT_COMPOSER_CONTROL_SIZE * 2 - ROOT_COMPOSER_COMPACT_INLINE_PADDING * 2),
  );

  measureTextarea.rows = 1;
  measureTextarea.style.width = `${compactTextLaneWidth}px`;
  measureTextarea.value = value;
  return measureTextareaScrollHeight(measureTextarea, fallbackHeight);
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
  resetContext,
  onResetContext,
  variant = "detail",
  fullControls,
  historyEntry = null,
  onOpenHistory,
  onHistoryChange,
}: StudentAiChatPanelProps) {
  const navigate = useNavigate();
  const [messages, setMessages] = useState<StudentAiChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("idle");
  const [activeThinking, setActiveThinking] = useState<AssistantVisibleThinking | null>(null);
  const [activeContext, setActiveContext] = useState<AssistantContext>(context);
  const [activeHistoryId, setActiveHistoryId] = useState<string | null>(null);
  const [activeHistoryCreatedAt, setActiveHistoryCreatedAt] = useState<string | undefined>();
  const [assistantTurnFeedback, setAssistantTurnFeedback] = useState<Record<string, AssistantTurnFeedback>>({});
  const [copiedTurnKey, setCopiedTurnKey] = useState<string | null>(null);
  const [contextPickerOpen, setContextPickerOpen] = useState(false);
  const streamRef = useRef<HTMLDivElement>(null);
  const composerFormRef = useRef<HTMLFormElement>(null);
  const composerTextareaRef = useRef<HTMLTextAreaElement>(null);
  const compactMeasureTextareaRef = useRef<HTMLTextAreaElement>(null);
  const copyResetTimeoutRef = useRef<number | undefined>(undefined);
  const rootGlowExitTimeoutRef = useRef<number | undefined>(undefined);
  const previousRootFirstResponseLoadingRef = useRef(false);
  const [composerContextActive, setComposerContextActive] = useState(false);
  const [composerTextareaMetrics, setComposerTextareaMetrics] = useState(() => initialComposerTextareaMetrics(fullControls ? "root" : variant));
  const [rootGlowExitActive, setRootGlowExitActive] = useState(false);

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
  const usesModernAtomSurface = isRootVariant || Boolean(fullControls);
  const surfaceVariant = usesModernAtomSurface ? "root" : variant;
  const modernSurfaceClassName = usesModernAtomSurface && !isRootVariant ? " root" : "";
  const boundPointContext = usesModernAtomSurface && isPointAssistantContext(activeContext) ? activeContext : null;
  const hasBoundPointContext = Boolean(boundPointContext);
  const hasComposerText = input.trim().length > 0;
  const showRootWelcome = usesModernAtomSurface && !messages.length && !hasComposerText;
  const rootLayoutState = usesModernAtomSurface ? (messages.length || loading ? "conversation" : hasComposerText ? "draft" : "empty") : "";
  const rootLayoutSemanticState =
    rootLayoutState === "empty" ? "is-empty" : rootLayoutState === "draft" ? "has-draft" : rootLayoutState === "conversation" ? "has-messages" : "";
  const isRootFirstResponseLoading =
    usesModernAtomSurface && loading && messages.length === 2 && messages[0]?.role === "user" && messages[1]?.role === "assistant";
  const rootFirstResponseClassName = isRootFirstResponseLoading ? " root-first-response-loading" : "";
  const rootGlowExitClassName = rootGlowExitActive ? " root-first-response-ending" : "";
  const boundPointLayoutClassName = hasBoundPointContext ? " has-bound-point-context" : "";
  const rootLayoutClassName = rootLayoutState
    ? ` root-state-${rootLayoutState} ${rootLayoutSemanticState}${rootFirstResponseClassName}${rootGlowExitClassName}${boundPointLayoutClassName}`
    : "";
  const rootResponsePhase = isRootFirstResponseLoading ? "first-response-loading" : rootGlowExitActive ? "first-response-ending" : undefined;
  const isGlobalContext = isGlobalAssistantContext(activeContext);
  const hasSubmittedUserMessage = messages.some((message) => message.role === "user");
  const contextBindingLocked = usesModernAtomSurface && (hasSubmittedUserMessage || loading);
  const canEditBoundPoint = usesModernAtomSurface && Boolean(boundPointContext) && !contextBindingLocked;
  const rootComposerMode = composerTextareaMetrics.expanded || hasBoundPointContext ? "is-expanded" : "is-compact";
  const composerPlaceholder =
    usesModernAtomSurface && boundPointContext
      ? `问“${experimentPlaceholderTitle(boundPointContext.context_title)}”的现象、步骤或原理`
      : usesModernAtomSurface
        ? "问实验现象、步骤或原理"
        : "围绕当前内容提问";
  const composerTextareaStyle: CSSProperties = {
    height: `${composerTextareaMetrics.height}px`,
    maxHeight: `${composerTextareaMetrics.maxHeight}px`,
    overflowY: composerTextareaMetrics.scrollable ? "auto" : "hidden",
  };
  const suggestedQuickPrompts = latestSuggestedPrompts(messages, loading, status);
  const boundStarterQuickPrompts =
    usesModernAtomSurface && boundPointContext && !hasComposerText && !hasSubmittedUserMessage && !loading ? boundContextStarterPrompts(boundPointContext) : [];
  const showBoundStarterPrompts = !suggestedQuickPrompts.length && boundStarterQuickPrompts.length > 0;
  const quickPrompts = suggestedQuickPrompts.length ? suggestedQuickPrompts : boundStarterQuickPrompts;

  const updateLatestAssistantContent = useCallback((content: string) => {
    setMessages((current) => {
      const updated = [...current];
      const last = updated[updated.length - 1];
      if (last?.role === "assistant") updated[updated.length - 1] = { ...last, content };
      return updated;
    });
  }, []);

  const {
    append: appendSmoothAnswer,
    flush: flushSmoothAnswer,
    replace: replaceSmoothAnswer,
    reset: resetSmoothAnswer,
    stop: stopSmoothAnswer,
  } = useSmoothAssistantStream({ onDisplayText: updateLatestAssistantContent });

  const syncComposerTextareaMetrics = useCallback(() => {
    const textarea = composerTextareaRef.current;
    if (!textarea) return;

    const minHeight = usesModernAtomSurface ? ROOT_COMPOSER_COMPACT_INPUT_HEIGHT : DETAIL_COMPOSER_MIN_HEIGHT;
    const visualViewportHeight = window.visualViewport?.height || window.innerHeight || minHeight;
    const panel = textarea.closest(".ai-chat-panel") as HTMLElement | null;
    const panelHeight = panel?.getBoundingClientRect().height || 0;
    const effectiveHeight = panelHeight > minHeight ? panelHeight : visualViewportHeight;

    const naturalHeight = measureTextareaScrollHeight(textarea, minHeight);
    const compactNaturalHeight = usesModernAtomSurface
      ? measureRootCompactScrollHeight(compactMeasureTextareaRef.current, composerFormRef.current, input, naturalHeight)
      : naturalHeight;

    const textRequiresExpandedMode = input.trim().length > 0 && (input.includes("\n") || compactNaturalHeight > ROOT_COMPOSER_COMPACT_THRESHOLD);
    const maxComposerHeight = Math.floor(effectiveHeight * ROOT_COMPOSER_MAX_HEIGHT_RATIO);
    const maxHeight = usesModernAtomSurface
      ? Math.max(
          ROOT_COMPOSER_EXPANDED_MIN_INPUT_HEIGHT,
          maxComposerHeight - ROOT_COMPOSER_EXPANDED_PADDING_TOP - ROOT_COMPOSER_WORKBENCH_HEIGHT - ROOT_COMPOSER_EXPANDED_PADDING_BOTTOM,
        )
      : DETAIL_COMPOSER_MAX_HEIGHT;
    const nextExpanded = usesModernAtomSurface ? textRequiresExpandedMode || hasBoundPointContext : false;
    const nextHeight = nextExpanded
      ? Math.min(Math.max(naturalHeight, ROOT_COMPOSER_EXPANDED_MIN_INPUT_HEIGHT), maxHeight)
      : usesModernAtomSurface
        ? ROOT_COMPOSER_COMPACT_INPUT_HEIGHT
        : Math.min(Math.max(naturalHeight, minHeight), maxHeight);
    const nextMaxHeight = nextExpanded || !usesModernAtomSurface ? maxHeight : ROOT_COMPOSER_COMPACT_INPUT_HEIGHT;
    const nextScrollable = usesModernAtomSurface ? nextExpanded && naturalHeight > maxHeight + 1 : naturalHeight > maxHeight + 1;
    setComposerTextareaMetrics((current) => {
      if (
        current.height === nextHeight &&
        current.maxHeight === nextMaxHeight &&
        current.scrollable === nextScrollable &&
        current.expanded === nextExpanded
      )
        return current;
      return { height: nextHeight, maxHeight: nextMaxHeight, scrollable: nextScrollable, expanded: nextExpanded };
    });
  }, [hasBoundPointContext, input, usesModernAtomSurface]);

  useLayoutEffect(() => {
    syncComposerTextareaMetrics();
  }, [input, loading, messages.length, syncComposerTextareaMetrics]);

  useEffect(() => {
    syncComposerTextareaMetrics();
    const handleViewportChange = () => syncComposerTextareaMetrics();
    window.addEventListener("resize", handleViewportChange);
    window.visualViewport?.addEventListener("resize", handleViewportChange);
    window.visualViewport?.addEventListener("scroll", handleViewportChange);
    return () => {
      window.removeEventListener("resize", handleViewportChange);
      window.visualViewport?.removeEventListener("resize", handleViewportChange);
      window.visualViewport?.removeEventListener("scroll", handleViewportChange);
    };
  }, [syncComposerTextareaMetrics]);

  useEffect(() => {
    return () => {
      if (copyResetTimeoutRef.current) window.clearTimeout(copyResetTimeoutRef.current);
      if (rootGlowExitTimeoutRef.current) window.clearTimeout(rootGlowExitTimeoutRef.current);
      stopSmoothAnswer();
    };
  }, [stopSmoothAnswer]);

  useEffect(() => {
    if (!usesModernAtomSurface) {
      previousRootFirstResponseLoadingRef.current = false;
      setRootGlowExitActive(false);
      if (rootGlowExitTimeoutRef.current) {
        window.clearTimeout(rootGlowExitTimeoutRef.current);
        rootGlowExitTimeoutRef.current = undefined;
      }
      return;
    }

    const wasFirstResponseLoading = previousRootFirstResponseLoadingRef.current;
    if (wasFirstResponseLoading && !isRootFirstResponseLoading && rootLayoutState === "conversation") {
      if (rootGlowExitTimeoutRef.current) window.clearTimeout(rootGlowExitTimeoutRef.current);
      setRootGlowExitActive(true);
      rootGlowExitTimeoutRef.current = window.setTimeout(() => {
        setRootGlowExitActive(false);
        rootGlowExitTimeoutRef.current = undefined;
      }, 420);
    } else if (rootLayoutState !== "conversation" || isRootFirstResponseLoading) {
      if (rootGlowExitTimeoutRef.current) {
        window.clearTimeout(rootGlowExitTimeoutRef.current);
        rootGlowExitTimeoutRef.current = undefined;
      }
      setRootGlowExitActive(false);
    }

    previousRootFirstResponseLoadingRef.current = isRootFirstResponseLoading;
  }, [isRootFirstResponseLoading, rootLayoutState, usesModernAtomSurface]);

  useEffect(() => {
    if (!usesModernAtomSurface) return undefined;
    const shell = composerFormRef.current?.closest(".student-app-shell");
    shell?.classList.toggle("context-picker-active", contextPickerOpen);
    document.documentElement.classList.toggle("atom-context-picker-active", contextPickerOpen);
    document.body.classList.toggle("atom-context-picker-active", contextPickerOpen);
    return () => {
      shell?.classList.remove("context-picker-active");
      document.documentElement.classList.remove("atom-context-picker-active");
      document.body.classList.remove("atom-context-picker-active");
    };
  }, [contextPickerOpen, usesModernAtomSurface]);

  useEffect(() => {
    if (historyEntry) {
      setActiveContext(historyEntry.context);
      setMessages(historyEntry.messages);
      setInput("");
      setComposerContextActive(false);
      setContextPickerOpen(false);
      setStatus("idle");
      setActiveThinking(null);
      setLoading(false);
      resetSmoothAnswer();
      setAssistantTurnFeedback({});
      setCopiedTurnKey(null);
      setActiveHistoryId(historyEntry.id);
      setActiveHistoryCreatedAt(historyEntry.createdAt);
      return;
    }
    setActiveContext(context);
    setMessages([]);
    setInput("");
    setComposerContextActive(false);
    setContextPickerOpen(false);
    setStatus("idle");
    setActiveThinking(null);
    setLoading(false);
    resetSmoothAnswer();
    setAssistantTurnFeedback({});
    setCopiedTurnKey(null);
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
    resetSmoothAnswer,
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
    title?: string,
  ): StudentAiHistoryEntry => {
    const saved = upsertStudentAiHistory(
      buildStudentAiHistoryEntry({
        id: historyId,
        context: nextContext,
        messages: nextMessages,
        source: historySourceForVariant(variant),
        createdAt,
        title,
      }),
    );
    setActiveHistoryId(saved.id);
    setActiveHistoryCreatedAt(saved.createdAt);
    onHistoryChange?.();
    return saved;
  };

  const handleResetContext = () => {
    setActiveContext(resetContext || defaultAssistantContext());
    setMessages([]);
    setInput("");
    setComposerContextActive(false);
    setContextPickerOpen(false);
    setLoading(false);
    setStatus("idle");
    setActiveThinking(null);
    resetSmoothAnswer();
    setAssistantTurnFeedback({});
    setCopiedTurnKey(null);
    setActiveHistoryId(null);
    setActiveHistoryCreatedAt(undefined);
    clearActiveStudentAiHistoryId();
    onResetContext();
  };

  const submitQuestion = async (questionText?: string, overrideContext?: AssistantContext) => {
    const question = (questionText || input).trim();
    if (!question || loading) return;
    const requestContext = overrideContext || activeContext;
    const baseMessages = messages;
    const userMessage: StudentAiChatMessage = { id: createStudentAiMessageId("user"), role: "user", content: question };
    const assistantDraft: StudentAiChatMessage = {
      id: createStudentAiMessageId("assistant"),
      role: "assistant",
      content: "",
      thinkingAnimationId: randomAtomThinkingAnimationId(),
    };
    const nextMessages: StudentAiChatMessage[] = [...baseMessages, userMessage, assistantDraft];
    const historyId = activeHistoryId || createStudentAiHistoryId();
    const createdAt = activeHistoryCreatedAt;
    setActiveContext(requestContext);
    resetSmoothAnswer();
    setMessages(nextMessages);
    setInput("");
    setComposerContextActive(false);
    setLoading(true);
    setStatus("streaming");
    setActiveThinking(null);
    const initialHistory = persistConversation(nextMessages, requestContext, historyId, createdAt);
    const createdAtForFinal = initialHistory.createdAt;

    let answer = "";
    let finalMetadata: StudentAssistantFinalMetadata | undefined;
    let debugPhase = "before-stream";
    let lastStreamEvent: StudentAssistantStreamEvent | undefined;
    try {
      debugPhase = "stream-start";
      await streamStudentAssistantAsk(
        {
          ...requestContext,
          question,
          conversation_history: conversationHistory(baseMessages),
        },
        (event) => {
          lastStreamEvent = event;
          const visibleThinking = normalizeVisibleThinkingEvent(event);
          if (visibleThinking) {
            debugPhase = "stream-thinking";
            setActiveThinking(visibleThinking);
            return;
          }
          if (event.event === "status" && typeof event.message === "string") {
            debugPhase = "stream-status";
            setStatus(event.message);
            return;
          }
          if (event.event === "delta" && typeof event.delta === "string") {
            debugPhase = "stream-delta";
            answer += event.delta;
            setStatus("outputting");
            setActiveThinking(null);
            appendSmoothAnswer(event.delta);
            return;
          }
          if (event.event === "replace" && typeof event.answer === "string") {
            debugPhase = "stream-replace";
            answer = event.answer;
            setStatus("outputting");
            setActiveThinking(null);
            replaceSmoothAnswer(answer);
            return;
          }
          if (event.event === "error") {
            debugPhase = "stream-error-event";
            throw new Error(typeof event.message === "string" ? event.message : "Atom 请求失败");
          }
          if (event.event === "final") {
            debugPhase = "stream-final";
            finalMetadata = normalizeAssistantMetadata(event.response);
            if (finalMetadata && typeof finalMetadata.text === "string" && !answer.trim()) {
              answer = finalMetadata.text;
            }
            answer = flushSmoothAnswer(answer);
            setStatus("ai");
            setActiveThinking(null);
            setMessages((current) => {
              const updated = [...current];
              const last = updated[updated.length - 1];
              if (last?.role === "assistant") {
                updated[updated.length - 1] = { ...last, content: answer || last.content, metadata: assistantMessageMetadata(finalMetadata) };
              }
              return updated;
            });
            debugPhase = "stream-final-state";
          }
        },
      );
      debugPhase = "stream-complete";
      if (!answer.trim()) answer = "Atom 暂时没有生成有效回答。";
      answer = flushSmoothAnswer(answer);
      const finalMessages: StudentAiChatMessage[] = [
        ...baseMessages,
        userMessage,
        { ...assistantDraft, content: answer, metadata: assistantMessageMetadata(finalMetadata) },
      ];
      setMessages(finalMessages);
      setStatus("ai");
      setActiveThinking(null);
      debugPhase = "persist-final-history";
      const generatedHistoryTitle = baseMessages.length ? "" : sanitizeStudentAiHistoryTitle(finalMetadata?.conversation_title);
      persistConversation(finalMessages, requestContext, historyId, createdAtForFinal, generatedHistoryTitle);
      debugPhase = "done";
    } catch (requestError) {
      const error = requestError instanceof Error ? requestError : undefined;
      console.error("[atom-chat-error]", {
        phase: debugPhase,
        message: error?.message || String(requestError),
        stack: error?.stack,
        answerLength: answer.length,
        hasFinalMetadata: Boolean(finalMetadata),
        finalMetadataKeys: finalMetadata ? Object.keys(finalMetadata) : [],
        lastEvent: streamEventDebugSnapshot(lastStreamEvent),
      });
      const message = errorMessage(requestError);
      stopSmoothAnswer();
      const errorMessages: StudentAiChatMessage[] = [...baseMessages, userMessage, { ...assistantDraft, content: message, state: "error" }];
      setStatus("error");
      setActiveThinking(null);
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

  const handleComposerChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
    setInput(event.target.value);
  };

  const handleSelectPointContext = (nextContext: AssistantContext) => {
    if (contextBindingLocked) {
      setComposerContextActive(true);
      setContextPickerOpen(false);
      composerTextareaRef.current?.focus();
      return;
    }
    setActiveContext(nextContext);
    setComposerContextActive(false);
    setContextPickerOpen(false);
    composerTextareaRef.current?.focus();
  };

  const handleRemovePointContext = () => {
    if (contextBindingLocked) return;
    setActiveContext(defaultAssistantContext());
    setComposerContextActive(false);
    composerTextareaRef.current?.focus();
  };

  const handleComposerContextAction = () => {
    if (usesModernAtomSurface) {
      if (contextBindingLocked) {
        setComposerContextActive(true);
        composerTextareaRef.current?.focus();
        return;
      }
      setContextPickerOpen(true);
      setComposerContextActive(false);
      return;
    }
    if (!isPointAssistantContext(activeContext)) {
      setComposerContextActive(false);
      composerTextareaRef.current?.focus();
      return;
    }
    setComposerContextActive(true);
    composerTextareaRef.current?.focus();
  };

  const handleComposerContextPointerDown = (event: PointerEvent<HTMLButtonElement>) => {
    if (!usesModernAtomSurface) return;
    event.preventDefault();
    handleComposerContextAction();
  };

  const handleAssistantTurnFeedback = useCallback((turnKey: string, feedback: AssistantTurnFeedback) => {
    setAssistantTurnFeedback((current) => {
      const next = { ...current };
      if (next[turnKey] === feedback) {
        delete next[turnKey];
      } else {
        next[turnKey] = feedback;
      }
      return next;
    });
  }, []);

  const handleCopyAssistantTurn = useCallback(async (turnKey: string, content: string) => {
    await copyAssistantText(content);
    setCopiedTurnKey(turnKey);
    if (copyResetTimeoutRef.current) window.clearTimeout(copyResetTimeoutRef.current);
    copyResetTimeoutRef.current = window.setTimeout(() => {
      setCopiedTurnKey((current) => (current === turnKey ? null : current));
    }, 1600);
  }, []);

  const handleOpenRichContentArtifact = useCallback(
    (historyId: string, messageId: string, artifact: AiRichContentArtifact) => {
      saveActiveStudentAiHistoryId(historyId);
      void navigate({
        to: "/ai/artifact/$historyId/$messageId/$artifactId",
        params: { historyId, messageId, artifactId: artifact.id },
        search: { from: "ai" },
      });
    },
    [navigate],
  );

  return (
    <section
      className={`ai-chat-panel ${variant}${modernSurfaceClassName}${rootLayoutClassName}`}
      data-root-layout={usesModernAtomSurface ? rootLayoutState : undefined}
      data-root-state={rootLayoutState || undefined}
      data-root-response-phase={rootResponsePhase}
      role="region"
      aria-label="Atom 学习助手对话"
    >
      {usesModernAtomSurface ? (
        <div className="ai-root-glow-field" aria-hidden="true">
          <i className="ai-root-glow-blob blob-gold" />
          <i className="ai-root-glow-blob blob-green" />
          <i className="ai-root-glow-blob blob-mint" />
        </div>
      ) : null}
      <header className={`ai-chat-head ${surfaceVariant}`}>
        <div>
          <span>
            <Atom size={14} />
            {usesModernAtomSurface ? "课程 Atom" : "当前上下文"}
          </span>
          <h2>{usesModernAtomSurface ? "Atom 学习助手" : activeContext.context_title}</h2>
          <small>
            <b>{usesModernAtomSurface ? activeContext.context_title : contextMeta}</b>
            {usesModernAtomSurface && contextMeta ? <span>{contextMeta}</span> : null}
            <span>{assistantContextHint(activeContext)}</span>
          </small>
        </div>
        {usesModernAtomSurface ? (
          <div className="ai-root-actions" aria-label="Atom 对话操作">
            {onOpenHistory ? (
              <button type="button" className="ai-root-icon-action ai-history-action" onClick={onOpenHistory} aria-label="查看 Atom 历史记录">
                <RootHistoryIcon />
              </button>
            ) : null}
            <button type="button" className="ai-root-icon-action ai-new-chat-action" onClick={handleResetContext} aria-label="新建 Atom 对话">
              <RootNewChatIcon />
            </button>
          </div>
        ) : !isRootVariant && !isGlobalContext ? (
          <button type="button" onClick={handleResetContext} aria-label="切回全局课程对话">
            <RotateCcw size={16} />
          </button>
        ) : null}
      </header>

      <div className={`ai-chat-stream${showRootWelcome ? " root-empty" : ""}${rootLayoutState ? ` root-${rootLayoutState}` : ""}`} aria-live="polite" ref={streamRef}>
        {showRootWelcome ? (
          <div className="ai-root-welcome">
            <Atom size={47} strokeWidth={1.9} aria-hidden="true" />
            <span>从一个实验开始吧！</span>
          </div>
        ) : null}
        {!messages.length && !usesModernAtomSurface ? (
          <div className={`ai-chat-empty ${variant}`}>
            <Atom size={18} />
            <strong>围绕当前页面继续问</strong>
            <span>{activeContext.context_summary || "当前页面上下文会带入这次对话。"}</span>
          </div>
        ) : null}
        {messages.map((message, index) => {
          const isActiveAssistant = message.role === "assistant" && loading && index === messages.length - 1;
          const isLastError = message.role === "assistant" && (message.state === "error" || (status === "error" && index === messages.length - 1));
          const assistantState = isLastError ? "error" : isActiveAssistant ? "running" : "done";
          const messageKey = message.id || `${message.role}-${index}`;
          const artifactHistoryId = activeHistoryId || historyEntry?.id || null;
          const artifactMessageId = message.id || (artifactHistoryId ? `${artifactHistoryId}-${message.role}-${index + 1}` : messageKey);
          const isRootFlatAssistant = usesModernAtomSurface && message.role === "assistant" && assistantState === "done";
          const isRootThinkingAssistant = usesModernAtomSurface && message.role === "assistant" && assistantState === "running";
          const activePhase = isActiveAssistant ? assistantVisibleThinkingPhase(activeThinking, status, Boolean(message.content.trim())) : null;
          return (
            <div className={`ai-message ${message.role} ${message.role === "assistant" ? assistantState : ""}`} key={messageKey}>
              {message.role === "assistant" ? (
                <>
                  {!isRootFlatAssistant && !isRootThinkingAssistant ? (
                    <div className="ai-message-meta">
                    <span>
                      <Atom size={14} />
                      Atom 学习助手
                    </span>
                    <em>
                      {isLastError ? <XCircle size={13} /> : isActiveAssistant ? <LoaderCircle className="spin" size={13} /> : <CheckCircle2 size={13} />}
                      {isLastError ? "失败" : isActiveAssistant ? "生成中" : "完成"}
                    </em>
                    </div>
                  ) : null}
                  {isRootThinkingAssistant && activePhase ? (
                    <AssistantThinkingLine animationId={message.thinkingAnimationId} phase={activePhase} />
                  ) : isActiveAssistant ? (
                    <div className="ai-stream-progress">
                      <span aria-hidden="true">
                        <i />
                        <i />
                        <i />
                      </span>
                      <strong>{assistantStreamPhaseLabel(status, Boolean(message.content.trim()))}</strong>
                    </div>
                  ) : null}
                  {message.content.trim() ? (
                    <AiMessageMarkdown
                      text={message.content}
                      streaming={isActiveAssistant}
                      artifactContext={
                        message.role === "assistant" && assistantState === "done" && artifactHistoryId && artifactMessageId
                          ? {
                              historyId: artifactHistoryId,
                              messageId: artifactMessageId,
                              onOpenArtifact: (artifact) => handleOpenRichContentArtifact(artifactHistoryId, artifactMessageId, artifact),
                            }
                          : undefined
                      }
                    />
                  ) : isActiveAssistant && !isRootThinkingAssistant ? (
                    <AssistantSkeleton />
                  ) : null}
                  {isRootFlatAssistant ? (
                    <AssistantTurnActions
                      turnKey={messageKey}
                      content={message.content}
                      metadata={message.metadata}
                      feedback={assistantTurnFeedback[messageKey]}
                      copied={copiedTurnKey === messageKey}
                      onFeedback={handleAssistantTurnFeedback}
                      onCopy={handleCopyAssistantTurn}
                    />
                  ) : (
                    <AssistantSourceSummary metadata={message.metadata} />
                  )}
                </>
              ) : (
                message.content
              )}
            </div>
          );
        })}
      </div>

      {quickPrompts.length ? (
        <div className={`ai-quick-prompts${showBoundStarterPrompts ? " bound-starter" : ""}`} aria-label={showBoundStarterPrompts ? "实验提问建议" : "快捷问题"}>
          {quickPrompts.map((prompt) => (
            <button type="button" key={`${prompt.label}-${prompt.question}`} disabled={loading} onClick={() => void submitQuestion(prompt.question)}>
              {showBoundStarterPrompts ? <FlaskConical size={15} aria-hidden="true" /> : null}
              {prompt.label}
            </button>
          ))}
        </div>
      ) : null}

      {usesModernAtomSurface ? (
        <form
          ref={composerFormRef}
          className={`ai-chat-compose root ${rootComposerMode}${loading ? " is-loading" : ""}`}
          onSubmit={handleSubmit}
        >
          <div className="ai-chat-compose-input">
            <MobileTextArea
              ref={composerTextareaRef}
              className={composerTextareaMetrics.scrollable ? "is-scrollable" : undefined}
              value={input}
              onChange={handleComposerChange}
              placeholder={composerPlaceholder}
              aria-label="向 Atom 提问"
              rows={1}
              maxLength={1600}
              disabled={loading}
              style={composerTextareaStyle}
            />
          </div>
          <textarea
            ref={compactMeasureTextareaRef}
            className="ai-chat-compact-measure"
            value={input}
            readOnly
            aria-hidden="true"
            tabIndex={-1}
            rows={1}
          />
          <div className="ai-chat-workbench" aria-label="Atom 输入工具">
            {boundPointContext ? (
              <span className={`ai-context-chip has-bound-context${canEditBoundPoint ? " is-editable" : " is-locked"}`}>
                <button
                  type="button"
                  className="ai-context-reselect-action"
                  onPointerDown={handleComposerContextPointerDown}
                  onClick={handleComposerContextAction}
                  aria-label={contextBindingLocked ? "已绑定学习背景，新建 Atom 对话后可更换" : "重新选择实验点位"}
                  aria-pressed={Boolean(boundPointContext || contextPickerOpen || composerContextActive)}
                  title={boundPointContext.context_title}
                  disabled={contextBindingLocked}
                >
                  <FlaskConical size={18} />
                </button>
                <span className="ai-context-bound-title" title={boundPointContext.context_title}>
                  {boundPointContext.context_title}
                </span>
                {canEditBoundPoint ? (
                  <button
                    type="button"
                    className="ai-context-clear-action"
                    onClick={handleRemovePointContext}
                    aria-label="取消点位绑定"
                    title="取消点位绑定"
                  >
                    <X size={15} />
                  </button>
                ) : null}
              </span>
            ) : (
              <button
                type="button"
                className="ai-context-action"
                onPointerDown={handleComposerContextPointerDown}
                onClick={handleComposerContextAction}
                aria-label={contextBindingLocked ? "已绑定学习背景，新建 Atom 对话后可更换" : "选择学习背景"}
                aria-pressed={Boolean(contextPickerOpen || composerContextActive)}
              >
                <Plus size={24} />
              </button>
            )}
            <span className="ai-composer-context-status" role="status" aria-live="polite">
              {composerContextActive && contextBindingLocked
                ? "已绑定此点位，新建对话后可更换"
                : contextPickerOpen
                  ? "正在选择学习背景"
                  : boundPointContext
                    ? "已选择学习背景"
                    : ""}
            </span>
            <button type="submit" className="ai-send-action" disabled={!input.trim() || loading} aria-label="发送问题">
              {loading ? <LoaderCircle className="spin" size={17} /> : <Send size={17} />}
            </button>
          </div>
        </form>
      ) : (
        <form className="ai-chat-compose detail" onSubmit={handleSubmit}>
          <MobileTextArea
            ref={composerTextareaRef}
            className={composerTextareaMetrics.scrollable ? "is-scrollable" : undefined}
            value={input}
            onChange={handleComposerChange}
            placeholder={composerPlaceholder}
            aria-label="向 Atom 提问"
            rows={1}
            maxLength={1600}
            disabled={loading}
            style={composerTextareaStyle}
          />
          <button type="submit" disabled={!input.trim() || loading} aria-label="发送问题">
            {loading ? <LoaderCircle className="spin" size={17} /> : <Send size={17} />}
          </button>
        </form>
      )}
      {usesModernAtomSurface && contextPickerOpen ? (
        <AtomContextPickerSheet selectedContext={boundPointContext} onClose={() => setContextPickerOpen(false)} onSelect={handleSelectPointContext} />
      ) : null}
    </section>
  );
}
