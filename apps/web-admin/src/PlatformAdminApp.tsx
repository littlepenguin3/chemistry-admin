import { useEffect, useMemo, useState } from "react";
import {
  App as AntApp,
  Button,
  Card,
  Checkbox,
  Empty,
  Form,
  Input,
  Layout,
  Modal,
  Result,
  Select,
  Space,
  Spin,
  Statistic,
  Table,
  Tag,
  Typography,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import {
  DeleteOutlined,
  EditOutlined,
  KeyOutlined,
  LogoutOutlined,
  PlusOutlined,
  ReloadOutlined,
  SafetyCertificateOutlined,
  SearchOutlined,
  TeamOutlined,
} from "@ant-design/icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import dayjs from "dayjs";

import {
  createTeacherAccount,
  disableTeacherAccount,
  errorMessage,
  getAuthToken,
  listTeacherAccounts,
  patchTeacherAccount,
  resetTeacherPassword,
  setAuthToken,
  verifyWebAdminSession,
  type TeacherAccount,
} from "./api";

const { Header, Content, Sider } = Layout;
const { Text, Title } = Typography;

type LoginValues = {
  token: string;
};

type CreateValues = {
  username: string;
  display_name: string;
  password: string;
  must_change_password: boolean;
};

type EditValues = {
  display_name: string;
  role: "admin" | "teacher";
  status: "active" | "disabled";
};

type ResetValues = {
  password: string;
  must_change_password: boolean;
};

function formatDate(value?: string | null): string {
  return value ? dayjs(value).format("YYYY-MM-DD HH:mm") : "-";
}

function statusTag(status: TeacherAccount["status"]) {
  return status === "active" ? <Tag color="green">启用</Tag> : <Tag color="default">停用</Tag>;
}

function roleTag(role: TeacherAccount["role"]) {
  return role === "admin" ? <Tag color="cyan">完整教师权限</Tag> : <Tag color="gold">历史教师角色</Tag>;
}

function LoginScreen({ onLoggedIn }: { onLoggedIn: () => void }) {
  const { message } = AntApp.useApp();
  const [form] = Form.useForm<LoginValues>();
  const [submitting, setSubmitting] = useState(false);

  const submit = async (values: LoginValues) => {
    const token = values.token.trim();
    if (!token) return;
    setSubmitting(true);
    setAuthToken(token);
    try {
      await verifyWebAdminSession();
      message.success("已进入平台运维后台");
      onLoggedIn();
    } catch (error) {
      setAuthToken("");
      message.error(errorMessage(error));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="login-screen">
      <Card className="login-panel">
        <Space direction="vertical" size={22} className="full-width">
          <div className="brand-lockup">
            <span className="brand-mark">
              <SafetyCertificateOutlined />
            </span>
            <div>
              <Text strong>中山大学化学教学平台</Text>
              <Text type="secondary" className="block-text">
                平台运维后台
              </Text>
            </div>
          </div>
          <div>
            <Text className="eyebrow">平台运维</Text>
            <Title level={2}>教师后台账号管理</Title>
          </div>
          <Form form={form} layout="vertical" onFinish={submit}>
            <Form.Item name="token" label="运维访问令牌" rules={[{ required: true, message: "请输入运维访问令牌" }]}>
              <Input.Password size="large" autoComplete="current-password" />
            </Form.Item>
            <Button type="primary" size="large" htmlType="submit" loading={submitting} block>
              进入运维后台
            </Button>
          </Form>
        </Space>
      </Card>
    </main>
  );
}

function TeacherAccountWorkbench() {
  const { message, modal } = AntApp.useApp();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<TeacherAccount | null>(null);
  const [resetAccount, setResetAccount] = useState<TeacherAccount | null>(null);
  const [createForm] = Form.useForm<CreateValues>();
  const [editForm] = Form.useForm<EditValues>();
  const [resetForm] = Form.useForm<ResetValues>();

  const accountsQuery = useQuery({
    queryKey: ["teacher-accounts"],
    queryFn: listTeacherAccounts,
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["teacher-accounts"] });

  const createMutation = useMutation({
    mutationFn: createTeacherAccount,
    onSuccess: () => {
      message.success("教师账号已创建");
      setCreateOpen(false);
      createForm.resetFields();
      invalidate();
    },
    onError: (error) => message.error(errorMessage(error)),
  });

  const editMutation = useMutation({
    mutationFn: ({ id, values }: { id: string; values: EditValues }) => patchTeacherAccount(id, values),
    onSuccess: () => {
      message.success("教师账号已更新");
      setEditingAccount(null);
      invalidate();
    },
    onError: (error) => message.error(errorMessage(error)),
  });

  const resetMutation = useMutation({
    mutationFn: ({ id, values }: { id: string; values: ResetValues }) => resetTeacherPassword(id, values),
    onSuccess: () => {
      message.success("密码已重置，原有教师登录态已失效");
      setResetAccount(null);
      resetForm.resetFields();
      invalidate();
    },
    onError: (error) => message.error(errorMessage(error)),
  });

  const disableMutation = useMutation({
    mutationFn: disableTeacherAccount,
    onSuccess: () => {
      message.success("教师账号已停用");
      invalidate();
    },
    onError: (error) => message.error(errorMessage(error)),
  });

  useEffect(() => {
    if (editingAccount) {
      editForm.setFieldsValue({
        display_name: editingAccount.display_name,
        role: editingAccount.role,
        status: editingAccount.status,
      });
    }
  }, [editForm, editingAccount]);

  const accounts = accountsQuery.data || [];
  const filteredAccounts = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    if (!keyword) return accounts;
    return accounts.filter((account) =>
      [account.username, account.display_name, account.role, account.status].some((value) =>
        value.toLowerCase().includes(keyword),
      ),
    );
  }, [accounts, search]);

  const activeCount = accounts.filter((account) => account.status === "active").length;
  const disabledCount = accounts.filter((account) => account.status === "disabled").length;

  const columns: ColumnsType<TeacherAccount> = [
    {
      title: "账号",
      dataIndex: "username",
      key: "username",
      fixed: "left",
      width: 200,
      render: (value: string, account) => (
        <Space direction="vertical" size={0} className="account-cell">
          <Text strong className="account-name" title={value}>
            {value}
          </Text>
          <Text type="secondary" className="account-id">
            {account.id}
          </Text>
        </Space>
      ),
    },
    {
      title: "显示名",
      dataIndex: "display_name",
      key: "display_name",
      width: 150,
    },
    {
      title: "角色",
      dataIndex: "role",
      key: "role",
      render: roleTag,
      width: 150,
    },
    {
      title: "状态",
      dataIndex: "status",
      key: "status",
      render: statusTag,
      width: 96,
    },
    {
      title: "下次登录改密",
      dataIndex: "must_change_password",
      key: "must_change_password",
      render: (value: boolean) => (value ? <Tag color="orange">需要</Tag> : <Tag>不需要</Tag>),
      width: 130,
    },
    {
      title: "密码版本",
      dataIndex: "password_version",
      key: "password_version",
      width: 96,
    },
    {
      title: "更新时间",
      dataIndex: "updated_at",
      key: "updated_at",
      render: formatDate,
      width: 130,
    },
    {
      title: "最近登录",
      dataIndex: "last_login_at",
      key: "last_login_at",
      render: formatDate,
      width: 130,
    },
    {
      title: "操作",
      key: "actions",
      fixed: "right",
      width: 196,
      render: (_, account) => (
        <Space>
          <Button icon={<EditOutlined />} onClick={() => setEditingAccount(account)}>
            编辑
          </Button>
          <Button icon={<KeyOutlined />} onClick={() => setResetAccount(account)}>
            重置
          </Button>
          <Button
            danger
            icon={<DeleteOutlined />}
            disabled={account.status === "disabled"}
            loading={disableMutation.isPending && disableMutation.variables === account.id}
            onClick={() =>
              modal.confirm({
                title: "停用教师后台账号",
                content: `确认停用 ${account.display_name}？该账号记录会保留，并将状态改为停用。`,
                okText: "停用",
                okButtonProps: { danger: true },
                cancelText: "取消",
                onOk: () => disableMutation.mutateAsync(account.id),
              })
            }
          >
            停用
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <>
      <section className="metrics-strip">
        <Card>
          <Statistic title="教师后台账号" value={accounts.length} prefix={<TeamOutlined />} />
        </Card>
        <Card>
          <Statistic title="启用中" value={activeCount} valueStyle={{ color: "#005826" }} />
        </Card>
        <Card>
          <Statistic title="已停用" value={disabledCount} />
        </Card>
      </section>

      <section className="workbench-section">
        <div className="toolbar">
          <Input
            className="search-input"
            allowClear
            prefix={<SearchOutlined />}
            placeholder="搜索账号、显示名、角色或状态"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          <Space>
            <Button icon={<ReloadOutlined />} onClick={() => accountsQuery.refetch()} loading={accountsQuery.isFetching}>
              刷新
            </Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateOpen(true)}>
              新建教师账号
            </Button>
          </Space>
        </div>
        <Table<TeacherAccount>
          rowKey="id"
          columns={columns}
          dataSource={filteredAccounts}
          loading={accountsQuery.isLoading}
          scroll={{ x: 1248 }}
          pagination={{ pageSize: 10, showSizeChanger: false }}
          locale={{
            emptyText: accountsQuery.isError ? (
              <Result
                status="error"
                title="教师账号列表加载失败"
                subTitle={errorMessage(accountsQuery.error)}
                extra={<Button onClick={() => accountsQuery.refetch()}>重试</Button>}
              />
            ) : (
              <Empty description="暂无教师后台账号" />
            ),
          }}
        />
      </section>

      <Modal
        title="新建教师后台账号"
        open={createOpen}
        okText="创建"
        cancelText="取消"
        confirmLoading={createMutation.isPending}
        onCancel={() => setCreateOpen(false)}
        onOk={() => createForm.submit()}
        destroyOnHidden
      >
        <Form
          form={createForm}
          layout="vertical"
          initialValues={{ must_change_password: true }}
          onFinish={(values) => createMutation.mutate(values)}
        >
          <Form.Item name="username" label="账号" rules={[{ required: true, message: "请输入账号" }]}>
            <Input autoComplete="off" />
          </Form.Item>
          <Form.Item
            name="display_name"
            label="显示名"
            rules={[{ required: true, message: "请输入显示名" }]}
          >
            <Input />
          </Form.Item>
          <Form.Item name="password" label="初始密码" rules={[{ required: true, min: 8, message: "密码至少 8 位" }]}>
            <Input.Password autoComplete="new-password" />
          </Form.Item>
          <Form.Item name="must_change_password" valuePropName="checked">
            <Checkbox>教师下次登录时必须修改密码</Checkbox>
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="编辑教师后台账号"
        open={Boolean(editingAccount)}
        okText="保存"
        cancelText="取消"
        confirmLoading={editMutation.isPending}
        onCancel={() => setEditingAccount(null)}
        onOk={() => editForm.submit()}
        destroyOnHidden
      >
        <Form
          form={editForm}
          layout="vertical"
          onFinish={(values) => {
            if (!editingAccount) return;
            editMutation.mutate({ id: editingAccount.id, values });
          }}
        >
          <Form.Item
            name="display_name"
            label="显示名"
            rules={[{ required: true, message: "请输入显示名" }]}
          >
            <Input />
          </Form.Item>
          <Form.Item name="role" label="角色" rules={[{ required: true, message: "请选择角色" }]}>
            <Select
              options={[
                { value: "admin", label: "完整教师权限" },
                { value: "teacher", label: "历史教师角色" },
              ]}
            />
          </Form.Item>
          <Form.Item name="status" label="状态" rules={[{ required: true, message: "请选择状态" }]}>
            <Select
              options={[
                { value: "active", label: "启用" },
                { value: "disabled", label: "停用" },
              ]}
            />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="重置教师账号密码"
        open={Boolean(resetAccount)}
        okText="重置"
        cancelText="取消"
        confirmLoading={resetMutation.isPending}
        onCancel={() => setResetAccount(null)}
        onOk={() => resetForm.submit()}
        destroyOnHidden
      >
        <Form
          form={resetForm}
          layout="vertical"
          initialValues={{ must_change_password: true }}
          onFinish={(values) => {
            if (!resetAccount) return;
            resetMutation.mutate({ id: resetAccount.id, values });
          }}
        >
          <Form.Item name="password" label="新密码" rules={[{ required: true, min: 8, message: "密码至少 8 位" }]}>
            <Input.Password autoComplete="new-password" />
          </Form.Item>
          <Form.Item name="must_change_password" valuePropName="checked">
            <Checkbox>教师下次登录时必须修改密码</Checkbox>
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
}

function AdminWorkspace({ onLogout }: { onLogout: () => void }) {
  return (
    <Layout className="admin-layout">
      <Sider width={248} className="admin-sider">
        <div className="sider-brand">
          <span className="sider-icon">
            <SafetyCertificateOutlined />
          </span>
          <div>
            <Text strong>平台运维后台</Text>
            <Text className="block-text" type="secondary">
              教师账号管理
            </Text>
          </div>
        </div>
        <div className="sider-menu-item active">
          <TeamOutlined />
          <span>教师账号</span>
        </div>
      </Sider>
      <Layout>
        <Header className="admin-header">
          <div>
            <Text className="eyebrow">平台运维</Text>
            <Title level={3}>教师后台账号管理</Title>
          </div>
          <Button icon={<LogoutOutlined />} onClick={onLogout}>
            清除令牌
          </Button>
        </Header>
        <Content className="admin-content">
          <TeacherAccountWorkbench />
        </Content>
      </Layout>
    </Layout>
  );
}

export function PlatformAdminApp() {
  const queryClient = useQueryClient();
  const [sessionTick, setSessionTick] = useState(0);
  const hasToken = Boolean(getAuthToken());

  const sessionQuery = useQuery({
    queryKey: ["web-admin-session", sessionTick],
    queryFn: verifyWebAdminSession,
    enabled: hasToken,
    retry: false,
  });

  useEffect(() => {
    if (sessionQuery.isError) {
      setAuthToken("");
      queryClient.clear();
      setSessionTick((value) => value + 1);
    }
  }, [queryClient, sessionQuery.isError]);

  const logout = () => {
    setAuthToken("");
    queryClient.clear();
    setSessionTick((value) => value + 1);
  };

  if (!hasToken) {
    return <LoginScreen onLoggedIn={() => setSessionTick((value) => value + 1)} />;
  }

  if (sessionQuery.isLoading || !sessionQuery.data) {
    return (
      <div className="center-screen">
        <Spin size="large" />
      </div>
    );
  }

  return <AdminWorkspace onLogout={logout} />;
}
