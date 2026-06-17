import { useMemo, useState } from "react";
import type { MouseEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import { App as AntApp, Button, Card, Drawer, Empty, Select, Space, Statistic, Table, Tabs, Tag, Tooltip, Typography } from "antd";
import type { TableColumnsType } from "antd";
import dayjs from "dayjs";

import { api, apiBase, getAuthToken } from "../../api";
import type { AnalyticsDashboard, ClassItem, Experiment, StudentAttempt, StudentReport, TeacherReportAiContent } from "../../api";
import { PageTitle } from "../../components/PageTitle";
import { QueryState } from "../../components/QueryState";

const { Text } = Typography;

type MatrixRow = AnalyticsDashboard["matrix"][number];
type DetailTarget =
  | { kind: "student"; studentId: string }
  | { kind: "experiment"; studentId: string; experimentId: string };

export function AnalyticsPage() {
  const { message } = AntApp.useApp();
  const classes = useQuery({ queryKey: ["classes"], queryFn: () => api<ClassItem[]>("/api/admin/classes") });
  const [classId, setClassId] = useState<string>();
  const [detailTarget, setDetailTarget] = useState<DetailTarget | null>(null);
  const activeClassId = classId || classes.data?.[0]?.id;
  const dashboard = useQuery({
    queryKey: ["analytics-dashboard", activeClassId],
    queryFn: () => api<AnalyticsDashboard>(`/api/admin/analytics/classes/${activeClassId}/dashboard`),
    enabled: Boolean(activeClassId),
  });
  const selectedStudentId = detailTarget?.studentId;
  const studentReport = useQuery({
    queryKey: ["student-report", activeClassId, selectedStudentId],
    queryFn: () => api<StudentReport>(`/api/admin/analytics/classes/${activeClassId}/students/${selectedStudentId}`),
    enabled: Boolean(activeClassId && selectedStudentId),
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
    link.download = `class-${activeClassId}-experiment-mastery.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const matrixColumns: TableColumnsType<MatrixRow> = useMemo(() => {
    const experiments = dashboard.data?.experiments || [];
    return [
      {
        title: "学生",
        dataIndex: "student_name",
        fixed: "left",
        width: 190,
        render: (_value: unknown, row: MatrixRow) => (
          <Space orientation="vertical" size={1} className="analytics-student-cell">
            <Text strong>{row.student_name || row.student_id}</Text>
            <Text type="secondary">{row.student_id}</Text>
          </Space>
        ),
      },
      {
        title: "均分",
        dataIndex: "average_score",
        fixed: "left",
        width: 92,
        sorter: (a: MatrixRow, b: MatrixRow) => (a.average_score || 0) - (b.average_score || 0),
        render: (value: number | undefined) => <ScorePill score={value ?? 0} />,
      },
      ...experiments.map((experiment) => ({
        title: <ExperimentColumnTitle experiment={experiment} />,
        width: 154,
        align: "center" as const,
        render: (_value: unknown, row: MatrixRow) => (
          <ScorePill
            score={row.experiments[experiment.id]?.mastery_score ?? 50}
            muted={!row.experiments[experiment.id]?.has_mastery}
            evidenceCount={row.experiments[experiment.id]?.evidence_count}
            onClick={(event) => {
              event.stopPropagation();
              setDetailTarget({ kind: "experiment", studentId: row.student_id, experimentId: experiment.id });
            }}
          />
        ),
      })),
    ];
  }, [dashboard.data?.experiments]);

  const experimentCount = dashboard.data?.experiments.length || 0;
  const tableScrollX = Math.max(980, 282 + experimentCount * 154);
  const selectedStudent = dashboard.data?.matrix.find((row) => row.student_id === selectedStudentId) || null;
  const selectedExperiment =
    detailTarget?.kind === "experiment"
      ? dashboard.data?.experiments.find((experiment) => experiment.id === detailTarget.experimentId) || null
      : null;
  const selectedExperimentState =
    detailTarget?.kind === "experiment" && selectedStudent
      ? selectedStudent.experiments[detailTarget.experimentId]
      : undefined;

  return (
    <Space orientation="vertical" size={18} className="full analytics-page">
      <PageTitle
        title="学情分析"
        description="班级实验分数总览"
        extra={<Button onClick={() => void exportReport()}>导出分数</Button>}
      />
      <Card className="analytics-toolbar-card">
        <Space wrap size={12}>
          <Select
            placeholder="选择班级"
            style={{ width: 280 }}
            value={activeClassId}
            onChange={(value) => {
              setClassId(value);
              setDetailTarget(null);
            }}
            options={(classes.data || []).map((item) => ({ value: item.id, label: item.class_name }))}
          />
          <Text type="secondary">未答题实验按 50 分计入。</Text>
        </Space>
      </Card>
      <QueryState loading={dashboard.isLoading} error={dashboard.error} empty={!activeClassId}>
        <div className="stat-grid analytics-stat-grid">
          <Card>
            <Statistic title="班级人数" value={dashboard.data?.metrics.class_size || 0} />
          </Card>
          <Card>
            <Statistic title="班级均分" value={dashboard.data?.metrics.average_score || 0} precision={1} suffix="分" />
          </Card>
          <Card>
            <Statistic title="实验数量" value={dashboard.data?.metrics.published_experiments || 0} />
          </Card>
          <Card>
            <Statistic title="已有答题学生" value={dashboard.data?.metrics.active_students || 0} />
          </Card>
        </div>
        <Card
          title="学生实验分数"
          extra={<Text type="secondary">{dashboard.data?.matrix.length || 0} 名学生</Text>}
          className="analytics-matrix-card"
        >
          <Table
            rowKey="student_id"
            size="small"
            scroll={{ x: tableScrollX, y: "calc(100vh - 390px)" }}
            dataSource={dashboard.data?.matrix || []}
            columns={matrixColumns}
            pagination={{ pageSize: 20, showSizeChanger: false }}
            locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无学生" /> }}
            onRow={(record) => ({
              onClick: () => setDetailTarget({ kind: "student", studentId: record.student_id }),
            })}
          />
        </Card>
      </QueryState>
      <StudentReportDrawer
        open={detailTarget?.kind === "student"}
        studentId={selectedStudentId}
        studentName={selectedStudent?.student_name}
        report={studentReport.data}
        loading={studentReport.isLoading}
        error={studentReport.error}
        onClose={() => setDetailTarget(null)}
      />
      <ExperimentEvidenceDrawer
        open={detailTarget?.kind === "experiment"}
        student={selectedStudent}
        experiment={selectedExperiment}
        state={selectedExperimentState}
        report={studentReport.data}
        loading={studentReport.isLoading}
        error={studentReport.error}
        onClose={() => setDetailTarget(null)}
      />
    </Space>
  );
}

function ExperimentColumnTitle({ experiment }: { experiment: Experiment }) {
  const family = experimentFamily(experiment);
  const title = cleanExperimentTitle(experiment.title);
  return (
    <Tooltip title={`${family ? `${family} / ` : ""}${title}`}>
      <div className="analytics-experiment-title">
        <strong>{title}</strong>
        <span>{family || experiment.code}</span>
      </div>
    </Tooltip>
  );
}

function StudentReportDrawer({
  open,
  studentId,
  studentName,
  report,
  loading,
  error,
  onClose,
}: {
  open: boolean;
  studentId?: string;
  studentName?: string;
  report?: StudentReport;
  loading: boolean;
  error: unknown;
  onClose: () => void;
}) {
  const latest = report?.latest_posttest_report || null;
  return (
    <Drawer
      title={`${studentName || studentId || "学生"} · 最近后测报告`}
      width={720}
      open={open}
      onClose={onClose}
      destroyOnHidden
    >
      <QueryState loading={loading} error={error}>
        {latest ? (
          <Space orientation="vertical" size={16} className="full analytics-drawer-content">
            <div className="analytics-report-summary">
              <Statistic title="后测得分" value={latest.score ?? 0} precision={1} suffix="分" />
              <Statistic title="正确题数" value={latest.correct_count} suffix={`/ ${latest.total_count}`} />
              <div>
                <Text type="secondary">完成时间</Text>
                <strong>{formatDate(latest.completed_at)}</strong>
              </div>
            </div>
            <section className="analytics-drawer-section">
              <Text type="secondary">本轮实验</Text>
              <Space size={6} wrap>
                {latest.experiments.map((experiment) => (
                  <Tag key={experiment.id}>{cleanExperimentTitle(String(experiment.title || experiment.code || experiment.id))}</Tag>
                ))}
              </Space>
            </section>
            <AiContentCard title="学习总结" value={latest.ai_summary} />
            <AiContentCard title="错题讲解" value={latest.ai_mistake_explanation} />
            <section className="analytics-drawer-section">
              <div className="analytics-section-title">
                <strong>错题明细</strong>
                <Text type="secondary">{latest.wrong_answers.length} 题</Text>
              </div>
              <AttemptTable
                attempts={latest.wrong_answers}
                emptyText="本次后测没有错题"
                pagination={latest.wrong_answers.length > 5 ? { pageSize: 5, showSizeChanger: false } : false}
              />
            </section>
          </Space>
        ) : (
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="该学生暂无已完成后测报告" />
        )}
      </QueryState>
    </Drawer>
  );
}

function ExperimentEvidenceDrawer({
  open,
  student,
  experiment,
  state,
  report,
  loading,
  error,
  onClose,
}: {
  open: boolean;
  student: MatrixRow | null;
  experiment: Experiment | null;
  state?: MatrixRow["experiments"][string];
  report?: StudentReport;
  loading: boolean;
  error: unknown;
  onClose: () => void;
}) {
  const attempts = (report?.attempts || []).filter((attempt) => attempt.experiment_id === experiment?.id);
  const posttestAttempts = attempts.filter((attempt) => attempt.attempt_kind === "posttest");
  const pretestAttempts = attempts.filter((attempt) => String(attempt.attempt_kind || "").startsWith("pretest"));
  return (
    <Drawer
      title={`${student?.student_name || student?.student_id || "学生"} · ${experiment ? cleanExperimentTitle(experiment.title) : "实验"}`}
      width={760}
      open={open}
      onClose={onClose}
      destroyOnHidden
    >
      <QueryState loading={loading} error={error}>
        {experiment ? (
          <Space orientation="vertical" size={16} className="full analytics-drawer-content">
            <div className="analytics-evidence-summary">
              <div>
                <Text type="secondary">当前实验 mastery</Text>
                <ScorePill score={state?.mastery_score ?? 50} muted={!state?.has_mastery} evidenceCount={state?.evidence_count} />
              </div>
              <div>
                <Text type="secondary">答题证据</Text>
                <strong>{attempts.length} 条</strong>
              </div>
              <div>
                <Text type="secondary">所属学习主题</Text>
                <strong>{experimentFamily(experiment) || experiment.code}</strong>
              </div>
            </div>
            <Tabs
              items={[
                {
                  key: "posttest",
                  label: `课后测试 ${posttestAttempts.length}`,
                  children: <AttemptTable attempts={posttestAttempts} emptyText="暂无该实验的课后测试记录" />,
                },
                {
                  key: "pretest",
                  label: `课前摸底 ${pretestAttempts.length}`,
                  children: <AttemptTable attempts={pretestAttempts} emptyText="暂无该实验的课前摸底记录" />,
                },
                {
                  key: "history",
                  label: `全部记录 ${attempts.length}`,
                  children: <AttemptTable attempts={attempts} emptyText="暂无该实验答题记录" />,
                },
              ]}
            />
          </Space>
        ) : (
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="请选择实验" />
        )}
      </QueryState>
    </Drawer>
  );
}

function AiContentCard({ title, value }: { title: string; value?: TeacherReportAiContent | null }) {
  return (
    <Card size="small" title={title} extra={value ? <Tag>{value.source === "ai" ? "AI 总结" : "规则总结"}</Tag> : null}>
      {value ? (
        <Space orientation="vertical" size={8} className="full">
          <Text>{value.text}</Text>
          {value.generated_at ? <Text type="secondary">生成时间：{formatDate(value.generated_at)}</Text> : null}
        </Space>
      ) : (
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="学生尚未生成" />
      )}
    </Card>
  );
}

function AttemptTable({
  attempts,
  emptyText,
  pagination = { pageSize: 6, showSizeChanger: false },
}: {
  attempts: StudentAttempt[];
  emptyText: string;
  pagination?: false | { pageSize: number; showSizeChanger: boolean };
}) {
  return (
    <Table
      rowKey={(row) => String(row.id || row.question_id || row.created_at)}
      size="small"
      dataSource={attempts}
      columns={attemptColumns}
      pagination={pagination}
      locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={emptyText} /> }}
    />
  );
}

const attemptColumns: TableColumnsType<StudentAttempt> = [
  {
    title: "阶段",
    dataIndex: "attempt_kind_label",
    width: 110,
    render: (value) => <Tag>{String(value || "未标记")}</Tag>,
  },
  {
    title: "题目",
    dataIndex: "stem",
    render: (value, row) => (
      <Space orientation="vertical" size={4} className="full">
        <Text>{String(value || "-")}</Text>
        <Text type="secondary">{row.experiment_title ? cleanExperimentTitle(row.experiment_title) : ""}</Text>
      </Space>
    ),
  },
  {
    title: "作答",
    width: 96,
    render: (_value, row) => renderAnswer(row.submitted_answer_value),
  },
  {
    title: "正确答案",
    width: 110,
    render: (_value, row) => renderAnswer(row.correct_answer),
  },
  {
    title: "结果",
    width: 74,
    render: (_value, row) =>
      row.correct === true ? <Tag color="green">正确</Tag> : row.correct === false ? <Tag color="red">错误</Tag> : <Tag>未判定</Tag>,
  },
];

function ScorePill({
  score,
  muted = false,
  evidenceCount = 0,
  onClick,
}: {
  score: number;
  muted?: boolean;
  evidenceCount?: number;
  onClick?: (event: MouseEvent<HTMLButtonElement>) => void;
}) {
  const title = muted ? "暂无答题证据，按默认 50 分计入" : `答题证据 ${evidenceCount} 条`;
  const className = `analytics-score-pill ${scoreTone(score)} ${muted ? "is-default" : ""}`;
  if (onClick) {
    return (
      <Tooltip title={title}>
        <button className={className} type="button" onClick={onClick}>
          {formatScore(score)}
        </button>
      </Tooltip>
    );
  }
  return (
    <Tooltip title={title}>
      <span className={className}>{formatScore(score)}</span>
    </Tooltip>
  );
}

function formatScore(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function formatDate(value?: string | null) {
  return value ? dayjs(String(value)).format("YYYY-MM-DD HH:mm") : "-";
}

function renderAnswer(value: unknown) {
  if (value === null || value === undefined || value === "") return <Text type="secondary">-</Text>;
  if (Array.isArray(value)) return value.join("、");
  if (typeof value === "boolean") return value ? "正确" : "错误";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function scoreTone(value: number) {
  if (value < 40) return "score-low";
  if (value < 60) return "score-watch";
  if (value < 80) return "score-steady";
  return "score-high";
}

function cleanExperimentTitle(value: string) {
  return value.replace(/^实验\s*\d+-\d+\s*/, "").trim();
}

function experimentFamily(experiment: Experiment) {
  const metadata = experiment.metadata || {};
  const parentTitle = typeof metadata.parent_title === "string" ? metadata.parent_title : "";
  return cleanExperimentTitle(parentTitle);
}
