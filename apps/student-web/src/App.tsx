import { CSSProperties, FormEvent, ReactNode, useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  Atom,
  BarChart3,
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
  PlayCircle,
  ShieldCheck,
  UserRound,
  Video,
} from "lucide-react";
import logoUrl from "./assets/sysu-logo.svg";
import {
  AuthUser,
  LoginResponse,
  PublicPosttestQuestion,
  PublicPretestQuestion,
  StudentExperimentDetailResponse,
  StudentExperimentGroupResponse,
  StudentExperimentGroupSummary,
  StudentLearningArea,
  StudentLearningHomeResponse,
  StudentPosttestReport,
  StudentPosttestResponse,
  changeStudentPassword,
  errorMessage,
  getStudentExperimentDetail,
  getStudentExperimentGroup,
  getStudentLearningHome,
  getAuthToken,
  loadCurrentUser,
  logout,
  setAuthToken,
  startStudentPretest,
  startStudentPosttest,
  studentMediaUrl,
  studentLogin,
  submitStudentPosttest,
  submitStudentPretest,
} from "./api";
import { periodicElements } from "./periodic";

type ViewState = "checking" | "login" | "password" | "pretest-loading" | "pretest-error" | "pretest" | "home";
type AnswerMap = Record<string, string>;
type AssessmentQuestion = PublicPretestQuestion | PublicPosttestQuestion;
type AreaId = "p" | "s" | "d" | "ds" | "f";
type PeriodicArea = "s区" | "p区" | "d区" | "ds区" | "f区";
type LearningRoute =
  | { screen: "home" }
  | { screen: "group"; parentCode: string }
  | { screen: "experiment"; parentCode: string; experimentId: string }
  | { screen: "posttest"; posttest: StudentPosttestResponse }
  | { screen: "summary"; report: StudentPosttestReport };

const areaIdByPeriodicArea: Record<PeriodicArea, AreaId> = {
  "s区": "s",
  "p区": "p",
  "d区": "d",
  "ds区": "ds",
  "f区": "f",
};

const periodicAreaByAreaId: Record<AreaId, PeriodicArea> = {
  s: "s区",
  p: "p区",
  d: "d区",
  ds: "ds区",
  f: "f区",
};

const areaSwatches: Record<AreaId, string> = {
  p: "#2f9d70",
  s: "#8cc95f",
  d: "#6fa3d8",
  ds: "#d7ab3c",
  f: "#a77bd2",
};

const areaInk: Record<AreaId, string> = {
  p: "#0f3d2b",
  s: "#28430e",
  d: "#123556",
  ds: "#4d3510",
  f: "#3a2452",
};

function normalizeStudentId(value: string): string {
  return value.trim().toUpperCase();
}

function isStudent(response: LoginResponse): boolean {
  return response.user.role === "student";
}

