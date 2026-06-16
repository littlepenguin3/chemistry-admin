import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { App as AntApp, Button, Card, Empty, Progress, Select, Space, Statistic, Table, Tag, Typography } from "antd";
import dayjs from "dayjs";

import { api, apiBase, getAuthToken } from "../../api";
import type { AnalyticsDashboard, ClassItem, StudentReport, WeakPointsResponse } from "../../api";
import { PageTitle } from "../../components/PageTitle";
import { QueryState } from "../../components/QueryState";
import { optionDiagnosticRoleLabel, statusTag } from "../../lib/status";

const { Text } = Typography;

export function AnalyticsPage() {
  const { message } = AntApp.useApp();
  const classes = useQuery({ queryKey: ["classes"], queryFn: () => api<ClassItem[]>("/api/admin/classes") });
  const [classId, setClassId] = useState<string>();
  const [studentId, setStudentId] = useState<string>();
  const activeClassId = classId || classes.data?.[0]?.id;
  const dashboard = useQuery({
    queryKey: ["analytics-dashboard", activeClassId],
    queryFn: () => api<AnalyticsDashboard>(`/api/admin/analytics/classes/${activeClassId}/dashboard`),
    enabled: Boolean(activeClassId),
  });
  const weakPoints = useQuery({
    queryKey: ["weak-points", activeClassId],
    queryFn: () => api<WeakPointsResponse>(`/api/admin/analytics/classes/${activeClassId}/weak-points`),
    enabled: Boolean(activeClassId),
  });
  const studentReport = useQuery({
    queryKey: ["student-report", activeClassId, studentId],
    queryFn: () => api<StudentReport>(`/api/admin/analytics/classes/${activeClassId}/students/${studentId}`),
    enabled: Boolean(activeClassId && studentId),
  });

  const exportReport = async () => {
    if (!activeClassId) return;
    const response = await fetch(`${apiBase}/api/admin/analytics/classes/${activeClassId}/export`, {
      headers: { Authorization: `Bearer ${getAuthToken()}` },
    });
    if (!response.ok) {
      message.error("导出失败");
      return;
    }
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `class-${activeClassId}-experiment-report.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const matrixColumns = useMemo(() => {
    const experiments = dashboard.data?.experiments || [];
    return [
      { title: "学号", dataIndex: "student_id", fixed: "left" as const, width: 130 },
      { title: "姓名", dataIndex: "student_name", fixed: "left" as const, width: 120 },
      ...experiments.map((experiment) => ({
        title: experiment.code,
        width: 140,
        render: (_: unknown, row: AnalyticsDashboard["matrix"][number]) => {
          const state = row.experiments[experiment.id];
          return (
            <Space direction="vertical" size={2} className="full">
              {statusTag(state?.status)}
              <Progress percent={Math.round(state?.completion_percent || 0)} size="small" />
              <Text type="secondary">{state?.best_score ?? "-"} 分</Text>
            </Space>
          );
        },
      })),
    ];
  }, [dashboard.data?.experiments]);

  return (
    <Space direction="vertical" size={18} className="full">
      <PageTitle
        title="学情分析"
        description="按班级查看实验进度、答题情况、个人路径和薄弱点。"
        extra={<Button onClick={() => void exportReport()}>导出报告</Button>}
      />
      <Card>
        <Select
          placeholder="选择班级"
          style={{ width: 280 }}
          value={activeClassId}
          onChange={(value) => {
            setClassId(value);
            setStudentId(undefined);
          }}
          options={(classes.data || []).map((item) => ({ value: item.id, label: item.class_name }))}
        />
      </Card>
      <QueryState loading={dashboard.isLoading} error={dashboard.error} empty={!activeClassId}>
        <div className="stat-grid">
          <Card>
            <Statistic title="班级人数" value={dashboard.data?.metrics.class_size || 0} />
          </Card>
          <Card>
            <Statistic title="活跃学生" value={dashboard.data?.metrics.active_students || 0} />
          </Card>
          <Card>
            <Statistic title="完成率" value={dashboard.data?.metrics.completion_rate || 0} suffix="%" />
          </Card>
          <Card>
            <Statistic title="平均分" value={dashboard.data?.metrics.average_score || 0} suffix="分" />
          </Card>
        </div>
        <Card title="实验完成矩阵">
          <Table
            rowKey="student_id"
            scroll={{ x: 1180 }}
            dataSource={dashboard.data?.matrix || []}
            columns={matrixColumns}
            onRow={(record) => ({
              onClick: () => setStudentId(record.student_id),
            })}
          />
        </Card>
        <div className="two-column">
          <Card title="薄弱点">
            <Space direction="vertical" size={14} className="full">
              <Table
                rowKey={(row) => row.point_key}
                size="small"
                dataSource={weakPoints.data?.point_items || []}
                pagination={{ pageSize: 5, showSizeChanger: false }}
                locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无点位答题数据" /> }}
                columns={[
                  {
                    title: "实验点位",
                    render: (_: unknown, row) => (
                      <Space direction="vertical" size={2}>
                        <Text strong>{row.point_title}</Text>
                        <Text type="secondary">
                          {row.experiment_code || ""} {row.experiment_title || ""}
                        </Text>
                      </Space>
                    ),
                  },
                  { title: "作答", dataIndex: "attempt_count", width: 70 },
                  { title: "错题", dataIndex: "incorrect_count", width: 70 },
                  { title: "错误率", dataIndex: "incorrect_rate", width: 90, render: (value) => `${value || 0}%` },
                  {
                    title: "诊断",
                    width: 150,
                    render: (_: unknown, row) => (
                      <Space size={4} wrap>
                        {(row.selected_option_links || []).slice(0, 2).map((link, index) => (
                          <Tag key={`${link.label || "option"}-${index}`}>
                            {link.label ? `${link.label} · ` : ""}
                            {optionDiagnosticRoleLabel(link.role)}
                          </Tag>
                        ))}
                        {row.kp_unmapped ? <Tag>KP 未映射</Tag> : null}
                      </Space>
                    ),
                  },
                ]}
              />
              <div>
                <Text type="secondary">题目/KP 回退视图</Text>
                <Table
                  rowKey={(row) => String(row.question_id || row.experiment_id || row.stem)}
                  size="small"
                  dataSource={weakPoints.data?.items || []}
                  pagination={{ pageSize: 4, showSizeChanger: false }}
                  columns={[
                    { title: "实验", render: (_: unknown, row) => `${row.experiment_code || ""} ${row.experiment_title || ""}` },
                    { title: "题目", dataIndex: "stem" },
                    { title: "错误率", dataIndex: "incorrect_rate", width: 90, render: (value) => `${value || 0}%` },
                    { title: "KP", dataIndex: "unmapped", width: 90, render: (value) => (value ? <Tag>未映射</Tag> : <Tag color="green">已映射</Tag>) },
                  ]}
                />
              </div>
            </Space>
          </Card>
          <Card title="学生路径">
            {studentId ? (
              <QueryState loading={studentReport.isLoading} error={studentReport.error}>
                <Space direction="vertical" size={14} className="full">
                  <Space wrap>
                    <Tag color="blue">学生 {String(studentReport.data?.student?.student_name || studentId)}</Tag>
                    <Tag>{studentReport.data?.attempts?.length || 0} 次答题</Tag>
                    <Tag color={studentReport.data?.weak_video_points?.length ? "gold" : "green"}>
                      弱点 {studentReport.data?.weak_video_points?.length || 0}
                    </Tag>
                  </Space>
                  <Table
                    rowKey={(row) => row.point_key}
                    size="small"
                    title={() => "薄弱实验点位"}
                    dataSource={studentReport.data?.weak_video_points || []}
                    pagination={{ pageSize: 4, showSizeChanger: false }}
                    locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无点位弱项" /> }}
                    columns={[
                      { title: "点位", dataIndex: "point_title" },
                      { title: "实验", render: (_: unknown, row) => `${row.experiment_code || ""} ${row.experiment_title || ""}` },
                      { title: "错误次数", dataIndex: "incorrect_count", width: 90 },
                    ]}
                  />
                  <Table
                    rowKey={(row) => String(row.id || row.question_id || row.created_at)}
                    size="small"
                    title={() => "最近答题"}
                    dataSource={(studentReport.data?.attempts || []).slice(0, 8)}
                    pagination={false}
                    columns={[
                      {
                        title: "实验",
                        width: 150,
                        render: (_: unknown, row) => `${row.experiment_code || ""} ${row.experiment_title || ""}`,
                      },
                      { title: "题目", dataIndex: "stem" },
                      {
                        title: "点位",
                        width: 180,
                        render: (_: unknown, row) => (
                          <Space size={4} wrap>
                            {(row.metadata?.primary_points || []).slice(0, 2).map((point) => (
                              <Tag key={point.point_key || point.point_title}>{point.point_title || point.point_key}</Tag>
                            ))}
                          </Space>
                        ),
                      },
                      {
                        title: "结果",
                        width: 80,
                        render: (_: unknown, row) =>
                          row.correct === true ? <Tag color="green">正确</Tag> : row.correct === false ? <Tag color="red">错误</Tag> : <Tag>未判定</Tag>,
                      },
                    ]}
                  />
                  <Table
                    rowKey={(row) => String(row.id || row.created_at || row.event_type)}
                    size="small"
                    title={() => "时间线"}
                    dataSource={(studentReport.data?.timeline || []).slice(0, 8)}
                    pagination={false}
                    columns={[
                      { title: "时间", dataIndex: "created_at", width: 150, render: (value) => (value ? dayjs(String(value)).format("MM-DD HH:mm") : "-") },
                      { title: "事件", dataIndex: "event_type" },
                      {
                        title: "结果",
                        width: 80,
                        render: (_: unknown, row) =>
                          row.correct === true ? <Tag color="green">正确</Tag> : row.correct === false ? <Tag color="red">错误</Tag> : <Tag>-</Tag>,
                      },
                    ]}
                  />
                </Space>
              </QueryState>
            ) : (
              <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="点击矩阵中的学生查看路径" />
            )}
          </Card>
        </div>
      </QueryState>
    </Space>
  );
}
