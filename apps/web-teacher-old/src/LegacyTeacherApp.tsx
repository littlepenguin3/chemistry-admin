import { FormEvent, type DependencyList, type ReactNode, useEffect, useMemo, useState } from "react";

import {
  getAuthToken,
  getTeacherDemoClassAnalytics,
  getTeacherDemoClasses,
  getTeacherDemoClassWeakPoints,
  getTeacherDemoEvaluationSystem,
  getTeacherDemoOverview,
  getTeacherDemoQuestionResources,
  getTeacherDemoVideoResources,
  legacyTeacherErrorMessage,
  loadCurrentUser,
  setLegacyVideoPointRecommendation,
  setAuthToken,
  teacherLogin,
  type TeacherDemoAnalytics,
  type TeacherDemoClassSummary,
  type TeacherDemoClasses,
  type TeacherDemoEvaluationSystem,
  type TeacherDemoOverview,
  type TeacherDemoQuestionResource,
  type TeacherDemoQuestionResources,
  type TeacherDemoVideoResource,
  type TeacherDemoVideoResources,
  type TeacherDemoWeakPoint,
  type TeacherDemoWeakPoints,
  type User,
} from "./api";

const logoSrc = `${import.meta.env.BASE_URL}assets/sysu-lockup-red.svg`;
const forbiddenPathSegments = [
  "/learning-assistant",
  "/ai-config",
  "/monitoring",
  "/rag",
  "/agent",
  "/provider",
  "/web-admin",
  "/recommend",
  "/question-bank",
  "/scores",
  "/workbench",
  "/import",
  "/publish",
];

type RouteKey = "overview" | "videos" | "questions" | "classes" | "analytics" | "evaluation";

const navItems: Array<{ key: RouteKey; label: string; path: string }> = [
  { key: "overview", label: "工作台", path: "/" },
  { key: "videos", label: "视频资源", path: "/videos" },
  { key: "questions", label: "题库资源", path: "/questions" },
  { key: "classes", label: "班级", path: "/classes" },
  { key: "analytics", label: "学情分析", path: "/analytics" },
  { key: "evaluation", label: "评价体系", path: "/evaluation" },
];

function currentPath(): string {
  return window.location.pathname || "/";
}

function navigate(path: string): void {
  window.history.pushState({}, "", path);
  window.dispatchEvent(new Event("popstate"));
}

function usePath(): string {
  const [path, setPath] = useState(currentPath);
  useEffect(() => {
    const update = () => setPath(currentPath());
    window.addEventListener("popstate", update);
    return () => window.removeEventListener("popstate", update);
  }, []);
  return path;
}

function isForbiddenPath(path: string): boolean {
  return forbiddenPathSegments.some((segment) => path.startsWith(segment));
}

function routeFromPath(path: string): RouteKey {
  if (path.startsWith("/videos")) return "videos";
  if (path.startsWith("/questions")) return "questions";
  if (path.startsWith("/classes")) return "classes";
  if (path.startsWith("/analytics")) return "analytics";
  if (path.startsWith("/evaluation")) return "evaluation";
  return "overview";
}