function App() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [checking, setChecking] = useState(true);
  const [sessionError, setSessionError] = useState("");
  const [pretest, setPretest] = useState<Awaited<ReturnType<typeof startStudentPretest>> | null>(null);
  const [pretestLoading, setPretestLoading] = useState(false);
  const [pretestError, setPretestError] = useState("");

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
      return;
    }

    let cancelled = false;
    setPretestLoading(true);
    setPretestError("");
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
    if (pretestError) return "pretest-error";
    if (pretest?.status === "in_progress" && pretest.stage && pretest.questions.length) return "pretest";
    if (pretestLoading) return "pretest-loading";
    return "home";
  }, [checking, pretest, pretestError, pretestLoading, user]);

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
      <section className="brand-rail" aria-label="中山大学化学学院">
        <div className="brand-seal">
          <img src={logoUrl} alt="中山大学校徽" />
        </div>
        <div>
          <p>中山大学化学学院</p>
          <h1>元素实验</h1>
        </div>
      </section>

      {view === "checking" ? <LoadingPanel text="正在恢复登录状态" /> : null}
      {view === "login" ? <LoginPanel sessionError={sessionError} onLogin={acceptLogin} /> : null}
      {view === "password" && user ? <PasswordPanel user={user} onChanged={acceptLogin} /> : null}
      {view === "pretest-loading" ? <LoadingPanel text="正在准备课前摸底" /> : null}
      {view === "pretest-error" ? <PretestErrorPanel message={pretestError} onLogout={handleLogout} /> : null}
      {view === "pretest" && pretest ? (
        <AssessmentPanel
          eyebrow="课前摸底"
          title="请完成以下题目"
          questions={pretest.questions}
          submitting={pretestLoading}
          onSubmit={handlePretestSubmit}
        />
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
              <input
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

function PretestErrorPanel({ message, onLogout }: { message: string; onLogout: () => void }) {
  return (
    <section className="auth-panel success-panel">
      <div className="success-mark warning-mark">
        <ClipboardList size={30} />
      </div>
      <div className="success-copy">
        <p>课前摸底</p>
        <h2>{message || "暂时无法开始"}</h2>
      </div>
      <button className="secondary-action" type="button" onClick={onLogout}>
        <LogOut size={18} />
        <span>退出登录</span>
      </button>
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
          <input
            value={studentId}
            onChange={(event) => setStudentId(event.target.value)}
            placeholder="请输入学号"
            autoComplete="username"
            inputMode="text"
          />
        </label>
        <label>
          <span>密码</span>
          <input
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="请输入密码"
            type="password"
            autoComplete="current-password"
          />
        </label>
        {error ? <div className="form-error">{error}</div> : null}
        <button className="primary-action" type="submit" disabled={loading || !studentId.trim() || !password}>
          {loading ? <LoaderCircle className="spin" size={18} /> : <LogIn size={18} />}
          <span>{loading ? "正在登录" : "登录"}</span>
        </button>
      </form>
    </section>
  );
}

function PasswordPanel({ user, onChanged }: { user: AuthUser; onChanged: (response: LoginResponse) => void }) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const canSubmit = Boolean(currentPassword) && newPassword.length >= 8 && newPassword === confirmPassword;

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canSubmit) return;
    setLoading(true);
    setError("");
    try {
      const response = await changeStudentPassword(currentPassword, newPassword);
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
        <label>
          <span>当前密码</span>
          <input
            value={currentPassword}
            onChange={(event) => setCurrentPassword(event.target.value)}
            placeholder="首次登录为初始密码"
            type="password"
            autoComplete="current-password"
          />
        </label>
        <label>
          <span>新密码</span>
          <input
            value={newPassword}
            onChange={(event) => setNewPassword(event.target.value)}
            placeholder="至少 8 位"
            type="password"
            autoComplete="new-password"
          />
        </label>
        <label>
          <span>确认新密码</span>
          <input
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
        <button className="primary-action" type="submit" disabled={loading || !canSubmit}>
          {loading ? <LoaderCircle className="spin" size={18} /> : <ShieldCheck size={18} />}
          <span>{loading ? "正在保存" : "保存并继续"}</span>
        </button>
      </form>
    </section>
  );
}

function LearningSurface({ user, onLogout }: { user: AuthUser; onLogout: () => void }) {
  const [route, setRoute] = useState<LearningRoute>({ screen: "home" });
  const [posttestLoading, setPosttestLoading] = useState(false);
  const [posttestSubmitting, setPosttestSubmitting] = useState(false);
  const [posttestError, setPosttestError] = useState("");

  const finishLearning = async () => {
    setPosttestLoading(true);
    setPosttestError("");
    try {
      const response = await startStudentPosttest();
      setRoute({ screen: "posttest", posttest: response });
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
      setRoute({ screen: "summary", report: response.report });
    } catch (requestError) {
      setPosttestError(errorMessage(requestError));
    } finally {
      setPosttestSubmitting(false);
    }
  };

  if (route.screen === "group") {
    return (
      <ExperimentGroupPanel
        parentCode={route.parentCode}
        onBack={() => setRoute({ screen: "home" })}
        onSelectExperiment={(experimentId) => setRoute({ screen: "experiment", parentCode: route.parentCode, experimentId })}
        onFinishLearning={finishLearning}
        finishing={posttestLoading}
        finishError={posttestError}
      />
    );
  }

  if (route.screen === "experiment") {
    return (
      <ExperimentDetailPanel
        experimentId={route.experimentId}
        onBack={() => setRoute({ screen: "group", parentCode: route.parentCode })}
        onFinishLearning={finishLearning}
        finishing={posttestLoading}
        finishError={posttestError}
      />
    );
  }

  if (route.screen === "posttest") {
    return (
      <PosttestPanel
        posttest={route.posttest}
        submitting={posttestSubmitting}
        error={posttestError}
        onSubmit={(answers) => submitPosttest(route.posttest, answers)}
      />
    );
  }

  if (route.screen === "summary") {
    return <PosttestSummaryPanel report={route.report} onContinue={() => setRoute({ screen: "home" })} />;
  }

  return (
    <LearningHomePanel
      user={user}
      onLogout={onLogout}
      onEnterGroup={(parentCode) => setRoute({ screen: "group", parentCode })}
      onFinishLearning={finishLearning}
      finishing={posttestLoading}
      finishError={posttestError}
    />
  );
}

