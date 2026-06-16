import { useEffect, useMemo, useRef, useState } from "react";
import { Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import type { ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { lazy, Suspense } from "react";
import { motion, useReducedMotion } from "motion/react";
import { AIGlowButton } from "./components/AIGlowButton";
import { AuthenticatedImage } from "./components/AuthenticatedImage";
import { PageTitle } from "./components/PageTitle";
import { QueryState } from "./components/QueryState";
import { formatMemoryMb, formatRuntimeSeconds, formatTraceMs, warmupStatusLabel } from "./features/learning-assistant/runtimeFormat";
import {
  experimentVideoCandidates,
  experimentVideoPointCount,
  formatChapterTitle,
  isGeneralResourceTitle,
  isPreviewableVideo,
  mediaAssetTime,
  mediaAssetType,
  theoryChapters,
} from "./features/resources/resourceUtils";
import { errorMessage } from "./lib/errors";
import { optionDiagnosticRoleLabel, statusColor, statusLabel, statusTag } from "./lib/status";
import {
  Alert,
  App as AntApp,
  Badge,
  Button,
  Card,
  Checkbox,
  ConfigProvider,
  Descriptions,
  Divider,
  Drawer,
  Empty,
  Flex,
  Form,
  Input,
  InputNumber,
  Layout,
  Menu,
  Modal,
  Popconfirm,
  Progress,
  Segmented,
  Select,
  Space,
  Spin,
  Statistic,
  Switch,
  Table,
  Tabs,
  Tag,
  Tooltip,
  Typography,
  Upload,
  theme,
} from "antd";
import {
  ArrowRightOutlined,
  ApiOutlined,
  AppstoreOutlined,
  BarChartOutlined,
  BookOutlined,
  CheckCircleOutlined,
  CloudUploadOutlined,
  CloseCircleOutlined,
  DatabaseOutlined,
  DeleteOutlined,
  EditOutlined,
  ExperimentOutlined,
  EyeOutlined,
  IdcardOutlined,
  KeyOutlined,
  LeftOutlined,
  LogoutOutlined,
  MessageOutlined,
  PauseCircleOutlined,
  PlayCircleOutlined,
  PlusOutlined,
  QuestionCircleOutlined,
  ReloadOutlined,
  SafetyCertificateOutlined,
  SettingOutlined,
  TeamOutlined,
  UnorderedListOutlined,
  VideoCameraOutlined,
} from "@ant-design/icons";
import dayjs from "dayjs";
import {
  api,
  apiBase,
  formatBytes,
  getAuthToken,
  patchJson,
  postJson,
  postJsonStream,
  putJson,
  setAuthToken,
} from "./api";
import type {
  AnalyticsDashboard,
  AIConfiguration,
  ApiList,
  Chapter,
  ClassItem,
  Experiment,
  ExperimentVideoPoint,
  ExperimentVideoPointResource,
  ExperimentVideoPointsResponse,
  MediaAsset,
  PointAwareSuggestionResponse,
  Question,
  QuestionBankSummary,
  QuestionDraft,
  QuestionWorkbenchCandidate,
  QuestionWorkbenchSession,
  LearningAssistantAskRequest,
  LearningAssistantResponse,
  LearningAssistantRuntime,
  LearningAssistantSource,
  User,
} from "./api";

const { Header, Sider, Content } = Layout;
const { Text, Title } = Typography;
const sysuLogoSrc = `${import.meta.env.BASE_URL}sysu-logo.svg`;
const adminSiderWidth = 248;
const adminSiderCollapsedWidth = 72;
const navBrandTransition = { type: "tween" as const, duration: 0.16, ease: [0.22, 1, 0.36, 1] as const };
const LazyAssistantMarkdownContent = lazy(async () => {
  const module = await import("./lib/assistant-markdown");
  return { default: module.AssistantMarkdownContent };
});
const FeedbackPage = lazy(async () => {
  const module = await import("./features/feedback/FeedbackPage");
  return { default: module.FeedbackPage };
});
const SettingsPage = lazy(async () => {
  const module = await import("./features/settings/SettingsPage");
  return { default: module.SettingsPage };
});
const AIConfigurationPage = lazy(async () => {
  const module = await import("./features/ai-config/AIConfigurationPage");
  return { default: module.AIConfigurationPage };
});
const AnalyticsPage = lazy(async () => {
  const module = await import("./features/analytics/AnalyticsPage");
  return { default: module.AnalyticsPage };
});
const LearningResourcesPage = lazy(async () => {
  const module = await import("./features/resources/LearningResourcesPage");
  return { default: module.LearningResourcesPage };
});
const ClassesPage = lazy(async () => {
  const module = await import("./features/classes/ClassesPage");
  return { default: module.ClassesPage };
});
const VideoResourcesPage = lazy(async () => {
  const module = await import("./features/media/VideoResourcesPage");
  return { default: module.VideoResourcesPage };
});

function renderAssistantInlineMarkdown(text: string | null | undefined): ReactNode {
  return (
    <Suspense fallback={null}>
      <LazyAssistantMarkdownContent text={text} inline />
    </Suspense>
  );
}

function renderAssistantMarkdown(text: string | null | undefined): ReactNode {
  return (
    <Suspense fallback={null}>
      <LazyAssistantMarkdownContent text={text} />
    </Suspense>
  );
}

type LoginResponse = {
  access_token: string;
  user: User;
};

type QuestionFormValues = {
  experiment_id: string;
  question_type: "single_choice" | "true_false" | "fill_blank";
  stem: string;
  options_text?: string;
  answer_text: string;
  explanation?: string;
  difficulty?: string;
  status?: string;
};

type VideoPreviewTarget = {
  id: string;
  title: string;
  original_file_name: string;
  mime_type?: string | null;
  upload_status?: string | null;
};

type VideoPointFilter = "all" | "empty" | "referenced" | "published";

const navItems: Array<{ key: string; icon: ReactNode; label: string; adminOnly?: boolean }> = [
  { key: "/overview", icon: <BookOutlined />, label: "资源总览" },
  { key: "/classes", icon: <TeamOutlined />, label: "班级与学生" },
  { key: "/experiments", icon: <ExperimentOutlined />, label: "实验管理" },
  { key: "/videos", icon: <VideoCameraOutlined />, label: "视频资源" },
  { key: "/question-banks", icon: <QuestionCircleOutlined />, label: "题库管理" },
  { key: "/analytics", icon: <BarChartOutlined />, label: "学情分析" },
  { key: "/feedback", icon: <MessageOutlined />, label: "反馈管理" },
  { key: "/learning-assistant", icon: <SafetyCertificateOutlined />, label: "学习助手", adminOnly: true },
  { key: "/settings", icon: <SettingOutlined />, label: "系统设置" },
  { key: "/ai-config", icon: <ApiOutlined />, label: "AI接入" },
];

function formatDateTime(value?: string | null) {
  return value ? dayjs(value).format("YYYY-MM-DD HH:mm") : "-";
}

function questionTypeLabel(type?: string) {
  if (type === "single_choice") return "选择";
  if (type === "true_false") return "判断";
  if (type === "fill_blank") return "填空";
  return type || "-";
}

function coverageTagLabel(tag?: string) {
  const labels: Record<string, string> = {
    experiment_purpose: "实验目的",
    true_false: "判断题",
    single_choice: "选择题",
    fill_blank: "填空题",
    evidence_based: "证据题",
    diagnostic: "诊断题",
  };
  return labels[String(tag || "")] || String(tag || "-").replace(/_/g, " ");
}

function App() {
  return (
    <ConfigProvider
      theme={{
        algorithm: theme.defaultAlgorithm,
        token: {
          colorPrimary: "#005826",
          colorInfo: "#356f9c",
          colorSuccess: "#005826",
          colorWarning: "#b8892f",
          colorError: "#b42318",
          colorText: "#0d1f17",
          colorTextSecondary: "#697a72",
          colorBorder: "#dfe8e2",
          colorBorderSecondary: "#dfe8e2",
          colorBgLayout: "#f6f8f5",
          colorBgContainer: "#ffffff",
          borderRadius: 8,
          fontFamily: '"PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        },
        components: {
          Layout: {
            bodyBg: "#f6f8f5",
            headerBg: "#ffffff",
            siderBg: "#ffffff",
          },
          Button: {
            primaryShadow: "0 12px 24px rgba(0, 88, 38, 0.16)",
          },
          Card: {
            borderRadiusLG: 8,
          },
          Menu: {
            itemSelectedBg: "#e8f2ec",
            itemSelectedColor: "#005826",
            itemHoverBg: "#f6f9f7",
            itemHoverColor: "#005826",
          },
          Segmented: {
            itemSelectedBg: "#ffffff",
          },
          Table: {
            headerBg: "#f1f7f3",
            borderColor: "#dfe8e2",
            rowHoverBg: "#f6f9f7",
          },
        },
      }}
    >
      <AntApp>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/" element={<Navigate to="/overview" replace />} />
          <Route path="/curriculum" element={<Navigate to="/experiments" replace />} />
          <Route path="/review" element={<Navigate to="/question-banks" replace />} />
          <Route path="/*" element={<ProtectedShell />} />
        </Routes>
      </AntApp>
    </ConfigProvider>
  );
}

function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { message } = AntApp.useApp();
  const [form] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);
  const from = (location.state as { from?: string } | null)?.from || "/overview";

  const submit = async (values: { username: string; password: string }) => {
    setSubmitting(true);
    try {
      const response = await api<LoginResponse>("/api/auth/login", {
        method: "POST",
        body: JSON.stringify(values),
      });
      if (response.user.role === "student") {
        throw new Error("学生账号不能登录教师后台");
      }
      setAuthToken(response.access_token);
      message.success("登录成功");
      navigate(from, { replace: true });
    } catch (error) {
      message.error(errorMessage(error));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="login-page">
      <Card className="login-card">
        <Space direction="vertical" size={20} className="full">
          <div className="login-brand-lockup">
            <img src={sysuLogoSrc} alt="" />
            <div>
              <Text strong>中山大学</Text>
              <Text type="secondary" className="block-text">
                SYSU Chemistry Learning
              </Text>
            </div>
          </div>
          <div className="login-title">
            <Text className="eyebrow">Teacher Console</Text>
            <Title level={2}>无机化学实验学习后台</Title>
            <Text type="secondary" className="block-text">
              班级、资源、题库与学情分析管理
            </Text>
          </div>
          <Form form={form} layout="vertical" onFinish={submit} initialValues={{ username: "admin" }}>
            <Form.Item name="username" label="账号" rules={[{ required: true, message: "请输入账号" }]}>
              <Input size="large" autoComplete="username" />
            </Form.Item>
            <Form.Item name="password" label="密码" rules={[{ required: true, message: "请输入密码" }]}>
              <Input.Password size="large" autoComplete="current-password" />
            </Form.Item>
            <Button type="primary" size="large" htmlType="submit" loading={submitting} block>
              登录后台
            </Button>
          </Form>
        </Space>
      </Card>
    </div>
  );
}

function ProtectedShell() {
  const token = getAuthToken();
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const prefersReducedMotion = useReducedMotion();
  const [navCollapsed, setNavCollapsed] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem("admin-nav-collapsed") === "true";
  });
  const brandTransition = prefersReducedMotion ? { duration: 0 } : navBrandTransition;

  const meQuery = useQuery({
    queryKey: ["me", token],
    queryFn: () => api<User>("/api/auth/me"),
    enabled: Boolean(token),
    retry: false,
  });

  useEffect(() => {
    if (meQuery.isError) {
      setAuthToken("");
      navigate("/login", { replace: true, state: { from: location.pathname } });
    }
  }, [location.pathname, meQuery.isError, navigate]);

  useEffect(() => {
    window.localStorage.setItem("admin-nav-collapsed", String(navCollapsed));
  }, [navCollapsed]);

  if (!token) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }
  if (meQuery.isLoading || !meQuery.data) {
    return (
      <div className="center-screen">
        <Spin size="large" />
      </div>
    );
  }
  if (meQuery.data.role === "student") {
    return <Navigate to="/login" replace />;
  }
  if (meQuery.data.role !== "admin" && location.pathname.startsWith("/learning-assistant")) {
    return <Navigate to="/overview" replace />;
  }

  const visibleNavItems = navItems
    .filter((item) => !item.adminOnly || meQuery.data.role === "admin")
    .map(({ adminOnly, label, ...item }) => ({ ...item, label, title: label }));

  const logout = () => {
    setAuthToken("");
    queryClient.clear();
    navigate("/login", { replace: true });
  };

  return (
    <Layout className={`admin-shell ${navCollapsed ? "admin-shell-collapsed" : ""}`}>
      <Sider
        width={adminSiderWidth}
        collapsedWidth={adminSiderCollapsedWidth}
        collapsed={navCollapsed}
        trigger={null}
        className="admin-sider"
        onBreakpoint={(broken) => setNavCollapsed(broken)}
        breakpoint="lg"
      >
        <Tooltip title={navCollapsed ? "展开导航" : "收起导航"} placement="right">
          <button
            type="button"
            className="brand brand-toggle"
            aria-label={navCollapsed ? "展开导航" : "收起导航"}
            aria-expanded={!navCollapsed}
            onClick={() => setNavCollapsed((value) => !value)}
          >
            <motion.span
              className="brand-mark"
              animate={{ scale: 1 }}
              transition={brandTransition}
            >
              <img src={sysuLogoSrc} alt="" />
            </motion.span>
            <motion.span
              className="brand-copy"
              animate={{
                opacity: navCollapsed ? 0 : 1,
                x: navCollapsed ? -10 : 0,
              }}
              initial={false}
              transition={brandTransition}
            >
              <Text strong>中大实验学习后台</Text>
            </motion.span>
            <motion.span
              className="brand-arrow"
              aria-hidden="true"
              animate={{
                opacity: navCollapsed ? 0 : 1,
                x: navCollapsed ? -8 : 0,
                rotate: navCollapsed ? 180 : 0,
              }}
              initial={false}
              transition={brandTransition}
            >
              <LeftOutlined />
            </motion.span>
          </button>
        </Tooltip>
        <Menu
          mode="inline"
          inlineCollapsed={navCollapsed}
          selectedKeys={[visibleNavItems.find((item) => location.pathname.startsWith(item.key))?.key || "/overview"]}
          items={visibleNavItems}
          onClick={({ key }) => navigate(String(key))}
        />
      </Sider>
      <Layout className="admin-main">
        <Header className="admin-header">
          <div className="admin-header-left">
            <Space>
              <Badge status="success" />
              <Text>
                {meQuery.data.display_name} · {meQuery.data.role}
              </Text>
            </Space>
          </div>
          <Button icon={<LogoutOutlined />} onClick={logout}>
            退出
          </Button>
        </Header>
        <Content className="admin-content">
          <Routes>
            <Route
              path="/overview"
              element={
                <Suspense fallback={<div className="center-panel"><Spin /></div>}>
                  <LearningResourcesPage />
                </Suspense>
              }
            />
            <Route
              path="/classes"
              element={
                <Suspense fallback={<div className="center-panel"><Spin /></div>}>
                  <ClassesPage />
                </Suspense>
              }
            />
            <Route path="/experiments" element={<ExperimentsPage />} />
            <Route
              path="/videos"
              element={
                <Suspense fallback={<div className="center-panel"><Spin /></div>}>
                  <VideoResourcesPage />
                </Suspense>
              }
            />
            <Route path="/question-banks" element={<QuestionBanksPage />} />
            <Route
              path="/analytics"
              element={
                <Suspense fallback={<div className="center-panel"><Spin /></div>}>
                  <AnalyticsPage />
                </Suspense>
              }
            />
            <Route
              path="/feedback"
              element={
                <Suspense fallback={<div className="center-panel"><Spin /></div>}>
                  <FeedbackPage />
                </Suspense>
              }
            />
            <Route path="/learning-assistant" element={<LearningAssistantPage />} />
            <Route
              path="/settings"
              element={
                <Suspense fallback={<div className="center-panel"><Spin /></div>}>
                  <SettingsPage />
                </Suspense>
              }
            />
            <Route
              path="/ai-config"
              element={
                <Suspense fallback={<div className="center-panel"><Spin /></div>}>
                  <AIConfigurationPage />
                </Suspense>
              }
            />
            <Route path="*" element={<Navigate to="/overview" replace />} />
          </Routes>
        </Content>
      </Layout>
    </Layout>
  );
}

function useChapters() {
  return useQuery({ queryKey: ["chapters"], queryFn: () => api<Chapter[]>("/api/chapters") });
}

function useExperiments(params = "") {
  return useQuery({
    queryKey: ["admin-experiments", params],
    queryFn: () => api<ApiList<Experiment>>(`/api/admin/experiments${params}`),
  });
}

function OverviewPage() {
  const classes = useQuery({ queryKey: ["classes"], queryFn: () => api<ClassItem[]>("/api/admin/classes") });
  const experiments = useExperiments();
  const banks = useQuery({
    queryKey: ["question-banks"],
    queryFn: () => api<ApiList<QuestionBankSummary>>("/api/admin/question-banks"),
  });
  const firstClassId = classes.data?.[0]?.id;
  const dashboard = useQuery({
    queryKey: ["class-dashboard", firstClassId],
    queryFn: () => api<AnalyticsDashboard>(`/api/admin/analytics/classes/${firstClassId}/dashboard`),
    enabled: Boolean(firstClassId),
  });

  const publishedQuestions = (banks.data?.items || []).reduce(
    (sum, item) => sum + item.banks.reduce((inner, bank) => inner + Number(bank.published_count || 0), 0),
    0,
  );

  return (
    <Space direction="vertical" size={18} className="full">
      <PageTitle title="总览" description="以精选目录中的具体实验点为核心的教学运营状态。" />
      <div className="stat-grid">
        <Card>
          <Statistic title="正式实验" value={experiments.data?.items.length || 0} prefix={<ExperimentOutlined />} />
        </Card>
        <Card>
          <Statistic title="班级" value={classes.data?.length || 0} prefix={<TeamOutlined />} />
        </Card>
        <Card>
          <Statistic title="已发布题目" value={publishedQuestions} prefix={<DatabaseOutlined />} />
        </Card>
        <Card>
          <Statistic title="班级完成率" value={dashboard.data?.metrics.completion_rate || 0} suffix="%" prefix={<CheckCircleOutlined />} />
        </Card>
      </div>
      <Card title="实验目录状态">
        <QueryState loading={experiments.isLoading} error={experiments.error} empty={!experiments.data?.items.length}>
          <Table
            rowKey="id"
            size="middle"
            pagination={false}
            dataSource={experiments.data?.items || []}
            columns={[
              { title: "实验", dataIndex: "title", render: (_: unknown, row: Experiment) => <Text strong>{row.title}</Text> },
              { title: "编号", dataIndex: "code", width: 90 },
              {
                title: "章节",
                render: (_: unknown, row: Experiment) => (
                <Space wrap>
                  {row.chapter_bindings.map((binding) => (
                    <Tag key={binding.chapter_id}>{formatChapterTitle(binding.chapter_title, binding.chapter_id)}</Tag>
                  ))}
                </Space>
              ),
              },
              { title: "视频", width: 120, render: (_: unknown, row: Experiment) => row.media_resources.length },
              { title: "发布题", width: 120, dataIndex: "published_question_count" },
              { title: "状态", width: 110, render: (_: unknown, row: Experiment) => statusTag(row.status) },
            ]}
          />
        </QueryState>
      </Card>
    </Space>
  );
}

