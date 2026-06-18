import { FormEvent, ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, Bot, CheckCircle2, FlaskConical, LoaderCircle, RotateCcw, Send, Sparkles, XCircle } from "lucide-react";
import {
  AgentChatMessage,
  StudentAssistantFinalMetadata,
  StudentExperimentDetailResponse,
  StudentExperimentGroupResponse,
  StudentExperimentGroupSummary,
  StudentLearningHomeResponse,
  errorMessage,
  getStudentExperimentDetail,
  getStudentExperimentGroup,
  getStudentLearningHome,
  streamStudentAssistantAsk,
} from "../../api";
import { MobileTextArea } from "../../mobile/primitives";
import { AiMarkdownBlock } from "../../shared/markdown/AiMarkdownBlock";
import { defaultAssistantContext, type AssistantContext } from "./assistantContext";
import {
  buildPointAssistantContext,
  buildPointStarterQuestion,
  deriveAssistantPointOptions,
  pointStarterIntents,
  preferredStudentExperimentGroup,
  type AssistantPointStarterContext,
  type AssistantPointStarterIntent,
  type AssistantStarterMode,
  type StudentAssistantPointOption,
} from "./assistantPointStarter";
import {
  assistantContextHint,
  assistantContextTypeLabel,
  assistantStarterIntents,
  buildStarterQuestion,
  isGlobalAssistantContext,
  type AssistantStarterIntent,
} from "./assistantStarter";

type ChatMessage = AgentChatMessage & { metadata?: StudentAssistantFinalMetadata };

