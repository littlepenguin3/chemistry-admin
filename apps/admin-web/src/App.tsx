import { useEffect, useState } from "react";
import { Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import type { ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { lazy, Suspense } from "react";
import { motion, useReducedMotion } from "motion/react";
import { errorMessage } from "./lib/errors";
import {
  App as AntApp,
  Badge,
  Button,
  Card,
  ConfigProvider,
  Form,
  Input,
  Layout,
  Menu,
  Space,
  Spin,
  Tooltip,
  Typography,
  theme,
} from "antd";
import {
  ApiOutlined,
  BarChartOutlined,
  BookOutlined,
  ExperimentOutlined,
  LeftOutlined,
  LogoutOutlined,
  MessageOutlined,
  QuestionCircleOutlined,
  SafetyCertificateOutlined,
  SettingOutlined,
  TeamOutlined,
  VideoCameraOutlined,
} from "@ant-design/icons";
import { api, getAuthToken, setAuthToken } from "./api";
import type { User } from "./api";

const { Header, Sider, Content } = Layout;
const { Text, Title } = Typography;
const sysuLogoSrc = `${import.meta.env.BASE_URL}sysu-logo.svg`;
const adminSiderWidth = 248;
const adminSiderCollapsedWidth = 72;
const navBrandTransition = { type: "tween" as const, duration: 0.16, ease: [0.22, 1, 0.36, 1] as const };
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
const ExperimentsPage = lazy(async () => {
  const module = await import("./features/experiments/ExperimentsPage");
  return { default: module.ExperimentsPage };
});
const QuestionBanksPage = lazy(async () => {
  const module = await import("./features/question-bank/QuestionBanksPage");
  return { default: module.QuestionBanksPage };
});
const LearningAssistantPage = lazy(async () => {
  const module = await import("./features/learning-assistant/LearningAssistantPage");
  return { default: module.LearningAssistantPage };
});

type LoginResponse = {
  access_token: string;
  user: User;
};

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
            <Route
              path="/experiments"
              element={
                <Suspense fallback={<div className="center-panel"><Spin /></div>}>
                  <ExperimentsPage />
                </Suspense>
              }
            />
            <Route
              path="/videos"
              element={
                <Suspense fallback={<div className="center-panel"><Spin /></div>}>
                  <VideoResourcesPage />
                </Suspense>
              }
            />
            <Route
              path="/question-banks"
              element={
                <Suspense fallback={<div className="center-panel"><Spin /></div>}>
                  <QuestionBanksPage />
                </Suspense>
              }
            />
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
            <Route
              path="/learning-assistant"
              element={
                <Suspense fallback={<div className="center-panel"><Spin /></div>}>
                  <LearningAssistantPage />
                </Suspense>
              }
            />
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

export default App;