function ExperimentsPage() {
  const { message } = AntApp.useApp();
  const queryClient = useQueryClient();
  const chapters = useChapters();
  const [experimentKeyword, setExperimentKeyword] = useState("");
  const [chapterId, setChapterId] = useState<string>();
  const [statusFilter, setStatusFilter] = useState<string>();
  const [selected, setSelected] = useState<Experiment | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [form] = Form.useForm();
  const [createForm] = Form.useForm();
  const [videoPointFilter, setVideoPointFilter] = useState<VideoPointFilter>("all");
  const [referencePoint, setReferencePoint] = useState<ExperimentVideoPoint | null>(null);
  const [assetKeyword, setAssetKeyword] = useState("");
  const [selectedAssetIds, setSelectedAssetIds] = useState<string[]>([]);
  const [previewTarget, setPreviewTarget] = useState<VideoPreviewTarget | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string>();
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState("");
  const [pendingVideoBindingAction, setPendingVideoBindingAction] = useState<{
    bindingId: string;
    action: "publish" | "unpublish" | "delete";
  } | null>(null);
  const searchParams = new URLSearchParams();
  if (chapterId) searchParams.set("chapter_id", chapterId);
  if (statusFilter) searchParams.set("status_filter", statusFilter);
  const params = searchParams.toString() ? `?${searchParams.toString()}` : "";
  const experiments = useExperiments(params);
  const selectedExperiment = useQuery({
    queryKey: ["admin-experiment", selected?.id],
    queryFn: () => api<Experiment>(`/api/admin/experiments/${selected?.id}`),
    enabled: Boolean(selected?.id),
  });
  const currentExperiment = selectedExperiment.data || selected;
  const currentExperimentId = currentExperiment?.id;
  const experimentVideoPoints = useQuery({
    queryKey: ["experiment-video-points", currentExperimentId],
    queryFn: () => api<ExperimentVideoPointsResponse>(`/api/admin/experiments/${currentExperimentId}/video-points`),
    enabled: Boolean(currentExperimentId),
  });
  const mediaAssets = useQuery({
    queryKey: ["media-assets"],
    queryFn: () => api<ApiList<MediaAsset>>("/api/admin/media/assets?limit=200"),
    enabled: Boolean(referencePoint),
  });
  const currentMetadata = (currentExperiment?.metadata || {}) as Record<string, unknown>;
  const videoCandidates = experimentVideoCandidates(currentExperiment);
  const videoPointItems = useMemo(() => experimentVideoPoints.data?.points || [], [experimentVideoPoints.data?.points]);
  const parentTitle = typeof currentMetadata.parent_title === "string" ? currentMetadata.parent_title : "";
  const moduleTitle = typeof currentMetadata.module_display_title === "string" ? currentMetadata.module_display_title : "";
  const videoPointCount = experimentVideoPoints.data?.total_points ?? videoCandidates.length;
  const resourceCount = experimentVideoPoints.data?.total_resources ?? currentExperiment?.media_resources.length ?? 0;
  const publishedResourceCount =
    experimentVideoPoints.data?.published_resources ??
    currentExperiment?.media_resources.filter((resource) => resource.binding_status === "published").length ??
    0;
  const referencedAssetIds = useMemo(
    () => new Set(videoPointItems.flatMap((point) => point.resources.map((resource) => resource.media_id))),
    [videoPointItems],
  );
  const currentPointAssetIds = useMemo(
    () => new Set(referencePoint?.resources.map((resource) => resource.media_id) || []),
    [referencePoint?.resources],
  );
  const referenceAssets = useMemo(() => mediaAssets.data?.items || [], [mediaAssets.data?.items]);
  const referenceAssetMap = useMemo(() => new Map(referenceAssets.map((asset) => [asset.id, asset])), [referenceAssets]);
  const filteredReferenceAssets = useMemo(() => {
    const keyword = assetKeyword.trim().toLowerCase();
    return referenceAssets.filter((asset) => {
      if (!keyword) return true;
      return `${asset.title} ${asset.original_file_name}`.toLowerCase().includes(keyword);
    });
  }, [assetKeyword, referenceAssets]);
  const filteredVideoPoints = useMemo(() => {
    if (videoPointFilter === "empty") return videoPointItems.filter((point) => point.resource_count === 0);
    if (videoPointFilter === "referenced") return videoPointItems.filter((point) => point.resource_count > 0);
    if (videoPointFilter === "published") return videoPointItems.filter((point) => point.published_count > 0);
    return videoPointItems;
  }, [videoPointFilter, videoPointItems]);

  useEffect(() => {
    if (currentExperiment) {
      form.setFieldsValue({
        title: currentExperiment.title,
        summary: currentExperiment.summary,
        status: currentExperiment.status,
        chapter_ids: currentExperiment.chapter_bindings.map((item) => item.chapter_id),
      });
    }
  }, [currentExperiment, form]);

  useEffect(() => {
    setVideoPointFilter("all");
    setReferencePoint(null);
    setAssetKeyword("");
    setSelectedAssetIds([]);
    setPreviewTarget(null);
    setPendingVideoBindingAction(null);
  }, [selected?.id]);

  useEffect(() => {
    setSelectedAssetIds([]);
    setAssetKeyword("");
  }, [referencePoint?.point_key]);

  useEffect(() => {
    let objectUrl: string | undefined;
    let cancelled = false;
    setPreviewUrl(undefined);
    setPreviewError("");
    setPreviewLoading(false);
    if (!previewTarget || previewTarget.upload_status !== "ready") {
      return undefined;
    }
    setPreviewLoading(true);
    const headers = new Headers();
    const token = getAuthToken();
    if (token) {
      headers.set("Authorization", `Bearer ${token}`);
    }
    void fetch(`${apiBase}/api/admin/media/assets/${previewTarget.id}/file`, { headers })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(response.status === 409 ? "视频还未就绪，暂不能预览" : "视频预览加载失败");
        }
        return response.blob();
      })
      .then((blob) => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setPreviewUrl(objectUrl);
      })
      .catch((error) => {
        if (!cancelled) setPreviewError(errorMessage(error));
      })
      .finally(() => {
        if (!cancelled) setPreviewLoading(false);
      });
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [previewTarget]);

  const invalidateExperimentData = (experimentId?: string) => {
    void queryClient.invalidateQueries({ queryKey: ["admin-experiments"] });
    void queryClient.invalidateQueries({ queryKey: ["question-banks"] });
    if (experimentId) {
      void queryClient.invalidateQueries({ queryKey: ["admin-experiment", experimentId] });
    }
  };

  const invalidateVideoReferenceData = (experimentId?: string) => {
    invalidateExperimentData(experimentId);
    if (experimentId) {
      void queryClient.invalidateQueries({ queryKey: ["experiment-video-points", experimentId] });
    }
    void queryClient.invalidateQueries({ queryKey: ["media-assets"] });
  };

  const createExperiment = useMutation({
    mutationFn: (values: { title: string; summary?: string; status: string; chapter_ids: string[] }) =>
      postJson<Experiment>("/api/admin/experiments", {
        title: values.title,
        summary: values.summary,
        status: values.status || "draft",
        chapter_ids: values.chapter_ids || [],
      }),
    onSuccess: (experiment) => {
      message.success("实验已创建");
      setCreateOpen(false);
      createForm.resetFields();
      setSelected(experiment);
      invalidateExperimentData(experiment.id);
    },
    onError: (error) => message.error(errorMessage(error)),
  });
  const submitCreateExperiment = async (status: "draft" | "published") => {
    try {
      const values = await createForm.validateFields();
      createExperiment.mutate({ ...values, status });
    } catch {
      // Ant Design will surface field validation messages beside the inputs.
    }
  };

  const save = useMutation({
    mutationFn: (values: { title: string; summary?: string; status: string; chapter_ids: string[] }) =>
      patchJson<Experiment>(`/api/admin/experiments/${currentExperiment?.id}`, {
        title: values.title,
        summary: values.summary,
        status: values.status,
        chapter_ids: values.chapter_ids || [],
      }),
    onSuccess: (experiment) => {
      message.success("实验已保存");
      setSelected(experiment);
      invalidateExperimentData(experiment.id);
    },
    onError: (error) => message.error(errorMessage(error)),
  });

  const addPointResources = useMutation({
    mutationFn: async () => {
      if (!currentExperimentId || !referencePoint) {
        throw new Error("请选择实验点位");
      }
      if (!selectedAssetIds.length) {
        throw new Error("请选择要引用的视频资源");
      }
      return Promise.all(
        selectedAssetIds.map((assetId) => {
          const asset = referenceAssetMap.get(assetId);
          return postJson<Record<string, unknown>>(
            `/api/admin/experiments/${currentExperimentId}/video-points/${encodeURIComponent(referencePoint.point_key)}/resources`,
            {
              media_asset_id: assetId,
              title: asset?.title || referencePoint.point_title,
              status: "draft",
            },
          );
        }),
      );
    },
    onSuccess: () => {
      message.success("视频已引用到点位");
      const experimentId = currentExperimentId;
      setReferencePoint(null);
      setSelectedAssetIds([]);
      setAssetKeyword("");
      invalidateVideoReferenceData(experimentId);
    },
    onError: (error) => message.error(errorMessage(error)),
  });

  const publishPointResource = useMutation({
    mutationFn: (resource: ExperimentVideoPointResource) =>
      postJson<Record<string, unknown>>(`/api/admin/media/bindings/${resource.binding_id}/publish`, {}),
    onMutate: (resource) => {
      setPendingVideoBindingAction({ bindingId: resource.binding_id, action: "publish" });
    },
    onSuccess: (_, resource) => {
      message.success("视频引用已发布");
      invalidateVideoReferenceData(resource.experiment_id);
    },
    onError: (error) => message.error(errorMessage(error)),
    onSettled: () => setPendingVideoBindingAction(null),
  });

  const unpublishPointResource = useMutation({
    mutationFn: (resource: ExperimentVideoPointResource) =>
      postJson<Record<string, unknown>>(`/api/admin/media/bindings/${resource.binding_id}/unpublish`, {}),
    onMutate: (resource) => {
      setPendingVideoBindingAction({ bindingId: resource.binding_id, action: "unpublish" });
    },
    onSuccess: (_, resource) => {
      message.success("视频引用已取消发布");
      invalidateVideoReferenceData(resource.experiment_id);
    },
    onError: (error) => message.error(errorMessage(error)),
    onSettled: () => setPendingVideoBindingAction(null),
  });

  const deletePointResource = useMutation({
    mutationFn: (resource: ExperimentVideoPointResource) =>
      api<Record<string, unknown>>(`/api/admin/media/bindings/${resource.binding_id}`, { method: "DELETE" }),
    onMutate: (resource) => {
      setPendingVideoBindingAction({ bindingId: resource.binding_id, action: "delete" });
    },
    onSuccess: (_, resource) => {
      message.success("视频引用已移除");
      invalidateVideoReferenceData(resource.experiment_id);
    },
    onError: (error) => message.error(errorMessage(error)),
    onSettled: () => setPendingVideoBindingAction(null),
  });

  const isVideoBindingActionPending = (resource: ExperimentVideoPointResource, action: "publish" | "unpublish" | "delete") =>
    pendingVideoBindingAction?.bindingId === resource.binding_id && pendingVideoBindingAction.action === action;
  const isVideoBindingBusy = (resource: ExperimentVideoPointResource) => pendingVideoBindingAction?.bindingId === resource.binding_id;

  const chapterTitleById = useMemo(() => {
    const values = new Map(theoryChapters.map((chapter) => [chapter.chapter_id, formatChapterTitle(chapter.chapter_title, chapter.chapter_id)]));
    (chapters.data || []).forEach((chapter) => {
      values.set(chapter.chapter_id, formatChapterTitle(chapter.chapter_title, chapter.chapter_id));
    });
    return values;
  }, [chapters.data]);
  const chapterOptions = (chapters.data || []).map((chapter) => ({
    value: chapter.chapter_id,
    label: formatChapterTitle(chapter.chapter_title, chapter.chapter_id),
  }));
  const scopedExperiments = experiments.data?.items || [];
  const filteredExperiments = useMemo(() => {
    const keyword = experimentKeyword.trim().toLowerCase();
    if (!keyword) return scopedExperiments;
    return scopedExperiments.filter((experiment) => experiment.title.toLowerCase().includes(keyword));
  }, [experimentKeyword, scopedExperiments]);
  const statusSummary = useMemo(
    () =>
      scopedExperiments.reduce(
        (summary, experiment) => {
          summary.total += 1;
          if (experiment.status === "draft") summary.draft += 1;
          if (experiment.status === "published") summary.published += 1;
          if (experiment.status === "archived") summary.archived += 1;
          return summary;
        },
        { total: 0, draft: 0, published: 0, archived: 0 },
      ),
    [scopedExperiments],
  );
  const hasFilters = Boolean(experimentKeyword || chapterId || statusFilter);

  return (
    <Space direction="vertical" size={18} className="full">
      <PageTitle
        title="实验管理"
        description="管理实验元信息、理论章节与发布状态；视频素材库作为独立模块维护。"
        extra={
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateOpen(true)}>
            新建实验
          </Button>
        }
      />
      <Card className="toolbar-card">
        <Space direction="vertical" size={14} className="full">
          <Flex justify="space-between" align="center" gap={14} wrap="wrap">
            <Space size={12} wrap className="experiment-filter-controls">
              <Text className="filter-group-label">筛选范围</Text>
              <Select
                allowClear
                placeholder="全部章节"
                style={{ width: 300 }}
                value={chapterId}
                onChange={setChapterId}
                options={chapterOptions}
              />
              <Select
                allowClear
                placeholder="全部状态"
                style={{ width: 160 }}
                value={statusFilter}
                onChange={setStatusFilter}
                options={[
                  { value: "draft", label: "草稿" },
                  { value: "published", label: "已发布" },
                  { value: "archived", label: "已归档" },
                ]}
              />
            </Space>
            <Input.Search
              allowClear
              placeholder="搜索实验名称"
              value={experimentKeyword}
              onChange={(event) => setExperimentKeyword(event.target.value)}
              style={{ width: 320 }}
            />
          </Flex>
          <Flex justify="space-between" align="center" gap={14} wrap="wrap">
            <Space size={8} wrap className="experiment-filter-summary">
              {experiments.isLoading ? (
                <Text type="secondary">正在加载实验...</Text>
              ) : (
                <>
                  <Text type="secondary">当前范围共 {statusSummary.total} 个实验</Text>
                  <Tag>草稿 {statusSummary.draft}</Tag>
                  <Tag color="green">已发布 {statusSummary.published}</Tag>
                  <Tag>已归档 {statusSummary.archived}</Tag>
                  {experimentKeyword.trim() ? <Tag color="blue">搜索结果 {filteredExperiments.length}</Tag> : null}
                </>
              )}
            </Space>
            <Button
              disabled={!hasFilters}
              onClick={() => {
                setExperimentKeyword("");
                setChapterId(undefined);
                setStatusFilter(undefined);
              }}
            >
              重置筛选
            </Button>
          </Flex>
        </Space>
      </Card>
      <Card>
        <QueryState loading={experiments.isLoading} error={experiments.error} empty={!filteredExperiments.length}>
          <Table
            rowKey="id"
            dataSource={filteredExperiments}
            columns={[
              { title: "序号", dataIndex: "display_order", width: 88 },
              {
                title: "实验",
                render: (_: unknown, row: Experiment) => (
                  <Space direction="vertical" size={2}>
                    <Text strong>{row.title}</Text>
                    <Text type="secondary">{row.summary}</Text>
                  </Space>
                ),
              },
              {
                title: "理论章节",
                render: (_: unknown, row: Experiment) => (
                  <Space wrap>
                    {row.chapter_bindings.map((binding) => (
                      <Tag key={binding.chapter_id}>
                        {formatChapterTitle(binding.chapter_title || chapterTitleById.get(binding.chapter_id), binding.chapter_id)}
                      </Tag>
                    ))}
                  </Space>
                ),
              },
              {
                title: "资源",
                width: 170,
                render: (_: unknown, row: Experiment) => (
                  <Space size={6} wrap>
                    <Tag>点位 {experimentVideoCandidates(row).length}</Tag>
                    <Tag color={row.media_resources.length ? "#356f9c" : "default"}>视频 {row.media_resources.length}</Tag>
                  </Space>
                ),
              },
              { title: "状态", width: 110, render: (_: unknown, row: Experiment) => statusTag(row.status) },
              {
                title: "操作",
                width: 90,
                render: (_: unknown, row: Experiment) => (
                  <Button onClick={() => setSelected(row)}>编辑</Button>
                ),
              },
            ]}
          />
        </QueryState>
      </Card>
      <Drawer
        title={currentExperiment ? `编辑实验：${currentExperiment.title}` : "编辑实验"}
        open={Boolean(selected)}
        onClose={() => setSelected(null)}
        width={1180}
        className="experiment-editor-drawer"
      >
        <QueryState loading={selectedExperiment.isLoading} error={selectedExperiment.error} empty={!currentExperiment}>
          <Space direction="vertical" size={16} className="full">
            {currentExperiment ? (
              <div className="experiment-editor-summary">
                <Flex justify="space-between" gap={18} wrap="wrap" align="center">
                  <div className="experiment-editor-summary-main">
                    <Space size={8} wrap>
                      {statusTag(currentExperiment.status)}
                      {currentExperiment.chapter_bindings.slice(0, 3).map((binding) => (
                        <Tag key={binding.chapter_id}>
                          {formatChapterTitle(binding.chapter_title || chapterTitleById.get(binding.chapter_id), binding.chapter_id)}
                        </Tag>
                      ))}
                    </Space>
                    <Title level={4}>{currentExperiment.title}</Title>
                    <Text type="secondary">{currentExperiment.summary || "暂无实验说明"}</Text>
                  </div>
                  <div className="experiment-editor-metrics">
                    <Statistic title="视频点位" value={videoPointCount} />
                    <Statistic title="关联资源" value={resourceCount} />
                    <Statistic title="已发布" value={publishedResourceCount} />
                  </div>
                </Flex>
              </div>
            ) : null}

            <div className="experiment-editor-grid">
              <Space direction="vertical" size={16} className="full">
                <Card title="基础信息" className="experiment-basic-card">
                  <Form form={form} layout="vertical" onFinish={(values) => save.mutate(values)}>
                    <Form.Item name="title" label="实验名称" rules={[{ required: true, message: "请输入实验名称" }]}>
                      <Input />
                    </Form.Item>
                    <Form.Item name="summary" label="实验说明">
                      <Input.TextArea rows={4} maxLength={300} showCount className="fixed-textarea" />
                    </Form.Item>
                    <div className="compact-form-grid">
                      <Form.Item name="status" label="发布状态" rules={[{ required: true }]}>
                        <Select
                          options={[
                            { value: "draft", label: "草稿" },
                            { value: "published", label: "已发布" },
                            { value: "archived", label: "已归档" },
                          ]}
                        />
                      </Form.Item>
                      <Form.Item name="chapter_ids" label="理论章节" rules={[{ required: true, message: "请选择至少一个章节" }]}>
                        <Select mode="multiple" options={chapterOptions} placeholder="选择章节" maxTagCount="responsive" />
                      </Form.Item>
                    </div>
                    <Button type="primary" htmlType="submit" loading={save.isPending}>
                      保存实验信息
                    </Button>
                  </Form>
                </Card>

                <Card title="来源上下文" className="experiment-context-card">
                  {parentTitle || moduleTitle ? (
                    <Descriptions
                      size="small"
                      column={1}
                      items={[
                        ...(parentTitle ? [{ key: "parent", label: "来源大类", children: parentTitle }] : []),
                        ...(moduleTitle ? [{ key: "module", label: "目录模块", children: moduleTitle }] : []),
                      ]}
                    />
                  ) : (
                    <Text type="secondary">暂无来源上下文</Text>
                  )}
                </Card>
              </Space>

              <Card
                title={
                  <Flex justify="space-between" align="center" gap={12} wrap="wrap">
                    <span>点位视频引用</span>
                    <Space size={6} wrap>
                      <Tag>点位 {videoPointCount}</Tag>
                      <Tag color={resourceCount ? "blue" : "default"}>已引用 {resourceCount}</Tag>
                      <Tag color={publishedResourceCount ? "green" : "default"}>已发布 {publishedResourceCount}</Tag>
                    </Space>
                  </Flex>
                }
                className="video-reference-card"
              >
                <Space direction="vertical" size={14} className="full">
                  <Flex justify="space-between" align="center" gap={12} wrap="wrap" className="video-reference-toolbar">
                    <Segmented
                      value={videoPointFilter}
                      onChange={(value) => setVideoPointFilter(value as VideoPointFilter)}
                      options={[
                        { value: "all", label: "全部" },
                        { value: "empty", label: "未引用" },
                        { value: "referenced", label: "已引用" },
                        { value: "published", label: "已发布" },
                      ]}
                    />
                    <Text type="secondary">从视频资源库选择已上传视频，引用到具体候选点。</Text>
                  </Flex>

                  {experimentVideoPoints.isLoading ? (
                    <div className="center-panel">
                      <Spin />
                    </div>
                  ) : experimentVideoPoints.error ? (
                    <Alert type="error" showIcon title="点位视频加载失败" description={errorMessage(experimentVideoPoints.error)} />
                  ) : !videoPointItems.length ? (
                    <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无候选视频点位" />
                  ) : !filteredVideoPoints.length ? (
                    <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="当前筛选下没有点位" />
                  ) : (
                    <div className="video-point-list">
                      {filteredVideoPoints.map((point) => {
                        const pointIndex = videoPointItems.findIndex((item) => item.point_key === point.point_key) + 1;
                        return (
                          <div className="video-point-card" key={point.point_key}>
                            <Flex justify="space-between" align="start" gap={12} wrap="wrap" className="video-point-header">
                              <Space size={12} align="start" className="video-point-heading">
                                <span className="video-point-index">{pointIndex}</span>
                                <div className="video-point-title">
                                  <Text strong>{point.point_title}</Text>
                                  <Space size={6} wrap>
                                    <Tag color={point.resource_count ? "blue" : "default"}>已引用 {point.resource_count}</Tag>
                                    <Tag color={point.published_count ? "green" : "default"}>已发布 {point.published_count}</Tag>
                                  </Space>
                                </div>
                              </Space>
                              <Button type={point.resource_count ? "default" : "primary"} icon={<PlusOutlined />} onClick={() => setReferencePoint(point)}>
                                引用视频
                              </Button>
                            </Flex>

                            {point.resources.length ? (
                              <div className="video-point-resources">
                                {point.resources.map((resource) => {
                                  const resourceTitle =
                                    resource.media_title || resource.title || resource.binding_title || resource.original_file_name;
                                  const thumbnailSrc = resource.thumbnail_relative_path
                                    ? `${apiBase}/api/admin/media/assets/${resource.media_id}/thumbnail`
                                    : null;
                                  const resourceBusy = isVideoBindingBusy(resource);
                                  const openResourcePreview = () =>
                                    setPreviewTarget({
                                      id: resource.media_id,
                                      title: resource.media_title || resourceTitle,
                                      original_file_name: resource.original_file_name,
                                      mime_type: resource.mime_type,
                                      upload_status: resource.upload_status,
                                    });
                                  return (
                                  <div className="video-point-resource" key={resource.binding_id}>
                                    <button
                                      type="button"
                                      className={thumbnailSrc ? "video-resource-thumb has-image" : "video-resource-thumb"}
                                      disabled={resource.upload_status !== "ready"}
                                      aria-label={`预览视频：${resourceTitle}`}
                                      title={resource.upload_status === "ready" ? "预览视频" : "视频未就绪，暂不能预览"}
                                      onClick={openResourcePreview}
                                    >
                                      <AuthenticatedImage src={thumbnailSrc} alt={resourceTitle} className="video-resource-thumb-image" />
                                      <div className="video-resource-thumb-fallback">
                                        <VideoCameraOutlined />
                                      </div>
                                      {resource.upload_status === "ready" ? (
                                        <span className="video-resource-thumb-play">
                                          <PlayCircleOutlined />
                                        </span>
                                      ) : null}
                                    </button>
                                    <div className="video-point-resource-main">
                                      <Text strong className="video-point-resource-title">
                                        {resourceTitle}
                                      </Text>
                                      <Text type="secondary" className="video-point-resource-file">
                                        {resource.original_file_name}
                                      </Text>
                                      <Space size={6} wrap>
                                        {statusTag(resource.upload_status)}
                                        {statusTag(resource.binding_status)}
                                        <Text type="secondary">{formatBytes(resource.file_size_bytes)}</Text>
                                      </Space>
                                    </div>
                                    <Space size={8} wrap className="video-point-resource-actions">
                                      {resource.binding_status === "published" ? (
                                        <Button
                                          size="small"
                                          icon={<PauseCircleOutlined />}
                                          disabled={resourceBusy}
                                          loading={isVideoBindingActionPending(resource, "unpublish")}
                                          onClick={() => unpublishPointResource.mutate(resource)}
                                        >
                                          取消发布
                                        </Button>
                                      ) : (
                                        <Button
                                          size="small"
                                          type="primary"
                                          icon={<CheckCircleOutlined />}
                                          disabled={resource.upload_status !== "ready" || resourceBusy}
                                          loading={isVideoBindingActionPending(resource, "publish")}
                                          onClick={() => publishPointResource.mutate(resource)}
                                        >
                                          发布引用
                                        </Button>
                                      )}
                                      <Popconfirm
                                        title="移除视频引用？"
                                        description="只删除本实验点位和该视频的引用关系，不删除视频资源库素材。"
                                        okText="移除"
                                        cancelText="取消"
                                        okButtonProps={{ danger: true }}
                                        onConfirm={() => deletePointResource.mutate(resource)}
                                      >
                                        <Button
                                          size="small"
                                          danger
                                          icon={<DeleteOutlined />}
                                          disabled={resourceBusy}
                                          loading={isVideoBindingActionPending(resource, "delete")}
                                        >
                                          移除引用
                                        </Button>
                                      </Popconfirm>
                                    </Space>
                                  </div>
                                  );
                                })}
                              </div>
                            ) : (
                              <button type="button" className="video-point-empty" onClick={() => setReferencePoint(point)}>
                                <PlusOutlined />
                                <span>还没有引用视频</span>
                                <Text type="secondary">点击从视频资源库选择素材</Text>
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </Space>
              </Card>
            </div>
          </Space>
        </QueryState>
      </Drawer>

      <Modal
        title={referencePoint ? `为「${referencePoint.point_title}」引用视频` : "引用视频"}
        open={Boolean(referencePoint)}
        width={980}
        onCancel={() => setReferencePoint(null)}
        footer={[
          <Button key="cancel" onClick={() => setReferencePoint(null)}>
            取消
          </Button>,
          <Button
            key="save"
            type="primary"
            loading={addPointResources.isPending}
            disabled={!selectedAssetIds.length}
            onClick={() => addPointResources.mutate()}
          >
            保存引用
          </Button>,
        ]}
      >
        <Space direction="vertical" size={14} className="full">
          <Alert
            type="info"
            showIcon
            message="这里不会上传新视频，只从视频资源库引用已上传素材。保存后默认是草稿引用，需要发布后学生端才可见。"
          />
          <Flex justify="space-between" align="center" gap={12} wrap="wrap">
            <Input.Search
              allowClear
              placeholder="搜索视频标题或文件名"
              value={assetKeyword}
              onChange={(event) => setAssetKeyword(event.target.value)}
              style={{ width: 360 }}
            />
            <Text type="secondary">已选择 {selectedAssetIds.length} 个视频</Text>
          </Flex>
          <QueryState loading={mediaAssets.isLoading} error={mediaAssets.error} empty={!referenceAssets.length}>
            <Table
              rowKey="id"
              dataSource={filteredReferenceAssets}
              pagination={{ pageSize: 6, showSizeChanger: false }}
              rowSelection={{
                selectedRowKeys: selectedAssetIds,
                onChange: (keys) => setSelectedAssetIds(keys.map(String)),
                getCheckboxProps: (asset: MediaAsset) => ({
                  disabled: !isPreviewableVideo(asset) || referencedAssetIds.has(asset.id),
                }),
              }}
              columns={[
                {
                  title: "视频资源",
                  render: (_: unknown, asset: MediaAsset) => (
                    <Space size={10} align="start" className="video-asset-name">
                      <div className="video-file-mark">
                        <VideoCameraOutlined />
                      </div>
                      <Space direction="vertical" size={1}>
                        <Text strong>{asset.title}</Text>
                        <Text type="secondary">{asset.original_file_name}</Text>
                      </Space>
                    </Space>
                  ),
                },
                { title: "类型", width: 90, render: (_: unknown, asset: MediaAsset) => mediaAssetType(asset) },
                { title: "大小", width: 100, render: (_: unknown, asset: MediaAsset) => formatBytes(asset.file_size_bytes) },
                { title: "状态", width: 100, render: (_: unknown, asset: MediaAsset) => statusTag(asset.upload_status) },
                {
                  title: "引用状态",
                  width: 130,
                  render: (_: unknown, asset: MediaAsset) => {
                    if (currentPointAssetIds.has(asset.id)) return <Tag color="green">已在此点位</Tag>;
                    if (referencedAssetIds.has(asset.id)) return <Tag>已被本实验引用</Tag>;
                    if (!isPreviewableVideo(asset)) return <Tag>不可引用</Tag>;
                    return <Tag color="blue">可引用</Tag>;
                  },
                },
                {
                  title: "操作",
                  width: 100,
                  render: (_: unknown, asset: MediaAsset) => (
                    <Button
                      size="small"
                      icon={<EyeOutlined />}
                      disabled={!isPreviewableVideo(asset)}
                      onClick={() =>
                        setPreviewTarget({
                          id: asset.id,
                          title: asset.title,
                          original_file_name: asset.original_file_name,
                          mime_type: asset.mime_type,
                          upload_status: asset.upload_status,
                        })
                      }
                    >
                      预览
                    </Button>
                  ),
                },
              ]}
            />
          </QueryState>
        </Space>
      </Modal>

      <Modal
        title={previewTarget?.title || "视频预览"}
        open={Boolean(previewTarget)}
        width={860}
        footer={null}
        onCancel={() => setPreviewTarget(null)}
      >
        <Space direction="vertical" size={14} className="full">
          <Text type="secondary">{previewTarget?.original_file_name}</Text>
          <div className="experiment-video-preview-stage">
            {previewLoading ? (
              <Spin />
            ) : previewError ? (
              <Alert type="error" showIcon title="预览失败" description={previewError} />
            ) : previewUrl ? (
              <video src={previewUrl} controls className="video-preview-player" />
            ) : (
              <Text type="secondary">正在准备预览...</Text>
            )}
          </div>
        </Space>
      </Modal>

      <Modal
        title="新建实验"
        open={createOpen}
        onCancel={() => setCreateOpen(false)}
        footer={[
          <Button key="cancel" onClick={() => setCreateOpen(false)}>
            取消
          </Button>,
          <Button key="draft" loading={createExperiment.isPending} onClick={() => void submitCreateExperiment("draft")}>
            保存为草稿
          </Button>,
          <Button key="publish" type="primary" loading={createExperiment.isPending} onClick={() => void submitCreateExperiment("published")}>
            保存并发布
          </Button>,
        ]}
      >
        <Text type="secondary" className="modal-helper">
          填写实验名称和说明，并选择它要显示在哪些理论章节下。
        </Text>
        <Form form={createForm} layout="vertical">
          <Form.Item name="title" label="实验名称" rules={[{ required: true, message: "请输入实验名称" }]}>
            <Input placeholder="例如：氯、溴、碘的置换次序" />
          </Form.Item>
          <Form.Item name="summary" label="实验说明">
            <Input.TextArea rows={3} maxLength={300} showCount className="fixed-textarea" />
          </Form.Item>
          <Form.Item name="chapter_ids" label="理论章节" rules={[{ required: true, message: "请选择至少一个章节" }]}>
            <Select mode="multiple" options={chapterOptions} placeholder="选择章节" />
          </Form.Item>
        </Form>
      </Modal>
    </Space>
  );
}

function answerText(answer?: Record<string, unknown>) {
  if (!answer) return "-";
  if (Array.isArray(answer.accepted_answers)) return answer.accepted_answers.map(String).join("，");
  if (answer.value !== undefined) {
    if (typeof answer.value === "boolean") return answer.value ? "正确" : "错误";
    return String(answer.value);
  }
  return JSON.stringify(answer);
}

function sourceRefLabel(ref: Record<string, unknown>) {
  const file = String(ref.source_file || "资料片段");
  const page = ref.page_number ? ` p.${ref.page_number}` : "";
  const section = ref.section_title ? ` · ${ref.section_title}` : "";
  return `${file}${page}${section}`;
}

function questionPoints(question: Question) {
  const points = question.metadata?.primary_points || [];
  if (points.length) {
    return points
      .map((point) => ({
        point_key: String(point.point_key || "").trim(),
        point_title: String(point.point_title || point.point_key || "").trim(),
      }))
      .filter((point) => point.point_key || point.point_title);
  }
  return (question.metadata?.primary_point_keys || [])
    .map((key) => ({ point_key: String(key), point_title: String(key) }))
    .filter((point) => point.point_key);
}

function questionPointTitles(question: Question) {
  return questionPoints(question).map((point) => point.point_title || point.point_key).filter(Boolean);
}

function draftPayload(draft: QuestionDraft) {
  return draft.payload || {};
}

function draftStem(draft: QuestionDraft) {
  return String(draftPayload(draft).stem || "");
}

function draftQuestionType(draft: QuestionDraft) {
  return String(draftPayload(draft).question_type || "");
}

function draftQuestionPoints(draft: QuestionDraft) {
  const metadata = draftPayload(draft).metadata || {};
  const points = Array.isArray(metadata.primary_points) ? metadata.primary_points : [];
  if (points.length) {
    return points
      .map((point) => ({
        point_key: String(point?.point_key || "").trim(),
        point_title: String(point?.point_title || point?.point_key || "").trim(),
      }))
      .filter((point) => point.point_key || point.point_title);
  }
  const keys = Array.isArray(metadata.primary_point_keys) ? metadata.primary_point_keys : [];
  return keys.map((key) => ({ point_key: String(key), point_title: String(key) })).filter((point) => point.point_key);
}

function candidatePayload(candidate: QuestionWorkbenchCandidate) {
  return candidate.payload || {};
}

function candidateStem(candidate: QuestionWorkbenchCandidate) {
  return String(candidatePayload(candidate).stem || "");
}

function candidateQuestionType(candidate: QuestionWorkbenchCandidate) {
  return String(candidatePayload(candidate).question_type || "");
}

function candidateQuestionPoints(candidate: QuestionWorkbenchCandidate) {
  const metadata = candidatePayload(candidate).metadata || {};
  const points = Array.isArray(metadata.primary_points) ? metadata.primary_points : [];
  if (points.length) {
    return points
      .map((point) => ({
        point_key: String(point?.point_key || "").trim(),
        point_title: String(point?.point_title || point?.point_key || "").trim(),
      }))
      .filter((point) => point.point_key || point.point_title);
  }
  const keys = Array.isArray(metadata.primary_point_keys) ? metadata.primary_point_keys : [];
  return keys.map((key) => ({ point_key: String(key), point_title: String(key) })).filter((point) => point.point_key);
}

function candidateValidationErrors(candidate: QuestionWorkbenchCandidate) {
  return candidate.validation_errors?.length
    ? candidate.validation_errors
    : candidate.draft_validation_errors?.length
      ? candidate.draft_validation_errors
      : [];
}

function questionHasAnyPoint(question: Question, pointKeys: string[]) {
  if (!pointKeys.length) return true;
  const selected = new Set(pointKeys);
  return questionPoints(question).some((point) => selected.has(point.point_key));
}

function evidenceStatusTag(question: Question) {
  if (question.metadata?.source_audit?.evidence_sufficient) return <Tag color="green">证据已核对</Tag>;
  if (question.source_refs?.length) return <Tag color="gold">有来源</Tag>;
  return <Tag>待核对</Tag>;
}

function evidenceStatusText(question: Question) {
  if (question.metadata?.source_audit?.evidence_sufficient) return "证据已核对";
  if (question.source_refs?.length) return "有来源";
  return "待核对";
}

function reviewDecisionText(decision?: string) {
  if (decision === "keep") return "审查保留";
  if (decision === "rewrite") return "建议改写";
  if (decision === "reject") return "已拒绝";
  return "未审查";
}

function questionBankStatusTag(status?: string) {
  if (status === "published") return <Tag color="green">启用</Tag>;
  if (status === "disabled") return <Tag>未启用</Tag>;
  return statusTag(status);
}

function questionBankStatusText(status?: string) {
  if (status === "published") return "启用";
  if (status === "disabled") return "未启用";
  return status || "-";
}

type QuestionWorkbenchGateState = {
  healthy: boolean;
  label: string;
  message: string;
  tagColor: string;
  alertType: "success" | "info" | "warning" | "error";
  bgeStatus: string;
  route: string;
  tone: "ready" | "checking" | "blocked";
};

function questionWorkbenchGateFromRuntime(runtime?: LearningAssistantRuntime): QuestionWorkbenchGateState {
  const ragRuntime = runtime?.rag_runtime;
  const bgeStatus = runtime?.bge_metrics?.ok
    ? "healthy"
    : runtime?.bge_status || (runtime?.bge_error ? "unreachable" : ragRuntime?.bge_service_required ? "checking" : "not_required");
  const route = ragRuntime?.hybrid_bge_enabled
    ? "来源检索正常"
    : ragRuntime?.rag_enabled
      ? "基础来源检索"
      : "来源检索关闭";

  if (!runtime || !ragRuntime) {
    return {
      healthy: false,
      label: "正在检查",
      message: "正在确认来源检索状态，稍等一下再使用 AI 建议。",
      tagColor: "#356f9c",
      alertType: "info",
      bgeStatus: "checking",
      route,
      tone: "checking",
    };
  }
  if (!ragRuntime.rag_enabled) {
    return {
      healthy: false,
      label: "AI 暂不可用",
      message: "来源检索还没开启，暂时不能让 AI 出题或修题。",
      tagColor: "#b42318",
      alertType: "error",
      bgeStatus,
      route,
      tone: "blocked",
    };
  }
  if (!ragRuntime.hybrid_bge_enabled) {
    return {
      healthy: false,
      label: "AI 暂不可用",
      message: "来源检索还没准备好，暂时不能使用 AI 建议。",
      tagColor: "#b42318",
      alertType: "error",
      bgeStatus,
      route,
      tone: "blocked",
    };
  }
  if (!ragRuntime.query_generation_enabled) {
    return {
      healthy: false,
      label: "AI 暂不可用",
      message: "来源检索的扩展查询未开启，暂时不能使用 AI 建议。",
      tagColor: "#b42318",
      alertType: "error",
      bgeStatus,
      route,
      tone: "blocked",
    };
  }
  if (bgeStatus !== "healthy") {
    const statusText: Record<string, string> = {
      checking: "正在检查来源检索服务",
      degraded: "来源检索服务异常",
      unreachable: "来源检索服务连接不上",
      not_configured: "来源检索服务未配置",
    };
    return {
      healthy: false,
      label: bgeStatus === "checking" ? "正在检查" : "AI 暂不可用",
      message: `${statusText[bgeStatus] || "来源检索还没准备好"}，稍后再使用 AI 建议。`,
      tagColor: bgeStatus === "checking" ? "#356f9c" : "#b42318",
      alertType: bgeStatus === "checking" ? "info" : "error",
      bgeStatus,
      route,
      tone: bgeStatus === "checking" ? "checking" : "blocked",
    };
  }
  return {
    healthy: true,
    label: "AI 建议可用",
    message: "会先读取当前实验和点位的来源片段，再生成出题/修题建议。",
    tagColor: "#005826",
    alertType: "success",
    bgeStatus,
    route,
    tone: "ready",
  };
}

function QuestionBanksPage() {
  const { message } = AntApp.useApp();
  const queryClient = useQueryClient();
  const [experimentId, setExperimentId] = useState<string>();
  const [questionType, setQuestionType] = useState<string>();
  const [pointKeys, setPointKeys] = useState<string[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>("published");
  const [search, setSearch] = useState("");
  const [workbenchOpen, setWorkbenchOpen] = useState(false);
  const [selectedQuestion, setSelectedQuestion] = useState<Question | null>(null);
  const [assistantIntent, setAssistantIntent] = useState<"add_questions" | "repair_question">("add_questions");
  const [assistantQuestion, setAssistantQuestion] = useState<Question | null>(null);
  const [assistantPointKey, setAssistantPointKey] = useState<string>();
  const [assistantPointKeys, setAssistantPointKeys] = useState<string[]>([]);
  const [aiWorkbenchOpen, setAiWorkbenchOpen] = useState(false);
  const [aiWorkbenchSessionId, setAiWorkbenchSessionId] = useState<string>();
  const [workbenchPrompt, setWorkbenchPrompt] = useState("");
  const [workbenchQuestionTypes, setWorkbenchQuestionTypes] = useState<Question["question_type"][]>(["single_choice", "true_false"]);
  const [workbenchCount, setWorkbenchCount] = useState(3);
  const [workbenchStreaming, setWorkbenchStreaming] = useState(false);
  const [workbenchStreamStatus, setWorkbenchStreamStatus] = useState("");

  const banks = useQuery({
    queryKey: ["question-banks"],
    queryFn: () => api<ApiList<QuestionBankSummary>>("/api/admin/question-banks"),
  });

  const bankExperiments = banks.data?.items || [];

  useEffect(() => {
    if (!experimentId && bankExperiments.length) {
      const firstWithBank = bankExperiments.find((experiment) =>
        experiment.banks.some((bank) => bank.bank_kind === "default" && Number(bank.published_count || bank.question_count || 0) > 0),
      );
      setExperimentId((firstWithBank || bankExperiments[0]).id);
    }
  }, [bankExperiments, experimentId]);

  const questionParams = new URLSearchParams({ limit: "1000" });
  if (experimentId) questionParams.set("experiment_id", experimentId);
  if (questionType) questionParams.set("question_type", questionType);
  if (statusFilter) questionParams.set("status_filter", statusFilter);
  if (search.trim()) questionParams.set("search", search.trim());

  const questions = useQuery({
    queryKey: ["experiment-bank-questions", questionParams.toString()],
    queryFn: () => api<ApiList<Question>>(`/api/admin/question-banks/questions?${questionParams.toString()}`),
    enabled: Boolean(experimentId),
  });

  const experimentPoints = useQuery({
    queryKey: ["question-bank-video-points", experimentId],
    queryFn: () => api<ExperimentVideoPointsResponse>(`/api/admin/experiments/${experimentId}/video-points`),
    enabled: Boolean(experimentId),
  });

  const drafts = useQuery({
    queryKey: ["question-bank-drafts", experimentId],
    queryFn: () => api<ApiList<QuestionDraft>>(`/api/admin/question-banks/drafts?experiment_id=${experimentId}`),
    enabled: Boolean(experimentId),
  });

  const aiWorkbench = useQuery({
    queryKey: ["question-ai-workbench", aiWorkbenchSessionId],
    queryFn: () => api<QuestionWorkbenchSession>(`/api/admin/question-banks/workbench-sessions/${aiWorkbenchSessionId}`),
    enabled: Boolean(aiWorkbenchOpen && aiWorkbenchSessionId),
  });

  const assistantRuntime = useQuery({
    queryKey: ["learning-assistant-runtime", "question-bank-workbench"],
    queryFn: () => api<LearningAssistantRuntime>("/api/admin/learning-assistant/runtime"),
    refetchInterval: 10000,
  });

  const selectedExperiment = useMemo(
    () => bankExperiments.find((item) => item.id === experimentId),
    [bankExperiments, experimentId],
  );
  const selectedBank = selectedExperiment?.banks.find((bank) => bank.bank_kind === "default") || selectedExperiment?.banks[0];

  const totals = useMemo(
    () =>
      bankExperiments.reduce(
        (acc, experiment) => {
          const bank = experiment.banks.find((item) => item.bank_kind === "default") || experiment.banks[0];
          return {
            total: acc.total + Number(bank?.question_count || 0),
            published: acc.published + Number(bank?.published_count || 0),
            choice: acc.choice + Number(bank?.choice_count || 0),
            trueFalse: acc.trueFalse + Number(bank?.true_false_count || 0),
            fillBlank: acc.fillBlank + Number(bank?.fill_blank_count || 0),
          };
        },
        { total: 0, published: 0, choice: 0, trueFalse: 0, fillBlank: 0 },
      ),
    [bankExperiments],
  );

  const pointOptions = useMemo(() => {
    const byKey = new Map<string, string>();
    for (const point of experimentPoints.data?.points || []) {
      if (point.point_key && point.source !== "legacy") byKey.set(point.point_key, point.point_title || point.point_key);
    }
    for (const question of questions.data?.items || []) {
      for (const point of questionPoints(question)) {
        const key = point.point_key || point.point_title;
        if (key && !byKey.has(key)) byKey.set(key, point.point_title || key);
      }
    }
    return [...byKey.entries()].map(([value, label]) => ({ value, label }));
  }, [experimentPoints.data?.points, questions.data?.items]);

  const visibleQuestions = useMemo(
    () => (questions.data?.items || []).filter((question) => questionHasAnyPoint(question, pointKeys)),
    [pointKeys, questions.data?.items],
  );

  const workbenchCandidates = aiWorkbench.data?.candidates || [];
  const workbenchTurns = aiWorkbench.data?.turns || [];
  const workbenchContext = aiWorkbench.data?.context_snapshot || {};
  const workbenchOriginalQuestion = aiWorkbench.data?.original_question_snapshot || assistantQuestion || null;
  const questionWorkbenchGate = questionWorkbenchGateFromRuntime(assistantRuntime.data);
  const workbenchRagGate = workbenchContext.rag_gate;
  const workbenchGateLabel = workbenchRagGate?.healthy === false
    ? String(workbenchRagGate.message || questionWorkbenchGate.message)
    : questionWorkbenchGate.message;
  const workbenchTargetPoints = (workbenchContext.target_points?.length
    ? workbenchContext.target_points
    : workbenchContext.selected_point
      ? [workbenchContext.selected_point]
      : assistantPointKeys.map((key) => ({ point_key: key, point_title: pointOptions.find((option) => option.value === key)?.label || key }))) || [];
  const workbenchEvidencePackage = workbenchContext.evidence_package;
  const workbenchStatusTone = workbenchRagGate?.healthy === false ? "blocked" : questionWorkbenchGate.tone;
  const workbenchEvidenceSourceCount = workbenchEvidencePackage?.source_count ?? (workbenchContext.source_refs || []).length;
  const workbenchEvidenceTitle = workbenchRagGate?.healthy === false
    ? "本轮没有生成"
    : questionWorkbenchGate.healthy
      ? "证据已就绪"
      : questionWorkbenchGate.label;
  const workbenchEvidenceMessage = workbenchRagGate?.healthy === false
    ? workbenchGateLabel
    : questionWorkbenchGate.healthy
      ? "已读取当前实验和点位的来源片段，可以继续用提示细化 AI 建议。"
      : workbenchGateLabel;
  const createTargetPointKeys = pointKeys.filter(Boolean);
  const createTargetPointLabel = createTargetPointKeys.length
    ? `围绕 ${createTargetPointKeys.length} 个点位出题`
    : "未选点位时，将从本实验默认点位开始";

  const openQuestionWorkbench = (question: Question) => {
    setSelectedQuestion(question);
    setWorkbenchOpen(true);
  };

  const closeWorkbench = () => {
    setWorkbenchOpen(false);
    setSelectedQuestion(null);
  };

  const openAddSuggestion = () => {
    if (!questionWorkbenchGate.healthy) {
      message.warning(questionWorkbenchGate.message);
      return;
    }
    const primaryPointKey = pointKeys[0];
    const targetPointKeys = pointKeys.filter(Boolean);
    setAssistantIntent("add_questions");
    setAssistantQuestion(null);
    setAssistantPointKey(primaryPointKey);
    setAssistantPointKeys(targetPointKeys);
    setWorkbenchPrompt(selectedExperiment ? `为《${selectedExperiment.code} ${selectedExperiment.title}》补充点位诊断题。` : "补充点位诊断题。");
    setWorkbenchQuestionTypes(["single_choice", "true_false"]);
    setWorkbenchCount(3);
    if (experimentId) {
      startWorkbench.mutate({
        mode: "create",
        experiment_id: experimentId,
        point_key: primaryPointKey || null,
        point_keys: targetPointKeys,
      });
    }
  };

  const openRepairSuggestion = (question: Question) => {
    if (!questionWorkbenchGate.healthy) {
      message.warning(questionWorkbenchGate.message);
      return;
    }
    const questionPointKeys = questionPoints(question).map((point) => point.point_key).filter(Boolean) as string[];
    setAssistantIntent("repair_question");
    setAssistantQuestion(question);
    setWorkbenchOpen(false);
    setAssistantPointKey(questionPoints(question)[0]?.point_key);
    setAssistantPointKeys(questionPointKeys);
    setWorkbenchPrompt("请基于当前实验点位、来源证据和选项诊断链接，给出一版更清晰、更可诊断的修正题。");
    setWorkbenchQuestionTypes([question.question_type]);
    setWorkbenchCount(1);
    startWorkbench.mutate({
      mode: "repair",
      experiment_id: question.experiment_id,
      question_id: question.id,
      point_key: questionPoints(question)[0]?.point_key || null,
      point_keys: questionPointKeys,
    });
  };

  const refreshQuestionBank = () => {
    void queryClient.invalidateQueries({ queryKey: ["question-banks"] });
    void queryClient.invalidateQueries({ queryKey: ["question-bank-drafts", experimentId] });
    void queryClient.invalidateQueries({ queryKey: ["experiment-bank-questions"] });
  };

  const startWorkbench = useMutation({
    mutationFn: (payload: {
      mode: "repair" | "create";
      experiment_id: string;
      question_id?: string | null;
      point_key?: string | null;
      point_keys?: string[];
    }) => postJson<QuestionWorkbenchSession>("/api/admin/question-banks/workbench-sessions", payload),
    onSuccess: (result) => {
      setAiWorkbenchSessionId(result.id);
      setAiWorkbenchOpen(true);
      void queryClient.invalidateQueries({ queryKey: ["question-ai-workbench", result.id] });
    },
    onError: (error) => message.error(`AI 工作台打开失败：${errorMessage(error)}`),
  });

  const sendWorkbenchMessage = async () => {
    if (!aiWorkbenchSessionId || !workbenchPrompt.trim() || workbenchStreaming) return;
    if (!questionWorkbenchGate.healthy) {
      message.warning(questionWorkbenchGate.message);
      return;
    }
    const prompt = workbenchPrompt.trim();
    setWorkbenchStreaming(true);
    setWorkbenchStreamStatus("已发送提示，等待 AI 开始生成");
    try {
      await postJsonStream<{ message?: string; session?: QuestionWorkbenchSession }>(
        `/api/admin/question-banks/workbench-sessions/${aiWorkbenchSessionId}/messages/stream`,
        {
          prompt,
          question_types: workbenchQuestionTypes,
          count: workbenchCount,
          difficulty: "basic",
        },
        ({ event, data }) => {
          if (event === "status") {
            setWorkbenchStreamStatus(String(data.message || "AI 正在生成候选题"));
          }
          if (event === "final" && data.session) {
            queryClient.setQueryData(["question-ai-workbench", aiWorkbenchSessionId], data.session);
            message.success("AI 候选已更新");
            setWorkbenchPrompt("");
            void queryClient.invalidateQueries({ queryKey: ["question-ai-workbench", aiWorkbenchSessionId] });
            refreshQuestionBank();
          }
          if (event === "error") {
            throw new Error(String(data.message || "AI 生成失败"));
          }
        },
      );
    } catch (error) {
      message.error(`AI 生成失败：${errorMessage(error)}`);
    } finally {
      setWorkbenchStreaming(false);
      setWorkbenchStreamStatus("");
    }
  };

  const publishCandidate = useMutation({
    mutationFn: (candidateId: string) => postJson<Question>(`/api/admin/question-banks/workbench-candidates/${candidateId}/publish`, {}),
    onSuccess: () => {
      message.success("候选已发布为生成题");
      void queryClient.invalidateQueries({ queryKey: ["question-ai-workbench", aiWorkbenchSessionId] });
      refreshQuestionBank();
    },
    onError: (error) => message.error(`发布失败：${errorMessage(error)}`),
  });

  const rejectCandidate = useMutation({
    mutationFn: (candidateId: string) => postJson<QuestionWorkbenchCandidate>(`/api/admin/question-banks/workbench-candidates/${candidateId}/reject`, {}),
    onSuccess: () => {
      message.success("候选已拒绝");
      void queryClient.invalidateQueries({ queryKey: ["question-ai-workbench", aiWorkbenchSessionId] });
      refreshQuestionBank();
    },
    onError: (error) => message.error(`拒绝失败：${errorMessage(error)}`),
  });

  return (
    <Space direction="vertical" size={18} className="full">
      <PageTitle
        title="题库管理"
        description="按正式实验和实验点位查看当前发布题库，核对题目、证据来源和单选诊断链接。"
      />

      <div className="stat-grid question-bank-stat-grid">
        <Card>
          <Statistic title="当前题库" value={totals.total} suffix="题" prefix={<DatabaseOutlined />} />
        </Card>
        <Card>
          <Statistic title="已发布" value={totals.published} suffix="题" prefix={<CheckCircleOutlined />} />
        </Card>
        <Card>
          <Statistic title="选择题" value={totals.choice} suffix="题" />
        </Card>
        <Card>
          <Statistic title="填空题" value={totals.fillBlank} suffix="题" />
        </Card>
        <Card>
          <Statistic title="判断题" value={totals.trueFalse} suffix="题" />
        </Card>
      </div>

      <div className="question-bank-layout">
        <Card className="question-chapter-panel" title="实验题库" extra={<Tag color="green">{bankExperiments.length} 个实验</Tag>}>
          <Text type="secondary" className="question-card-helper">
            先选实验，再按点位查看题目。
          </Text>
          <QueryState loading={banks.isLoading} error={banks.error} empty={!bankExperiments.length}>
            <Table
              rowKey="id"
              size="small"
              pagination={{ pageSize: 12, showSizeChanger: false }}
              dataSource={bankExperiments}
              rowClassName={(row) => (row.id === experimentId ? "question-chapter-row-active" : "")}
              onRow={(record) => ({
                onClick: () => {
                  setExperimentId(record.id);
                  setQuestionType(undefined);
                  setPointKeys([]);
                  setSearch("");
                  setSelectedQuestion(null);
                  setWorkbenchOpen(false);
                },
              })}
              columns={[
                {
                  title: "实验",
                  render: (_: unknown, row: QuestionBankSummary) => {
                    const bank = row.banks.find((item) => item.bank_kind === "default") || row.banks[0];
                    const published = Number(bank?.published_count || row.published_question_count || 0);
                    return (
                      <Space direction="vertical" size={3} className="question-bank-experiment-cell">
                        <Text strong>
                          {row.code} {row.title}
                        </Text>
                        <Text type="secondary">
                          {experimentVideoPointCount(row)} 个点位 · {published} 题 · 选 {Number(bank?.choice_count || 0)} · 判{" "}
                          {Number(bank?.true_false_count || 0)} · 填 {Number(bank?.fill_blank_count || 0)}
                        </Text>
                      </Space>
                    );
                  },
                },
              ]}
            />
          </QueryState>
        </Card>

        <Card title="当前实验题目" className="question-bank-question-panel">
          <Flex justify="space-between" gap={16} wrap="wrap" className="question-list-heading">
            <div>
              <Title level={3}>
                {selectedExperiment ? `${selectedExperiment.code} ${selectedExperiment.title}` : "请选择实验"}
              </Title>
              <Text type="secondary" className="question-bank-summary-line">
                已发布 {selectedBank?.published_count || 0} 题 · 选择 {selectedBank?.choice_count || 0} · 判断{" "}
                {selectedBank?.true_false_count || 0} · 填空 {selectedBank?.fill_blank_count || 0}
              </Text>
            </div>
            <Space wrap className="question-list-heading-actions">
              <Tooltip title={questionWorkbenchGate.healthy ? createTargetPointLabel : questionWorkbenchGate.message}>
                <Button
                  type="primary"
                  icon={<MessageOutlined />}
                  onClick={openAddSuggestion}
                  disabled={!experimentId || !questionWorkbenchGate.healthy}
                >
                  AI 新增建议
                </Button>
              </Tooltip>
            </Space>
          </Flex>

          <div className={`question-workbench-status question-workbench-status-${questionWorkbenchGate.tone}`} role="status">
            <div className="question-workbench-status-main">
              <span className="question-workbench-status-icon">
                {questionWorkbenchGate.tone === "ready" ? (
                  <CheckCircleOutlined />
                ) : questionWorkbenchGate.tone === "checking" ? (
                  <ReloadOutlined />
                ) : (
                  <CloseCircleOutlined />
                )}
              </span>
              <div className="question-workbench-status-copy">
                <Text strong>{questionWorkbenchGate.label}</Text>
                <Text type="secondary">{questionWorkbenchGate.message}</Text>
              </div>
            </div>
            <div className="question-workbench-status-meta">
              <span>{questionWorkbenchGate.route}</span>
              <span>{createTargetPointLabel}</span>
            </div>
          </div>

          <div className="question-bank-actions">
            <Select
              allowClear
              className="question-bank-type-filter"
              placeholder="题型"
              value={questionType}
              onChange={setQuestionType}
              options={[
                { value: "single_choice", label: "选择" },
                { value: "true_false", label: "判断" },
                { value: "fill_blank", label: "填空" },
              ]}
            />
            <Select
              allowClear
              className="question-bank-point-filter"
              mode="multiple"
              maxTagCount="responsive"
              placeholder="实验点位"
              value={pointKeys}
              onChange={(values) => setPointKeys(values)}
              showSearch
              optionFilterProp="label"
              options={pointOptions}
            />
            <Select
              className="question-bank-status-filter"
              placeholder="状态"
              value={statusFilter}
              onChange={setStatusFilter}
              options={[
                { value: "published", label: "已发布" },
                { value: "disabled", label: "已停用" },
                { value: "draft", label: "草稿" },
              ]}
            />
            <Input.Search
              allowClear
              className="question-bank-search"
              placeholder="搜索题干或解析"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              onSearch={setSearch}
            />
          </div>

          <QueryState loading={questions.isLoading} error={questions.error} empty={!visibleQuestions.length}>
            <Table
              rowKey="id"
              dataSource={visibleQuestions}
              pagination={{ pageSize: 8 }}
              onRow={(record) => ({ onClick: () => openQuestionWorkbench(record) })}
              columns={[
                { title: "题型", width: 64, dataIndex: "question_type", render: questionTypeLabel },
                { title: "题干", dataIndex: "stem" },
                {
                  title: "主点位",
                  width: 154,
                  render: (_: unknown, row: Question) => {
                    const points = questionPointTitles(row);
                    const primaryPoint = points[0];
                    if (!primaryPoint) return <Text type="secondary">-</Text>;
                    return (
                      <Tooltip
                        title={
                          <div className="question-point-tooltip-list">
                            {points.map((title) => (
                              <span key={title}>{title}</span>
                            ))}
                          </div>
                        }
                      >
                        <span className="question-point-stack">
                          <span className="question-point-pill">{primaryPoint}</span>
                          {points.length > 1 ? <span className="question-point-count">共 {points.length} 个</span> : null}
                        </span>
                      </Tooltip>
                    );
                  },
                },
                {
                  title: "证据",
                  width: 96,
                  render: (_: unknown, row: Question) => (
                    <Space direction="vertical" size={2}>
                      {evidenceStatusTag(row)}
                      <Text type="secondary">{row.source_refs?.length || 0} 条来源</Text>
                    </Space>
                  ),
                },
                { title: "状态", width: 72, dataIndex: "status", render: questionBankStatusTag },
                {
                  title: "操作",
                  width: 56,
                  render: (_: unknown, row: Question) => (
                    <Tooltip title="查看题目详情">
                      <Button
                        type="text"
                        icon={<EyeOutlined />}
                        aria-label="查看题目详情"
                        onClick={(event) => {
                          event.stopPropagation();
                          openQuestionWorkbench(row);
                        }}
                      />
                    </Tooltip>
                  ),
                },
              ]}
            />
          </QueryState>
        </Card>
      </div>

      <Modal
        title="题目详情"
        open={workbenchOpen}
        width={980}
        onCancel={closeWorkbench}
        footer={
          selectedQuestion
            ? [
                <Button
                  key="repair"
                  type="primary"
                  icon={<MessageOutlined />}
                  disabled={!questionWorkbenchGate.healthy}
                  title={questionWorkbenchGate.healthy ? "" : questionWorkbenchGate.message}
                  onClick={() => openRepairSuggestion(selectedQuestion)}
                >
                  AI 修正建议
                </Button>,
                <Button key="close" onClick={closeWorkbench}>
                  关闭
                </Button>,
              ]
            : [
                <Button key="close" onClick={closeWorkbench}>
                  关闭
                </Button>,
              ]
        }
      >
        {selectedQuestion ? (
          <Space direction="vertical" size={16} className="full">
            <div className="modal-section question-detail-card">
              <div>
                <Title level={4}>{selectedQuestion.stem}</Title>
                <div className="question-detail-meta-grid">
                  <span className="question-detail-fact">
                    <span className="question-detail-fact-label">题型</span>
                    <span className="question-detail-fact-value">{questionTypeLabel(selectedQuestion.question_type)}</span>
                  </span>
                  <span className="question-detail-fact">
                    <span className="question-detail-fact-label">状态</span>
                    <span className="question-detail-fact-value">{questionBankStatusText(selectedQuestion.status)}</span>
                  </span>
                  <span className="question-detail-fact">
                    <span className="question-detail-fact-label">证据</span>
                    <span className="question-detail-fact-value">{evidenceStatusText(selectedQuestion)}</span>
                  </span>
                  {selectedQuestion.experiment_code || selectedQuestion.experiment_title ? (
                    <span className="question-detail-fact question-detail-fact-wide">
                      <span className="question-detail-fact-label">所属实验</span>
                      <span className="question-detail-fact-value">
                        {selectedQuestion.experiment_code} {selectedQuestion.experiment_title}
                      </span>
                    </span>
                  ) : null}
                </div>
              </div>

              {selectedQuestion.options?.length ? (
                <div className="question-options question-workbench-options">
                  {selectedQuestion.options.map((option, index) => {
                    const label = typeof option === "string" ? String.fromCharCode(65 + index) : option.label || String.fromCharCode(65 + index);
                    const text = typeof option === "string" ? option : option.text || "";
                    return (
                      <div key={`${label}-${index}`} className="question-option">
                        <Text strong>{label}</Text>
                        <Text>{text}</Text>
                      </div>
                    );
                  })}
                </div>
              ) : null}

              <Descriptions size="small" column={1} className="question-workbench-descriptions">
                <Descriptions.Item label="确定性答案">{answerText(selectedQuestion.answer)}</Descriptions.Item>
                <Descriptions.Item label="解析">{selectedQuestion.explanation || "暂无解析"}</Descriptions.Item>
              </Descriptions>

              <div className="question-point-section">
                <Flex justify="space-between" align="center" gap={10} wrap="wrap">
                  <Text strong>点位与证据核查</Text>
                  <Text type="secondary">
                    {reviewDecisionText(selectedQuestion.metadata?.review_decision)} · {evidenceStatusText(selectedQuestion)}
                  </Text>
                </Flex>
                <div className="question-evidence-grid">
                  <div className="question-evidence-row">
                    <Text type="secondary">实验点位</Text>
                    <div className="question-evidence-values">
                      {questionPointTitles(selectedQuestion).length ? (
                        questionPointTitles(selectedQuestion).map((title) => (
                          <span key={title} className="question-evidence-pill is-point">
                            {title}
                          </span>
                        ))
                      ) : (
                        <Text type="secondary">未绑定点位</Text>
                      )}
                    </div>
                  </div>
                  {selectedQuestion.metadata?.coverage_tags?.length ? (
                    <div className="question-evidence-row">
                      <Text type="secondary">诊断维度</Text>
                      <div className="question-evidence-values">
                        {selectedQuestion.metadata.coverage_tags.map((tag) => (
                          <span key={tag} className="question-evidence-pill">
                            {coverageTagLabel(tag)}
                          </span>
                        ))}
                      </div>
                    </div>
                  ) : null}
                  <div className="question-evidence-row">
                    <Text type="secondary">核心来源片段</Text>
                    <div className="question-evidence-values">
                      {(selectedQuestion.metadata?.source_audit?.canonical_chunk_ids || []).length ? (
                        (selectedQuestion.metadata?.source_audit?.canonical_chunk_ids || []).map((chunkId) => (
                          <code key={chunkId} className="question-evidence-code">
                            {chunkId}
                          </code>
                        ))
                      ) : (
                        <Text type="secondary">暂无记录</Text>
                      )}
                    </div>
                  </div>
                  <div className="question-evidence-row">
                    <Text type="secondary">理论支撑片段</Text>
                    <div className="question-evidence-values">
                      {(selectedQuestion.metadata?.source_audit?.supporting_theory_chunk_ids || []).length ? (
                        (selectedQuestion.metadata?.source_audit?.supporting_theory_chunk_ids || []).map((chunkId) => (
                          <code key={chunkId} className="question-evidence-code">
                            {chunkId}
                          </code>
                        ))
                      ) : (
                        <Text type="secondary">暂无单独理论片段</Text>
                      )}
                    </div>
                  </div>
                  {selectedQuestion.metadata?.source_audit?.reviewer_note ? (
                    <div className="question-evidence-row">
                      <Text type="secondary">审查备注</Text>
                      <Text>{selectedQuestion.metadata.source_audit.reviewer_note}</Text>
                    </div>
                  ) : null}
                </div>
              </div>

              {selectedQuestion.metadata?.option_links?.length ? (
                <div className="question-source-section">
                  <Text strong>选项诊断链接</Text>
                  <Table
                    rowKey={(row) => String(row.label || row.role || Math.random())}
                    size="small"
                    pagination={false}
                    dataSource={selectedQuestion.metadata.option_links}
                    columns={[
                      { title: "选项", dataIndex: "label", width: 70 },
                      { title: "角色", dataIndex: "role", width: 120, render: optionDiagnosticRoleLabel },
                      {
                        title: "点位/说明",
                        render: (_: unknown, row) => row.point_title || row.point_key || row.diagnostic_note || "-",
                      },
                    ]}
                  />
                </div>
              ) : null}

              {selectedQuestion.source_refs?.length ? (
                <div className="question-source-section">
                  <Text strong>来源依据</Text>
                  <div className="question-source-list question-source-list-stacked">
                    {selectedQuestion.source_refs.map((ref, index) => (
                      <div key={`${ref.chunk_id || index}`} className="question-source-item">
                        {sourceRefLabel(ref)}
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          </Space>
        ) : (
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="请选择题目" />
        )}
      </Modal>

      <Drawer
        title={assistantIntent === "repair_question" ? "AI 修题工作台" : "AI 新增题工作台"}
        open={aiWorkbenchOpen}
        width="min(1280px, 96vw)"
        onClose={() => setAiWorkbenchOpen(false)}
        className="ai-question-workbench-drawer"
        extra={
          <Button
            type="primary"
            icon={<MessageOutlined />}
            loading={workbenchStreaming}
            disabled={!aiWorkbenchSessionId || !workbenchPrompt.trim() || workbenchStreaming || !questionWorkbenchGate.healthy}
            onClick={sendWorkbenchMessage}
          >
            发送提示
          </Button>
        }
      >
        <QueryState loading={aiWorkbench.isLoading || startWorkbench.isPending} error={aiWorkbench.error}>
          <div className="ai-workbench-grid">
            <section className="ai-workbench-panel ai-workbench-context">
              <Flex justify="space-between" align="center" gap={10} wrap="wrap" className="ai-workbench-section-head">
                <div>
                  <Text className="eyebrow">{assistantIntent === "repair_question" ? "原题上下文" : "新增上下文"}</Text>
                  <Title level={4}>
                    {aiWorkbench.data?.experiment_code || selectedExperiment?.code} {aiWorkbench.data?.experiment_title || selectedExperiment?.title}
                  </Title>
                </div>
                <Tag color={assistantIntent === "repair_question" ? "gold" : "blue"}>
                  {assistantIntent === "repair_question" ? "修题会话" : "新增会话"}
                </Tag>
              </Flex>
              <div className={`question-workbench-status question-workbench-status-${workbenchStatusTone}`}>
                <div className="question-workbench-status-main">
                  <span className="question-workbench-status-icon">
                    {workbenchStatusTone === "ready" ? (
                      <CheckCircleOutlined />
                    ) : workbenchStatusTone === "checking" ? (
                      <ReloadOutlined />
                    ) : (
                      <CloseCircleOutlined />
                    )}
                  </span>
                  <div className="question-workbench-status-copy">
                    <Text strong>{workbenchEvidenceTitle}</Text>
                    <Text type="secondary">{workbenchEvidenceMessage}</Text>
                  </div>
                </div>
                <div className="question-workbench-status-meta">
                  <span>来源 {workbenchEvidenceSourceCount} 条</span>
                  {workbenchTargetPoints.length ? <span>{workbenchTargetPoints.length} 个目标点位</span> : null}
                </div>
              </div>

              {assistantIntent === "repair_question" && workbenchOriginalQuestion ? (
                <Space direction="vertical" size={12} className="full">
                  <div className="ai-workbench-original-card">
                    <Text strong>{String(workbenchOriginalQuestion.stem || "")}</Text>
                    <Space wrap className="question-detail-meta">
                      <Tag color="blue">{questionTypeLabel(String(workbenchOriginalQuestion.question_type || ""))}</Tag>
                      {workbenchOriginalQuestion.status ? questionBankStatusTag(String(workbenchOriginalQuestion.status)) : null}
                    </Space>
                    {Array.isArray(workbenchOriginalQuestion.options) && workbenchOriginalQuestion.options.length ? (
                      <div className="question-options">
                        {workbenchOriginalQuestion.options.map((option, index) => {
                          const label = typeof option === "string" ? String.fromCharCode(65 + index) : option.label || String.fromCharCode(65 + index);
                          const text = typeof option === "string" ? option : option.text || "";
                          return (
                            <div key={`${label}-${index}`} className="question-option">
                              <Text strong>{label}</Text>
                              <Text>{text}</Text>
                            </div>
                          );
                        })}
                      </div>
                    ) : null}
                    <Descriptions size="small" column={1} className="question-workbench-descriptions">
                      <Descriptions.Item label="答案">{answerText(workbenchOriginalQuestion.answer as Record<string, unknown>)}</Descriptions.Item>
                      <Descriptions.Item label="解析">{String(workbenchOriginalQuestion.explanation || "暂无解析")}</Descriptions.Item>
                    </Descriptions>
                  </div>
                </Space>
              ) : (
                <div className="ai-workbench-original-card">
                  <Text strong>当前实验与点位</Text>
                  <Descriptions size="small" column={1} className="question-workbench-descriptions">
                    <Descriptions.Item label="目标点位">
                      {workbenchTargetPoints.length
                        ? workbenchTargetPoints.map((point) => point.point_title || point.point_key).join("、")
                        : assistantPointKey || "全部点位"}
                    </Descriptions.Item>
                    <Descriptions.Item label="已有题量">{workbenchContext.coverage?.question_count ?? "-"}</Descriptions.Item>
                    <Descriptions.Item label="该点位题量">{workbenchContext.coverage?.selected_point_question_count ?? "-"}</Descriptions.Item>
                  </Descriptions>
                </div>
              )}

              <div className="question-point-section">
                <Text strong>点位与证据</Text>
                <Space wrap className="question-point-list">
                  {workbenchTargetPoints.map((point) => (
                    <Tag key={point.point_key || point.point_title} color="cyan">
                      {point.point_title || point.point_key}
                    </Tag>
                  ))}
                  {!workbenchTargetPoints.length && workbenchOriginalQuestion?.metadata
                    ? questionPoints(workbenchOriginalQuestion as Question).map((point) => (
                        <Tag key={point.point_key || point.point_title} color="cyan">
                          {point.point_title || point.point_key}
                        </Tag>
                      ))
                    : null}
                </Space>
                <Space wrap className="question-source-list">
                  {(workbenchContext.source_refs || []).slice(0, 8).map((ref, index) => (
                    <Tag key={`${ref.chunk_id || index}`}>{sourceRefLabel(ref)}</Tag>
                  ))}
                  {!(workbenchContext.source_refs || []).length ? <Tag>暂无来源片段</Tag> : null}
                </Space>
              </div>

              {workbenchOriginalQuestion?.metadata?.option_links?.length ? (
                <div className="question-source-section">
                  <Text strong>原题选项诊断</Text>
                  <Table
                    rowKey={(row) => String(row.label || row.role || row.diagnostic_note || Math.random())}
                    size="small"
                    pagination={false}
                    dataSource={workbenchOriginalQuestion.metadata.option_links}
                    columns={[
                      { title: "选项", dataIndex: "label", width: 64 },
                      { title: "角色", dataIndex: "role", width: 110, render: optionDiagnosticRoleLabel },
                      { title: "说明", render: (_: unknown, row) => row.point_title || row.point_key || row.diagnostic_note || "-" },
                    ]}
                  />
                </div>
              ) : null}
            </section>

            <section className="ai-workbench-panel ai-workbench-chat">
              <Flex justify="space-between" align="center" gap={10} className="ai-workbench-section-head">
                <div>
                  <Text className="eyebrow">多轮提示</Text>
                  <Title level={4}>会话记录</Title>
                </div>
                <Space size={6} wrap>
                  {workbenchStreaming && workbenchStreamStatus ? <Tag color="processing">{workbenchStreamStatus}</Tag> : null}
                  <Tag>{workbenchTurns.length} 轮</Tag>
                </Space>
              </Flex>
              <div className="ai-workbench-chat-timeline">
                {workbenchTurns.length ? (
                  workbenchTurns.map((turn) => (
                    <div key={turn.id} className={`ai-chat-turn ai-chat-turn-${turn.role}`}>
                      <Text strong>{turn.role === "user" ? "老师" : "AI"}</Text>
                      <Text className="block-text">{turn.content}</Text>
                      {turn.error_state ? <Alert type="error" showIcon message="本轮生成失败" description={String(turn.error_state.message || "")} /> : null}
                    </div>
                  ))
                ) : (
                  <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="还没有开始对话" />
                )}
                {workbenchStreaming ? (
                  <div className="ai-chat-turn ai-chat-turn-assistant">
                    <Flex align="center" gap={8}>
                      <Text strong>AI</Text>
                      <Spin size="small" />
                    </Flex>
                    <Text className="block-text">{workbenchStreamStatus || "正在生成候选题..."}</Text>
                  </div>
                ) : null}
              </div>
              <div className="ai-workbench-composer">
                <Space direction="vertical" size={10} className="full">
                  <Space wrap>
                    <Select
                      mode="multiple"
                      value={workbenchQuestionTypes}
                      onChange={(value) => setWorkbenchQuestionTypes(value as Question["question_type"][])}
                      options={[
                        { value: "single_choice", label: "选择" },
                        { value: "true_false", label: "判断" },
                        { value: "fill_blank", label: "填空" },
                      ]}
                      disabled={assistantIntent === "repair_question" || workbenchStreaming || !questionWorkbenchGate.healthy}
                      className="ai-workbench-type-select"
                    />
                    <InputNumber
                      min={1}
                      max={20}
                      value={workbenchCount}
                      onChange={(value) => setWorkbenchCount(Number(value || 1))}
                      addonBefore="数量"
                      disabled={assistantIntent === "repair_question" || workbenchStreaming || !questionWorkbenchGate.healthy}
                    />
                  </Space>
                  <Input.TextArea
                    rows={4}
                    value={workbenchPrompt}
                    disabled={workbenchStreaming || !questionWorkbenchGate.healthy}
                    onChange={(event) => setWorkbenchPrompt(event.target.value)}
                    placeholder="可以连续追问，例如：保留原实验点位，把选项 B 改成更有诊断价值的误区。"
                  />
                </Space>
              </div>
            </section>

            <section className="ai-workbench-panel ai-workbench-candidates">
              <Flex justify="space-between" align="center" gap={10} className="ai-workbench-section-head">
                <div>
                  <Text className="eyebrow">候选版本</Text>
                  <Title level={4}>建议草稿</Title>
                </div>
                <Tag>{workbenchCandidates.length} 条</Tag>
              </Flex>
              <div className="ai-workbench-candidate-list">
                {workbenchCandidates.length ? (
                  workbenchCandidates.map((candidate) => {
                    const payload = candidatePayload(candidate);
                    const errors = candidateValidationErrors(candidate);
                    return (
                      <div key={candidate.id} className="ai-candidate-card">
                        <Space direction="vertical" size={8} className="full">
                          <Flex justify="space-between" align="start" gap={8}>
                            <Space size={4} wrap>
                              <Tag color="blue">{questionTypeLabel(candidateQuestionType(candidate))}</Tag>
                              {errors.length ? <Tag color="red">需修订</Tag> : <Tag color="green">可发布</Tag>}
                              {candidate.status !== "draft" ? <Tag>{candidate.status}</Tag> : null}
                            </Space>
                            <Text type="secondary">{candidate.id.slice(0, 8)}</Text>
                          </Flex>
                          <Text strong>{candidateStem(candidate) || "未生成题干"}</Text>
                          {Array.isArray(payload.options) && payload.options.length ? (
                            <div className="question-options">
                              {payload.options.map((option, index) => {
                                const label = typeof option === "string" ? String.fromCharCode(65 + index) : option.label || String.fromCharCode(65 + index);
                                const text = typeof option === "string" ? option : option.text || "";
                                return (
                                  <div key={`${candidate.id}-${label}-${index}`} className="question-option">
                                    <Text strong>{label}</Text>
                                    <Text>{text}</Text>
                                  </div>
                                );
                              })}
                            </div>
                          ) : null}
                          <Descriptions size="small" column={1} className="question-workbench-descriptions">
                            <Descriptions.Item label="答案">{answerText(payload.answer as Record<string, unknown>)}</Descriptions.Item>
                            <Descriptions.Item label="解析">{String(payload.explanation || "暂无解析")}</Descriptions.Item>
                          </Descriptions>
                          <Space size={4} wrap>
                            {candidateQuestionPoints(candidate).slice(0, 3).map((point) => (
                              <Tag key={point.point_key || point.point_title} color="cyan">
                                {point.point_title || point.point_key}
                              </Tag>
                            ))}
                          </Space>
                          {errors.length ? <Alert type="warning" showIcon message={errors.join("；")} /> : null}
                          <Flex justify="space-between" align="center" gap={8} wrap="wrap">
                            <Button
                              size="small"
                              onClick={() => setWorkbenchPrompt(`请继续修订候选 ${candidate.id.slice(0, 8)}：`)}
                            >
                              继续修
                            </Button>
                            <Space size={4}>
                              <Popconfirm
                                title="发布这条候选？"
                                onConfirm={() => publishCandidate.mutate(candidate.id)}
                                disabled={Boolean(errors.length) || candidate.status !== "draft"}
                              >
                                <Button
                                  type="link"
                                  size="small"
                                  disabled={Boolean(errors.length) || candidate.status !== "draft"}
                                  loading={publishCandidate.isPending}
                                >
                                  发布
                                </Button>
                              </Popconfirm>
                              <Button
                                type="link"
                                danger
                                size="small"
                                disabled={candidate.status !== "draft"}
                                loading={rejectCandidate.isPending}
                                onClick={() => rejectCandidate.mutate(candidate.id)}
                              >
                                拒绝
                              </Button>
                            </Space>
                          </Flex>
                        </Space>
                      </div>
                    );
                  })
                ) : (
                  <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无候选，先发送一条提示" />
                )}
              </div>
            </section>
          </div>
        </QueryState>
      </Drawer>
    </Space>
  );
}

type LearningAssistantFormValues = Omit<
  LearningAssistantAskRequest,
  "question" | "knowledge_point_ids" | "conversation_history" | "max_answer_chars"
>;

type LearningAssistantTurn = {
  id: string;
  question: string;
  answer: string;
  response?: LearningAssistantResponse;
  status: "running" | "done" | "error";
  streamStatus?: string;
  error?: string;
  createdAt: string;
};

type LearningAssistantPointContext = {
  chapterId?: string | null;
  experimentId?: string | null;
  experimentCode?: string | null;
  experimentTitle?: string | null;
  pointKey?: string | null;
  pointTitle?: string | null;
  pointIndex?: number | null;
};

type LearningAssistantPointOption = {
  pointKey: string;
  pointTitle: string;
  pointIndex: number;
};

type LearningAssistantPointIntent = {
  id: string;
  label: string;
  description: string;
  buildQuestion?: (context: LearningAssistantPointContext) => string;
};

const learningAssistantPolicyLabels: Record<string, string> = {
  normal_answer: "普通回答",
  refuse_out_of_scope: "课程外拒答",
  safe_experiment_guidance: "实验安全引导",
  assessment_hint: "测验提示",
  needs_platform_evidence: "资源可用性",
};

const learningAssistantModeLabels: Record<string, string> = {
  local: "本地兜底",
  guardrail_refusal: "护栏拒答",
  guardrail_hint: "护栏提示",
  openai_chat_fallback: "普通模型",
  openai_chat_stream: "流式模型",
  openai_agents_sdk: "模型回答",
};

const learningAssistantGuardrailLabels: Record<string, string> = {
  agent_sdk_fallback: "模型兜底",
  assessment_answer_leakage: "测验保护",
  chat_completion_fallback: "普通模型兜底",
  chat_completion_stream_fallback: "流式模型兜底",
  course_scope: "课程范围",
  experiment_safety: "实验安全",
  missing_evidence: "缺少证据",
  no_fabricated_resource: "资源未发布",
  point_context_empty: "点位证据为空",
  point_context_fixed: "固定点位证据",
  point_context_missing_reviewed_evidence: "点位证据缺失",
  policy_decision_invalid: "策略兜底",
  policy_gate_fallback: "策略兜底",
  rag_no_match: "RAG 未命中",
  rag_lookup_disabled: "RAG 关闭",
  simple_greeting: "简单问候",
  source_grounding: "来源约束",
  mobile_length: "长度控制",
};

const learningAssistantActionLabels: Record<string, string> = {
  allow_without_tools: "无需工具",
  answer_without_rag: "无 RAG 回答",
  continue_with_local_policy: "走本地策略",
  fallback_to_local: "转本地兜底",
  answer_from_model_knowledge: "用模型常识",
  no_evidence_fallback: "说明无证据",
  override_no_evidence: "覆盖无来源回答",
  override_unavailable_resource: "资源未发布",
  provide_hint: "只给提示",
  refuse: "拒答",
  refuse_unsafe_detail: "拒绝危险步骤",
  skip_rag_lookup: "跳过 RAG",
  state_unavailable: "资源未发布",
  trim: "截断",
  use_fixed_evidence: "使用固定证据",
};

function createStreamingAssistantResponse(answer = ""): LearningAssistantResponse {
  return {
    answer,
    sources: [],
    mode: "openai_chat_stream",
    classification: {},
    tool_calls: [],
    guardrail_decisions: [],
    rag_trace: {},
    review_required: true,
  };
}

function assistantConversationHistory(turns: LearningAssistantTurn[]) {
  return turns
    .filter((turn) => turn.question.trim() || turn.answer.trim())
    .flatMap((turn) => [
      { role: "user" as const, content: turn.question },
      ...(turn.answer.trim() ? [{ role: "assistant" as const, content: turn.answer }] : []),
    ])
    .slice(-10);
}

function assistantTurnLabel(turn: LearningAssistantTurn, index: number) {
  return `第 ${index + 1} 轮`;
}

function assistantResponseTypeLabel(turn: LearningAssistantTurn) {
  const response = turn.response;
  const mode = String(response?.classification?.policy_decision_mode || response?.classification?.intent || "");
  const labels: Record<string, string> = {
    normal_answer: "普通回答",
    course_factual_query: "课程问答",
    assessment_guidance: "测验保护",
    unsafe_experiment: "安全拦截",
    resource_request: "资源可用性",
    out_of_scope: "范围外",
    greeting: "问候",
  };
  return labels[mode] || learningAssistantPolicyLabels[mode] || mode;
}

function assistantStreamPhaseLabel(status?: string, hasAnswer = false) {
  if (hasAnswer) return "正在生成回答";
  const text = String(status || "");
  if (text.includes("判断") || text.includes("安全") || text.includes("策略")) return "正在检查问题策略";
  if (text.includes("检索") || text.includes("RAG") || text.includes("证据")) return "正在检索课程证据";
  if (text.includes("连接") || text.includes("模型") || text.includes("流式")) return "正在连接模型";
  if (text.includes("兜底")) return "正在切换兜底回答";
  return text || "正在准备回答";
}

function assistantChapterExperiments(experiments: Experiment[], chapterId?: string | null) {
  const selectedChapterId = String(chapterId || "").trim();
  const visible = experiments.filter((experiment) => experiment.status !== "archived");
  if (!selectedChapterId) return visible;
  return visible.filter((experiment) => (
    experiment.chapter_bindings || []
  ).some((binding) => binding.chapter_id === selectedChapterId));
}

function sha1Hex(value: string) {
  const bytes = Array.from(new TextEncoder().encode(value.trim()));
  const bitLength = bytes.length * 8;
  bytes.push(0x80);
  while (bytes.length % 64 !== 56) bytes.push(0);
  for (let shift = 56; shift >= 0; shift -= 8) {
    bytes.push(Math.floor(bitLength / 2 ** shift) & 0xff);
  }

  let h0 = 0x67452301;
  let h1 = 0xefcdab89;
  let h2 = 0x98badcfe;
  let h3 = 0x10325476;
  let h4 = 0xc3d2e1f0;

  const rotateLeft = (num: number, bits: number) => ((num << bits) | (num >>> (32 - bits))) >>> 0;
  for (let offset = 0; offset < bytes.length; offset += 64) {
    const words = new Array<number>(80).fill(0);
    for (let index = 0; index < 16; index += 1) {
      const base = offset + index * 4;
      words[index] = (
        (bytes[base] << 24)
        | (bytes[base + 1] << 16)
        | (bytes[base + 2] << 8)
        | bytes[base + 3]
      ) >>> 0;
    }
    for (let index = 16; index < 80; index += 1) {
      words[index] = rotateLeft(words[index - 3] ^ words[index - 8] ^ words[index - 14] ^ words[index - 16], 1);
    }

    let a = h0;
    let b = h1;
    let c = h2;
    let d = h3;
    let e = h4;
    for (let index = 0; index < 80; index += 1) {
      let f = 0;
      let k = 0;
      if (index < 20) {
        f = (b & c) | (~b & d);
        k = 0x5a827999;
      } else if (index < 40) {
        f = b ^ c ^ d;
        k = 0x6ed9eba1;
      } else if (index < 60) {
        f = (b & c) | (b & d) | (c & d);
        k = 0x8f1bbcdc;
      } else {
        f = b ^ c ^ d;
        k = 0xca62c1d6;
      }
      const temp = (rotateLeft(a, 5) + f + e + k + words[index]) >>> 0;
      e = d;
      d = c;
      c = rotateLeft(b, 30);
      b = a;
      a = temp;
    }
    h0 = (h0 + a) >>> 0;
    h1 = (h1 + b) >>> 0;
    h2 = (h2 + c) >>> 0;
    h3 = (h3 + d) >>> 0;
    h4 = (h4 + e) >>> 0;
  }

  return [h0, h1, h2, h3, h4].map((word) => word.toString(16).padStart(8, "0")).join("");
}

function learningAssistantCandidatePointKey(index: number, title: string) {
  return `candidate-${index + 1}-${sha1Hex(title).slice(0, 8)}`;
}

function learningAssistantExperimentLabel(experiment?: Experiment | null) {
  if (!experiment) return "-";
  return [experiment.code, experiment.title].map((item) => String(item || "").trim()).filter(Boolean).join(" · ")
    || experiment.id;
}

function learningAssistantPointOptions(experiment?: Experiment | null): LearningAssistantPointOption[] {
  const candidates = experimentVideoCandidates(experiment);
  if (candidates.length) {
    return candidates.map((pointTitle, index) => ({
      pointKey: learningAssistantCandidatePointKey(index, pointTitle),
      pointTitle,
      pointIndex: index + 1,
    }));
  }

  const byKey = new Map<string, LearningAssistantPointOption>();
  for (const resource of experiment?.media_resources || []) {
    const key = String(resource.point_key || resource.point_title || "").trim();
    if (!key || byKey.has(key)) continue;
    byKey.set(key, {
      pointKey: key,
      pointTitle: String(resource.point_title || resource.title || resource.original_file_name || key).trim(),
      pointIndex: byKey.size + 1,
    });
  }
  return [...byKey.values()];
}

function learningAssistantPointContext(
  chapterId: string | null | undefined,
  experiment: Experiment,
  point: LearningAssistantPointOption,
): LearningAssistantPointContext {
  return {
    chapterId: chapterId || null,
    experimentId: experiment.id,
    experimentCode: experiment.code,
    experimentTitle: experiment.title,
    pointKey: point.pointKey,
    pointTitle: point.pointTitle,
    pointIndex: point.pointIndex,
  };
}

const learningAssistantPointIntents: LearningAssistantPointIntent[] = [
  {
    id: "observe",
    label: "观察什么",
    description: "聚焦操作对象和观察目标",
    buildQuestion: (context) => `我正在看「${context.experimentCode ? `${context.experimentCode} ` : ""}${context.experimentTitle || "这个实验"}」的点位 ${context.pointIndex || ""}「${context.pointTitle || context.pointKey || ""}」。这个点位主要要观察什么？`,
  },
  {
    id: "phenomenon",
    label: "现象说明什么",
    description: "把现象和结论连起来",
    buildQuestion: (context) => `请结合「${context.pointTitle || context.pointKey || "这个点位"}」这个视频点位，说明可能观察到的现象分别说明什么。`,
  },
  {
    id: "principle",
    label: "背后原理",
    description: "解释对应化学原理",
    buildQuestion: (context) => `请解释「${context.pointTitle || context.pointKey || "这个点位"}」背后的化学原理，并说明它和本实验结论的关系。`,
  },
  {
    id: "design",
    label: "为什么这样设计",
    description: "理解试剂和步骤安排",
    buildQuestion: (context) => `为什么本实验要设置「${context.pointTitle || context.pointKey || "这个点位"}」这个点位？这种实验设计想证明什么？`,
  },
  {
    id: "compare",
    label: "和其他点位对比",
    description: "放回同一实验里比较",
    buildQuestion: (context) => `请把「${context.pointTitle || context.pointKey || "这个点位"}」放回「${context.experimentCode || ""} ${context.experimentTitle || "本实验"}」中，和相邻点位对比说明它的作用。`,
  },
  {
    id: "mistake",
    label: "易错点",
    description: "找常见误解和判断边界",
    buildQuestion: (context) => `学习「${context.pointTitle || context.pointKey || "这个点位"}」时容易误解哪里？请结合本实验证据帮我梳理易错点。`,
  },
  {
    id: "custom",
    label: "我自己问",
    description: "保留点位上下文，手动输入",
  },
];

function getRagTraceLatest(response?: LearningAssistantResponse) {
  const trace = response?.rag_trace || {};
  const latest = (trace as { latest?: unknown }).latest;
  return latest && typeof latest === "object" ? (latest as Record<string, unknown>) : {};
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function traceRecord(trace: Record<string, unknown>, key: string): Record<string, unknown> {
  return asRecord(trace[key]);
}

function traceRecords(trace: Record<string, unknown>, key: string): Record<string, unknown>[] {
  const value = trace[key];
  return Array.isArray(value)
    ? value.filter((item) => item && typeof item === "object").map((item) => item as Record<string, unknown>)
    : [];
}

function traceNumber(value: unknown): number | undefined {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function warmupStatusColor(status?: string) {
  if (status === "succeeded") return "#005826";
  if (status === "running") return "blue";
  if (status === "failed") return "red";
  return "default";
}

function sourceKindLabel(value: unknown): string {
  const source = String(value || "");
  const labels: Record<string, string> = {
    keyword: "关键词召回",
    keyword_generated: "生成 Query 关键词",
    vector: "BGE 向量召回",
  };
  return labels[source] || source || "未知来源";
}

function findFinalEvidence(source: LearningAssistantSource, finalEvidence: Record<string, unknown>[]) {
  return finalEvidence.find((item) => String(item.chunk_id || "") === source.chunk_id);
}

function RagAssetPreview({ asset }: { asset: NonNullable<LearningAssistantSource["assets"]>[number] }) {
  const [src, setSrc] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const token = getAuthToken();
    const controller = new AbortController();
    let objectUrl: string | null = null;
    setSrc(null);
    setFailed(false);

    fetch(`${apiBase}/api/admin/rag-assets?path=${encodeURIComponent(asset.path)}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.blob();
      })
      .then((blob) => {
        objectUrl = URL.createObjectURL(blob);
        setSrc(objectUrl);
      })
      .catch((error) => {
        if ((error as Error).name !== "AbortError") {
          setFailed(true);
        }
      });

    return () => {
      controller.abort();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [asset.path]);

  if (failed) {
    return (
      <div className="assistant-source-asset assistant-source-asset-failed">
        <Text type="secondary">{asset.file_name || "图像资产不可访问"}</Text>
      </div>
    );
  }

  return (
    <div className="assistant-source-asset">
      {src ? (
        <img src={src} alt={asset.caption || asset.file_name || "RAG 图像证据"} />
      ) : (
        <div className="assistant-source-asset-loading" />
      )}
      <span>{asset.kind === "page" ? "整页" : "图像"} · {asset.file_name}</span>
    </div>
  );
}

function LearningAssistantPage() {
  const { message } = AntApp.useApp();
  const chatDraftMaxLength = 1024;
  const [form] = Form.useForm<LearningAssistantFormValues>();
  const [turns, setTurns] = useState<LearningAssistantTurn[]>([]);
  const [selectedTurnId, setSelectedTurnId] = useState<string | null>(null);
  const [chatDraft, setChatDraft] = useState("");
  const [assistantStreaming, setAssistantStreaming] = useState(false);
  const [starterExperimentId, setStarterExperimentId] = useState<string | null>(null);
  const [starterPointKey, setStarterPointKey] = useState<string | null>(null);
  const [starterIntentId, setStarterIntentId] = useState<string>(learningAssistantPointIntents[0].id);
  const [activePointContext, setActivePointContext] = useState<LearningAssistantPointContext | null>(null);
  const chatListRef = useRef<HTMLDivElement | null>(null);
  const chapters = useChapters();
  const experiments = useExperiments("?limit=200");
  const selectedChapterId = (Form.useWatch("chapter_id", form) as string | undefined) || "CH13";
  const experimentItems = experiments.data?.items || [];
  const aiConfig = useQuery({
    queryKey: ["ai-configuration", "learning-assistant"],
    queryFn: () => api<AIConfiguration>("/api/admin/ai-configuration"),
  });
  const assistantRuntime = useQuery({
    queryKey: ["learning-assistant-runtime", "learning-assistant-status"],
    queryFn: () => api<LearningAssistantRuntime>("/api/admin/learning-assistant/runtime"),
    refetchInterval: 10000,
  });
  const selectedTurn = turns.find((turn) => turn.id === selectedTurnId) || turns.at(-1);

  useEffect(() => {
    chatListRef.current?.scrollTo({ top: chatListRef.current.scrollHeight, behavior: "smooth" });
  }, [turns]);

  useEffect(() => {
    setStarterExperimentId(null);
    setStarterPointKey(null);
    setStarterIntentId(learningAssistantPointIntents[0].id);
    setActivePointContext(null);
    setChatDraft("");
  }, [selectedChapterId]);

  const starterExperiments = useMemo(
    () => assistantChapterExperiments(experimentItems, selectedChapterId),
    [experimentItems, selectedChapterId],
  );
  const starterExperiment = starterExperiments.find((experiment) => experiment.id === starterExperimentId)
    || starterExperiments[0]
    || null;
  const starterPointOptions = useMemo(
    () => learningAssistantPointOptions(starterExperiment),
    [starterExperiment],
  );
  const starterPoint = starterPointOptions.find((point) => point.pointKey === starterPointKey)
    || starterPointOptions[0]
    || null;
  const starterIntent = learningAssistantPointIntents.find((intent) => intent.id === starterIntentId)
    || learningAssistantPointIntents[0];
  const starterPointContext = starterExperiment && starterPoint
    ? learningAssistantPointContext(selectedChapterId, starterExperiment, starterPoint)
    : null;
  const starterQuestion = starterPointContext && starterIntent.buildQuestion
    ? starterIntent.buildQuestion(starterPointContext)
    : "";
  const starterLaunchDisabled = assistantStreaming || !starterPointContext || (!chatDraft.trim() && !starterQuestion);
  const starterPointTotal = useMemo(
    () => starterExperiments.reduce((total, experiment) => total + learningAssistantPointOptions(experiment).length, 0),
    [starterExperiments],
  );

  useEffect(() => {
    setStarterExperimentId((current) => {
      if (current && starterExperiments.some((experiment) => experiment.id === current)) return current;
      return starterExperiments[0]?.id || null;
    });
  }, [starterExperiments]);

  useEffect(() => {
    setStarterPointKey((current) => {
      if (current && starterPointOptions.some((point) => point.pointKey === current)) return current;
      return starterPointOptions[0]?.pointKey || null;
    });
  }, [starterPointOptions]);

  const submit = async (
    questionInput?: string,
    pointContext?: LearningAssistantPointContext,
  ) => {
    const question = String(questionInput ?? chatDraft).trim();
    if (!question) {
      message.warning("请输入学生问题");
      return;
    }
    const values = form.getFieldsValue(true) as LearningAssistantFormValues;
    const chapterId = values.chapter_id || selectedChapterId;
    if (!chapterId) {
      message.warning("请选择章节范围");
      return;
    }
    const contextForRequest = pointContext ?? activePointContext;
    const payload: LearningAssistantAskRequest = {
      question,
      student_id: values.student_id?.trim() || null,
      chapter_id: chapterId,
      experiment_id: contextForRequest?.experimentId || null,
      point_key: contextForRequest?.pointKey || null,
      knowledge_point_ids: [],
      allow_progress_lookup: values.allow_progress_lookup ?? true,
      allow_rag_lookup: values.allow_rag_lookup ?? true,
      conversation_history: assistantConversationHistory(turns),
      max_answer_chars: 0,
    };

    const turnId = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const nextTurn: LearningAssistantTurn = {
      id: turnId,
      question: payload.question,
      answer: "",
      response: createStreamingAssistantResponse(),
      status: "running",
      streamStatus: "正在连接学习助手",
      createdAt: new Date().toISOString(),
    };
    setAssistantStreaming(true);
    setChatDraft("");
    if (pointContext) {
      setActivePointContext(pointContext);
    }
    setTurns((current) => [...current, nextTurn]);
    setSelectedTurnId(turnId);
    try {
      await postJsonStream<{
        message?: string;
        delta?: string;
        answer?: string;
        response?: LearningAssistantResponse;
      }>("/api/admin/learning-assistant/ask/stream", payload, ({ event, data }) => {
        if (event === "status") {
          setTurns((current) => current.map((turn) => (
            turn.id === turnId ? { ...turn, streamStatus: String(data.message || "学习助手正在生成") } : turn
          )));
        }
        if (event === "delta" && data.delta) {
          setTurns((current) => current.map((turn) => {
            if (turn.id !== turnId) return turn;
            const nextAnswer = `${turn.answer}${data.delta}`;
            return {
              ...turn,
              answer: nextAnswer,
              response: { ...(turn.response || createStreamingAssistantResponse()), answer: nextAnswer },
            };
          }));
        }
        if (event === "replace") {
          const answer = String(data.answer || "");
          setTurns((current) => current.map((turn) => (
            turn.id === turnId
              ? { ...turn, answer, response: { ...(turn.response || createStreamingAssistantResponse()), answer } }
              : turn
          )));
        }
        if (event === "final" && data.response) {
          setTurns((current) => current.map((turn) => (
            turn.id === turnId
              ? { ...turn, answer: data.response?.answer || turn.answer, response: data.response, status: "done", streamStatus: "" }
              : turn
          )));
          message.success("学习助手已返回");
        }
        if (event === "error") {
          throw new Error(String(data.message || "学习助手生成失败"));
        }
      });
    } catch (error) {
      setTurns((current) => current.map((turn) => (
        turn.id === turnId ? { ...turn, status: "error", error: errorMessage(error), streamStatus: "" } : turn
      )));
      message.error(errorMessage(error));
    } finally {
      setAssistantStreaming(false);
    }
  };

  const applyStarterIntent = (intent: LearningAssistantPointIntent) => {
    setStarterIntentId(intent.id);
  };
  const submitStarterQuestion = async () => {
    if (!starterPointContext) {
      message.warning("请先选择实验点位");
      return;
    }
    const question = (chatDraft.trim() || starterQuestion).trim();
    if (!question) {
      message.info("请先输入问题或选择一个提问方向");
      return;
    }
    await submit(question, starterPointContext);
  };
  const assistantChapterOptions = (chapters.data || [])
    .filter((chapter) => !isGeneralResourceTitle(chapter.chapter_title, chapter.chapter_id))
    .map((chapter) => ({
      value: chapter.chapter_id,
      label: formatChapterTitle(chapter.chapter_title, chapter.chapter_id),
    }));
  const response = selectedTurn?.response;
  const selectedTurnIndex = selectedTurn ? turns.findIndex((turn) => turn.id === selectedTurn.id) : -1;
  const policyMode = String(response?.classification?.policy_decision_mode || response?.classification?.intent || "");
  const policyLabel = learningAssistantPolicyLabels[policyMode] || policyMode || "-";
  const modeLabel = response?.mode ? learningAssistantModeLabels[response.mode] || response.mode : "-";
  const connectionStatus = aiConfig.data?.status.connectivity_status || "not_configured";
  const ragRuntime = assistantRuntime.data?.rag_runtime || aiConfig.data?.rag_runtime;
  const bgeMetrics = assistantRuntime.data?.bge_metrics || null;
  const bgeStatus = assistantRuntime.data?.bge_status
    || (assistantRuntime.data?.bge_error
      ? "unreachable"
      : bgeMetrics?.ok
        ? "healthy"
        : bgeMetrics
          ? "degraded"
          : ragRuntime?.bge_service_required
            ? "checking"
            : "not_required");
  const latestRagTrace = getRagTraceLatest(response);
  const pointContextTrace = traceRecord(response?.rag_trace || {}, "point_context");
  const pointContextEnabled = pointContextTrace.enabled === true || Boolean(pointContextTrace.point_key || pointContextTrace.requested_point_key);
  const pointContextSources = traceRecords(pointContextTrace, "sources");
  const pointContextChunkIds = Array.isArray(pointContextTrace.chunk_ids)
    ? pointContextTrace.chunk_ids.map((item) => String(item)).filter(Boolean)
    : [];
  const pointContextExperimentChunkIds = Array.isArray(pointContextTrace.experiment_chunk_ids)
    ? pointContextTrace.experiment_chunk_ids.map((item) => String(item)).filter(Boolean)
    : [];
  const pointContextTheoryChunkIds = Array.isArray(pointContextTrace.theory_chunk_ids)
    ? pointContextTrace.theory_chunk_ids.map((item) => String(item)).filter(Boolean)
    : [];
  const pointContextMissingChunkIds = Array.isArray(pointContextTrace.missing_chunk_ids)
    ? pointContextTrace.missing_chunk_ids.map((item) => String(item)).filter(Boolean)
    : [];
  const pointContextEvidenceSource = String(pointContextTrace.evidence_source || "");
  const pointContextReviewGrade = String(pointContextTrace.review_grade || "");
  const pointContextExperimentSourceCount = traceNumber(pointContextTrace.experiment_source_count);
  const pointContextTheorySourceCount = traceNumber(pointContextTrace.theory_source_count);
  const pointContextSourceCount = traceNumber(pointContextTrace.source_count);
  const traceTimings = traceRecord(latestRagTrace, "timings_ms");
  const traceCounts = traceRecord(latestRagTrace, "candidate_counts");
  const finalEvidence = traceRecords(latestRagTrace, "final_evidence");
  const keywordTotalCount = traceNumber(traceCounts.keyword_total);
  const vectorCount = traceNumber(traceCounts.vector);
  const mergedCount = traceNumber(traceCounts.merged);
  const rerankPoolCount = traceNumber(traceCounts.rerank_pool);
  const finalEvidenceCount = traceNumber(traceCounts.final);
  const traceReranked = latestRagTrace.rerank_applied === true || latestRagTrace.mode === "hybrid_bge_rerank";
  const chatDraftLength = chatDraft.length;
  const chatDraftAtLimit = chatDraftLength >= chatDraftMaxLength;
  const connectionLabels: Record<string, string> = {
    connected: "已连接",
    failed: "连接失败",
    not_configured: "未配置",
    stale: "需复检",
    untested: "待检测",
  };
  const ragHealthMeta = (() => {
    if (!ragRuntime?.rag_enabled) return { value: "关闭", tone: "muted" };
    if (!ragRuntime.hybrid_bge_enabled) return { value: "健康", tone: "ok" };
    if (bgeStatus === "healthy") return { value: "健康", tone: "ok" };
    if (bgeStatus === "checking") return { value: "检测中", tone: "warn" };
    if (bgeStatus === "degraded") return { value: "降级", tone: "warn" };
    if (bgeStatus === "unreachable" || bgeStatus === "not_configured") return { value: "异常", tone: "bad" };
    return { value: "待检测", tone: "warn" };
  })();
  const ragModeMeta = (() => {
    if (!ragRuntime?.rag_enabled) return { value: "关闭", tone: "muted" };
    if (ragRuntime.hybrid_bge_enabled) return { value: "混合", tone: "ok" };
    return { value: "关键词", tone: "warn" };
  })();
  const assistantStatusChips = [
    {
      label: "模型",
      value: connectionLabels[connectionStatus] || connectionStatus,
      tone: connectionStatus === "connected" ? "ok" : connectionStatus === "failed" ? "bad" : "muted",
    },
    {
      label: "RAG 状态",
      value: ragHealthMeta.value,
      tone: ragHealthMeta.tone,
    },
    {
      label: "RAG 模式",
      value: ragModeMeta.value,
      tone: ragModeMeta.tone,
    },
  ];

  return (
    <Space direction="vertical" size={18} className="full">
      <PageTitle
        title="学习助手"
        description="模拟学生学习页 chat，验证课程范围、实验安全、测验保护和来源证据策略。"
        extra={<Tag color="#005826">学生场景测试</Tag>}
      />
      <div className="assistant-status-strip assistant-status-bar">
        {assistantStatusChips.map((item) => (
          <div key={item.label} className={`assistant-status-chip assistant-status-chip-${item.tone}`}>
            <span>{item.label}</span>
            <strong>{item.value}</strong>
          </div>
        ))}
      </div>
      <div className="learning-assistant-workbench">
        <Card title="上下文设置" className="learning-assistant-card learning-assistant-context">
          <Text type="secondary" className="assistant-context-note">
            学生端从章节学习页进入；实验和视频点位由章节内容中的起始问题带入。
          </Text>
          <Form
            form={form}
            layout="vertical"
            initialValues={{ chapter_id: "CH13", allow_progress_lookup: true, allow_rag_lookup: true }}
          >
            <div className="settings-grid">
              <Form.Item name="student_id" label="学生学号">
                <Input placeholder="可选，用于测试本人学习进度" />
              </Form.Item>
              <Form.Item name="chapter_id" label="章节范围">
                <Select
                  showSearch
                  placeholder="选择章节"
                  optionFilterProp="label"
                  loading={chapters.isLoading}
                  options={assistantChapterOptions}
                />
              </Form.Item>
            </div>
            <div className="assistant-switch-row">
              <Form.Item name="allow_rag_lookup" valuePropName="checked" noStyle>
                <Switch checkedChildren="RAG" unCheckedChildren="RAG" />
              </Form.Item>
              <Text type="secondary">允许本次检索课程证据</Text>
              <Form.Item name="allow_progress_lookup" valuePropName="checked" noStyle>
                <Switch checkedChildren="进度" unCheckedChildren="进度" />
              </Form.Item>
              <Text type="secondary">允许查询该学生本人进度</Text>
            </div>
          </Form>
        </Card>

        <Card
          title="多轮对话"
          className="learning-assistant-card learning-assistant-chat"
          extra={
            <Space size={8}>
              <Text type="secondary">{turns.length} 轮</Text>
              <Button
                size="small"
                onClick={() => {
                  setTurns([]);
                  setSelectedTurnId(null);
                  setActivePointContext(null);
                }}
                disabled={!turns.length || assistantStreaming}
              >
                清空
              </Button>
            </Space>
          }
        >
          <div className="assistant-chat-shell">
            <div className="assistant-chat-scroll" ref={chatListRef}>
              {turns.length ? (
                <div className="assistant-chat-list">
                  {turns.map((turn, index) => (
                    <button
                      type="button"
                      key={turn.id}
                      className={`assistant-turn ${selectedTurn?.id === turn.id ? "selected" : ""}`}
                      onClick={() => setSelectedTurnId(turn.id)}
                    >
                      <div className="assistant-message user">
                        <div className="assistant-message-meta">
                          <Text strong>学生</Text>
                          <Text type="secondary">{dayjs(turn.createdAt).format("HH:mm:ss")}</Text>
                        </div>
                        <div>{turn.question}</div>
                      </div>
                      <div className={`assistant-message assistant ${turn.status}`}>
                        <div className="assistant-message-meta">
                          <Space size={8} wrap>
                            <Text strong>学习助手</Text>
                            <Tag className={`assistant-response-chip assistant-response-chip-${turn.status}`}>
                              {turn.status === "done" ? "完成" : turn.status === "error" ? "失败" : "生成中"}
                            </Tag>
                            {assistantResponseTypeLabel(turn) ? (
                              <Tag className="assistant-response-chip">{assistantResponseTypeLabel(turn)}</Tag>
                            ) : null}
                          </Space>
                          <Text type="secondary" className="assistant-turn-index">{assistantTurnLabel(turn, index)}</Text>
                        </div>
                        {turn.status === "running" ? (
                          <div className="assistant-stream-progress">
                            <span className="assistant-stream-dots" aria-hidden="true">
                              <span />
                              <span />
                              <span />
                            </span>
                            <span>{assistantStreamPhaseLabel(turn.streamStatus, Boolean(turn.answer))}</span>
                          </div>
                        ) : null}
                        {turn.error ? <div className="assistant-error-line">{turn.error}</div> : null}
                        <div className={`assistant-answer ${turn.answer ? "" : "assistant-answer-empty"}`}>
                          {turn.answer ? renderAssistantMarkdown(turn.answer) : (
                            turn.status === "running" ? (
                              <div className="assistant-stream-skeleton">
                                <span />
                                <span />
                              </div>
                            ) : renderAssistantMarkdown("等待模型输出...")
                          )}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="assistant-empty-start assistant-starter-panel">
                  <div className="assistant-starter-heading">
                    <div className="assistant-empty-title">从本章实验点位开始提问</div>
                    <Text type="secondary">
                      章节范围由左侧选择；这里选择实验、点位和想问的方向，发送后继续正常多轮对话。
                    </Text>
                  </div>
                  {experiments.isLoading ? (
                    <Spin tip="正在读取本章实验点位" />
                  ) : starterPointTotal ? (
                    <>
                      <div className="assistant-starter-grid">
                        <section className="assistant-starter-column">
                          <div className="assistant-starter-section-title">1. 选择实验</div>
                          <div className="assistant-starter-list">
                            {starterExperiments.map((experiment) => {
                              const pointCount = learningAssistantPointOptions(experiment).length;
                              const selected = starterExperiment?.id === experiment.id;
                              return (
                                <button
                                  type="button"
                                  key={experiment.id}
                                  className={`assistant-starter-option ${selected ? "selected" : ""}`}
                                  onClick={() => {
                                    setStarterExperimentId(experiment.id);
                                    setStarterPointKey(null);
                                    setStarterIntentId(learningAssistantPointIntents[0].id);
                                    setChatDraft("");
                                  }}
                                  disabled={assistantStreaming}
                                >
                                  <span className="assistant-starter-option-title">
                                    {experiment.code || experiment.title || experiment.id}
                                  </span>
                                  <span className="assistant-starter-option-meta">{experiment.title || experiment.id}</span>
                                  <span className="assistant-starter-option-badge">{pointCount} 点位</span>
                                </button>
                              );
                            })}
                          </div>
                        </section>

                        <section className="assistant-starter-column">
                          <div className="assistant-starter-section-title">2. 选择点位</div>
                          {starterPointOptions.length ? (
                            <div className="assistant-starter-list">
                              {starterPointOptions.map((point) => {
                                const selected = starterPoint?.pointKey === point.pointKey;
                                return (
                                  <button
                                    type="button"
                                    key={point.pointKey}
                                    className={`assistant-starter-option ${selected ? "selected" : ""}`}
                                  onClick={() => {
                                    setStarterPointKey(point.pointKey);
                                    setStarterIntentId(learningAssistantPointIntents[0].id);
                                    setChatDraft("");
                                  }}
                                    disabled={assistantStreaming}
                                  >
                                    <span className="assistant-starter-option-title">点位 {point.pointIndex}</span>
                                    <span className="assistant-starter-option-meta">{point.pointTitle}</span>
                                  </button>
                                );
                              })}
                            </div>
                          ) : (
                            <Text type="secondary" className="assistant-starter-empty-text">
                              当前实验暂无视频点位，仍可在下方输入章节问题。
                            </Text>
                          )}
                        </section>

                        <section className="assistant-starter-column">
                          <div className="assistant-starter-section-title">3. 选择想问的方向</div>
                          <div className="assistant-starter-intents">
                            {learningAssistantPointIntents.map((intent) => (
                              <button
                                type="button"
                                key={intent.id}
                                className={`assistant-starter-intent ${starterIntent.id === intent.id ? "selected" : ""}`}
                                onClick={() => applyStarterIntent(intent)}
                                disabled={assistantStreaming || !starterPointContext}
                              >
                                <span>{intent.label}</span>
                                <small>{intent.description}</small>
                              </button>
                            ))}
                          </div>
                        </section>
                      </div>

                      <div className="assistant-starter-preview">
                        <div className="assistant-starter-preview-question">
                          {starterQuestion ? (
                            renderAssistantInlineMarkdown(starterQuestion)
                          ) : (
                            <Text type="secondary">已选择点位上下文，请在下方输入自己的问题。</Text>
                          )}
                        </div>
                        <div className="assistant-starter-launch-row">
                          <AIGlowButton
                            type="button"
                            className="assistant-starter-launch"
                            onClick={() => void submitStarterQuestion()}
                            disabled={starterLaunchDisabled}
                            glowColor="rgba(194, 255, 219, 0.44)"
                            glowSoftColor="rgba(73, 219, 132, 0.22)"
                            washColor="rgba(183, 255, 210, 0.5)"
                            washSoftColor="rgba(72, 211, 126, 0.24)"
                            background="linear-gradient(135deg, #00552c 0%, #04723c 48%, #139653 100%)"
                          >
                            <span className="assistant-launch-label">从这个问题开始</span>
                            <span className="assistant-launch-arrow">
                              <ArrowRightOutlined />
                            </span>
                          </AIGlowButton>
                        </div>
                      </div>
                    </>
                  ) : (
                    <Empty
                      image={Empty.PRESENTED_IMAGE_SIMPLE}
                      description="当前章节暂无可用视频点位"
                    >
                      <Text type="secondary">仍可在下方输入框发送章节范围内的问题。</Text>
                    </Empty>
                  )}
                </div>
              )}
            </div>
            <div className="assistant-chat-composer">
              {activePointContext ? (
                <div className="assistant-active-point-context">
                  <div>
                    <Text type="secondary">当前点位</Text>
                    <div className="assistant-active-point-title">
                      {[activePointContext.experimentCode, activePointContext.experimentTitle]
                        .map((item) => String(item || "").trim())
                        .filter(Boolean)
                        .join(" · ") || activePointContext.experimentId || "-"}
                      {" / "}
                      点位 {activePointContext.pointIndex || "-"}
                    </div>
                    <Text type="secondary">
                      {activePointContext.pointTitle || activePointContext.pointKey || "-"}
                    </Text>
                  </div>
                  <Button
                    size="small"
                    onClick={() => setActivePointContext(null)}
                    disabled={assistantStreaming}
                  >
                    清除
                  </Button>
                </div>
              ) : null}
              <div className={`assistant-composer-box ${chatDraftAtLimit ? "assistant-composer-box-limit" : ""}`}>
                <Input.TextArea
                  className="assistant-chat-textarea"
                  value={chatDraft}
                  onChange={(event) => setChatDraft(event.target.value)}
                  onPressEnter={(event) => {
                    if (!event.shiftKey && !(event.nativeEvent as KeyboardEvent).isComposing) {
                      event.preventDefault();
                      void submit();
                    }
                  }}
                  autoSize={{ minRows: 1, maxRows: 8 }}
                  maxLength={chatDraftMaxLength}
                  placeholder="输入学生问题"
                  disabled={assistantStreaming}
                />
                <div className="assistant-composer-footer">
                  <span className={`assistant-composer-count ${chatDraftAtLimit ? "assistant-composer-count-limit" : ""}`}>
                    {chatDraftLength} / {chatDraftMaxLength}
                  </span>
                  <Button
                    type="primary"
                    icon={<ArrowRightOutlined />}
                    loading={assistantStreaming}
                    disabled={!chatDraft.trim() || assistantStreaming}
                    onClick={() => void submit()}
                  >
                    发送
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </Card>

        <Card
          title={selectedTurnIndex >= 0 ? `轮次诊断 · 第 ${selectedTurnIndex + 1} 轮` : "轮次诊断"}
          className="learning-assistant-card learning-assistant-inspector"
        >
          {selectedTurn && response ? (
            <Space direction="vertical" size={14} className="full">
              <Space wrap>
                <Tag color="#005826">{policyLabel}</Tag>
                <Tooltip title={response.mode}>
                  <Tag>{modeLabel}</Tag>
                </Tooltip>
                {response.review_required ? <Tag color="#b8892f">记录留痕</Tag> : null}
              </Space>

              <div>
                <Text strong>护栏评估</Text>
                <div className="assistant-pill-list">
                  {response.guardrail_decisions.length ? response.guardrail_decisions.map((item, index) => {
                    const guardrailCode = String(item.code || "");
                    const guardrailAction = String(item.action || "");
                    return (
                      <Tooltip
                        key={`${guardrailCode || "guardrail"}-${index}`}
                        title={`${guardrailCode || "guardrail"} · ${guardrailAction || "-"}${item.reason ? `：${item.reason}` : ""}`}
                      >
                        <Tag color="#356f9c">
                          {learningAssistantGuardrailLabels[guardrailCode] || guardrailCode || "护栏"} · {learningAssistantActionLabels[guardrailAction] || guardrailAction || "-"}
                        </Tag>
                      </Tooltip>
                    );
                  }) : <Text type="secondary">无触发</Text>}
                </div>
              </div>

              <div>
                <Text strong>固定点位上下文</Text>
                {pointContextEnabled ? (
                  <>
                    <Descriptions column={1} size="small" className="assistant-rag-desc">
                      <Descriptions.Item label="实验">
                        {[
                          pointContextTrace.experiment_code,
                          pointContextTrace.experiment_title,
                        ].map((item) => String(item || "").trim()).filter(Boolean).join(" · ") || String(pointContextTrace.experiment_id || "-")}
                      </Descriptions.Item>
                      <Descriptions.Item label="点位">
                        <Tag color={pointContextTrace.resolved === false ? "orange" : "#005826"}>
                          {pointContextTrace.resolved === false ? "按传入点位保留" : "已解析"}
                        </Tag>
                        <Text>{String(pointContextTrace.point_title || pointContextTrace.point_key || "-")}</Text>
                      </Descriptions.Item>
                      <Descriptions.Item label="点位 key">
                        <Tag>{String(pointContextTrace.point_key || "-")}</Tag>
                        {pointContextTrace.requested_point_key && pointContextTrace.requested_point_key !== pointContextTrace.point_key ? (
                          <Tag color="blue">传入：{String(pointContextTrace.requested_point_key)}</Tag>
                        ) : null}
                      </Descriptions.Item>
                      <Descriptions.Item label="固定证据">
                        <Tag color={pointContextEvidenceSource === "manual_reviewed_point_evidence" ? "#005826" : "default"}>
                          {pointContextEvidenceSource === "manual_reviewed_point_evidence" ? "人工审核点位证据" : pointContextEvidenceSource || "未装载"}
                        </Tag>
                        <Tag color={pointContextTrace.manual_reviewed === true ? "#005826" : "default"}>
                          {pointContextTrace.manual_reviewed === true ? "manual reviewed" : "未确认人工审核"}
                        </Tag>
                        {pointContextReviewGrade ? <Tag color={pointContextReviewGrade === "weak_but_best_available" ? "orange" : "#005826"}>{pointContextReviewGrade}</Tag> : null}
                        <Tag color={pointContextSourceCount ? "#005826" : "default"}>来源 {pointContextSourceCount ?? 0}</Tag>
                        <Tag>实验证据 {pointContextExperimentSourceCount ?? pointContextExperimentChunkIds.length}</Tag>
                        <Tag>理论证据 {pointContextTheorySourceCount ?? pointContextTheoryChunkIds.length}</Tag>
                        {pointContextMissingChunkIds.length ? <Tag color="orange">缺失 chunk {pointContextMissingChunkIds.length}</Tag> : null}
                        {pointContextChunkIds.slice(0, 4).map((chunkId) => <Tag key={chunkId}>{chunkId}</Tag>)}
                      </Descriptions.Item>
                    </Descriptions>
                    {pointContextSources.length ? (
                      <div className="assistant-point-evidence-list">
                        {pointContextSources.slice(0, 3).map((source, index) => (
                          <div key={String(source.chunk_id || index)} className="assistant-point-evidence-item">
                            <Space size={8} wrap>
                              <Tag color="#005826">固定 #{index + 1}</Tag>
                              {source.evidence_kind ? <Tag>{String(source.evidence_kind)}</Tag> : null}
                              <Text strong>{String(source.caption || source.source_file || source.chunk_id || "点位证据")}</Text>
                              {source.page_number ? <Text type="secondary">p.{String(source.page_number)}</Text> : null}
                              {Array.isArray(source.assets) && source.assets.length ? <Tag color="blue">图像 {source.assets.length}</Tag> : null}
                            </Space>
                            <Text type="secondary" className="block-text">
                              {renderAssistantInlineMarkdown(String(source.text_preview || ""))}
                            </Text>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <Text type="secondary" className="block-text">
                        本轮保留了结构化点位，但未装载到人工审核点位固定来源片段。请确认 experiment_video_point_evidence 已导入且 source_chunks 引用有效。
                      </Text>
                    )}
                  </>
                ) : (
                  <Text type="secondary" className="block-text">本轮未携带结构化视频点位。</Text>
                )}
              </div>

              <div>
                <Text strong>补充 RAG 查询与重排</Text>
                <Descriptions column={1} size="small" className="assistant-rag-desc">
                  <Descriptions.Item label="模式">{String(latestRagTrace.mode || "-")}</Descriptions.Item>
                  <Descriptions.Item label="最终排序">
                    <Tag color={traceReranked ? "#005826" : "default"}>
                      {traceReranked ? "BGE reranker 已重排" : String(latestRagTrace.final_sort || "未使用重排")}
                    </Tag>
                    {traceReranked ? <Text type="secondary">来源证据按 final_evidence.rank 展示</Text> : null}
                  </Descriptions.Item>
                  <Descriptions.Item label="生成 Query">
                    {Array.isArray(latestRagTrace.generated_queries) && latestRagTrace.generated_queries.length
                      ? latestRagTrace.generated_queries.map((item) => <Tag key={String(item)}>{String(item)}</Tag>)
                      : <Text type="secondary">无</Text>}
                  </Descriptions.Item>
                  <Descriptions.Item label="降级">
                    {Array.isArray(latestRagTrace.fallbacks) && latestRagTrace.fallbacks.length
                      ? latestRagTrace.fallbacks.map((item, index) => (
                        <Tag color="orange" key={`fallback-${index}`}>
                          {String((item as Record<string, unknown>).stage || "fallback")}
                        </Tag>
                      ))
                      : <Text type="secondary">无</Text>}
                  </Descriptions.Item>
                </Descriptions>
                <div className="assistant-trace-metrics">
                  <div>
                    <span>总耗时</span>
                    <strong>{formatTraceMs(traceTimings.total_ms)}</strong>
                  </div>
                  <div>
                    <span>Query 生成</span>
                    <strong>{formatTraceMs(traceTimings.query_generation_ms)}</strong>
                  </div>
                  <div>
                    <span>BGE Embedding</span>
                    <strong>{formatTraceMs(traceTimings.bge_embed_ms_total)}</strong>
                  </div>
                  <div>
                    <span>向量召回</span>
                    <strong>{formatTraceMs(traceTimings.vector_recall_ms_total)}</strong>
                  </div>
                  <div>
                    <span>BGE Rerank</span>
                    <strong>{formatTraceMs(traceTimings.bge_rerank_ms)}</strong>
                  </div>
                  <div>
                    <span>候选池</span>
                    <strong>
                      {mergedCount === undefined
                        ? "-"
                        : `${keywordTotalCount || 0} + ${vectorCount || 0} → ${mergedCount}`}
                    </strong>
                  </div>
                  <div>
                    <span>重排池</span>
                    <strong>{rerankPoolCount === undefined ? "-" : String(rerankPoolCount)}</strong>
                  </div>
                  <div>
                    <span>最终证据</span>
                    <strong>{finalEvidenceCount === undefined ? "-" : String(finalEvidenceCount)}</strong>
                  </div>
                </div>
              </div>

              <div>
                <Text strong>来源证据</Text>
                <div className="assistant-source-list">
                  {response.sources.length ? response.sources.map((source, index) => {
                    const evidence = findFinalEvidence(source, finalEvidence);
                    return (
                      <div key={source.chunk_id} className="assistant-source-item">
                        <div className="assistant-source-head">
                          <Space size={8} wrap>
                            <Tag color={traceReranked ? "#005826" : "default"}>
                              #{String(evidence?.rank || index + 1)}
                            </Tag>
                            <Text strong>{source.caption || source.source_file || source.chunk_id}</Text>
                          </Space>
                          {source.page_number ? <Text type="secondary">p.{source.page_number}</Text> : null}
                        </div>
                        <div className="assistant-source-tags">
                          <Tag>{sourceKindLabel(evidence?.source)}</Tag>
                          {source.content_type ? <Tag>{source.content_type === "figure" ? "图像 chunk" : source.content_type}</Tag> : null}
                          {evidence?.rerank_score !== undefined ? (
                            <Tag color="#005826">rerank {String(evidence.rerank_score)}</Tag>
                          ) : null}
                          {evidence?.score !== undefined ? <Tag>score {String(evidence.score)}</Tag> : null}
                          <Tag>{source.chunk_id}</Tag>
                        </div>
                        {source.section_path?.length ? (
                          <Text type="secondary" className="block-text">
                            章节：{source.section_path.join(" / ")}
                          </Text>
                        ) : null}
                        {evidence?.query ? (
                          <Text type="secondary" className="block-text">Query：{String(evidence.query)}</Text>
                        ) : null}
                        <Text type="secondary" className="block-text">
                          {renderAssistantInlineMarkdown(source.text_preview)}
                        </Text>
                        {source.assets?.length ? (
                          <div className="assistant-source-assets">
                            {source.assets.slice(0, 3).map((asset) => (
                              <RagAssetPreview asset={asset} key={`${source.chunk_id}-${asset.kind}-${asset.path}`} />
                            ))}
                          </div>
                        ) : null}
                      </div>
                    );
                  }) : <Text type="secondary" className="block-text">无来源</Text>}
                </div>
              </div>

              <div>
                <Text strong>分类与工具调用</Text>
                <pre className="assistant-json">
                  {JSON.stringify({
                    classification: response.classification,
                    tool_calls: response.tool_calls,
                    rag_trace: response.rag_trace,
                    guardrail_decisions: response.guardrail_decisions,
                  }, null, 2)}
                </pre>
              </div>
            </Space>
          ) : (
            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="选择一个助手轮次查看诊断" />
          )}
        </Card>
      </div>
    </Space>
  );
}

export default App;
