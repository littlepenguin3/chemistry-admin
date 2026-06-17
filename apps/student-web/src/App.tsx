import { CSSProperties, FormEvent, ReactNode, Suspense, lazy, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  Atom,
  BarChart3,
  Bot,
  BookOpenCheck,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  FlaskConical,
  GraduationCap,
  Layers3,
  LoaderCircle,
  LockKeyhole,
  LogIn,
  LogOut,
  MessageCircle,
  Paperclip,
  PlayCircle,
  Send,
  ShieldCheck,
  Sparkles,
  Trash2,
  UserRound,
  Video,
  X,
} from "lucide-react";
import logoUrl from "./assets/sysu-logo.svg";
import {
  MobileButton,
  MobileEmptyState,
  MobileField,
  MobileIconButton,
  MobileStatus,
  MobileTextArea,
} from "./mobile/primitives";
import {
  AgentChatMessage,
  AuthUser,
  LoginResponse,
  PublicPosttestQuestion,
  PublicPretestQuestion,
  StudentAssistantAskRequest,
  StudentAssistantFinalMetadata,
  StudentAppConfigResponse,
  StudentAppFeatureFlags,
  StudentExperimentDetailResponse,
  StudentExperimentGroupResponse,
  StudentExperimentGroupSummary,
  StudentLearningElementBadge,
  StudentLearningArea,
  StudentLearningHomeResponse,
  StudentLearningChapterExperimentGroup,
  StudentLearningPageResponse,
  StudentLearningPointCard,
  StudentLearningPointGroup,
  StudentLearningProfile,
  StudentLearningProfileSummary,
  StudentLearningPropertyCard,
  StudentLearningPropertySection,
  StudentPosttestReport,
  StudentPosttestResponse,
  changeStudentPassword,
  errorMessage,
  explainPosttestMistakes,
  generatePosttestAiSummary,
  getStudentAppConfig,
  getStudentExperimentDetail,
  getStudentExperimentGroup,
  getStudentLearningHome,
  getStudentLearningPage,
  getAuthToken,
  loadCurrentUser,
  logout,
  setAuthToken,
  startStudentPretest,
  startStudentPosttest,
  streamStudentAssistantAsk,
  studentMediaUrl,
  studentLogin,
  submitStudentFeedback,
  submitStudentPosttest,
  submitStudentPretest,
} from "./api";
import { periodicElements } from "./periodic";

type ViewState = "checking" | "login" | "password" | "pretest-loading" | "pretest-error" | "pretest" | "home";
type AnswerMap = Record<string, string>;
type AssessmentQuestion = PublicPretestQuestion | PublicPosttestQuestion;
type AssistantContext = Omit<StudentAssistantAskRequest, "question" | "conversation_history"> & { prompts: string[] };
type ChatMessage = AgentChatMessage & { metadata?: StudentAssistantFinalMetadata };
type FeedbackContext = {
  pagePath: string;
  contextTitle: string;
  chapterId?: string | null;
  experimentId?: string | null;
  pointKey?: string | null;
  metadata?: Record<string, unknown>;
};
type AreaId = "p" | "s" | "ds" | "d" | "f" | "integrated";
type ChapterLearningView = "facts" | "experiments";
type PeriodicArea = "s区" | "p区" | "d区" | "ds区" | "f区";
type StudentTab = "learn" | "experiments" | "assistant" | "assessment" | "profile";
type LearningRoute =
  | { screen: "entry" }
  | {
      screen: "chapter";
      profileId?: string | null;
      propertyKey?: string | null;
      elementSymbol?: string | null;
      chapterView?: ChapterLearningView;
    }
  | {
      screen: "point";
      profileId?: string | null;
      propertyKey?: string | null;
      propertyTitle?: string | null;
      elementSymbol?: string | null;
      chapterView?: ChapterLearningView;
      experimentId: string;
      pointKey?: string | null;
      pointTitle?: string | null;
    };
type AssessmentRoute =
  | { screen: "home" }
  | { screen: "posttest"; posttest: StudentPosttestResponse }
  | { screen: "summary"; report: StudentPosttestReport };
type ExperimentTabRoute =
  | { screen: "overview" }
  | { screen: "group"; parentCode: string }
  | { screen: "detail"; parentCode?: string | null; experimentId: string };

const defaultStudentAppConfig: StudentAppConfigResponse = {
  features: {
    ai_assistant_enabled: true,
    feedback_enabled: true,
    student_ai_assistant_enabled: true,
    rag_access_enabled: true,
  },
};

const TEMP_PRETEST_SKIP_BARRIER = true;
const TEMP_PRETEST_SKIP_TITLE = "课前摸底暂未接入";

const areaIdByPeriodicArea: Record<PeriodicArea, AreaId> = {
  "s区": "s",
  "p区": "p",
  "d区": "d",
  "ds区": "ds",
  "f区": "f",
};

const periodicAreaByAreaId: Record<AreaId, string> = {
  p: "p区",
  s: "s区",
  ds: "ds区",
  d: "d区",
  f: "f区",
  integrated: "氢和稀有气体",
};

const periodicLegendLabelByAreaId: Record<AreaId, string> = {
  p: "p区元素",
  s: "s区元素",
  ds: "ds区元素",
  d: "d区元素",
  f: "f区元素",
  integrated: "氢和稀有气体",
};

const periodicAreaOrder: AreaId[] = ["p", "s", "ds", "d", "f", "integrated"];
const periodicPeriodLabels = ["一", "二", "三", "四", "五", "六", "七", "镧系", "锕系"];
const integratedElementSymbols = new Set(["H", "He", "Ne", "Ar", "Kr", "Xe", "Rn", "Og"]);
type PeriodicElementMeta = (typeof periodicElements)[number];

function periodicAreaIdForElement(element: PeriodicElementMeta): AreaId {
  if (integratedElementSymbols.has(element.symbol)) return "integrated";
  return areaIdByPeriodicArea[element.area as PeriodicArea];
}

function periodicGridColumnForElement(element: PeriodicElementMeta): number {
  const displayGroup = element.area === "f区" && element.period >= 8 ? element.group - 1 : element.group;
  return displayGroup + 1;
}

function periodicGridRowForPeriod(period: number): number {
  return period >= 8 ? period + 2 : period + 1;
}

const LazyAiMarkdown = lazy(async () => {
  const module = await import("./components/AiMarkdown");
  return { default: module.AiMarkdown };
});

const areaSwatches: Record<AreaId, string> = {
  p: "#2f9d70",
  s: "#8cc95f",
  ds: "#d7ab3c",
  d: "#6fa3d8",
  f: "#a77bd2",
  integrated: "#86b4d2",
};

const areaInk: Record<AreaId, string> = {
  p: "#0f3d2b",
  s: "#28430e",
  ds: "#4d3510",
  d: "#123556",
  f: "#3a2452",
  integrated: "#205071",
};

const profileAreaByChapterId: Record<string, AreaId> = {
  CH13: "p",
  CH14: "p",
  CH15: "p",
  CH16: "p",
  CH17: "p",
  CH18: "s",
  CH19: "ds",
  CH20: "d",
  CH21: "f",
  CH22: "integrated",
};

const elementEnglishNames: Record<string, string> = {
  H: "Hydrogen",
  He: "Helium",
  Li: "Lithium",
  B: "Boron",
  C: "Carbon",
  N: "Nitrogen",
  O: "Oxygen",
  F: "Fluorine",
  Ne: "Neon",
  Na: "Sodium",
  Mg: "Magnesium",
  Al: "Aluminium",
  Si: "Silicon",
  P: "Phosphorus",
  S: "Sulfur",
  Cl: "Chlorine",
  Ar: "Argon",
  K: "Potassium",
  Ca: "Calcium",
  Ti: "Titanium",
  V: "Vanadium",
  Cr: "Chromium",
  Mn: "Manganese",
  Fe: "Iron",
  Co: "Cobalt",
  Ni: "Nickel",
  Cu: "Copper",
  Zn: "Zinc",
  Ga: "Gallium",
  As: "Arsenic",
  Se: "Selenium",
  Br: "Bromine",
  Kr: "Krypton",
  Ag: "Silver",
  Cd: "Cadmium",
  In: "Indium",
  Sn: "Tin",
  Sb: "Antimony",
  Te: "Tellurium",
  I: "Iodine",
  Xe: "Xenon",
  At: "Astatine",
  Ba: "Barium",
  Hg: "Mercury",
  Tl: "Thallium",
  Pb: "Lead",
  Bi: "Bismuth",
};

function normalizeStudentId(value: string): string {
  return value.trim().toUpperCase();
}

function isStudent(response: LoginResponse): boolean {
  return response.user.role === "student";
}

function compactText(parts: Array<string | null | undefined>): string {
  return parts
    .map((part) => String(part || "").trim())
    .filter(Boolean)
    .join("；")
    .slice(0, 1800);
}

function assistantStatusLabel(status: string, loading: boolean): string {
  if (loading) return "正在生成";
  if (status === "ai") return "AI 已回答";
  if (status === "fallback") return "兜底回答";
  if (status === "error") return "请求失败";
  return "课程上下文已绑定";
}