function assistantStreamPhaseLabel(status: string, hasAnswer: boolean): string {
  if (hasAnswer) return "正在生成回答";
  const text = String(status || "");
  if (text.includes("检索") || text.includes("证据") || text.includes("RAG") || text.includes("资料")) return "正在检索课程资料";
  if (text.includes("判断") || text.includes("范围") || text.includes("策略") || text.includes("安全")) return "正在判断问题范围";
  if (text.includes("连接")) return "正在连接学习助手";
  if (text.includes("生成")) return "正在生成回答";
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
      <span>引用来源 {sourceCount || sources.length}</span>
      {sources.length ? (
        <div>
          {sources.map((source, index) => (
            <small key={`${source.chunk_id || source.title || "source"}-${index}`}>
              {source.title || source.section || source.chunk_id || "课程资料"}
            </small>
          ))}
        </div>
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

function AssistantStarterSurface({
  selectedIntent,
  intents,
  previewQuestion,
  loading,
  onSelectIntent,
  onLaunchPreview,
}: {
  selectedIntent: AssistantStarterIntent;
  intents: AssistantStarterIntent[];
  previewQuestion: string;
  loading: boolean;
  onSelectIntent: (intent: AssistantStarterIntent) => void;
  onLaunchPreview: () => void;
}) {
  const isCustom = selectedIntent.id === "custom";
  return (
    <div className="ai-starter-surface">
      <section className="ai-starter-card" aria-label="选择提问方向">
        <div className="ai-starter-heading">
          <p>你想先问哪一类？</p>
          <span>选择一个方向，我会帮你整理成适合课程上下文的问题。</span>
        </div>
        <div className="ai-starter-intents">
          {intents.map((intent) => (
            <button
              type="button"
              key={intent.id}
              className={selectedIntent.id === intent.id ? "selected" : ""}
              onClick={() => onSelectIntent(intent)}
              disabled={loading}
            >
              <strong>{intent.label}</strong>
              <small>{intent.description}</small>
            </button>
          ))}
        </div>
      </section>

      <section className="ai-starter-preview" aria-label="准备提问">
        <p>准备提问</p>
        {previewQuestion ? (
          <blockquote>{previewQuestion}</blockquote>
        ) : (
          <blockquote>已保留当前上下文，请在下方输入自己的问题。</blockquote>
        )}
        <button type="button" onClick={onLaunchPreview} disabled={loading || isCustom || !previewQuestion.trim()}>
          <span>{isCustom ? "请在下方输入" : "发送预览问题"}</span>
          <ArrowRight size={16} />
        </button>
      </section>
    </div>
  );
}

function StarterModeSwitch({
  mode,
  disabled,
  onChange,
}: {
  mode: AssistantStarterMode;
  disabled: boolean;
  onChange: (mode: AssistantStarterMode) => void;
}) {
  return (
    <div className="ai-starter-mode" role="tablist" aria-label="选择问答起点">
      <button type="button" role="tab" aria-selected={mode === "course"} className={mode === "course" ? "selected" : ""} disabled={disabled} onClick={() => onChange("course")}>
        课程问答
      </button>
      <button type="button" role="tab" aria-selected={mode === "point"} className={mode === "point" ? "selected" : ""} disabled={disabled} onClick={() => onChange("point")}>
        实验点位
      </button>
    </div>
  );
}

function PointStarterState({
  icon,
  text,
  actionLabel,
  onAction,
}: {
  icon?: ReactNode;
  text: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <div className="ai-point-state">
      {icon || <FlaskConical size={16} />}
      <span>{text}</span>
      {actionLabel && onAction ? (
        <button type="button" onClick={onAction}>
          {actionLabel}
        </button>
      ) : null}
    </div>
  );
}

function PointChoiceSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="ai-point-section">
      <p>{title}</p>
      {children}
    </section>
  );
}

function AssistantPointStarterSurface({
  disabled,
  groups,
  selectedGroupCode,
  learningHomeLoading,
  learningHomeError,
  group,
  selectedExperimentId,
  groupLoading,
  groupError,
  detail,
  selectedPointKey,
  detailLoading,
  detailError,
  pointOptions,
  selectedIntent,
  previewQuestion,
  canLaunch,
  onSelectGroup,
  onSelectExperiment,
  onSelectPoint,
  onSelectIntent,
  onLaunchPreview,
  onRetryLearningHome,
  onRetryGroup,
  onRetryDetail,
}: {
  disabled: boolean;
  groups: StudentExperimentGroupSummary[];
  selectedGroupCode: string;
  learningHomeLoading: boolean;
  learningHomeError: string;
  group: StudentExperimentGroupResponse | null;
  selectedExperimentId: string;
  groupLoading: boolean;
  groupError: string;
  detail: StudentExperimentDetailResponse | null;
  selectedPointKey: string;
  detailLoading: boolean;
  detailError: string;
  pointOptions: StudentAssistantPointOption[];
  selectedIntent: AssistantPointStarterIntent;
  previewQuestion: string;
  canLaunch: boolean;
  onSelectGroup: (parentCode: string) => void;
  onSelectExperiment: (experimentId: string) => void;
  onSelectPoint: (pointKey: string) => void;
  onSelectIntent: (intent: AssistantPointStarterIntent) => void;
  onLaunchPreview: () => void;
  onRetryLearningHome: () => void;
  onRetryGroup: () => void;
  onRetryDetail: () => void;
}) {
  const selectedExperiment = group?.experiments.find((experiment) => experiment.id === selectedExperimentId) || null;
  const selectedPoint = pointOptions.find((point) => point.pointKey === selectedPointKey) || null;
  const isCustom = selectedIntent.id === "custom";
  return (
    <div className="ai-point-starter">
      <section className="ai-starter-card ai-point-card" aria-label="选择实验点位">
        <div className="ai-starter-heading">
          <p>从实验点位开始</p>
          <span>像教师端一样先选具体实验点，再选择想问的方向。</span>
        </div>

        <PointChoiceSection title="1. 实验组">
          {learningHomeLoading ? (
            <PointStarterState icon={<LoaderCircle className="spin" size={16} />} text="正在读取实验组" />
          ) : learningHomeError ? (
            <PointStarterState text={learningHomeError} actionLabel="重试" onAction={onRetryLearningHome} />
          ) : groups.length ? (
            <div className="ai-point-choice-grid">
              {groups.map((item) => (
                <button
                  type="button"
                  key={item.parent_code}
                  className={selectedGroupCode === item.parent_code ? "selected" : ""}
                  onClick={() => onSelectGroup(item.parent_code)}
                  disabled={disabled}
                >
                  <strong>{item.parent_title}</strong>
                  <small>{item.area_name} · {item.experiment_count} 个实验</small>
                  {item.recommended ? <em>推荐</em> : null}
                </button>
              ))}
            </div>
          ) : (
            <PointStarterState text="暂无可选实验组，仍可使用课程问答。" />
          )}
        </PointChoiceSection>

        {selectedGroupCode ? (
          <PointChoiceSection title="2. 实验/视频">
            {groupLoading ? (
              <PointStarterState icon={<LoaderCircle className="spin" size={16} />} text="正在读取实验列表" />
            ) : groupError ? (
              <PointStarterState text={groupError} actionLabel="重试" onAction={onRetryGroup} />
            ) : group?.experiments.length ? (
              <div className="ai-point-choice-stack">
                {group.experiments.map((experiment) => (
                  <button
                    type="button"
                    key={experiment.id}
                    className={selectedExperimentId === experiment.id ? "selected" : ""}
                    onClick={() => onSelectExperiment(experiment.id)}
                    disabled={disabled}
                  >
                    <strong>{experiment.code || experiment.title}</strong>
                    <small>{experiment.title}</small>
                    <em>视频 {experiment.published_video_count || experiment.video_candidate_count}</em>
                  </button>
                ))}
              </div>
            ) : (
              <PointStarterState text="这个实验组暂无可选实验。" />
            )}
          </PointChoiceSection>
        ) : null}

        {selectedExperiment ? (
          <PointChoiceSection title="3. 视频点位">
            {detailLoading ? (
              <PointStarterState icon={<LoaderCircle className="spin" size={16} />} text="正在读取视频点位" />
            ) : detailError ? (
              <PointStarterState text={detailError} actionLabel="重试" onAction={onRetryDetail} />
            ) : pointOptions.length ? (
              <div className="ai-point-choice-stack">
                {pointOptions.map((point) => (
                  <button
                    type="button"
                    key={point.pointKey}
                    className={selectedPointKey === point.pointKey ? "selected" : ""}
                    onClick={() => onSelectPoint(point.pointKey)}
                    disabled={disabled}
                  >
                    <strong>点位 {point.pointIndex}</strong>
                    <small>{point.pointTitle}</small>
                    <em>{point.hasPublishedVideo ? "已发布视频" : "候选点位"}</em>
                  </button>
                ))}
              </div>
            ) : detail ? (
              <PointStarterState text="这个实验暂无可选视频点位，可以换一个实验或直接输入问题。" />
            ) : null}
          </PointChoiceSection>
        ) : null}

        {selectedPoint ? (
          <PointChoiceSection title="4. 想问方向">
            <div className="ai-starter-intents ai-point-intents">
              {pointStarterIntents.map((intent) => (
                <button
                  type="button"
                  key={intent.id}
                  className={selectedIntent.id === intent.id ? "selected" : ""}
                  onClick={() => onSelectIntent(intent)}
                  disabled={disabled}
                >
                  <strong>{intent.label}</strong>
                  <small>{intent.description}</small>
                </button>
              ))}
            </div>
          </PointChoiceSection>
        ) : null}
      </section>

      <section className="ai-starter-preview" aria-label="准备提问">
        <p>准备提问</p>
        {previewQuestion ? (
          <blockquote>{previewQuestion}</blockquote>
        ) : selectedPoint ? (
          <blockquote>已保留这个实验点位，请在下方输入自己的问题。</blockquote>
        ) : (
          <blockquote>先选择实验点位，我会帮你整理成可直接发送的问题。</blockquote>
        )}
        <button type="button" onClick={onLaunchPreview} disabled={disabled || !canLaunch || isCustom}>
          <span>{isCustom ? "请在下方输入" : "发送点位问题"}</span>
          <ArrowRight size={16} />
        </button>
      </section>
    </div>
  );
}

export function StudentAiChatPanel({
  context,
  onResetContext,
}: {
  context: AssistantContext;
  onResetContext: () => void;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("idle");
  const [selectedIntentId, setSelectedIntentId] = useState<string>("");
  const [activeContext, setActiveContext] = useState<AssistantContext>(context);
  const [starterMode, setStarterMode] = useState<AssistantStarterMode>("course");
  const [learningHome, setLearningHome] = useState<StudentLearningHomeResponse | null>(null);
  const [learningHomeLoading, setLearningHomeLoading] = useState(false);
  const [learningHomeError, setLearningHomeError] = useState("");
  const [learningHomeRetry, setLearningHomeRetry] = useState(0);
  const [selectedGroupCode, setSelectedGroupCode] = useState("");
  const [pointGroup, setPointGroup] = useState<StudentExperimentGroupResponse | null>(null);
  const [pointGroupLoading, setPointGroupLoading] = useState(false);
  const [pointGroupError, setPointGroupError] = useState("");
  const [pointGroupRetry, setPointGroupRetry] = useState(0);
  const [selectedExperimentId, setSelectedExperimentId] = useState("");
  const [pointDetail, setPointDetail] = useState<StudentExperimentDetailResponse | null>(null);
  const [pointDetailLoading, setPointDetailLoading] = useState(false);
  const [pointDetailError, setPointDetailError] = useState("");
  const [pointDetailRetry, setPointDetailRetry] = useState(0);
  const [selectedPointKey, setSelectedPointKey] = useState("");
  const [selectedPointIntentId, setSelectedPointIntentId] = useState<string>(pointStarterIntents[0].id);
  const streamRef = useRef<HTMLDivElement>(null);

  const starterIntents = useMemo(() => assistantStarterIntents(activeContext), [activeContext]);
  const selectedIntent = starterIntents.find((intent) => intent.id === selectedIntentId) || starterIntents[0];
  const previewQuestion = selectedIntent ? buildStarterQuestion(selectedIntent, activeContext) : "";
  const pointGroups = learningHome?.groups || [];
  const selectedExperiment = pointGroup?.experiments.find((experiment) => experiment.id === selectedExperimentId) || null;
  const pointOptions = useMemo(() => deriveAssistantPointOptions(pointDetail), [pointDetail]);
  const selectedPoint = pointOptions.find((point) => point.pointKey === selectedPointKey) || null;
  const selectedPointStarterIntent = pointStarterIntents.find((intent) => intent.id === selectedPointIntentId) || pointStarterIntents[0];
  const pointStarterContext: AssistantPointStarterContext | null =
    pointGroup && selectedExperiment && pointDetail && selectedPoint
      ? { group: pointGroup, experiment: selectedExperiment, detail: pointDetail, point: selectedPoint }
      : null;
  const selectedPointAssistantContext = pointStarterContext ? buildPointAssistantContext(pointStarterContext) : null;
  const pointPreviewQuestion = buildPointStarterQuestion(selectedPointStarterIntent, pointStarterContext);
  const contextMeta = [
    activeContext.chapter_id,
    activeContext.point_key ? "已绑定点位" : "",
  ].filter(Boolean).join(" · ");

  useEffect(() => {
    setActiveContext(context);
    setMessages([]);
    setInput("");
    setStatus("idle");
    setLoading(false);
    setSelectedIntentId("");
    setStarterMode("course");
    setSelectedPointIntentId(pointStarterIntents[0].id);
  }, [context.context_type, context.context_title, context.experiment_id, context.chapter_id, context.point_key]);

  useEffect(() => {
    if (!selectedIntent || starterIntents.some((intent) => intent.id === selectedIntentId)) return;
    setSelectedIntentId(starterIntents[0]?.id || "");
  }, [selectedIntent, selectedIntentId, starterIntents]);

  useEffect(() => {
    if (starterMode !== "point" || learningHome || learningHomeLoading) return;
    let cancelled = false;
    setLearningHomeLoading(true);
    setLearningHomeError("");
    getStudentLearningHome()
      .then((payload) => {
        if (cancelled) return;
        setLearningHome(payload);
      })
      .catch((requestError) => {
        if (!cancelled) setLearningHomeError(errorMessage(requestError));
      })
      .finally(() => {
        if (!cancelled) setLearningHomeLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [starterMode, learningHome, learningHomeRetry]);

  useEffect(() => {
    if (starterMode !== "point" || !learningHome) return;
    setSelectedGroupCode((current) => {
      if (current && learningHome.groups.some((group) => group.parent_code === current)) return current;
      return preferredStudentExperimentGroup(learningHome.groups, learningHome.recommended_parent_code)?.parent_code || "";
    });
  }, [starterMode, learningHome]);

  useEffect(() => {
    if (starterMode !== "point" || !selectedGroupCode) return;
    let cancelled = false;
    setPointGroupLoading(true);
    setPointGroupError("");
    getStudentExperimentGroup(selectedGroupCode)
      .then((payload) => {
        if (cancelled) return;
        setPointGroup(payload);
        setSelectedExperimentId((current) => {
          if (current && payload.experiments.some((experiment) => experiment.id === current)) return current;
          return payload.experiments[0]?.id || "";
        });
      })
      .catch((requestError) => {
        if (!cancelled) setPointGroupError(errorMessage(requestError));
      })
      .finally(() => {
        if (!cancelled) setPointGroupLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [starterMode, selectedGroupCode, pointGroupRetry]);

  useEffect(() => {
    if (starterMode !== "point" || !selectedExperimentId) return;
    let cancelled = false;
    setPointDetailLoading(true);
    setPointDetailError("");
    getStudentExperimentDetail(selectedExperimentId)
      .then((payload) => {
        if (cancelled) return;
        setPointDetail(payload);
      })
      .catch((requestError) => {
        if (!cancelled) setPointDetailError(errorMessage(requestError));
      })
      .finally(() => {
        if (!cancelled) setPointDetailLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [starterMode, selectedExperimentId, pointDetailRetry]);

  useEffect(() => {
    if (starterMode !== "point") return;
    setSelectedPointKey((current) => {
      if (current && pointOptions.some((point) => point.pointKey === current)) return current;
      return pointOptions[0]?.pointKey || "";
    });
  }, [starterMode, pointOptions]);

  useEffect(() => {
    if (!streamRef.current) return;
    if (typeof streamRef.current.scrollTo === "function") {
      streamRef.current.scrollTo({ top: streamRef.current.scrollHeight });
      return;
    }
    streamRef.current.scrollTop = streamRef.current.scrollHeight;
  }, [messages, loading]);

  const handleStarterModeChange = (mode: AssistantStarterMode) => {
    setStarterMode(mode);
    setSelectedIntentId("");
    setSelectedPointIntentId(pointStarterIntents[0].id);
  };

  const handleSelectGroup = (parentCode: string) => {
    const isSameGroup = selectedGroupCode === parentCode;
    setSelectedGroupCode(parentCode);
    setPointGroup(null);
    setPointGroupError("");
    setSelectedExperimentId("");
    setPointDetail(null);
    setPointDetailError("");
    setSelectedPointKey("");
    setSelectedPointIntentId(pointStarterIntents[0].id);
    if (isSameGroup) setPointGroupRetry((value) => value + 1);
  };

  const handleSelectExperiment = (experimentId: string) => {
    const isSameExperiment = selectedExperimentId === experimentId;
    setSelectedExperimentId(experimentId);
    setPointDetail(null);
    setPointDetailError("");
    setSelectedPointKey("");
    setSelectedPointIntentId(pointStarterIntents[0].id);
    if (isSameExperiment) setPointDetailRetry((value) => value + 1);
  };

  const handleSelectPoint = (pointKey: string) => {
    setSelectedPointKey(pointKey);
    setSelectedPointIntentId(pointStarterIntents[0].id);
  };

  const handleResetContext = () => {
    setActiveContext(defaultAssistantContext());
    setMessages([]);
    setInput("");
    setLoading(false);
    setStatus("idle");
    setSelectedIntentId("");
    setStarterMode("course");
    setSelectedPointIntentId(pointStarterIntents[0].id);
    setSelectedGroupCode("");
    setPointGroup(null);
    setPointGroupError("");
    setSelectedExperimentId("");
    setPointDetail(null);
    setPointDetailError("");
    setSelectedPointKey("");
    onResetContext();
  };

  const submitQuestion = async (questionText?: string, overrideContext?: AssistantContext) => {
    const question = (questionText || input).trim();
    if (!question || loading) return;
    const requestContext = overrideContext || activeContext;
    const history = messages.slice(-10).map(({ role, content }) => ({ role, content }));
    const nextMessages: ChatMessage[] = [...messages, { role: "user", content: question }, { role: "assistant", content: "" }];
    setActiveContext(requestContext);
    setMessages(nextMessages);
    setInput("");
    setLoading(true);
    setStatus("streaming");
    let answer = "";
    try {
      await streamStudentAssistantAsk(
        {
          ...requestContext,
          question,
          conversation_history: history,
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
            const metadata = normalizeAssistantMetadata(event.response);
            if (metadata && typeof metadata.text === "string" && !answer.trim()) {
              answer = metadata.text;
            }
            setMessages((current) => {
              const updated = [...current];
              const last = updated[updated.length - 1];
              if (last?.role === "assistant") updated[updated.length - 1] = { ...last, content: answer || last.content, metadata };
              return updated;
            });
            setStatus("ai");
          }
        },
      );
      if (!answer.trim()) {
        setMessages((current) => {
          const updated = [...current];
          const last = updated[updated.length - 1];
          if (last?.role === "assistant") updated[updated.length - 1] = { ...last, content: "AI 暂时没有生成有效回答。" };
          return updated;
        });
      }
      setStatus("ai");
    } catch (requestError) {
      const message = errorMessage(requestError);
      setStatus("error");
      setMessages((current) => {
        const updated = [...current];
        const last = updated[updated.length - 1];
        if (last?.role === "assistant") updated[updated.length - 1] = { ...last, content: message };
        return updated;
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const pointContext = !messages.length && starterMode === "point" ? selectedPointAssistantContext : null;
    void submitQuestion(undefined, pointContext || undefined);
  };

  const handleLaunchPreview = () => {
    void submitQuestion(previewQuestion, activeContext);
  };

  const handleLaunchPointPreview = () => {
    if (!selectedPointAssistantContext || !pointPreviewQuestion.trim()) return;
    void submitQuestion(pointPreviewQuestion, selectedPointAssistantContext);
  };

  return (
    <section className="ai-chat-panel" role="region" aria-label="AI 学习助手对话">
      <header className="ai-chat-head">
        <div>
          <span>
            <Sparkles size={14} />
            当前内容
          </span>
          <h2>{activeContext.context_title}</h2>
          <small>
            <b>{assistantContextTypeLabel(activeContext)}</b>
            {contextMeta ? <span>{contextMeta}</span> : null}
            <span>{assistantContextHint(activeContext)}</span>
          </small>
        </div>
        {!isGlobalAssistantContext(activeContext) ? (
          <button type="button" onClick={handleResetContext} aria-label="切回全局课程问答并开始新对话">
            <RotateCcw size={16} />
          </button>
        ) : null}
      </header>

      <div className="ai-chat-stream" aria-live="polite" ref={streamRef}>
        {!messages.length ? (
          <div className="ai-starter-shell">
            <StarterModeSwitch mode={starterMode} disabled={loading} onChange={handleStarterModeChange} />
            {starterMode === "course" ? (
              <AssistantStarterSurface
                selectedIntent={selectedIntent}
                intents={starterIntents}
                previewQuestion={previewQuestion}
                loading={loading}
                onSelectIntent={(intent) => setSelectedIntentId(intent.id)}
                onLaunchPreview={handleLaunchPreview}
              />
            ) : (
              <AssistantPointStarterSurface
                disabled={loading}
                groups={pointGroups}
                selectedGroupCode={selectedGroupCode}
                learningHomeLoading={learningHomeLoading}
                learningHomeError={learningHomeError}
                group={pointGroup}
                selectedExperimentId={selectedExperimentId}
                groupLoading={pointGroupLoading}
                groupError={pointGroupError}
                detail={pointDetail}
                selectedPointKey={selectedPointKey}
                detailLoading={pointDetailLoading}
                detailError={pointDetailError}
                pointOptions={pointOptions}
                selectedIntent={selectedPointStarterIntent}
                previewQuestion={pointPreviewQuestion}
                canLaunch={Boolean(selectedPointAssistantContext && pointPreviewQuestion.trim())}
                onSelectGroup={handleSelectGroup}
                onSelectExperiment={handleSelectExperiment}
                onSelectPoint={handleSelectPoint}
                onSelectIntent={(intent) => setSelectedPointIntentId(intent.id)}
                onLaunchPreview={handleLaunchPointPreview}
                onRetryLearningHome={() => setLearningHomeRetry((value) => value + 1)}
                onRetryGroup={() => setPointGroupRetry((value) => value + 1)}
                onRetryDetail={() => setPointDetailRetry((value) => value + 1)}
              />
            )}
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

      {messages.length ? (
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
          placeholder="输入自己的问题"
          aria-label="输入给 AI 的问题"
          rows={1}
          maxLength={1600}
          disabled={loading}
        />
        <button type="submit" disabled={!input.trim() || loading} aria-label="发送输入内容">
          {loading ? <LoaderCircle className="spin" size={17} /> : <Send size={17} />}
        </button>
      </form>
    </section>
  );
}