export function LegacyTeacherApp() {
  const path = usePath();
  const [user, setUser] = useState<User | null>(null);
  const [checkingSession, setCheckingSession] = useState(Boolean(getAuthToken()));

  useEffect(() => {
    if (!getAuthToken()) return;
    let active = true;
    setCheckingSession(true);
    loadCurrentUser()
      .then((value) => {
        if (active && (value.role === "admin" || value.role === "teacher" || value.role === "platform_admin")) setUser(value);
      })
      .catch(() => {
        if (active) setUser(null);
      })
      .finally(() => {
        if (active) setCheckingSession(false);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (isForbiddenPath(path)) navigate("/");
  }, [path]);

  if (checkingSession) {
    return <div className="legacy-teacher-loading">正在载入教师端...</div>;
  }

  if (!user) return <LoginScreen onLogin={setUser} />;

  const activeRoute = routeFromPath(isForbiddenPath(path) ? "/" : path);

  return (
    <div className="legacy-teacher-shell">
      <aside className="legacy-sidebar">
        <img src={logoSrc} alt="中山大学" className="legacy-sidebar-logo" />
        <strong>无机化学实验教学平台</strong>
        <nav aria-label="旧版教师导航">
          {navItems.map((item) => (
            <NavButton key={item.key} active={activeRoute === item.key} label={item.label} path={item.path} />
          ))}
        </nav>
      </aside>
      <div className="legacy-teacher-main">
        <header className="legacy-teacher-header">
          <div>
            <span>旧版教师展示台</span>
            <strong>{user.display_name || user.username}</strong>
          </div>
          <button
            className="text-button"
            onClick={() => {
              setAuthToken("");
              window.location.assign("/");
            }}
          >
            退出登录
          </button>
        </header>
        {activeRoute === "videos" ? (
          <VideosPage />
        ) : activeRoute === "questions" ? (
          <QuestionsPage />
        ) : activeRoute === "classes" ? (
          <ClassesPage />
        ) : activeRoute === "analytics" ? (
          <AnalyticsPage />
        ) : activeRoute === "evaluation" ? (
          <EvaluationPage />
        ) : (
          <OverviewPage />
        )}
      </div>
    </div>
  );
}

function NavButton({ active, label, path }: { active: boolean; label: string; path: string }) {
  return (
    <button className={active ? "active" : ""} onClick={() => navigate(path)}>
      {label}
    </button>
  );
}

function LoginScreen({ onLogin }: { onLogin: (user: User) => void }) {
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      const response = await teacherLogin(username, password);
      if (!["admin", "teacher", "platform_admin"].includes(response.user.role)) {
        throw new Error("该账号不能进入教师端。");
      }
      setAuthToken(response.access_token);
      onLogin(response.user);
    } catch (caught) {
      setError(legacyTeacherErrorMessage(caught));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="legacy-teacher-login">
      <section className="legacy-teacher-login-card">
        <img src={logoSrc} alt="中山大学" />
        <span className="eyebrow">Teacher Console Classic</span>
        <h1>无机化学实验教学管理平台</h1>
        <p>围绕实验视频、题库资源、班级学情和 BKT 评价体系展示教学反馈闭环。</p>
        <form onSubmit={submit}>
          <label>
            账号
            <input value={username} onChange={(event) => setUsername(event.target.value)} autoComplete="username" />
          </label>
          <label>
            密码
            <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" />
          </label>
          {error ? <div className="legacy-error">{error}</div> : null}
          <button className="primary-button" disabled={submitting}>
            {submitting ? "登录中..." : "进入教师端" }
          </button>
        </form>
      </section>
    </div>
  );
}

function useAsyncData<T>(loader: () => Promise<T>, deps: DependencyList): { data: T | null; error: string; loading: boolean } {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    loader()
      .then((value) => {
        if (active) setData(value);
      })
      .catch((caught) => {
        if (active) setError(legacyTeacherErrorMessage(caught));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, deps);

  return { data, error, loading };
}

function PageFrame({ eyebrow, title, description, children }: { eyebrow: string; title: string; description: string; children: ReactNode }) {
  return (
    <main className="legacy-teacher-page">
      <section className="legacy-page-head">
        <span className="eyebrow">{eyebrow}</span>
        <h1>{title}</h1>
        <p>{description}</p>
      </section>
      {children}
    </main>
  );
}

function StateBlock({ loading, error, children }: { loading: boolean; error: string; children: ReactNode }) {
  if (loading) return <div className="legacy-empty">正在读取展示数据...</div>;
  if (error) return <div className="legacy-error">{error}</div>;
  return <>{children}</>;
}

function MetricGrid({ metrics }: { metrics: Array<{ label: string; value: ReactNode; unit?: string; description?: string }> }) {
  return (
    <div className="legacy-metric-grid">
      {metrics.map((metric) => (
        <div className="legacy-metric" key={metric.label}>
          <span>{metric.label}</span>
          <strong>
            {metric.value}
            {metric.unit ? <em>{metric.unit}</em> : null}
          </strong>
          {metric.description ? <small>{metric.description}</small> : null}
        </div>
      ))}
    </div>
  );
}

function OverviewPage() {
  const { data, error, loading } = useAsyncData<TeacherDemoOverview>(getTeacherDemoOverview, []);

  return (
    <PageFrame
      eyebrow="只读教学资源总览"
      title="教学工作台"
      description="展示实验视频、题库、班级与 BKT 反馈闭环，用于评奖现场快速说明系统已有教学资源。"
    >
      <StateBlock loading={loading} error={error}>
        {data ? (
          <>
            <MetricGrid
              metrics={data.metrics.map((metric) => ({
                label: metric.label,
                value: metric.value,
                unit: metric.unit,
                description: metric.description,
              }))}
            />
            <section className="legacy-card">
              <h2>BKT 教学反馈闭环</h2>
              <div className="legacy-flow">
                {data.loop.map((step) => (
                  <article key={step.title}>
                    <strong>{step.title}</strong>
                    <p>{step.description}</p>
                  </article>
                ))}
              </div>
            </section>
            <section className="legacy-panel-grid">
              <ModuleCard title="视频资源" description="按实验点位查看可学习视频、题目覆盖和推荐学习标签。" path="/videos" />
              <ModuleCard title="题库资源" description="查看题库数量、题型分布和章节点位覆盖情况。" path="/questions" />
              <ModuleCard title="学情分析" description="查看班级平均分、掌握度证据和薄弱点位排行。" path="/analytics" />
            </section>
          </>
        ) : null}
      </StateBlock>
    </PageFrame>
  );
}

function ModuleCard({ title, description, path }: { title: string; description: string; path: string }) {
  return (
    <button className="legacy-module-card" onClick={() => navigate(path)}>
      <strong>{title}</strong>
      <span>{description}</span>
    </button>
  );
}

function VideosPage() {
  const [query, setQuery] = useState("");
  const [submittedQuery, setSubmittedQuery] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const [updatingNodeId, setUpdatingNodeId] = useState("");
  const [notice, setNotice] = useState("");
  const [actionError, setActionError] = useState("");
  const { data, error, loading } = useAsyncData<TeacherDemoVideoResources>(() => getTeacherDemoVideoResources(submittedQuery), [submittedQuery, reloadKey]);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    setSubmittedQuery(query.trim());
  };

  const items = data?.items || [];
  const playableCount = items.filter((item) => item.has_video).length;
  const recommendedCount = items.filter((item) => item.is_recommended).length;

  const toggleRecommendation = async (item: TeacherDemoVideoResource, recommended: boolean) => {
    setUpdatingNodeId(item.node_id);
    setNotice("");
    setActionError("");
    try {
      await setLegacyVideoPointRecommendation(item.node_id, recommended);
      setNotice(recommended ? `已设为推荐学习：${item.title}` : `已取消推荐学习：${item.title}`);
      setReloadKey((value) => value + 1);
    } catch (caught) {
      setActionError(legacyTeacherErrorMessage(caught));
    } finally {
      setUpdatingNodeId("");
    }
  };

  return (
    <PageFrame
      eyebrow="实验视频证据"
      title="视频资源"
      description="以实验点位为单位展示视频资源，已有视频的点位排在前面；教师推荐学习仅作为静态标签展示。"
    >
      <form className="legacy-search-row" onSubmit={submit}>
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="输入实验、试剂、现象或点位名称" />
        <button className="primary-button">搜索</button>
      </form>
      {notice ? <div className="legacy-notice">{notice}</div> : null}
      {actionError ? <div className="legacy-error">{actionError}</div> : null}
      <StateBlock loading={loading} error={error}>
        <MetricGrid
          metrics={[
            { label: submittedQuery ? "搜索结果" : "全部点位", value: data?.total || 0, unit: "项" },
            { label: "已绑定视频", value: playableCount, unit: "项" },
            { label: "推荐学习", value: recommendedCount, unit: "项" },
            { label: "题目覆盖", value: items.reduce((sum, item) => sum + item.published_question_count, 0), unit: "题" },
          ]}
        />
        <section className="legacy-table-card">
          <header>
            <h2>视频点位列表</h2>
            <span>{items.length ? `当前显示 ${items.length} 项` : "暂无数据"}</span>
          </header>
          <div className="legacy-resource-list">
            {items.map((item) => (
              <VideoResourceRow
                key={item.node_id}
                item={item}
                updating={updatingNodeId === item.node_id}
                onToggle={(recommended) => void toggleRecommendation(item, recommended)}
              />
            ))}
          </div>
        </section>
      </StateBlock>
    </PageFrame>
  );
}

function VideoResourceRow({
  item,
  updating,
  onToggle,
}: {
  item: TeacherDemoVideoResource;
  updating: boolean;
  onToggle: (recommended: boolean) => void;
}) {
  return (
    <article className="legacy-resource-row">
      <div>
        <span className="legacy-row-label">{item.has_video ? "已绑定视频" : "待补充视频"}</span>
        {item.is_recommended ? <span className="legacy-row-label gold">推荐学习</span> : null}
      </div>
      <div className="legacy-row-main">
        <strong>{item.title}</strong>
        <p>{item.summary || "暂无摘要。"}</p>
        <small>{item.catalog_path.join(" / ") || "未绑定目录路径"}</small>
      </div>
      <div className="legacy-row-stats">
        <span>视频 {item.published_media_count}</span>
        <span>题目 {item.published_question_count}</span>
        <button className="legacy-secondary-button" disabled={updating} onClick={() => onToggle(!item.is_recommended)}>
          {updating ? "处理中..." : item.is_recommended ? "取消推荐" : "设为推荐"}
        </button>
      </div>
    </article>
  );
}

function QuestionsPage() {
  const { data, error, loading } = useAsyncData<TeacherDemoQuestionResources>(getTeacherDemoQuestionResources, []);
  const pointItems = useMemo(() => (data?.items || []).filter((item) => item.node_kind === "point"), [data]);
  const directoryItems = useMemo(() => (data?.items || []).filter((item) => item.node_kind !== "point"), [data]);

  return (
    <PageFrame
      eyebrow="智能辅助题库建设"
      title="题库资源"
      description="展示教材与实验点位沉淀出的题库资源、题型分布和覆盖情况，说明题库建设流程与资源规模。"
    >
      <StateBlock loading={loading} error={error}>
        {data ? (
          <>
            <MetricGrid
              metrics={[
                { label: "题目总数", value: Number(data.totals.question_count || 0), unit: "题" },
                { label: "已发布", value: Number(data.totals.published_count || 0), unit: "题" },
                { label: "点位覆盖", value: Number(data.totals.point_count || pointItems.length), unit: "项" },
                { label: "目录单元", value: directoryItems.length, unit: "项" },
              ]}
            />
            <section className="legacy-card">
              <h2>题库建设流程</h2>
              <div className="legacy-process-grid">
                <span>教材资料</span>
                <span>智能辅助命题</span>
                <span>教师审核</span>
                <span>正式题库</span>
              </div>
            </section>
            <section className="legacy-table-card">
              <header>
                <h2>点位题库覆盖</h2>
                <span>{pointItems.length} 个实验点位</span>
              </header>
              <div className="legacy-resource-list">
                {pointItems.slice(0, 120).map((item) => (
                  <QuestionResourceRow key={item.node_id} item={item} />
                ))}
              </div>
            </section>
          </>
        ) : null}
      </StateBlock>
    </PageFrame>
  );
}

function QuestionResourceRow({ item }: { item: TeacherDemoQuestionResource }) {
  return (
    <article className="legacy-resource-row">
      <div>
        <span className="legacy-row-label">{item.published_count > 0 ? "有题" : "待补题"}</span>
      </div>
      <div className="legacy-row-main">
        <strong>{item.title}</strong>
        <p>{item.breadcrumb_titles.join(" / ") || "未绑定目录路径"}</p>
      </div>
      <div className="legacy-row-stats">
        <span>总题 {item.question_count}</span>
        <span>选择 {item.choice_count}</span>
        <span>判断 {item.true_false_count}</span>
        <span>填空 {item.fill_blank_count}</span>
      </div>
    </article>
  );
}

function ClassesPage() {
  const { data, error, loading } = useAsyncData<TeacherDemoClasses>(getTeacherDemoClasses, []);
  const classes = data?.classes || [];

  return (
    <PageFrame
      eyebrow="班级与学生范围"
      title="班级"
      description="展示已有班级、学生规模、参与情况和平均掌握表现，作为后续学情分析的数据范围。"
    >
      <StateBlock loading={loading} error={error}>
        <MetricGrid
          metrics={[
            { label: "班级数", value: classes.length, unit: "个" },
            { label: "学生数", value: classes.reduce((sum, item) => sum + item.student_count, 0), unit: "人" },
            { label: "参与学生", value: classes.reduce((sum, item) => sum + item.active_students, 0), unit: "人" },
            { label: "待开始", value: classes.reduce((sum, item) => sum + item.missing_students, 0), unit: "人" },
          ]}
        />
        <section className="legacy-table-card">
          <header>
            <h2>班级列表</h2>
            <span>{classes.length ? `当前共 ${classes.length} 个班级` : "暂无班级"}</span>
          </header>
          <div className="legacy-class-grid">
            {classes.map((item) => (
              <ClassCard key={item.id} item={item} />
            ))}
          </div>
        </section>
      </StateBlock>
    </PageFrame>
  );
}

function ClassCard({ item }: { item: TeacherDemoClassSummary }) {
  return (
    <article className="legacy-card class-card">
      <span className="legacy-row-label">{item.status === "active" ? "使用中" : item.status}</span>
      <h2>{item.class_name}</h2>
      <p>{item.description || "无备注。"}</p>
      <div className="legacy-card-stats">
        <span>学生 {item.student_count}</span>
        <span>参与 {item.active_students}</span>
        <span>平均 {item.average_score}</span>
        <span>完成 {item.completion_rate}%</span>
      </div>
    </article>
  );
}

function AnalyticsPage() {
  const classState = useAsyncData<TeacherDemoClasses>(getTeacherDemoClasses, []);
  const classes = classState.data?.classes || [];
  const [selectedClassId, setSelectedClassId] = useState("");

  useEffect(() => {
    if (!selectedClassId && classes[0]?.id) setSelectedClassId(classes[0].id);
  }, [classes, selectedClassId]);

  const analyticsState = useAsyncData<TeacherDemoAnalytics | null>(
    () => (selectedClassId ? getTeacherDemoClassAnalytics(selectedClassId) : Promise.resolve(null)),
    [selectedClassId],
  );
  const weakState = useAsyncData<TeacherDemoWeakPoints | null>(
    () => (selectedClassId ? getTeacherDemoClassWeakPoints(selectedClassId) : Promise.resolve(null)),
    [selectedClassId],
  );

  const analytics = analyticsState.data;
  const weakPoints = weakState.data?.point_items || [];

  return (
    <PageFrame
      eyebrow="BKT 学情展示"
      title="学情分析"
      description="按班级展示学生掌握情况、答题证据和薄弱实验点位，帮助教师说明个性化复习与智能组卷依据。"
    >
      <StateBlock loading={classState.loading} error={classState.error}>
        <section className="legacy-card">
          <label className="legacy-select-label">
            当前班级
            <select value={selectedClassId} onChange={(event) => setSelectedClassId(event.target.value)}>
              {classes.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.class_name}
                </option>
              ))}
            </select>
          </label>
        </section>
        <StateBlock loading={analyticsState.loading || weakState.loading} error={analyticsState.error || weakState.error}>
          {analytics ? (
            <>
              <MetricGrid
                metrics={[
                  { label: "班级人数", value: Number(analytics.metrics.class_size || 0), unit: "人" },
                  { label: "参与学生", value: Number(analytics.metrics.active_students || 0), unit: "人" },
                  { label: "平均分", value: Number(analytics.metrics.average_score || 0), unit: "分" },
                  { label: "薄弱点位", value: weakPoints.length, unit: "项" },
                ]}
              />
              <section className="legacy-table-card">
                <header>
                  <h2>学生掌握情况</h2>
                  <span>{analytics.students.length} 名学生</span>
                </header>
                <div className="legacy-student-table">
                  {analytics.students.map((student) => (
                    <article key={student.student_id}>
                      <strong>{student.student_name}</strong>
                      <span>{student.student_id}</span>
                      <span>平均 {student.average_score}</span>
                      <span>证据 {student.evidence_count}</span>
                      <span>{student.status}</span>
                    </article>
                  ))}
                </div>
              </section>
              <section className="legacy-table-card">
                <header>
                  <h2>薄弱点位排行</h2>
                  <span>{weakPoints.length ? `当前共 ${weakPoints.length} 项` : "暂无薄弱点位"}</span>
                </header>
                <div className="legacy-resource-list">
                  {(weakPoints.length ? weakPoints : weakState.data?.items || []).slice(0, 20).map((item, index) => (
                    <WeakPointRow key={`${item.point_node_id || item.point_key || item.point_title}-${index}`} item={item} />
                  ))}
                </div>
              </section>
            </>
          ) : null}
        </StateBlock>
      </StateBlock>
    </PageFrame>
  );
}