function LearningHomePanel({
  user,
  onLogout,
  onEnterGroup,
  onFinishLearning,
  finishing,
  finishError,
}: {
  user: AuthUser;
  onLogout: () => void;
  onEnterGroup: (parentCode: string) => void;
  onFinishLearning: () => void;
  finishing: boolean;
  finishError: string;
}) {
  const [home, setHome] = useState<StudentLearningHomeResponse | null>(null);
  const [selectedArea, setSelectedArea] = useState<AreaId>("p");
  const [selectedParentCode, setSelectedParentCode] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    getStudentLearningHome()
      .then((payload) => {
        if (cancelled) return;
        setHome(payload);
        const recommendedArea = normalizeAreaId(payload.recommended_area_id) || firstEnabledArea(payload.areas) || "p";
        setSelectedArea(recommendedArea);
        setSelectedParentCode(payload.recommended_parent_code || firstGroupForArea(payload.groups, recommendedArea)?.parent_code || null);
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

  useEffect(() => {
    if (!home) return;
    const nextGroup = home.groups.find((group) => group.area_id === selectedArea && group.recommended) || firstGroupForArea(home.groups, selectedArea);
    setSelectedParentCode(nextGroup?.parent_code || null);
  }, [home, selectedArea]);

  const groups = home?.groups.filter((group) => group.area_id === selectedArea) || [];
  const selectedGroup =
    groups.find((group) => group.parent_code === selectedParentCode) || groups.find((group) => group.recommended) || groups[0] || null;

  return (
    <section className="learning-panel" aria-label="实验学习">
      <div className="learning-topbar">
        <div>
          <p>{user.student_id || user.username}</p>
          <h2>{user.display_name}</h2>
        </div>
        <button className="icon-action" type="button" onClick={onLogout} aria-label="退出登录">
          <LogOut size={18} />
        </button>
      </div>

      {loading ? <LearningState icon={<LoaderCircle className="spin" size={23} />} text="正在加载实验资源" /> : null}
      {error ? <LearningState icon={<FlaskConical size={23} />} text={error} /> : null}
      {!loading && !error && home ? (
        <>
          <PeriodicTable selectedArea={selectedArea} areas={home.areas} onSelectArea={setSelectedArea} />

          <section className="selection-panel">
            <div className="selection-head">
              <span style={{ "--area-color": areaSwatches[selectedArea] } as CSSProperties}>
                <Layers3 size={18} />
              </span>
              <div>
                <p>当前选区</p>
                <h2>{home.areas.find((area) => area.area_id === selectedArea)?.area_name || periodicAreaByAreaId[selectedArea]}</h2>
              </div>
            </div>

            {groups.length ? (
              <div className="family-grid">
                {groups.map((group) => (
                  <ExperimentGroupCard
                    key={group.parent_code}
                    group={group}
                    selected={selectedGroup?.parent_code === group.parent_code}
                    onSelect={() => setSelectedParentCode(group.parent_code)}
                  />
                ))}
              </div>
            ) : (
              <div className="empty-learning-card">
                <FlaskConical size={20} />
                <span>该区实验暂未开放</span>
              </div>
            )}
          </section>

          <button
            className="primary-action full"
            type="button"
            disabled={!selectedGroup}
            onClick={() => selectedGroup && onEnterGroup(selectedGroup.parent_code)}
          >
            <BookOpenCheck size={18} />
            <span>进入实验</span>
          </button>
          <FinishLearningAction loading={finishing} error={finishError} onClick={onFinishLearning} />
        </>
      ) : null}
    </section>
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

function LearningState({ icon, text }: { icon: ReactNode; text: string }) {
  return (
    <div className="learning-state">
      {icon}
      <span>{text}</span>
    </div>
  );
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

function PeriodicTable({
  selectedArea,
  areas,
  onSelectArea,
}: {
  selectedArea: AreaId;
  areas: StudentLearningArea[];
  onSelectArea: (area: AreaId) => void;
}) {
  const groupNumbers = Array.from({ length: 18 }, (_, index) => index + 1);
  const areaEnabled = new Map(areas.map((area) => [area.area_id, area.enabled]));

  return (
    <section className="periodic-card" aria-label="元素周期表选择区">
      <div className="periodic-card-head">
        <div>
          <p>元素周期表</p>
          <h3>{periodicAreaByAreaId[selectedArea]}</h3>
        </div>
        <Atom size={22} />
      </div>
      <div className="area-legend" aria-label="元素区图例">
        {(Object.keys(periodicAreaByAreaId) as AreaId[]).map((area) => (
          <button
            key={area}
            type="button"
            className={[selectedArea === area ? "selected" : "", areaEnabled.get(area) ? "" : "muted"].filter(Boolean).join(" ")}
            style={{ "--area-color": areaSwatches[area], "--area-ink": areaInk[area] } as CSSProperties}
            onClick={() => onSelectArea(area)}
            aria-label={`选择${periodicAreaByAreaId[area]}`}
          >
            <i />
            <span>{periodicAreaByAreaId[area]}</span>
          </button>
        ))}
      </div>
      <div className="periodic-caption">族（IUPAC 编号）</div>
      <div className="periodic-grid">
        {groupNumbers.map((group) => (
          <div className="group-number" key={group} style={{ gridColumn: group, gridRow: 1 }}>
            {group}
          </div>
        ))}
        {periodicElements.map((element) => {
          const areaId = areaIdByPeriodicArea[element.area as PeriodicArea];
          return (
            <button
              key={element.atomicNumber}
              type="button"
              className={selectedArea === areaId ? "element-cell selected-area" : "element-cell"}
              style={{
                gridColumn: element.group,
                gridRow: element.period + 1,
                background: selectedArea === areaId ? areaSwatches[areaId] : `${areaSwatches[areaId]}88`,
                "--cell-ink": areaInk[areaId],
              } as CSSProperties}
              aria-label={`${element.symbol} ${element.name}`}
              title={`${element.symbol} ${element.name}`}
              onClick={() => onSelectArea(areaId)}
            />
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
}: {
  parentCode: string;
  onBack: () => void;
  onSelectExperiment: (experimentId: string) => void;
  onFinishLearning: () => void;
  finishing: boolean;
  finishError: string;
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
      {group ? <FinishLearningAction loading={finishing} error={finishError} onClick={onFinishLearning} /> : null}
    </section>
  );
}

function ExperimentDetailPanel({
  experimentId,
  onBack,
  onFinishLearning,
  finishing,
  finishError,
}: {
  experimentId: string;
  onBack: () => void;
  onFinishLearning: () => void;
  finishing: boolean;
  finishError: string;
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

  const video = detail?.videos[0] || null;

  return (
    <section className="learning-panel" aria-label="实验详情">
      <PageBar title={detail?.title || "实验详情"} onBack={onBack} />
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
            <p>{detail.module_title || detail.parent_title}</p>
            <h2>{detail.title}</h2>
            {detail.summary ? <span>{detail.summary}</span> : null}
          </section>

          <section className="detail-section">
            <h3>实验观察点</h3>
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
              <div className="empty-learning-card">暂无观察点</div>
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
      <button className="secondary-action finish-action" type="button" disabled={loading} onClick={onClick}>
        {loading ? <LoaderCircle className="spin" size={18} /> : <GraduationCap size={18} />}
        <span>{loading ? "正在生成后测" : "完成学习"}</span>
      </button>
    </section>
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

function PosttestSummaryPanel({ report, onContinue }: { report: StudentPosttestReport; onContinue: () => void }) {
  const masteryChanges = report.mastery_changes.slice(0, 5);
  return (
    <section className="learning-panel" aria-label="学习总结">
      <section className="summary-hero">
        <span className="panel-icon">
          <BarChart3 size={20} />
        </span>
        <div>
          <p>学习总结</p>
          <h2>本轮实验报告</h2>
          <small>{report.next_recommendation}</small>
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
          <div className="empty-learning-card">
            <CheckCircle2 size={20} />
            <span>本轮没有错题</span>
          </div>
        )}
      </section>

      <button className="primary-action full" type="button" onClick={onContinue}>
        <BookOpenCheck size={18} />
        <span>继续学习</span>
      </button>
    </section>
  );
}

function PageBar({ title, onBack }: { title: string; onBack: () => void }) {
  return (
    <div className="pagebar">
      <button className="icon-action" type="button" onClick={onBack} aria-label="返回">
        <ArrowLeft size={18} />
      </button>
      <h2>{title}</h2>
      <span />
    </div>
  );
}

export default App;