function App() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [checking, setChecking] = useState(true);
  const [sessionError, setSessionError] = useState("");
  const [pretest, setPretest] = useState<Awaited<ReturnType<typeof startStudentPretest>> | null>(null);
  const [pretestLoading, setPretestLoading] = useState(false);
  const [pretestError, setPretestError] = useState("");
  const [pretestSkipped, setPretestSkipped] = useState(false);

  useEffect(() => {
    if (!getAuthToken()) {
      setChecking(false);
      return;
    }
    loadCurrentUser()
      .then((currentUser) => {
        if (currentUser.role !== "student") {
          setAuthToken("");
          setSessionError("请使用学生账号登录");
          return;
        }
        setUser(currentUser);
      })
      .catch(() => {
        setAuthToken("");
      })
      .finally(() => setChecking(false));
  }, []);

  useEffect(() => {
    if (!user || user.must_change_password) {
      setPretest(null);
      setPretestLoading(false);
      setPretestError("");
      setPretestSkipped(false);
      return;
    }

    if (TEMP_PRETEST_SKIP_BARRIER) {
      setPretest(null);
      setPretestLoading(false);
      setPretestError(TEMP_PRETEST_SKIP_TITLE);
      setPretestSkipped(false);
      return;
    }

    let cancelled = false;
    setPretestLoading(true);
    setPretestError("");
    setPretestSkipped(false);
    startStudentPretest()
      .then((response) => {
        if (cancelled) return;
        setPretest(response);
      })
      .catch((requestError) => {
        if (cancelled) return;
        setPretestError(errorMessage(requestError));
      })
      .finally(() => {
        if (!cancelled) setPretestLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [user?.id, user?.must_change_password, user?.password_version]);

  const view: ViewState = useMemo(() => {
    if (checking) return "checking";
    if (!user) return "login";
    if (user.must_change_password) return "password";
    if (pretestLoading && !pretest) return "pretest-loading";
    if (pretestError && !pretestSkipped) return "pretest-error";
    if (pretest?.status === "in_progress" && pretest.stage && pretest.questions.length) return "pretest";
    if (pretestLoading) return "pretest-loading";
    return "home";
  }, [checking, pretest, pretestError, pretestLoading, pretestSkipped, user]);

  const acceptLogin = (response: LoginResponse) => {
    if (!isStudent(response)) {
      setAuthToken("");
      setSessionError("请使用学生账号登录");
      return;
    }
    setSessionError("");
    setAuthToken(response.access_token);
    setUser(response.user);
  };

  const handleLogout = async () => {
    await logout();
    setPretest(null);
    setPretestError("");
    setPretestSkipped(false);
    setUser(null);
  };

  const handlePretestSubmit = async (answers: AnswerMap) => {
    if (!pretest?.stage) return;
    setPretestLoading(true);
    setPretestError("");
    try {
      const response = await submitStudentPretest(
        pretest.stage,
        Object.entries(answers).map(([questionId, answer]) => ({ question_id: questionId, answer })),
      );
      setPretest(response);
    } catch (requestError) {
      setPretestError(errorMessage(requestError));
    } finally {
      setPretestLoading(false);
    }
  };

  return (
    <main className={view === "pretest" ? "app-shell assessment-shell" : view === "home" ? "app-shell learning-shell" : "app-shell"}>
      {view === "home" ? null : (
        <section className="brand-rail" aria-label="中山大学化学学院">
          <div className="brand-seal">
            <img src={logoUrl} alt="中山大学校徽" />
          </div>
          <div>
            <p>中山大学化学学院</p>
            <h1>元素实验</h1>
          </div>
        </section>
      )}

      {view === "checking" ? <LoadingPanel text="正在恢复登录状态" /> : null}
      {view === "login" ? <LoginPanel sessionError={sessionError} onLogin={acceptLogin} /> : null}
      {view === "password" && user ? <PasswordPanel user={user} onChanged={acceptLogin} /> : null}
      {view === "pretest-loading" ? <LoadingPanel text="正在准备课前摸底" /> : null}
      {view === "pretest-error" ? (
        <PretestErrorPanel message={pretestError} onSkip={() => setPretestSkipped(true)} onLogout={handleLogout} />
      ) : null}
      {view === "pretest" && pretest ? (
        <>
          <AssessmentPanel
            eyebrow="课前摸底"
            title="请完成以下题目"
            questions={pretest.questions}
            submitting={pretestLoading}
            onSubmit={handlePretestSubmit}
          />
        </>
      ) : null}
      {view === "home" && user ? <LearningSurface user={user} onLogout={handleLogout} /> : null}
    </main>
  );
}

function LoadingPanel({ text }: { text: string }) {
  return (
    <section className="auth-panel compact-panel" aria-live="polite">
      <LoaderCircle className="spin" size={24} />
      <p>{text}</p>
    </section>
  );
}

function optionValue(option: Record<string, unknown>, index: number): string {
  const raw = option.label ?? option.key ?? option.value ?? String.fromCharCode(65 + index);
  return String(raw);
}

function optionText(option: Record<string, unknown>, index: number): string {
  const fallback = optionValue(option, index);
  return String(option.text ?? fallback);
}

function assessmentOptions(question: AssessmentQuestion): Array<{ value: string; marker: string; text: string }> {
  if (question.question_type === "true_false") {
    return [
      { value: "true", marker: "对", text: "正确" },
      { value: "false", marker: "错", text: "错误" },
    ];
  }
  return question.options.map((option, index) => {
    const value = optionValue(option, index);
    return { value, marker: value, text: optionText(option, index) };
  });
}

function AssessmentPanel({
  eyebrow,
  title,
  questions,
  submitting,
  onSubmit,
}: {
  eyebrow: string;
  title: string;
  questions: AssessmentQuestion[];
  submitting: boolean;
  onSubmit: (answers: AnswerMap) => void;
}) {
  const [answers, setAnswers] = useState<AnswerMap>({});

  useEffect(() => {
    setAnswers({});
  }, [questions]);

  const allAnswered = questions.length > 0 && questions.every((question) => String(answers[question.id] || "").trim());

  return (
    <section className="assessment-panel" aria-label={eyebrow}>
      <div className="assessment-title">
        <span className="panel-icon">
          <ClipboardList size={19} />
        </span>
        <div>
          <p>{eyebrow}</p>
          <h2>{title}</h2>
        </div>
      </div>

      <div className="question-list">
        {questions.map((question, questionIndex) => (
          <article className="question-card" key={question.id}>
            <div className="question-card-head">
              <span>Q{questionIndex + 1}</span>
            </div>
            <h3>{question.stem}</h3>
            {question.question_type === "fill_blank" ? (
              <MobileField
                className="fill-answer"
                value={answers[question.id] || ""}
                onChange={(event) => setAnswers((current) => ({ ...current, [question.id]: event.target.value }))}
                placeholder="请输入答案"
              />
            ) : (
              <div className="option-list">
                {assessmentOptions(question).map((option) => {
                  const selected = answers[question.id] === option.value;
                  return (
                    <button
                      key={`${question.id}-${option.value}`}
                      className={selected ? "option selected" : "option"}
                      type="button"
                      aria-pressed={selected}
                      onClick={() => setAnswers((current) => ({ ...current, [question.id]: option.value }))}
                    >
                      <b>{option.marker}</b>
                      <span>{option.text}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </article>
        ))}
      </div>
      <button className="sticky-action" type="button" disabled={!allAnswered || submitting} onClick={() => onSubmit(answers)}>
        {submitting ? <LoaderCircle className="spin" size={18} /> : <CheckCircle2 size={18} />}
        <span>{submitting ? "正在提交" : "提交答案"}</span>
      </button>
    </section>
  );
}

function PretestErrorPanel({ message, onSkip, onLogout }: { message: string; onSkip: () => void; onLogout: () => void }) {
  const title = TEMP_PRETEST_SKIP_BARRIER ? TEMP_PRETEST_SKIP_TITLE : message || "暂时无法开始";

  return (
    <section className="auth-panel success-panel">
      <div className="success-mark warning-mark">
        <ClipboardList size={30} />
      </div>
      <div className="success-copy">
        <p>课前摸底</p>
        <h2>{title}</h2>
      </div>
      <div className="form-hint">临时跳过屏障：课前摸底由后续分支继续完善，本轮可先进入学习页检查学习体验。</div>
      <MobileButton className="primary-action" type="button" onClick={onSkip}>
        <BookOpenCheck size={18} />
        <span>跳过课前摸底</span>
      </MobileButton>
      <MobileButton variant="secondary" className="secondary-action" type="button" onClick={onLogout}>
        <LogOut size={18} />
        <span>退出登录</span>
      </MobileButton>
    </section>
  );
}

function LoginPanel({
  sessionError,
  onLogin,
}: {
  sessionError: string;
  onLogin: (response: LoginResponse) => void;
}) {
  const [studentId, setStudentId] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(sessionError);

  useEffect(() => setError(sessionError), [sessionError]);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const normalizedId = normalizeStudentId(studentId);
    if (!normalizedId || !password) return;
    setLoading(true);
    setError("");
    try {
      const response = await studentLogin(normalizedId, password);
      onLogin(response);
    } catch (requestError) {
      setError(errorMessage(requestError));
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="auth-panel">
      <div className="panel-heading">
        <span className="panel-icon">
          <UserRound size={19} />
        </span>
        <div>
          <p>学生入口</p>
          <h2>学号登录</h2>
        </div>
      </div>

      <form onSubmit={submit} className="auth-form">
        <label>
          <span>学号</span>
          <MobileField
            value={studentId}
            onChange={(event) => setStudentId(event.target.value)}
            placeholder="请输入学号"
            autoComplete="username"
            inputMode="text"
          />
        </label>
        <label>
          <span>密码</span>
          <MobileField
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="请输入密码"
            type="password"
            autoComplete="current-password"
          />
        </label>
        {error ? <div className="form-error">{error}</div> : null}
        <MobileButton className="primary-action" type="submit" loading={loading} disabled={!studentId.trim() || !password}>
          {loading ? <LoaderCircle className="spin" size={18} /> : <LogIn size={18} />}
          <span>{loading ? "正在登录" : "登录"}</span>
        </MobileButton>
      </form>
    </section>
  );
}

function PasswordPanel({ user, onChanged }: { user: AuthUser; onChanged: (response: LoginResponse) => void }) {
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const canSubmit = newPassword.length >= 8 && newPassword === confirmPassword;

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canSubmit) return;
    setLoading(true);
    setError("");
    try {
      const response = await changeStudentPassword(newPassword);
      onChanged(response);
    } catch (requestError) {
      setError(errorMessage(requestError));
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="auth-panel">
      <div className="panel-heading">
        <span className="panel-icon warning">
          <LockKeyhole size={19} />
        </span>
        <div>
          <p>{user.student_id || user.username}</p>
          <h2>修改初始密码</h2>
        </div>
      </div>

      <form onSubmit={submit} className="auth-form">
        <div className="form-hint">首次登录已完成身份校验，只需要设置新密码。</div>
        <label>
          <span>新密码</span>
          <MobileField
            value={newPassword}
            onChange={(event) => setNewPassword(event.target.value)}
            placeholder="至少 8 位"
            type="password"
            autoComplete="new-password"
          />
        </label>
        <label>
          <span>确认新密码</span>
          <MobileField
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            placeholder="再次输入新密码"
            type="password"
            autoComplete="new-password"
          />
        </label>
        {newPassword && newPassword.length < 8 ? <div className="form-hint">新密码至少 8 位</div> : null}
        {confirmPassword && newPassword !== confirmPassword ? <div className="form-hint">两次输入的新密码不一致</div> : null}
        {error ? <div className="form-error">{error}</div> : null}
        <MobileButton className="primary-action" type="submit" loading={loading} disabled={!canSubmit}>
          {loading ? <LoaderCircle className="spin" size={18} /> : <ShieldCheck size={18} />}
          <span>{loading ? "正在保存" : "保存并继续"}</span>
        </MobileButton>
      </form>
    </section>
  );
}

function assistantEnabled(features: StudentAppFeatureFlags): boolean {
  return features.ai_assistant_enabled && features.student_ai_assistant_enabled;
}

function feedbackEnabled(features: StudentAppFeatureFlags): boolean {
  return features.feedback_enabled;
}

function LearningSurface({ user, onLogout }: { user: AuthUser; onLogout: () => void }) {
  const [activeTab, setActiveTab] = useState<StudentTab>("learn");
  const [learningRoute, setLearningRoute] = useState<LearningRoute>({ screen: "entry" });
  const [assessmentRoute, setAssessmentRoute] = useState<AssessmentRoute>({ screen: "home" });
  const [experimentRoute, setExperimentRoute] = useState<ExperimentTabRoute>({ screen: "overview" });
  const [assistantContext, setAssistantContext] = useState<AssistantContext>(() => defaultAssistantContext());
  const [appConfig, setAppConfig] = useState<StudentAppConfigResponse>(defaultStudentAppConfig);
  const [configError, setConfigError] = useState("");
  const [posttestLoading, setPosttestLoading] = useState(false);
  const [posttestSubmitting, setPosttestSubmitting] = useState(false);
  const [posttestError, setPosttestError] = useState("");

  useEffect(() => {
    let cancelled = false;
    const refreshConfig = async () => {
      try {
        const response = await getStudentAppConfig();
        if (!cancelled) {
          setAppConfig(response);
          setConfigError("");
        }
      } catch (requestError) {
        if (!cancelled) setConfigError(errorMessage(requestError));
      }
    };
    void refreshConfig();
    const handleVisible = () => {
      if (document.visibilityState !== "hidden") void refreshConfig();
    };
    window.addEventListener("focus", handleVisible);
    document.addEventListener("visibilitychange", handleVisible);
    const timer = window.setInterval(refreshConfig, 60_000);
    return () => {
      cancelled = true;
      window.removeEventListener("focus", handleVisible);
      document.removeEventListener("visibilitychange", handleVisible);
      window.clearInterval(timer);
    };
  }, []);

  const finishLearning = async () => {
    setPosttestLoading(true);
    setPosttestError("");
    try {
      const response = await startStudentPosttest();
      setAssessmentRoute({ screen: "posttest", posttest: response });
      setActiveTab("assessment");
    } catch (requestError) {
      setPosttestError(errorMessage(requestError));
    } finally {
      setPosttestLoading(false);
    }
  };

  const submitPosttest = async (posttest: StudentPosttestResponse, answers: AnswerMap) => {
    setPosttestSubmitting(true);
    setPosttestError("");
    try {
      const response = await submitStudentPosttest(
        posttest.session_id,
        Object.entries(answers).map(([questionId, answer]) => ({ question_id: questionId, answer })),
      );
      setAssessmentRoute({ screen: "summary", report: response.report });
      setActiveTab("assessment");
    } catch (requestError) {
      setPosttestError(errorMessage(requestError));
    } finally {
      setPosttestSubmitting(false);
    }
  };

  const canUseAssistant = assistantEnabled(appConfig.features);
  const canUseFeedback = feedbackEnabled(appConfig.features);

  useEffect(() => {
    if (!canUseAssistant && activeTab === "assistant") {
      setActiveTab("learn");
    }
  }, [activeTab, canUseAssistant]);

  const switchTab = (tab: StudentTab) => {
    if (tab === "assistant" && !canUseAssistant) return;
    setActiveTab(tab);
    window.requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: "auto" }));
  };

  const openAssistant = (context: AssistantContext) => {
    if (!canUseAssistant) return;
    setAssistantContext(context);
    setActiveTab("assistant");
    window.requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: "auto" }));
  };

  const renderLearning = () => {
    if (learningRoute.screen === "point") {
      return (
        <ExperimentDetailPanel
          experimentId={learningRoute.experimentId}
          profileId={learningRoute.profileId}
          propertyKey={learningRoute.propertyKey}
          propertyTitle={learningRoute.propertyTitle}
          elementSymbol={learningRoute.elementSymbol}
          chapterView={learningRoute.chapterView}
          pointKey={learningRoute.pointKey}
          pointTitle={learningRoute.pointTitle}
          onBack={() =>
            setLearningRoute({
              screen: "chapter",
              profileId: learningRoute.profileId,
              propertyKey: learningRoute.propertyKey,
              elementSymbol: learningRoute.elementSymbol,
              chapterView: learningRoute.chapterView || "experiments",
            })
          }
          onFinishLearning={finishLearning}
          finishing={posttestLoading}
          finishError={posttestError}
          assistantEnabled={canUseAssistant}
          onOpenAssistant={openAssistant}
        />
      );
    }

    if (learningRoute.screen === "entry") {
      return (
        <LearningEntryPanel
          onSelectProfile={(profileId) => setLearningRoute({ screen: "chapter", profileId })}
        />
      );
    }

    return (
      <LearningHomePanel
        profileId={learningRoute.profileId}
        initialPropertyKey={learningRoute.propertyKey}
        initialElementSymbol={learningRoute.elementSymbol}
        initialChapterView={learningRoute.chapterView}
        onSwitchChapter={() => setLearningRoute({ screen: "entry" })}
        onSelectPoint={(point) =>
          setLearningRoute({
            screen: "point",
            profileId: point.profileId,
            propertyKey: point.propertyKey,
            propertyTitle: point.propertyTitle,
            elementSymbol: point.elementSymbol,
            chapterView: point.chapterView,
            experimentId: point.experimentId,
            pointKey: point.pointKey,
            pointTitle: point.pointTitle,
          })
        }
        onFinishLearning={finishLearning}
        finishing={posttestLoading}
        finishError={posttestError}
        assistantEnabled={canUseAssistant}
        onOpenAssistant={openAssistant}
      />
    );
  };

  const renderExperiments = () => {
    if (experimentRoute.screen === "group") {
      return (
        <ExperimentGroupPanel
          parentCode={experimentRoute.parentCode}
          onBack={() => setExperimentRoute({ screen: "overview" })}
          onSelectExperiment={(experimentId) => setExperimentRoute({ screen: "detail", parentCode: experimentRoute.parentCode, experimentId })}
          onFinishLearning={finishLearning}
          finishing={posttestLoading}
          finishError={posttestError}
          assistantEnabled={canUseAssistant}
          onOpenAssistant={openAssistant}
        />
      );
    }
    if (experimentRoute.screen === "detail") {
      return (
        <ExperimentDetailPanel
          experimentId={experimentRoute.experimentId}
          onBack={() =>
            setExperimentRoute(experimentRoute.parentCode ? { screen: "group", parentCode: experimentRoute.parentCode } : { screen: "overview" })
          }
          onFinishLearning={finishLearning}
          finishing={posttestLoading}
          finishError={posttestError}
          assistantEnabled={canUseAssistant}
          onOpenAssistant={openAssistant}
        />
      );
    }
    return (
      <ExperimentsOverviewPanel
        onSelectGroup={(parentCode) => setExperimentRoute({ screen: "group", parentCode })}
      />
    );
  };

  const renderAssessment = () => {
    if (assessmentRoute.screen === "posttest") {
      return (
        <PosttestPanel
          posttest={assessmentRoute.posttest}
          submitting={posttestSubmitting}
          error={posttestError}
          onSubmit={(answers) => submitPosttest(assessmentRoute.posttest, answers)}
        />
      );
    }
    if (assessmentRoute.screen === "summary") {
      return (
        <PosttestSummaryPanel
          report={assessmentRoute.report}
          onContinue={() => {
            setAssessmentRoute({ screen: "home" });
            setLearningRoute({ screen: "entry" });
            setActiveTab("learn");
          }}
        />
      );
    }
    return <AssessmentHomePanel />;
  };

  const activeMeta = studentTabMeta[activeTab];
  const navItems = studentTabItems(canUseAssistant);
  const content =
    activeTab === "learn"
      ? renderLearning()
      : activeTab === "experiments"
        ? renderExperiments()
        : activeTab === "assistant"
          ? <StudentAiChatTab context={assistantContext} onResetContext={() => setAssistantContext(defaultAssistantContext())} />
          : activeTab === "assessment"
            ? renderAssessment()
            : <ProfileTabPanel user={user} feedbackEnabled={canUseFeedback} onLogout={onLogout} />;

  return (
    <section className="student-app-shell" aria-label="学生学习应用">
      <StudentAppHeader title={activeMeta.title} subtitle={activeMeta.subtitle} user={user} />
      {configError ? <div className="form-hint app-config-hint">配置刷新失败，当前页面会继续使用上一次配置：{configError}</div> : null}
      <div className="student-tab-content">{content}</div>
      <StudentBottomNav items={navItems} activeTab={activeTab} onChange={switchTab} />
    </section>
  );
}

function defaultAssistantContext(): AssistantContext {
  return {
    context_type: "learning_home",
    context_title: "AI 学习助手",
    context_summary: "学生端全局课程问答入口",
    prompts: ["我应该先复习哪一块？", "帮我解释一个无机化学实验现象", "怎样把元素性质和实验联系起来？"],
  };
}

const studentTabMeta: Record<StudentTab, { title: string; subtitle: string }> = {
  learn: { title: "学习", subtitle: "章节与元素周期表" },
  experiments: { title: "实验", subtitle: "资源与点位" },
  assistant: { title: "问答", subtitle: "AI 学习助手" },
  assessment: { title: "测评", subtitle: "后测与报告" },
  profile: { title: "我的", subtitle: "账号与反馈" },
};

function studentTabItems(canUseAssistant: boolean): Array<{ key: StudentTab; label: string; icon: ReactNode }> {
  return [
    { key: "learn", label: "学习", icon: <BookOpenCheck size={20} /> },
    { key: "experiments", label: "实验", icon: <FlaskConical size={20} /> },
    ...(canUseAssistant ? [{ key: "assistant" as const, label: "问答", icon: <MessageCircle size={20} /> }] : []),
    { key: "assessment", label: "测评", icon: <ClipboardList size={20} /> },
    { key: "profile", label: "我的", icon: <UserRound size={20} /> },
  ];
}

function StudentAppHeader({ title, subtitle, user }: { title: string; subtitle: string; user: AuthUser }) {
  return (
    <header className="student-app-header">
      <div>
        <p>{subtitle}</p>
        <h1>{title}</h1>
      </div>
      <span>{user.display_name || user.student_id || user.username}</span>
    </header>
  );
}

function StudentBottomNav({
  items,
  activeTab,
  onChange,
}: {
  items: Array<{ key: StudentTab; label: string; icon: ReactNode }>;
  activeTab: StudentTab;
  onChange: (tab: StudentTab) => void;
}) {
  return (
    <nav className="student-bottom-nav" aria-label="学生端主导航">
      {items.map((item) => (
        <button
          key={item.key}
          type="button"
          className={activeTab === item.key ? "active" : ""}
          aria-current={activeTab === item.key ? "page" : undefined}
          onClick={() => onChange(item.key)}
        >
          {item.icon}
          <span>{item.label}</span>
        </button>
      ))}
    </nav>
  );
}

function AssessmentHomePanel() {
  return (
    <section className="learning-panel assessment-home-panel" aria-label="测评">
      <section className="tab-empty-card">
        <span className="panel-icon">
          <ClipboardList size={20} />
        </span>
        <div>
          <p>当前测评</p>
          <h2>完成章节学习后进入后测</h2>
          <span>后测会根据本次学习的实验点生成，完成后这里会显示报告和错题讲解。</span>
        </div>
      </section>
    </section>
  );
}

function ExperimentsOverviewPanel({ onSelectGroup }: { onSelectGroup: (parentCode: string) => void }) {
  const [home, setHome] = useState<StudentLearningHomeResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    getStudentLearningHome()
      .then((payload) => {
        if (!cancelled) setHome(payload);
      })
      .catch((requestError) => {
        if (!cancelled) setError(errorMessage(requestError));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <section className="learning-panel experiments-overview-panel" aria-label="实验资源">
      {loading ? <LearningState icon={<LoaderCircle className="spin" size={23} />} text="正在加载实验资源" /> : null}
      {error ? <LearningState icon={<FlaskConical size={23} />} text={error} /> : null}
      {home ? (
        <>
          <section className="resource-overview-card">
            <div>
              <p>实验资源</p>
              <h2>{home.groups.length} 个实验模块</h2>
              <span>
                {home.areas.filter((area) => area.enabled).length} 个学习区域 / {home.groups.reduce((total, group) => total + group.question_count, 0)} 道配套题
              </span>
            </div>
            <FlaskConical size={24} />
          </section>
          <div className="experiment-module-list">
            {home.groups.map((group) => (
              <button className={group.recommended ? "experiment-module-card recommended" : "experiment-module-card"} key={group.parent_code} type="button" onClick={() => onSelectGroup(group.parent_code)}>
                {group.recommended ? <em>推荐学习</em> : null}
                <div>
                  <p>{group.area_name}</p>
                  <h3>{stripExperimentPrefix(group.parent_title)}</h3>
                  <span>
                    {group.experiment_count} 个点位 / {group.published_video_count} 个视频 / {group.question_count} 道题
                  </span>
                </div>
                <ChevronRight size={18} />
              </button>
            ))}
          </div>
          {!home.groups.length ? (
            <MobileEmptyState className="empty-learning-card" icon={<FlaskConical size={20} />}>
              <span>暂无可学习的实验模块</span>
            </MobileEmptyState>
          ) : null}
        </>
      ) : null}
    </section>
  );
}

function ProfileTabPanel({
  user,
  feedbackEnabled,
  onLogout,
}: {
  user: AuthUser;
  feedbackEnabled: boolean;
  onLogout: () => void;
}) {
  return (
    <section className="learning-panel profile-tab-panel" aria-label="我的">
      <section className="profile-card">
        <span className="panel-icon">
          <UserRound size={20} />
        </span>
        <div>
          <p>{user.student_id || user.username}</p>
          <h2>{user.display_name}</h2>
          {user.class_name ? <small>{user.class_name}</small> : null}
        </div>
      </section>
      {feedbackEnabled ? (
        <StudentFeedbackForm
          context={{
            pagePath: "/student/profile/feedback",
            contextTitle: "学生端反馈",
            metadata: { screen: "profile_feedback" },
          }}
        />
      ) : (
        <MobileEmptyState className="empty-learning-card" icon={<ClipboardList size={20} />}>
          <span>反馈入口已关闭</span>
        </MobileEmptyState>
      )}
      <MobileButton className="secondary-action full profile-logout-action" type="button" variant="secondary" onClick={onLogout}>
        <LogOut size={18} />
        <span>退出登录</span>
      </MobileButton>
    </section>
  );
}

function LearningEntryPanel({
  onSelectProfile,
}: {
  onSelectProfile: (profileId: string) => void;
}) {
  const [page, setPage] = useState<StudentLearningPageResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedArea, setSelectedArea] = useState<AreaId>("p");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    getStudentLearningPage(null)
      .then((payload) => {
        if (!cancelled) setPage(payload);
      })
      .catch((requestError) => {
        if (!cancelled) setError(errorMessage(requestError));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const profiles = page?.profiles || [];
  const recommendedProfileId = page?.recommended_profile_id || page?.active_profile?.profile_id || profiles[0]?.profile_id || "";
  const recommendedProfile = profiles.find((profile) => profile.profile_id === recommendedProfileId) || profiles[0] || null;
  const recommendedArea = recommendedProfile ? profileAreaId(recommendedProfile) : null;
  const recommendedCueLabel = formatRecommendedAreaCueLabel(recommendedProfile);
  const recommendedElementSymbols = useMemo(
    () => new Set<string>(recommendedProfile?.element_symbols || []),
    [recommendedProfile],
  );
  const selectedAreaProfiles = useMemo(
    () => profiles.filter((profile) => profileAreaId(profile) === selectedArea),
    [profiles, selectedArea],
  );
  const selectedAreaLearnableSymbols = useMemo(() => {
    const symbols = new Set<string>();
    selectedAreaProfiles.forEach((profile) => {
      profile.element_symbols.forEach((symbol) => symbols.add(symbol));
    });
    return symbols;
  }, [selectedAreaProfiles]);
  useEffect(() => {
    if (recommendedArea) setSelectedArea(recommendedArea);
  }, [recommendedArea]);

  return (
    <section className="learning-panel" aria-label="元素周期表章节入口">
      {loading ? <LearningState icon={<LoaderCircle className="spin" size={23} />} text="正在加载学习章节" /> : null}
      {error ? <LearningState icon={<FlaskConical size={23} />} text={error} /> : null}
      {!loading && !error ? (
        <>
          <section className="chapter-entry-hero">
            <p>元素周期表</p>
            <h2>选择本次学习的元素族</h2>
            <span>先从周期表定位章节，再进入该族的元素特性、通性规律和实验点位学习。</span>
          </section>

          <PeriodicTable
            selectedArea={selectedArea}
            recommendedArea={recommendedArea}
            recommendedCueLabel={recommendedCueLabel}
            recommendedSymbols={recommendedElementSymbols}
            learnableSymbols={selectedAreaLearnableSymbols}
            onSelectArea={setSelectedArea}
          />

          <section className="chapter-card-panel" aria-label="可学习章节">
            <div className="point-list-head">
              <div>
                <p>当前选区</p>
                <h2>{periodicAreaByAreaId[selectedArea]}</h2>
              </div>
              <span>{selectedAreaProfiles.length} 个</span>
            </div>
            {selectedAreaProfiles.length ? (
              <div className="chapter-card-list">
                {selectedAreaProfiles.map((profile) => {
                  const isRecommended = profile.profile_id === recommendedProfileId;
                  const chapterEntryTitle = formatChapterEntryTitle(profile);
                  return (
                    <button
                      aria-label={`${chapterEntryTitle}${isRecommended ? "，推荐学习" : ""}`}
                      className={isRecommended ? "chapter-entry-card recommended" : "chapter-entry-card"}
                      key={profile.profile_id}
                      type="button"
                      onClick={() => onSelectProfile(profile.profile_id)}
                    >
                      <div className="chapter-entry-title">
                        <strong>{chapterEntryTitle}</strong>
                      </div>
                      {isRecommended ? <em>推荐学习</em> : null}
                      <span className="chapter-entry-elements">{profile.element_symbols.join(" ") || profile.family_name}</span>
                      <ChevronRight size={17} />
                    </button>
                  );
                })}
              </div>
            ) : (
              <MobileEmptyState className="empty-learning-card" icon={<Atom size={20} />}>
                <span>暂无可学习章节</span>
              </MobileEmptyState>
            )}
          </section>

        </>
      ) : null}
    </section>
  );
}

function chapterExperimentGroupsForProfile(profile: StudentLearningProfile): StudentLearningChapterExperimentGroup[] {
  if (profile.chapter_experiment_groups?.length) return profile.chapter_experiment_groups;

  const groups = new Map<string, StudentLearningChapterExperimentGroup>();
  for (const relatedGroup of profile.related_groups || []) {
    const groupKey = relatedGroup.parent_code || relatedGroup.parent_title;
    if (!groupKey) continue;
    const group =
      groups.get(groupKey) ||
      ({
        parent_code: relatedGroup.parent_code,
        parent_title: relatedGroup.parent_title,
        points: [],
      } satisfies StudentLearningChapterExperimentGroup);
    const seenPointKeys = new Set(group.points.map((point) => point.id || point.point_key || point.title));
    for (const point of relatedGroup.points || []) {
      const pointKey = point.id || point.point_key || point.title;
      if (!seenPointKeys.has(pointKey)) {
        group.points.push(point);
        seenPointKeys.add(pointKey);
      }
    }
    groups.set(groupKey, group);
  }
  return Array.from(groups.values()).sort((first, second) => first.parent_code.localeCompare(second.parent_code));
}

function periodicMetaForElement(symbol: string) {
  return periodicElements.find((element) => element.symbol === symbol) || null;
}

function elementEnglishName(element: StudentLearningElementBadge): string {
  return elementEnglishNames[element.symbol] || element.symbol;
}

function elementTileStyle(element: StudentLearningElementBadge): CSSProperties | undefined {
  const periodicElement = periodicMetaForElement(element.symbol);
  const areaId = periodicElement ? periodicAreaIdForElement(periodicElement) : null;
  if (!areaId) return undefined;
  return {
    "--element-area-color": areaSwatches[areaId],
    "--element-area-ink": areaInk[areaId],
  } as CSSProperties;
}

function ElementTileContent({ element }: { element: StudentLearningElementBadge }) {
  const periodicElement = periodicMetaForElement(element.symbol);
  const atomicNumber = element.atomic_number ?? periodicElement?.atomicNumber ?? "";
  const englishName = elementEnglishName(element);
  return (
    <>
      <small>{atomicNumber}</small>
      <strong>{element.symbol}</strong>
      <span title={englishName}>{englishName}</span>
    </>
  );
}

function LearningHomePanel({
  profileId,
  initialPropertyKey,
  initialElementSymbol,
  initialChapterView,
  onSwitchChapter,
  onSelectPoint,
  onFinishLearning,
  finishing,
  finishError,
  assistantEnabled,
  onOpenAssistant,
}: {
  profileId?: string | null;
  initialPropertyKey?: string | null;
  initialElementSymbol?: string | null;
  initialChapterView?: ChapterLearningView | null;
  onSwitchChapter: () => void;
  onSelectPoint: (point: {
    profileId: string;
    propertyKey: string;
    propertyTitle: string;
    elementSymbol?: string | null;
    chapterView?: ChapterLearningView;
    experimentId: string;
    pointKey?: string | null;
    pointTitle?: string | null;
  }) => void;
  onFinishLearning: () => void;
  finishing: boolean;
  finishError: string;
  assistantEnabled: boolean;
  onOpenAssistant: (context: AssistantContext) => void;
}) {
  const [page, setPage] = useState<StudentLearningPageResponse | null>(null);
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(profileId || null);
  const [selectedPropertyKey, setSelectedPropertyKey] = useState<string>(initialPropertyKey || "");
  const [selectedElementSymbol, setSelectedElementSymbol] = useState<string>(initialElementSymbol || "");
  const [activeChapterView, setActiveChapterView] = useState<ChapterLearningView>(initialChapterView || "facts");
  const chapterScrollPositions = useRef<Record<ChapterLearningView, number>>({ facts: 0, experiments: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    setSelectedProfileId(profileId || null);
  }, [profileId]);

  useEffect(() => {
    if (initialPropertyKey) setSelectedPropertyKey(initialPropertyKey);
  }, [initialPropertyKey]);

  useEffect(() => {
    if (initialElementSymbol) setSelectedElementSymbol(initialElementSymbol);
  }, [initialElementSymbol]);

  useEffect(() => {
    if (initialChapterView) setActiveChapterView(initialChapterView);
  }, [initialChapterView]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    getStudentLearningPage(selectedProfileId)
      .then((payload) => {
        if (cancelled) return;
        setPage(payload);
        if (!selectedProfileId && payload.active_profile?.profile_id) {
          setSelectedProfileId(payload.active_profile.profile_id);
        }
      })
      .catch((requestError) => {
        if (!cancelled) setError(errorMessage(requestError));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedProfileId]);

  const profile = page?.active_profile || null;
  useEffect(() => {
    if (!profile) return;
    const keys = profile.property_sections.map((section) => section.key);
    const preferred = initialPropertyKey && keys.includes(initialPropertyKey) ? initialPropertyKey : selectedPropertyKey;
    if (!preferred || !keys.includes(preferred)) {
      setSelectedPropertyKey(keys[0] || "");
    }
  }, [profile, initialPropertyKey, selectedPropertyKey]);
  useEffect(() => {
    if (!profile) return;
    const symbols = profile.elements.map((element) => element.symbol);
    const preferred =
      initialElementSymbol && symbols.includes(initialElementSymbol)
        ? initialElementSymbol
        : selectedElementSymbol || profile.default_element_symbol || symbols[0] || "";
    if (!preferred || !symbols.includes(preferred)) {
      setSelectedElementSymbol(profile.default_element_symbol && symbols.includes(profile.default_element_symbol) ? profile.default_element_symbol : symbols[0] || "");
    }
  }, [profile, initialElementSymbol, selectedElementSymbol]);

  const changeChapterView = (nextView: ChapterLearningView) => {
    if (nextView === activeChapterView) return;
    chapterScrollPositions.current[activeChapterView] = window.scrollY;
    setActiveChapterView(nextView);
    window.requestAnimationFrame(() => {
      window.scrollTo({ top: chapterScrollPositions.current[nextView] || 0, behavior: "auto" });
    });
  };

  const selectedSection =
    profile?.property_sections.find((section) => section.key === selectedPropertyKey) || profile?.property_sections[0] || null;
  const selectedElement =
    profile?.elements.find((element) => element.symbol === selectedElementSymbol) ||
    profile?.elements.find((element) => element.symbol === profile.default_element_symbol) ||
    profile?.elements[0] ||
    null;
  const chapterExperimentGroups = profile ? chapterExperimentGroupsForProfile(profile) : [];
  const relatedPointCount = chapterExperimentGroups.reduce((total, group) => total + group.points.length, 0);
  const homeAssistantContext: AssistantContext | null = profile
    ? {
        context_type: "learning_profile",
        context_title: profile.title,
        context_summary: compactText([
          profile.hero.summary,
          selectedElement && activeChapterView === "facts"
            ? `当前元素：${selectedElement.symbol} ${selectedElement.name}，${selectedElement.electron_configuration || ""}，${selectedElement.common_valence || ""}，${selectedElement.redox_tendency || ""}`
            : null,
          `全族通性：${(profile.family_common_properties || profile.property_cards).map((card) => `${card.label} ${card.value}`).join("；")}`,
          selectedSection && activeChapterView === "facts" ? `当前性质：${selectedSection.title} ${selectedSection.summary}` : null,
          chapterExperimentGroups.length
            ? `相关实验点：${chapterExperimentGroups.flatMap((group) => group.points.map((point) => point.point_title || point.title)).join("、")}`
            : null,
        ]),
        chapter_id: profile.chapter_id,
        prompts: [
          activeChapterView === "facts" && selectedSection ? `${selectedSection.title}怎么理解？` : "这一章先学什么？",
          "相关实验先看哪一个？",
          `帮我整理${profile.family_name || profile.title}的记忆表`,
        ],
      }
    : null;
  return (
    <section className="learning-panel" aria-label="实验学习">
      {loading ? <LearningState icon={<LoaderCircle className="spin" size={23} />} text="正在加载学习资源" /> : null}
      {error ? <LearningState icon={<FlaskConical size={23} />} text={error} /> : null}
      {!loading && !error && profile ? (
        <>
          <LearningChapterHeader
            profile={profile}
            onSwitchChapter={onSwitchChapter}
            assistantContext={assistantEnabled ? homeAssistantContext : null}
            onOpenAssistant={onOpenAssistant}
          />
          <ChapterViewSwitcher activeView={activeChapterView} experimentCount={relatedPointCount} onChange={changeChapterView} />

          {activeChapterView === "facts" ? (
            <LearningFactsView
              profile={profile}
              elements={profile.elements}
              selectedElement={selectedElement}
              selectedSection={selectedSection}
              experimentCount={relatedPointCount}
              onSelectElement={setSelectedElementSymbol}
              onShowExperiments={() => changeChapterView("experiments")}
            />
          ) : (
            <LearningExperimentsView
              profile={profile}
              groups={chapterExperimentGroups}
              pointCount={relatedPointCount}
              elementSymbol={null}
              onSelectPoint={onSelectPoint}
              finishing={finishing}
              finishError={finishError}
              onFinishLearning={onFinishLearning}
            />
          )}
        </>
      ) : null}
    </section>
  );
}

function ChapterViewSwitcher({
  activeView,
  experimentCount,
  onChange,
}: {
  activeView: ChapterLearningView;
  experimentCount: number;
  onChange: (view: ChapterLearningView) => void;
}) {
  const options: { key: ChapterLearningView; label: string; count?: number }[] = [
    { key: "facts", label: "性质通识" },
    { key: "experiments", label: "实验视频", count: experimentCount },
  ];

  return (
    <div className="chapter-view-switcher" role="tablist" aria-label="章节学习视图">
      {options.map((option) => (
        <button
          key={option.key}
          type="button"
          role="tab"
          aria-selected={activeView === option.key}
          className={activeView === option.key ? "active" : ""}
          onClick={() => onChange(option.key)}
        >
          <span>{option.label}</span>
          {typeof option.count === "number" ? <em>{option.count}</em> : null}
        </button>
      ))}
    </div>
  );
}

function LearningFactsView({
  profile,
  elements,
  selectedElement,
  selectedSection,
  experimentCount,
  onSelectElement,
  onShowExperiments,
}: {
  profile: StudentLearningProfile;
  elements: StudentLearningElementBadge[];
  selectedElement: StudentLearningElementBadge | null;
  selectedSection: StudentLearningPropertySection | null;
  experimentCount: number;
  onSelectElement: (symbol: string) => void;
  onShowExperiments: () => void;
}) {
  return (
    <div className="chapter-view-panel facts-view" data-view="facts">
      <LearningElementChips elements={elements} activeSymbol={selectedElement?.symbol || ""} onSelectElement={onSelectElement} />
      {selectedElement ? <LearningSelectedElementFacts element={selectedElement} profile={profile} /> : null}
      <LearningReferenceMedia profile={profile} selectedElement={selectedElement} />
      <LearningFamilyCommonProperties profile={profile} />
      <LearningPropertySectionSummaries profile={profile} selectedSection={selectedSection} />
      <section className="facts-to-experiments-card">
        <div>
          <p>下一步</p>
          <h2>进入实验-点位视频学习</h2>
          <span>本章节已整理 {experimentCount} 个开放实验点位，按实验和点位顺序学习。</span>
        </div>
        <MobileButton className="facts-to-experiments-action" type="button" variant="secondary" fullWidth={false} onClick={onShowExperiments}>
          <Video size={18} />
          <span>看实验视频</span>
        </MobileButton>
      </section>
    </div>
  );
}

function LearningPropertySectionSummaries({
  profile,
  selectedSection,
}: {
  profile: StudentLearningProfile;
  selectedSection: StudentLearningPropertySection | null;
}) {
  if (!profile.property_sections.length) return null;
  return (
    <section className="property-section-panel facts-property-panel">
      <div className="selection-head">
        <span style={{ "--area-color": "#087246" } as CSSProperties}>
          <Layers3 size={18} />
        </span>
        <div>
          <p>族元素的典型性质</p>
          <h2>{selectedSection?.title || "通性与趋势"}</h2>
        </div>
      </div>
      <div className="property-section-list">
        {profile.property_sections.map((section) => (
          <article className={selectedSection?.key === section.key ? "property-section-summary active" : "property-section-summary"} key={section.key}>
            <strong>{section.title}</strong>
            <span>{section.subtitle || section.summary}</span>
            {section.formula ? <small>{section.formula}</small> : null}
          </article>
        ))}
      </div>
    </section>
  );
}

function LearningExperimentsView({
  profile,
  groups,
  pointCount,
  elementSymbol,
  onSelectPoint,
  finishing,
  finishError,
  onFinishLearning,
}: {
  profile: StudentLearningProfile;
  groups: StudentLearningChapterExperimentGroup[];
  pointCount: number;
  elementSymbol?: string | null;
  onSelectPoint: (point: {
    profileId: string;
    propertyKey: string;
    propertyTitle: string;
    elementSymbol?: string | null;
    chapterView?: ChapterLearningView;
    experimentId: string;
    pointKey?: string | null;
    pointTitle?: string | null;
  }) => void;
  finishing: boolean;
  finishError: string;
  onFinishLearning: () => void;
}) {
  return (
    <div className="chapter-view-panel experiments-view" data-view="experiments">
      <section className="point-list-panel">
        <div className="point-list-head">
          <div>
            <p>{profile.subtitle || profile.family_name || "视频与点位"}</p>
            <h2>实验-点位视频</h2>
          </div>
          <span>{pointCount} 个</span>
        </div>
        {groups.length ? (
          <div className="point-group-stack">
            {groups.map((group) => (
              <LearningPointGroupView
                key={group.parent_code || group.parent_title}
                group={group}
                profile={profile}
                onSelectPoint={onSelectPoint}
                elementSymbol={elementSymbol}
              />
            ))}
          </div>
        ) : (
          <MobileEmptyState className="empty-learning-card" icon={<FlaskConical size={20} />}>
            <span>该章节暂未匹配到开放实验点</span>
          </MobileEmptyState>
        )}
      </section>
      <FinishLearningAction loading={finishing} error={finishError} onClick={onFinishLearning} />
    </div>
  );
}

function LearningProfileTabs({
  page,
  activeProfileId,
  onSelectProfile,
}: {
  page: StudentLearningPageResponse | null;
  activeProfileId: string;
  onSelectProfile: (profileId: string) => void;
}) {
  const profiles = page?.profiles || [];
  if (profiles.length <= 1) return null;
  return (
    <div className="learning-profile-tabs" aria-label="学习章节">
      {profiles.map((profile) => (
        <button
          key={profile.profile_id}
          type="button"
          className={profile.profile_id === activeProfileId ? "active" : ""}
          onClick={() => onSelectProfile(profile.profile_id)}
        >
          <strong>{profile.family_number || profile.title}</strong>
          <span>{profile.element_symbols.join(" ") || profile.family_name}</span>
        </button>
      ))}
    </div>
  );
}

function LearningChapterHeader({
  profile,
  onSwitchChapter,
  assistantContext,
  onOpenAssistant,
}: {
  profile: StudentLearningProfile;
  onSwitchChapter: () => void;
  assistantContext?: AssistantContext | null;
  onOpenAssistant: (context: AssistantContext) => void;
}) {
  return (
    <section className="chapter-context-card" aria-label="当前章节">
      <div className="chapter-context-copy">
        <div className="chapter-context-kicker">
          <p>当前章节</p>
          <span>{profile.hero.eyebrow || profile.subtitle || "元素性质"}</span>
        </div>
        <h2>{profile.title}</h2>
        <span>{profile.subtitle || profile.element_symbols.join(" ")}</span>
        <div className="chapter-context-summary">
          <strong>{profile.hero.title}</strong>
          {profile.hero.summary ? <small>{profile.hero.summary}</small> : null}
        </div>
      </div>
      <div className="chapter-context-actions">
        {assistantContext ? (
          <MobileButton className="chapter-switch-action" type="button" variant="ghost" fullWidth={false} onClick={() => onOpenAssistant(assistantContext)}>
            <MessageCircle size={17} />
            <span>问答</span>
          </MobileButton>
        ) : null}
        <MobileButton className="chapter-switch-action" type="button" variant="ghost" fullWidth={false} onClick={onSwitchChapter}>
          <Atom size={17} />
          <span>换章节</span>
        </MobileButton>
      </div>
    </section>
  );
}

function LearningElementChips({
  elements,
  activeSymbol,
  onSelectElement,
}: {
  elements: StudentLearningElementBadge[];
  activeSymbol: string;
  onSelectElement: (symbol: string) => void;
}) {
  return (
    <section className="element-chip-panel" aria-label="选择族内元素">
      <div className="element-chip-row" style={{ "--element-count": Math.max(elements.length, 1) } as CSSProperties}>
        {elements.map((element) => (
          <button
            className={element.symbol === activeSymbol ? "element-chip active" : "element-chip"}
            key={element.symbol}
            type="button"
            style={elementTileStyle(element)}
            aria-label={`${element.symbol} ${elementEnglishName(element)} ${element.name}`}
            aria-pressed={element.symbol === activeSymbol}
            onClick={() => onSelectElement(element.symbol)}
          >
            <ElementTileContent element={element} />
          </button>
        ))}
      </div>
    </section>
  );
}

function LearningSelectedElementFacts({ element, profile }: { element: StudentLearningElementBadge; profile: StudentLearningProfile }) {
  const facts = [
    { key: "atomic_number", label: "原子序数", value: element.atomic_number != null ? String(element.atomic_number) : "未整理" },
    { key: "electron_configuration", label: "电子排布", value: element.electron_configuration || "未整理" },
    { key: "group", label: "所属族", value: element.group_label || profile.title },
    { key: "common_valence", label: "常见化合价", value: element.common_valence || "未整理" },
    { key: "state", label: "单质状态", value: element.state || "未整理" },
    { key: "redox", label: "氧化/还原性", value: element.redox_tendency || "未整理" },
  ];

  return (
    <section className="selected-element-panel" aria-label={`${element.name}元素特性`}>
      <div className="selected-element-head">
        <div className="selected-element-symbol" style={elementTileStyle(element)}>
          <ElementTileContent element={element} />
        </div>
        <div>
          <p>当前元素特性</p>
          <h2>{element.name}在{profile.family_name || profile.title}中的位置</h2>
          {element.note ? <span>{element.note}</span> : null}
        </div>
      </div>
      <div className="element-fact-grid">
        {facts.map((fact) => (
          <article className="element-fact-card" key={fact.key}>
            <p>{fact.label}</p>
            <strong>{fact.value}</strong>
          </article>
        ))}
      </div>
    </section>
  );
}

function LearningReferenceMedia({
  profile,
  selectedElement,
}: {
  profile: StudentLearningProfile;
  selectedElement: StudentLearningElementBadge | null;
}) {
  const referenceMedia = Array.isArray(profile.reference_media) ? profile.reference_media : [];
  const media = referenceMedia.filter((item) => {
    const itemElementSymbols = item.element_symbols || [];
    if (!selectedElement || !itemElementSymbols.length) return true;
    return itemElementSymbols.includes(selectedElement.symbol);
  });
  if (!media.length) return null;

  return (
    <section className="reference-media-panel" aria-label="公开参考素材">
      <div className="selection-head">
        <span style={{ "--area-color": "#0f7b4d" } as CSSProperties}>
          <Sparkles size={18} />
        </span>
        <div>
          <p>公开参考素材</p>
          <h2>补充观察</h2>
        </div>
      </div>
      <div className="reference-media-list">
        {media.slice(0, 2).map((item) => (
          <a className="reference-media-item" href={item.source_url} key={item.id} target="_blank" rel="noreferrer">
            {item.local_path && item.asset_type === "image" ? <img src={item.local_path} alt={item.alt_text} /> : <BookOpenCheck size={22} />}
            <span>
              <strong>{item.alt_text}</strong>
              <small>{item.license} · {item.attribution}</small>
            </span>
          </a>
        ))}
      </div>
    </section>
  );
}

function LearningFamilyCommonProperties({ profile }: { profile: StudentLearningProfile }) {
  const cards = profile.family_common_properties?.length ? profile.family_common_properties : profile.property_cards;
  return (
    <section className="family-common-panel" aria-label="全族通性">
      <div className="selection-head">
        <span style={{ "--area-color": "#0f7b4d" } as CSSProperties}>
          <BookOpenCheck size={18} />
        </span>
        <div>
          <p>{profile.family_name || profile.title}</p>
          <h2>全族通性</h2>
        </div>
      </div>
      <LearningPropertyCards cards={cards} label="全族通性卡片" />
    </section>
  );
}

function LearningPropertyCards({ cards, label }: { cards: StudentLearningPropertyCard[]; label: string }) {
  return (
    <section className="property-card-grid" aria-label={label}>
      {cards.map((card) => (
        <article className="property-card" key={card.key}>
          <p>{card.label}</p>
          <strong>{card.value}</strong>
          {card.description ? <span>{card.description}</span> : null}
        </article>
      ))}
    </section>
  );
}

function PropertySectionButton({
  section,
  active,
  onClick,
}: {
  section: StudentLearningPropertySection;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button className={active ? "property-section active" : "property-section"} type="button" aria-pressed={active} onClick={onClick}>
      <div>
        <strong>{section.title}</strong>
        <span>{section.subtitle || section.summary}</span>
      </div>
      <ChevronRight size={17} />
    </button>
  );
}

function LearningPointGroupView({
  group,
  profile,
  elementSymbol,
  onSelectPoint,
}: {
  group: StudentLearningChapterExperimentGroup | StudentLearningPointGroup;
  profile: StudentLearningProfile;
  elementSymbol?: string | null;
  onSelectPoint: (point: {
    profileId: string;
    propertyKey: string;
    propertyTitle: string;
    elementSymbol?: string | null;
    chapterView?: ChapterLearningView;
    experimentId: string;
    pointKey?: string | null;
    pointTitle?: string | null;
  }) => void;
}) {
  return (
    <section className="point-group">
      <div className="point-group-title">
        <FlaskConical size={17} />
        <strong>{stripExperimentPrefix(group.parent_title)}</strong>
      </div>
      <div className="point-card-grid">
        {group.points.map((point) => (
          <LearningPointCardView
            key={`${point.id}-${point.property_key}-${point.point_key || point.title}`}
            point={point}
            profile={profile}
            elementSymbol={elementSymbol}
            onSelectPoint={onSelectPoint}
          />
        ))}
      </div>
    </section>
  );
}

function LearningPointCardView({
  point,
  profile,
  elementSymbol,
  onSelectPoint,
}: {
  point: StudentLearningPointCard;
  profile: StudentLearningProfile;
  elementSymbol?: string | null;
  onSelectPoint: (point: {
    profileId: string;
    propertyKey: string;
    propertyTitle: string;
    elementSymbol?: string | null;
    chapterView?: ChapterLearningView;
    experimentId: string;
    pointKey?: string | null;
    pointTitle?: string | null;
  }) => void;
}) {
  const video = point.videos[0] || null;
  return (
    <button
      className="learning-point-card"
      type="button"
      onClick={() =>
        onSelectPoint({
          profileId: profile.profile_id,
          propertyKey: point.property_key,
          propertyTitle: point.property_title,
          elementSymbol,
          chapterView: "experiments",
          experimentId: point.id,
          pointKey: point.point_key,
          pointTitle: point.point_title || point.title,
        })
      }
    >
      <div className="point-thumb">
        {video?.thumbnail_path ? <img src={studentMediaUrl(video.thumbnail_path)} alt="" /> : <PlayCircle size={30} />}
        <span>{point.code}</span>
      </div>
      <div className="point-card-copy">
        <p>{point.point_title || point.property_title}</p>
        <h3>{stripExperimentPrefix(point.title)}</h3>
        {point.formula || point.summary ? <small>{point.formula || point.summary}</small> : null}
        <span>
          视频 {point.published_video_count || point.video_candidate_count} / 练习 {point.question_count}
        </span>
      </div>
    </button>
  );
}

function normalizeAreaId(value: string | null | undefined): AreaId | null {
  if (value === "p" || value === "s" || value === "d" || value === "ds" || value === "f") return value;
  return null;
}

function firstEnabledArea(areas: StudentLearningArea[]): AreaId | null {
  const match = areas.find((area) => area.enabled && normalizeAreaId(area.area_id));
  return normalizeAreaId(match?.area_id);
}

function firstGroupForArea(groups: StudentExperimentGroupSummary[], areaId: AreaId): StudentExperimentGroupSummary | null {
  return groups.find((group) => group.area_id === areaId) || null;
}

function profileAreaId(profile: StudentLearningProfileSummary): AreaId | null {
  const mappedArea = profileAreaByChapterId[profile.chapter_id];
  if (mappedArea) return mappedArea;

  const text = `${profile.title} ${profile.subtitle} ${profile.family_name}`;
  if (text.includes("ds")) return "ds";
  if (text.includes("s区")) return "s";
  if (text.includes("p区")) return "p";
  if (text.includes("d区")) return "d";
  if (text.includes("f区")) return "f";
  return null;
}

function LearningState({ icon, text }: { icon: ReactNode; text: string }) {
  return <MobileStatus className="learning-state" icon={icon} text={text} />;
}

function ExperimentGroupCard({
  group,
  selected,
  onSelect,
}: {
  group: StudentExperimentGroupSummary;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button className={selected ? "family-card active" : "family-card"} type="button" aria-pressed={selected} onClick={onSelect}>
      {group.recommended ? <em>推荐学习</em> : null}
      <strong>{stripExperimentPrefix(group.parent_title)}</strong>
      <small>
        {group.experiment_count} 个实验点 / {group.question_count} 题
      </small>
    </button>
  );
}

function stripExperimentPrefix(value: string): string {
  return value.replace(/^实验\s+\d+(?:-\d+)?\s*/, "").trim() || value;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function stripFamilyNumberPrefix(title: string, familyNumber?: string | null): string {
  if (!familyNumber) return title;
  const escapedFamilyNumber = escapeRegExp(familyNumber);
  const stripped = title
    .replace(new RegExp(`^第\\s*${escapedFamilyNumber}\\s*族\\s*`), "")
    .replace(new RegExp(`^${escapedFamilyNumber}\\s*族\\s*`), "")
    .trim();
  return stripped || title;
}

function formatFamilyNumberLabel(familyNumber?: string | null): string {
  const normalized = familyNumber?.trim();
  if (!normalized || !/^\d+$/.test(normalized)) return "";
  const parsed = Number.parseInt(normalized, 10);
  return parsed >= 1 && parsed <= 18 ? `${parsed}族` : "";
}

function formatChapterEntryTitle(profile: StudentLearningProfileSummary): string {
  const title = stripFamilyNumberPrefix(profile.title, profile.family_number);
  const familyLabel = formatFamilyNumberLabel(profile.family_number);
  if (!familyLabel) return formatAreaProfileLabel(profile);
  return `${familyLabel}${formatNicknameParentheses(title)}`;
}

function formatNicknameParentheses(value: string): string {
  const title = value.trim();
  if (/^（.+）$/.test(title)) return title;
  const asciiWrapped = title.match(/^\((.+)\)$/);
  if (asciiWrapped) return `（${asciiWrapped[1]}）`;
  return title ? `（${title}）` : "";
}

function stripLearningChapterPrefix(value: string): string {
  return value.replace(/^第\s*\d+\s*章\s*/, "").trim() || value;
}

function formatAreaProfileLabel(profile: StudentLearningProfileSummary): string {
  if (profileAreaId(profile) === "integrated") return "氢和稀有气体";

  const rawLabel = profile.family_name || profile.title || profile.subtitle || "";
  const withoutChapter = stripLearningChapterPrefix(rawLabel).trim();
  const parenthesizedAreaLabel = withoutChapter.match(/^(?:s|p|d|ds|f)\s*区\s*[（(](.+)[）)]$/i);
  const label = (parenthesizedAreaLabel?.[1] || withoutChapter)
    .replace(/^(?:s|p|d|ds|f)\s*区\s*/i, "")
    .replace(/元素$/g, "")
    .replace(/\s+/g, "")
    .trim();
  return label || withoutChapter || profile.title;
}

function formatRecommendedAreaCueLabel(profile: StudentLearningProfileSummary | null): string | null {
  if (!profile) return null;
  if (profileAreaId(profile) === "integrated") return "氢和稀有气体";

  const familyLabel = formatFamilyNumberLabel(profile.family_number);
  if (familyLabel) return familyLabel;

  return formatAreaProfileLabel(profile);
}

function PeriodicTable({
  selectedArea,
  recommendedArea,
  recommendedCueLabel,
  recommendedSymbols,
  learnableSymbols,
  onSelectArea,
}: {
  selectedArea: AreaId;
  recommendedArea?: AreaId | null;
  recommendedCueLabel?: string | null;
  recommendedSymbols: ReadonlySet<string>;
  learnableSymbols: ReadonlySet<string>;
  onSelectArea: (areaId: AreaId) => void;
}) {
  const groupNumbers = Array.from({ length: 18 }, (_, index) => index + 1);

  return (
    <section className="periodic-card" aria-label="元素周期表选择区">
      <div className="periodic-card-head">
        <div>
          <p>周期表入口</p>
          <h3>按族进入章节</h3>
        </div>
        <Atom size={22} />
      </div>
      <div className="area-legend" aria-label="元素区图例">
        {periodicAreaOrder.map((areaId) => {
          const isSelected = selectedArea === areaId;
          const isRecommended = recommendedArea === areaId;
          return (
            <button
              key={areaId}
              type="button"
              className={[isSelected ? "selected" : "", isRecommended ? "recommended-area" : ""].filter(Boolean).join(" ")}
              style={{ "--area-color": areaSwatches[areaId], "--area-ink": areaInk[areaId] } as CSSProperties}
              onClick={() => onSelectArea(areaId)}
              aria-label={`${periodicLegendLabelByAreaId[areaId]}${isRecommended ? `，推荐学习区域${recommendedCueLabel ? `，推荐${recommendedCueLabel}` : ""}` : ""}`}
              aria-pressed={isSelected}
            >
              <i />
              <span>{periodicLegendLabelByAreaId[areaId]}</span>
              {isRecommended ? (
                <em>
                  <span>推荐学习</span>
                  {recommendedCueLabel ? <b>{recommendedCueLabel}</b> : null}
                </em>
              ) : null}
            </button>
          );
        })}
      </div>
      <div className="periodic-caption">族（IUPAC 编号）</div>
      <div className="periodic-grid">
        {groupNumbers.map((group) => (
          <div aria-label={`${group}族`} className="group-number" key={group} style={{ gridColumn: group + 1, gridRow: 1 }}>
            {group}
          </div>
        ))}
        {periodicPeriodLabels.map((period, index) => (
          <div className="period-number" key={period} style={{ gridColumn: 1, gridRow: periodicGridRowForPeriod(index + 1) }}>
            {period}
          </div>
        ))}
        {periodicElements.map((element) => {
          const areaId = periodicAreaIdForElement(element);
          const selected = areaId === selectedArea;
          const learnable = selected && learnableSymbols.has(element.symbol);
          const recommended = recommendedSymbols.has(element.symbol);
          return (
            <button
              key={element.atomicNumber}
              type="button"
              className={[
                "element-cell",
                selected ? "selected-area" : "muted-area",
                learnable ? "learnable-element" : "",
                recommended ? "recommended-element" : "",
              ]
                .filter(Boolean)
                .join(" ")}
              style={{
                gridColumn: periodicGridColumnForElement(element),
                gridRow: periodicGridRowForPeriod(element.period),
                background: areaSwatches[areaId],
                "--cell-ink": areaInk[areaId],
              } as CSSProperties}
              aria-label={`${element.symbol} ${element.name}，${recommended ? "推荐学习，" : ""}${learnable ? "当前选区可学习" : `选择${periodicAreaByAreaId[areaId]}`}`}
              title={`${element.symbol} ${element.name}${recommended ? " · 推荐学习" : ""}${learnable ? " · 可学习" : ""}`}
              onClick={() => onSelectArea(areaId)}
            >
              {learnable ? <span>{element.symbol}</span> : null}
            </button>
          );
        })}
      </div>
    </section>
  );
}

function ExperimentGroupPanel({
  parentCode,
  onBack,
  onSelectExperiment,
  onFinishLearning,
  finishing,
  finishError,
  assistantEnabled,
  onOpenAssistant,
}: {
  parentCode: string;
  onBack: () => void;
  onSelectExperiment: (experimentId: string) => void;
  onFinishLearning: () => void;
  finishing: boolean;
  finishError: string;
  assistantEnabled: boolean;
  onOpenAssistant: (context: AssistantContext) => void;
}) {
  const [group, setGroup] = useState<StudentExperimentGroupResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    getStudentExperimentGroup(parentCode)
      .then((payload) => {
        if (!cancelled) setGroup(payload);
      })
      .catch((requestError) => {
        if (!cancelled) setError(errorMessage(requestError));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [parentCode]);

  const assistantContext: AssistantContext | null = group
    ? {
        context_type: "experiment_group",
        context_title: stripExperimentPrefix(group.parent_title),
        context_summary: compactText([
          `实验组：${group.parent_title}`,
          `所属区域：${group.area_name}`,
          `实验点：${group.experiments.map((experiment) => experiment.title).join("、")}`,
        ]),
        chapter_id: group.experiments[0]?.chapter_ids[0] || null,
        prompts: ["这一组实验重点是什么？", "我应该按什么顺序看？", "这些实验会考什么现象？"],
      }
    : null;

  return (
    <section className="learning-panel" aria-label="实验列表">
      <PageBar title={group ? stripExperimentPrefix(group.parent_title) : "实验列表"} onBack={onBack} />
      {loading ? <LearningState icon={<LoaderCircle className="spin" size={23} />} text="正在加载实验列表" /> : null}
      {error ? <LearningState icon={<FlaskConical size={23} />} text={error} /> : null}
      {group ? (
        <div className="experiment-list">
          {group.experiments.map((experiment) => (
            <button className="experiment-card" key={experiment.id} type="button" onClick={() => onSelectExperiment(experiment.id)}>
              <div className="experiment-thumb">
                <PlayCircle size={32} />
                <strong>{experiment.code}</strong>
              </div>
              <div>
                <p>{experiment.module_title || group.area_name}</p>
                <h3>{experiment.title}</h3>
                <span>
                  视频 {experiment.published_video_count || experiment.video_candidate_count} / 练习 {experiment.question_count}
                </span>
              </div>
              <ChevronRight size={18} />
            </button>
          ))}
        </div>
      ) : null}
      {group && assistantEnabled && assistantContext ? (
        <MobileButton className="secondary-action full context-assistant-action" type="button" variant="secondary" onClick={() => onOpenAssistant(assistantContext)}>
          <MessageCircle size={18} />
          <span>带着本组实验去问答</span>
        </MobileButton>
      ) : null}
      {group ? <FinishLearningAction loading={finishing} error={finishError} onClick={onFinishLearning} /> : null}
    </section>
  );
}

function ExperimentDetailPanel({
  experimentId,
  profileId,
  propertyKey,
  propertyTitle,
  elementSymbol,
  chapterView,
  pointKey,
  pointTitle,
  onBack,
  onFinishLearning,
  finishing,
  finishError,
  assistantEnabled,
  onOpenAssistant,
}: {
  experimentId: string;
  profileId?: string | null;
  propertyKey?: string | null;
  propertyTitle?: string | null;
  elementSymbol?: string | null;
  chapterView?: ChapterLearningView | null;
  pointKey?: string | null;
  pointTitle?: string | null;
  onBack: () => void;
  onFinishLearning: () => void;
  finishing: boolean;
  finishError: string;
  assistantEnabled: boolean;
  onOpenAssistant: (context: AssistantContext) => void;
}) {
  const [detail, setDetail] = useState<StudentExperimentDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    getStudentExperimentDetail(experimentId)
      .then((payload) => {
        if (!cancelled) setDetail(payload);
      })
      .catch((requestError) => {
        if (!cancelled) setError(errorMessage(requestError));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [experimentId]);

  const video = detail?.videos.find((item) => pointKey && item.point_key === pointKey) || detail?.videos[0] || null;
  const effectivePointTitle = pointTitle || video?.point_title || detail?.video_candidates[0] || detail?.title || "实验点位";
  const detailAssistantContext: AssistantContext | null = detail
    ? {
        context_type: "learning_point",
        context_title: effectivePointTitle,
        context_summary: compactText([
          chapterView ? `当前视图：${chapterView === "experiments" ? "实验视频" : "性质通识"}` : null,
          propertyTitle ? `相关性质：${propertyTitle}` : null,
          elementSymbol ? `当前元素：${elementSymbol}` : null,
          `实验：${detail.title}`,
          detail.summary || null,
          pointKey ? `点位标识：${pointKey}` : null,
          detail.video_candidates.length ? `观察点：${detail.video_candidates.join("、")}` : null,
          detail.videos.length ? `视频：${detail.videos.map((item) => item.point_title || item.title).join("、")}` : null,
        ]),
        chapter_id: detail.chapter_ids[0] || null,
        experiment_id: detail.id,
        point_key: pointKey || video?.point_key || detail.video_candidates[0] || null,
        prompts: ["这个现象说明什么？", "帮我解释反应原理", "这个实验怎么记？"],
      }
    : null;
  return (
    <section className="learning-panel" aria-label="实验详情">
      <PageBar title={effectivePointTitle} onBack={onBack} />
      {loading ? <LearningState icon={<LoaderCircle className="spin" size={23} />} text="正在加载实验详情" /> : null}
      {error ? <LearningState icon={<FlaskConical size={23} />} text={error} /> : null}
      {detail ? (
        <>
          <section className="video-stage">
            {video?.stream_path ? (
              <video
                controls
                playsInline
                poster={video.thumbnail_path ? studentMediaUrl(video.thumbnail_path) : undefined}
                src={studentMediaUrl(video.stream_path)}
              />
            ) : (
              <div className="video-placeholder">
                <Video size={34} />
                <strong>实验视频待发布</strong>
              </div>
            )}
          </section>

          <section className="experiment-detail-card">
            <p>{propertyTitle || detail.module_title || detail.parent_title}</p>
            <h2>{effectivePointTitle}</h2>
            <small>{stripExperimentPrefix(detail.title)}</small>
            {detail.summary ? <span>{detail.summary}</span> : null}
          </section>

          <section className="detail-section">
            <h3>实验观察与相关点位</h3>
            {detail.video_candidates.length ? (
              <div className="candidate-list">
                {detail.video_candidates.map((candidate) => (
                  <div key={candidate}>
                    <FlaskConical size={16} />
                    <span>{candidate}</span>
                  </div>
                ))}
              </div>
            ) : (
              <MobileEmptyState className="empty-learning-card">暂无观察点</MobileEmptyState>
            )}
          </section>

          <section className="detail-section practice-strip">
            <div>
              <p>练习</p>
              <h3>{detail.question_count} 题</h3>
            </div>
            <button type="button" disabled>
              <ClipboardList size={17} />
              <span>暂未开放</span>
            </button>
          </section>
          {assistantEnabled && detailAssistantContext ? (
            <MobileButton className="secondary-action full context-assistant-action" type="button" variant="secondary" onClick={() => onOpenAssistant(detailAssistantContext)}>
              <MessageCircle size={18} />
              <span>带着这个点位去问答</span>
            </MobileButton>
          ) : null}
          <FinishLearningAction loading={finishing} error={finishError} onClick={onFinishLearning} />
        </>
      ) : null}
    </section>
  );
}

function FinishLearningAction({ loading, error, onClick }: { loading: boolean; error: string; onClick: () => void }) {
  return (
    <section className="finish-learning">
      {error ? <div className="form-error">{error}</div> : null}
      <MobileButton variant="secondary" className="secondary-action finish-action" type="button" loading={loading} onClick={onClick}>
        {loading ? <LoaderCircle className="spin" size={18} /> : <GraduationCap size={18} />}
        <span>{loading ? "正在生成后测" : "完成学习"}</span>
      </MobileButton>
    </section>
  );
}

function normalizeAssistantMetadata(value: unknown): StudentAssistantFinalMetadata | undefined {
  if (!value || typeof value !== "object") return undefined;
  return value as StudentAssistantFinalMetadata;
}

function renderInlineMarkdown(text: string): ReactNode[] {
  return text.split(/(`[^`]+`|\*\*[^*]+?\*\*)/g).map((part, index) => {
    if (part.startsWith("`") && part.endsWith("`")) {
      return <code key={`${part}-${index}`}>{part.slice(1, -1)}</code>;
    }
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={`${part}-${index}`}>{part.slice(2, -2)}</strong>;
    }
    return <span key={`${part}-${index}`}>{part}</span>;
  });
}

function MarkdownLite({ content }: { content: string }) {
  const lines = content.split(/\r?\n/);
  return (
    <div className="ai-markdown">
      {lines.map((line, index) => {
        const trimmed = line.trim();
        if (!trimmed) return <div className="ai-markdown-gap" key={`gap-${index}`} />;
        const bullet = trimmed.match(/^[-*]\s+(.+)$/);
        const ordered = trimmed.match(/^\d+[.)]\s+(.+)$/);
        if (bullet || ordered) {
          return (
            <p className="ai-markdown-bullet" key={`${trimmed}-${index}`}>
              <i>{ordered ? "•" : "•"}</i>
              <span>{renderInlineMarkdown((bullet || ordered)?.[1] || trimmed)}</span>
            </p>
          );
        }
        return <p key={`${trimmed}-${index}`}>{renderInlineMarkdown(trimmed)}</p>;
      })}
    </div>
  );
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

function StudentAiChatTab({ context, onResetContext }: { context: AssistantContext; onResetContext: () => void }) {
  const hasContextHandoff = context.context_type !== "learning_home" || context.context_title !== "AI 学习助手";
  return (
    <section className="learning-panel assistant-tab-panel" aria-label="AI 学习助手">
      <section className="assistant-intro-card">
        <span className="panel-icon">
          <Bot size={20} />
        </span>
        <div>
          <p>AI 学习助手</p>
          <h2>{context.context_title}</h2>
          <span>{hasContextHandoff ? "已带入当前学习上下文，也可以随时切回全局问答。" : "可以询问课程知识、实验现象、复习顺序和错题思路。"}</span>
        </div>
        {hasContextHandoff ? (
          <button type="button" className="assistant-context-clear" onClick={onResetContext} aria-label="清除当前问答上下文">
            <X size={17} />
          </button>
        ) : null}
      </section>
      <StudentAiChatPanel context={context} />
    </section>
  );
}

function StudentAiChatPanel({
  context,
}: {
  context: AssistantContext;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("idle");
  const streamRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMessages([]);
    setInput("");
    setStatus("idle");
    setLoading(false);
  }, [context.context_type, context.context_title, context.experiment_id, context.chapter_id]);

  useEffect(() => {
    if (!streamRef.current) return;
    if (typeof streamRef.current.scrollTo === "function") {
      streamRef.current.scrollTo({ top: streamRef.current.scrollHeight });
      return;
    }
    streamRef.current.scrollTop = streamRef.current.scrollHeight;
  }, [messages, loading]);

  const submitQuestion = async (questionText?: string) => {
    const question = (questionText || input).trim();
    if (!question || loading) return;
    const history = messages.slice(-10).map(({ role, content }) => ({ role, content }));
    const nextMessages: ChatMessage[] = [...messages, { role: "user", content: question }, { role: "assistant", content: "" }];
    setMessages(nextMessages);
    setInput("");
    setLoading(true);
    setStatus("streaming");
    let answer = "";
    try {
      await streamStudentAssistantAsk(
        {
          ...context,
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
    void submitQuestion();
  };

  return (
    <section className="ai-chat-panel" role="region" aria-label="AI 学习助手对话">
      <header className="ai-chat-head">
        <div>
          <span>
            <Sparkles size={14} />
            当前内容
          </span>
          <h2>{context.context_title}</h2>
        </div>
      </header>

      <div className="ai-chat-stream" aria-live="polite" ref={streamRef}>
        {!messages.length ? (
          <div className="ai-empty-bubble">
            <Bot size={18} />
            <p>可以问我实验现象、原理、复习顺序和知识点。</p>
          </div>
        ) : null}
        {messages.map((message, index) => (
          <div className={`ai-message ${message.role}`} key={`${message.role}-${index}`}>
            {message.role === "assistant" ? (
              <>
                <MarkdownLite content={message.content || (loading ? "正在生成..." : "")} />
                <AssistantSourceSummary metadata={message.metadata} />
              </>
            ) : (
              message.content
            )}
          </div>
        ))}
      </div>

      <div className="ai-quick-prompts" aria-label="快捷问题">
        {context.prompts.map((prompt) => (
          <button type="button" key={prompt} disabled={loading} onClick={() => void submitQuestion(prompt)}>
            {prompt}
          </button>
        ))}
      </div>

      <form className="ai-chat-compose" onSubmit={handleSubmit}>
        <MobileField
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder="问当前学习内容"
          aria-label="输入给 AI 的问题"
        />
        <button type="submit" disabled={!input.trim() || loading} aria-label="发送问题">
          {loading ? <LoaderCircle className="spin" size={17} /> : <Send size={17} />}
        </button>
      </form>
      <div className="ai-chat-status">{assistantStatusLabel(status, loading)}</div>
    </section>
  );
}

const feedbackTypes = [
  { value: "content", label: "内容问题" },
  { value: "experience", label: "体验问题" },
  { value: "suggestion", label: "功能建议" },
];

function StudentFeedbackForm({ context }: { context: FeedbackContext }) {
  const [feedbackType, setFeedbackType] = useState("content");
  const [content, setContent] = useState("");
  const [attachment, setAttachment] = useState<File | null>(null);
  const [attachmentError, setAttachmentError] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setMessage("");
    setError("");
  }, [context.pagePath, context.experimentId, context.pointKey]);

  const selectAttachment = (file: File | null) => {
    setAttachmentError("");
    if (!file) {
      setAttachment(null);
      return;
    }
    const allowedTypes = new Set(["image/png", "image/jpeg", "image/webp"]);
    if (!allowedTypes.has(file.type)) {
      setAttachment(null);
      setAttachmentError("只能上传 PNG、JPG 或 WebP 图片");
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setAttachment(null);
      setAttachmentError("图片不能超过 5 MB");
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }
    setAttachment(file);
  };

  const clearAttachment = () => {
    setAttachment(null);
    setAttachmentError("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = content.trim();
    if (!trimmed || attachmentError || loading) return;
    setLoading(true);
    setMessage("");
    setError("");
    try {
      await submitStudentFeedback({
        feedback_type: feedbackType,
        content: trimmed,
        chapter_id: context.chapterId,
        experiment_id: context.experimentId,
        point_key: context.pointKey,
        page_path: context.pagePath,
        metadata: {
          ...context.metadata,
          context_title: context.contextTitle,
          viewport: { width: window.innerWidth, height: window.innerHeight },
          user_agent: window.navigator.userAgent,
        },
        attachment,
      });
      setContent("");
      clearAttachment();
      setMessage("已收到反馈，老师后台可以看到。");
    } catch (requestError) {
      setError(errorMessage(requestError));
    } finally {
      setLoading(false);
    }
  };

  return (
    <form className="feedback-panel profile-feedback-panel" onSubmit={submit} aria-label="学生端反馈">
      <header className="feedback-head">
        <div>
          <span>反馈</span>
          <h2>{context.contextTitle}</h2>
        </div>
      </header>
      <div className="feedback-type-row">
        {feedbackTypes.map((item) => (
          <button
            key={item.value}
            type="button"
            className={feedbackType === item.value ? "active" : ""}
            onClick={() => setFeedbackType(item.value)}
          >
            {item.label}
          </button>
        ))}
      </div>
      <MobileTextArea
        value={content}
        rows={4}
        maxLength={4000}
        placeholder="描述你遇到的问题或建议，可以配一张截图"
        onChange={(event) => setContent(event.target.value)}
      />
      <div className="feedback-attachment-row">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          onChange={(event) => selectAttachment(event.target.files?.[0] ?? null)}
        />
        <button type="button" disabled={loading} onClick={() => fileInputRef.current?.click()}>
          <Paperclip size={15} />
          <span>{attachment ? "更换图片" : "添加截图"}</span>
        </button>
        {attachment ? (
          <button type="button" className="feedback-file-pill" disabled={loading} onClick={clearAttachment}>
            <span>{attachment.name}</span>
            <Trash2 size={14} />
          </button>
        ) : null}
      </div>
      {attachmentError ? <div className="form-error">{attachmentError}</div> : null}
      {message ? <div className="form-hint feedback-success">{message}</div> : null}
      {error ? <div className="form-error">{error}</div> : null}
      <MobileButton className="primary-action" type="submit" loading={loading} disabled={!content.trim() || Boolean(attachmentError)}>
        {loading ? <LoaderCircle className="spin" size={18} /> : <Send size={18} />}
        <span>{loading ? "正在提交" : "提交反馈"}</span>
      </MobileButton>
    </form>
  );
}

function PosttestPanel({
  posttest,
  submitting,
  error,
  onSubmit,
}: {
  posttest: StudentPosttestResponse;
  submitting: boolean;
  error: string;
  onSubmit: (answers: AnswerMap) => void;
}) {
  const names = posttest.experiments.map((experiment) => stripExperimentPrefix(experiment.title)).join("、");
  return (
    <section className="learning-panel" aria-label="课后摸底">
      <section className="posttest-context">
        <div>
          <p>本轮学习</p>
          <h2>{names || "实验学习"}</h2>
        </div>
        <span>{posttest.questions.length} 题</span>
      </section>
      {error ? <div className="form-error">{error}</div> : null}
      <AssessmentPanel
        eyebrow="课后摸底"
        title="请完成学习后测"
        questions={posttest.questions}
        submitting={submitting}
        onSubmit={onSubmit}
      />
    </section>
  );
}

function formatPercent(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "未生成";
  return `${Math.round(value * 100)}%`;
}

function formatScore(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "未生成";
  return value.toFixed(1);
}

function answerLabel(answer: unknown): string {
  if (Array.isArray(answer)) return answer.map(answerLabel).join(" / ");
  if (typeof answer === "boolean") return answer ? "正确" : "错误";
  if (answer === null || answer === undefined || answer === "") return "未作答";
  return String(answer);
}

function AiMarkdownBlock({ text, className = "" }: { text: string | null | undefined; className?: string }) {
  const value = String(text || "");
  if (!value.trim()) return null;
  return (
    <Suspense
      fallback={
        <div className={["ai-markdown", className].filter(Boolean).join(" ")}>
          <p className="ai-md-paragraph">{value}</p>
        </div>
      }
    >
      <LazyAiMarkdown text={value} className={className} />
    </Suspense>
  );
}

function PosttestSummaryPanel({ report, onContinue }: { report: StudentPosttestReport; onContinue: () => void }) {
  const masteryChanges = report.mastery_changes.slice(0, 5);
  const [aiSummary, setAiSummary] = useState(report.next_recommendation);
  const [aiSummaryLoading, setAiSummaryLoading] = useState(true);
  const [aiSummarySource, setAiSummarySource] = useState<"ai" | "fallback">("fallback");
  const [mistakeAnswer, setMistakeAnswer] = useState("");
  const [mistakeLoading, setMistakeLoading] = useState(false);
  const [mistakeError, setMistakeError] = useState("");

  useEffect(() => {
    let cancelled = false;
    setAiSummary(report.next_recommendation);
    setAiSummarySource("fallback");
    setAiSummaryLoading(true);
    generatePosttestAiSummary(report.session_id)
      .then((response) => {
        if (cancelled) return;
        setAiSummary(response.text);
        setAiSummarySource(response.source);
      })
      .catch(() => {
        if (!cancelled) {
          setAiSummary(report.next_recommendation);
          setAiSummarySource("fallback");
        }
      })
      .finally(() => {
        if (!cancelled) setAiSummaryLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [report.session_id, report.next_recommendation]);

  const explainMistakes = async () => {
    if (mistakeLoading || !report.wrong_answers.length) return;
    setMistakeLoading(true);
    setMistakeError("");
    try {
      const response = await explainPosttestMistakes(report.session_id);
      setMistakeAnswer(response.text);
    } catch (requestError) {
      setMistakeError(errorMessage(requestError));
    } finally {
      setMistakeLoading(false);
    }
  };

  return (
    <section className="learning-panel" aria-label="学习总结">
      <section className="summary-hero">
        <span className="panel-icon">
          <BarChart3 size={20} />
        </span>
        <div>
          <p>学习总结</p>
          <h2>本轮实验报告</h2>
          <AiMarkdownBlock className="summary-ai-text" text={aiSummaryLoading ? "正在生成 AI 学习总结..." : aiSummary} />
          <em>
            <Sparkles size={13} />
            {aiSummarySource === "ai" ? "AI 总结" : "规则总结"}
          </em>
        </div>
      </section>

      <section className="summary-grid">
        <div>
          <span>后测正确率</span>
          <strong>{formatPercent(report.correct_rate)}</strong>
          <small>
            {report.correct_count}/{report.total_count} 题
          </small>
        </div>
        <div>
          <span>掌握度变化</span>
          <strong>{report.mastery_delta === null || report.mastery_delta === undefined ? "未生成" : `${report.mastery_delta >= 0 ? "+" : ""}${report.mastery_delta}`}</strong>
          <small>
            {formatScore(report.mastery_before_average)} → {formatScore(report.mastery_after_average)}
          </small>
        </div>
      </section>

      <section className="detail-section">
        <h3>本轮实验</h3>
        <div className="learned-list">
          {report.experiments.map((experiment) => (
            <div key={experiment.id}>
              <FlaskConical size={16} />
              <span>{stripExperimentPrefix(experiment.title)}</span>
            </div>
          ))}
        </div>
      </section>

      {masteryChanges.length ? (
        <section className="detail-section">
          <h3>掌握度变化</h3>
          <div className="mastery-list">
            {masteryChanges.map((item) => (
              <div key={item.knowledge_point_id}>
                <span>{item.content || item.knowledge_point_id}</span>
                <strong>
                  {formatScore(item.before_score)} → {formatScore(item.after_score)}
                </strong>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <section className="detail-section">
        <h3>错题回顾</h3>
        {report.wrong_answers.length ? (
          <div className="wrong-list">
            {report.wrong_answers.map((item, index) => (
              <article key={item.question_id}>
                <p>Q{index + 1}</p>
                <h4>{item.stem}</h4>
                <span>你的答案：{answerLabel(item.submitted_answer)}</span>
                <span>参考答案：{answerLabel(item.correct_answer)}</span>
                {item.explanation ? <small>{item.explanation}</small> : null}
              </article>
            ))}
          </div>
        ) : (
          <MobileEmptyState className="empty-learning-card" icon={<CheckCircle2 size={20} />}>
            <span>本轮没有错题</span>
          </MobileEmptyState>
        )}
        {report.wrong_answers.length ? (
          <>
            <MobileButton
              variant="secondary"
              className="secondary-action full ai-mistake-action"
              type="button"
              loading={mistakeLoading}
              onClick={() => void explainMistakes()}
            >
              {mistakeLoading ? <LoaderCircle className="spin" size={18} /> : <Bot size={18} />}
              <span>{mistakeLoading ? "AI 正在讲解" : "AI 讲解错题"}</span>
            </MobileButton>
            {mistakeError ? <div className="form-error">{mistakeError}</div> : null}
            {mistakeAnswer ? (
              <div className="mistake-ai-answer">
                <span>
                  <Sparkles size={13} />
                  AI 解答
                </span>
                <AiMarkdownBlock text={mistakeAnswer} />
              </div>
            ) : null}
          </>
        ) : null}
      </section>

      <MobileButton className="primary-action full" type="button" onClick={onContinue}>
        <BookOpenCheck size={18} />
        <span>继续学习</span>
      </MobileButton>
    </section>
  );
}

function PageBar({ title, onBack }: { title: string; onBack: () => void }) {
  return (
    <div className="pagebar">
      <MobileIconButton className="icon-action" type="button" onClick={onBack} aria-label="返回">
        <ArrowLeft size={18} />
      </MobileIconButton>
      <h2>{title}</h2>
      <span />
    </div>
  );
}

export default App;