function WeakPointRow({ item }: { item: TeacherDemoWeakPoint }) {
  return (
    <article className="legacy-resource-row">
      <div>
        <span className="legacy-row-label">薄弱</span>
      </div>
      <div className="legacy-row-main">
        <strong>{item.point_title}</strong>
        <p>{item.experiment_title || item.representative_questions[0]?.stem || "暂无代表题。"}</p>
      </div>
      <div className="legacy-row-stats">
        <span>错误 {item.incorrect_count}</span>
        <span>尝试 {item.attempt_count}</span>
        <span>{item.incorrect_rate}%</span>
      </div>
    </article>
  );
}

function EvaluationPage() {
  const { data, error, loading } = useAsyncData<TeacherDemoEvaluationSystem>(getTeacherDemoEvaluationSystem, []);

  return (
    <PageFrame
      eyebrow="分数评价体系"
      title="评价体系"
      description="说明旧版展示中 BKT 掌握度的评价对象、证据来源、分档含义和教学输出。"
    >
      <StateBlock loading={loading} error={error}>
        {data ? (
          <div className="legacy-evaluation-grid">
            <section className="legacy-card">
              <h2>评价对象</h2>
              <TagList values={data.evaluated_objects} />
            </section>
            <section className="legacy-card">
              <h2>证据来源</h2>
              <TagList values={data.evidence_sources} />
            </section>
            <section className="legacy-card wide">
              <h2>更新机制</h2>
              <p>{data.update_mechanism}</p>
            </section>
            <section className="legacy-card wide">
              <h2>掌握度分档</h2>
              <div className="legacy-band-list">
                {data.score_bands.map((band) => (
                  <article key={band.label}>
                    <strong>{band.label}</strong>
                    <span>
                      {band.min_score ?? 0} - {band.max_score ?? 100}
                    </span>
                    <p>{band.description}</p>
                  </article>
                ))}
              </div>
            </section>
            <section className="legacy-card wide">
              <h2>教学输出</h2>
              <TagList values={data.outputs} />
            </section>
          </div>
        ) : null}
      </StateBlock>
    </PageFrame>
  );
}

function TagList({ values }: { values: string[] }) {
  return (
    <div className="legacy-tag-list">
      {values.map((value) => (
        <span key={value}>{value}</span>
      ))}
    </div>
  );
}
