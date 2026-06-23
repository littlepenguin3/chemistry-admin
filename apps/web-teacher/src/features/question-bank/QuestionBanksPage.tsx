import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Alert,
  App as AntApp,
  Button,
  Card,
  Descriptions,
  Drawer,
  Empty,
  Flex,
  Input,
  InputNumber,
  Modal,
  Popconfirm,
  Select,
  Space,
  Spin,
  Statistic,
  Table,
  Tag,
  Tooltip,
  Tree,
  Typography,
} from "antd";
import type { DataNode } from "antd/es/tree";
import {
  CheckCircleOutlined,
  CloseCircleOutlined,
  DatabaseOutlined,
  ExperimentOutlined,
  FileTextOutlined,
  FolderOutlined,
  MessageOutlined,
  ReloadOutlined,
} from "@ant-design/icons";

import type { ApiList } from "../../api/common";
import { api, postJson, postJsonStream } from "../../api/http";
import type {
  CatalogQuestionBankNode,
  CatalogQuestionBankResponse,
  Question,
  QuestionDraft,
  QuestionWorkbenchCandidate,
  QuestionWorkbenchSession,
} from "../../api/questionBank";
import { listCatalogQuestionBank, refreshCatalogQuestionBankEvidence } from "../../api/questionBank";
import type { LearningAssistantRuntime } from "../../api/learningAssistant";
import { PageTitle } from "../../components/PageTitle";
import { QueryState } from "../../components/QueryState";
import { errorMessage } from "../../lib/errors";
import { formatChapterTitle } from "../../lib/resourceUtils";
import {
  answerText,
  candidatePayload,
  candidateQuestionPoints,
  candidateQuestionType,
  candidateStem,
  candidateValidationErrors,
  evidenceStatusTag,
  evidenceStatusText,
  questionBankStatusTag,
  questionBankStatusText,
  questionPointTitles,
  questionTypeLabel,
  questionWorkbenchGateFromRuntime,
  sourceRefLabel,
  textbookSectionLabels,
  workbenchEvidenceSectionsFromPackage,
} from "./questionBankDisplay";
import "./question-bank.css";

const { Text, Title } = Typography;

type TreeNodeWithTitle = DataNode & {
  title: ReactNode;
  children?: TreeNodeWithTitle[];
};

function nodePath(node?: CatalogQuestionBankNode | null) {
  return (node?.breadcrumb_titles || []).join(" / ");
}

function cleanText(value?: string | null) {
  return String(value || "").trim();
}

function principleText(node?: CatalogQuestionBankNode | null) {
  if (!node) return "";
  if (node.principle_mode === "equation") {
    return cleanText(node.principle_equation) || cleanText(node.principle_text);
  }
  return cleanText(node.principle_text) || cleanText(node.principle_equation);
}

function nodeEvidenceTone(node?: CatalogQuestionBankNode | null) {
  const status = node?.evidence_status || "missing";
  if (["available", "succeeded", "fresh"].includes(status)) return "green";
  if (["pending", "running", "stale"].includes(status)) return "gold";
  return "default";
}

function nodeEvidenceLabel(node?: CatalogQuestionBankNode | null) {
  const status = node?.evidence_status || "missing";
  const labels: Record<string, string> = {
    available: "证据可用",
    succeeded: "证据可用",
    fresh: "证据可用",
    pending: "证据待生成",
    running: "证据生成中",
    stale: "证据需刷新",
    missing: "证据缺失",
    failed: "证据失败",
  };
  return labels[status] || status;
}

function statusCountLine(node?: CatalogQuestionBankNode | null) {
  const counts = node?.counts;
  if (!counts) return "0 题";
  return `${counts.question_count || 0} 题 · 选 ${counts.choice_count || 0} · 判 ${counts.true_false_count || 0} · 填 ${counts.fill_blank_count || 0}`;
}

function buildQuestionBankTree(nodes: CatalogQuestionBankNode[]): TreeNodeWithTitle[] {
  const childrenByParent = new Map<string | null, CatalogQuestionBankNode[]>();
  nodes.forEach((node) => {
    const parent = node.parent_id || null;
    const current = childrenByParent.get(parent) || [];
    current.push(node);
    childrenByParent.set(parent, current);
  });
  const sortNodes = (items: CatalogQuestionBankNode[]) =>
    [...items].sort((a, b) => Number(a.display_order || 0) - Number(b.display_order || 0) || a.title.localeCompare(b.title, "zh-Hans-CN"));
  const toTreeNode = (node: CatalogQuestionBankNode): TreeNodeWithTitle => {
    const isPoint = node.node_kind === "point";
    const counts = node.counts || {};
    return {
      key: node.node_id,
      icon: isPoint ? <ExperimentOutlined /> : <FolderOutlined />,
      title: (
        <span className={`question-catalog-tree-title is-${node.node_kind}`}>
          <span className="question-catalog-tree-name">{node.title}</span>
          <span className="question-catalog-tree-count">
            {isPoint ? `${counts.question_count || 0} 题` : `${node.descendant_point_count || 0} 点`}
          </span>
        </span>
      ),
      selectable: true,
      children: sortNodes(childrenByParent.get(node.node_id) || []).map(toTreeNode),
    };
  };
  return sortNodes(childrenByParent.get(null) || []).map(toTreeNode);
}

function selectedPointNodes(nodes: CatalogQuestionBankNode[]) {
  return nodes.filter((node) => node.node_kind === "point");
}

function questionParams({
  selectedPoint,
  questionType,
  statusFilter,
  search,
}: {
  selectedPoint?: CatalogQuestionBankNode | null;
  questionType?: string;
  statusFilter?: string;
  search?: string;
}) {
  const params = new URLSearchParams({ limit: "1000" });
  if (selectedPoint?.node_id) params.set("point_node_id", selectedPoint.node_id);
  if (selectedPoint?.canonical_point_id) params.set("canonical_point_id", selectedPoint.canonical_point_id);
  if (questionType) params.set("question_type", questionType);
  if (statusFilter && statusFilter !== "all") params.set("status_filter", statusFilter);
  if (search?.trim()) params.set("search", search.trim());
  return params;
}

function draftParams(selectedPoint?: CatalogQuestionBankNode | null) {
  const params = new URLSearchParams();
  if (selectedPoint?.node_id) params.set("point_node_id", selectedPoint.node_id);
  if (selectedPoint?.canonical_point_id) params.set("canonical_point_id", selectedPoint.canonical_point_id);
  return params;
}

export function QuestionBanksPage() {
  const { message, modal } = AntApp.useApp();
  const queryClient = useQueryClient();
  const [chapterId, setChapterId] = useState<string>("CH13");
  const [selectedNodeId, setSelectedNodeId] = useState<string>();
  const [questionType, setQuestionType] = useState<string>();
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [selectedQuestion, setSelectedQuestion] = useState<Question | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [aiWorkbenchOpen, setAiWorkbenchOpen] = useState(false);
  const [aiWorkbenchSessionId, setAiWorkbenchSessionId] = useState<string>();
  const [workbenchPrompt, setWorkbenchPrompt] = useState("");
  const [workbenchQuestionTypes, setWorkbenchQuestionTypes] = useState<Question["question_type"][]>([
    "single_choice",
    "true_false",
    "fill_blank",
  ]);
  const [workbenchCount, setWorkbenchCount] = useState(3);
  const [workbenchStreaming, setWorkbenchStreaming] = useState(false);
  const [workbenchStreamStatus, setWorkbenchStreamStatus] = useState("");

  const catalog = useQuery<CatalogQuestionBankResponse>({
    queryKey: ["question-bank-catalog", chapterId],
    queryFn: () => listCatalogQuestionBank(chapterId),
  });
  const nodes = catalog.data?.items || [];
  const points = useMemo(() => selectedPointNodes(nodes), [nodes]);

  useEffect(() => {
    const current = nodes.find((node) => node.node_id === selectedNodeId);
    if (current?.node_kind === "point") return;
    setSelectedNodeId(points[0]?.node_id);
  }, [nodes, points, selectedNodeId]);

  const selectedPoint = useMemo(
    () => nodes.find((node) => node.node_id === selectedNodeId && node.node_kind === "point") || null,
    [nodes, selectedNodeId],
  );
  const selectedChapter = catalog.data?.chapters.find((chapter) => chapter.chapter_id === chapterId);
  const treeData = useMemo(() => buildQuestionBankTree(nodes), [nodes]);
  const expandedRootKeys = useMemo(
    () => nodes.filter((node) => !node.parent_id && node.node_kind === "directory").map((node) => node.node_id),
    [nodes],
  );

  const params = useMemo(
    () => questionParams({ selectedPoint, questionType, statusFilter, search }),
    [questionType, search, selectedPoint, statusFilter],
  );
  const questions = useQuery({
    queryKey: ["question-bank-catalog-questions", params.toString()],
    queryFn: () => api<ApiList<Question>>(`/api/admin/question-banks/questions?${params.toString()}`),
    enabled: Boolean(selectedPoint),
  });
  const draftsQueryParams = useMemo(() => draftParams(selectedPoint), [selectedPoint]);
  const drafts = useQuery({
    queryKey: ["question-bank-catalog-drafts", draftsQueryParams.toString()],
    queryFn: () => api<ApiList<QuestionDraft>>(`/api/admin/question-banks/drafts?${draftsQueryParams.toString()}`),
    enabled: Boolean(selectedPoint),
  });
  const assistantRuntime = useQuery({
    queryKey: ["learning-assistant-runtime", "question-bank-workbench"],
    queryFn: () => api<LearningAssistantRuntime>("/api/admin/learning-assistant/runtime"),
    refetchInterval: 10000,
  });
  const aiWorkbench = useQuery({
    queryKey: ["question-ai-workbench", aiWorkbenchSessionId],
    queryFn: () => api<QuestionWorkbenchSession>(`/api/admin/question-banks/workbench-sessions/${aiWorkbenchSessionId}`),
    enabled: Boolean(aiWorkbenchOpen && aiWorkbenchSessionId),
  });

  const workbenchContext = aiWorkbench.data?.context_snapshot || {};
  const workbenchCandidates = aiWorkbench.data?.candidates || [];
  const workbenchTurns = aiWorkbench.data?.turns || [];
  const workbenchEvidencePackage = workbenchContext.evidence_package;
  const workbenchEvidenceSections = workbenchEvidenceSectionsFromPackage(workbenchEvidencePackage);
  const questionWorkbenchGate = questionWorkbenchGateFromRuntime(assistantRuntime.data);
  const workbenchRagGate = workbenchContext.rag_gate;
  const workbenchStatusTone = workbenchRagGate?.healthy === false ? "blocked" : questionWorkbenchGate.tone;
  const workbenchEvidenceSourceCount = workbenchEvidencePackage?.source_count ?? (workbenchContext.source_refs || []).length;
  const workbenchEvidenceStatusText = `已读取 ${workbenchEvidenceSourceCount || 0} 条已绑定教材证据`;
  const selectedEvidenceReady = Boolean(
    selectedPoint && ["succeeded", "partial", "fresh", "available"].includes(selectedPoint.evidence_status || ""),
  );
  const evidenceBlockedText = selectedPoint ? `${nodeEvidenceLabel(selectedPoint)}，请先刷新教材证据。` : "请先选择一个点位";

  const refreshQuestionBank = () => {
    void queryClient.invalidateQueries({ queryKey: ["question-bank-catalog"] });
    void queryClient.invalidateQueries({ queryKey: ["question-bank-catalog-questions"] });
    void queryClient.invalidateQueries({ queryKey: ["question-bank-catalog-drafts"] });
  };

  const refreshEvidence = useMutation({
    mutationFn: (payload: {
      chapter_id?: string | null;
      point_node_id?: string | null;
      force?: boolean;
      process_now?: boolean;
      process_limit?: number;
    }) => refreshCatalogQuestionBankEvidence(payload),
    onSuccess: (result) => {
      message.success(
        result.queued_count
          ? `已开始刷新 ${result.queued_count} 个点位证据，预估 ${result.qwen_call_estimate} 次 Qwen 调用`
          : `没有新点位需要刷新，已跳过 ${result.skipped_count} 个点位`,
      );
      refreshQuestionBank();
      window.setTimeout(refreshQuestionBank, 2500);
      window.setTimeout(refreshQuestionBank, 8000);
    },
    onError: (error) => message.error(`证据刷新失败：${errorMessage(error)}`),
  });

  const startWorkbench = useMutation({
    mutationFn: (payload: {
      mode: "create";
      experiment_id: string;
      point_node_id: string;
      point_node_ids: string[];
      point_key?: string | null;
    }) => postJson<QuestionWorkbenchSession>("/api/admin/question-banks/workbench-sessions", payload),
    onSuccess: (result) => {
      setAiWorkbenchSessionId(result.id);
      setAiWorkbenchOpen(true);
      void queryClient.invalidateQueries({ queryKey: ["question-ai-workbench", result.id] });
    },
    onError: (error) => message.error(`AI 工作台打开失败：${errorMessage(error)}`),
  });

  const publishCandidate = useMutation({
    mutationFn: (candidateId: string) => postJson<Question>(`/api/admin/question-banks/workbench-candidates/${candidateId}/publish`, {}),
    onSuccess: () => {
      message.success("候选题已发布");
      void queryClient.invalidateQueries({ queryKey: ["question-ai-workbench", aiWorkbenchSessionId] });
      refreshQuestionBank();
    },
    onError: (error) => message.error(`发布失败：${errorMessage(error)}`),
  });

  const rejectCandidate = useMutation({
    mutationFn: (candidateId: string) => postJson<QuestionWorkbenchCandidate>(`/api/admin/question-banks/workbench-candidates/${candidateId}/reject`, {}),
    onSuccess: () => {
      message.success("候选题已拒绝");
      void queryClient.invalidateQueries({ queryKey: ["question-ai-workbench", aiWorkbenchSessionId] });
      refreshQuestionBank();
    },
    onError: (error) => message.error(`拒绝失败：${errorMessage(error)}`),
  });

  const publishDraft = useMutation({
    mutationFn: (draftId: string) => postJson<Question>(`/api/admin/question-banks/drafts/${draftId}/publish`, {}),
    onSuccess: () => {
      message.success("草稿已发布");
      refreshQuestionBank();
    },
    onError: (error) => message.error(`草稿发布失败：${errorMessage(error)}`),
  });

  const rejectDraft = useMutation({
    mutationFn: (draftId: string) => postJson<QuestionDraft>(`/api/admin/question-banks/drafts/${draftId}/reject`, {}),
    onSuccess: () => {
      message.success("草稿已拒绝");
      refreshQuestionBank();
    },
    onError: (error) => message.error(`草稿拒绝失败：${errorMessage(error)}`),
  });

  const openQuestionDetail = (question: Question) => {
    setSelectedQuestion(question);
    setDetailOpen(true);
  };

  const openAddSuggestion = () => {
    if (!selectedPoint) {
      message.warning("请先选择一个点位");
      return;
    }
    if (!questionWorkbenchGate.healthy) {
      message.warning(questionWorkbenchGate.message);
      return;
    }
    if (!selectedEvidenceReady) {
      message.warning(evidenceBlockedText);
      return;
    }
    setWorkbenchPrompt(`请围绕「${selectedPoint.title}」生成一组可机判的实验题，覆盖实验原理、现象解释和安全提示。`);
    setWorkbenchQuestionTypes(["single_choice", "true_false", "fill_blank"]);
    setWorkbenchCount(3);
    startWorkbench.mutate({
      mode: "create",
      experiment_id: selectedPoint.experiment_id,
      point_node_id: selectedPoint.node_id,
      point_node_ids: [selectedPoint.node_id],
      point_key: selectedPoint.node_id,
    });
  };

  const sendWorkbenchMessage = async () => {
    if (!aiWorkbenchSessionId || !workbenchPrompt.trim() || workbenchStreaming) return;
    if (!questionWorkbenchGate.healthy) {
      message.warning(questionWorkbenchGate.message);
      return;
    }
    const prompt = workbenchPrompt.trim();
    setWorkbenchStreaming(true);
    setWorkbenchStreamStatus("已发送提示，正在准备教材证据");
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
            message.success("AI 候选题已更新");
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

  const confirmRefreshEvidence = (scope: "chapter" | "point", force = false) => {
    if (scope === "point" && !selectedPoint) {
      message.warning("请先选择一个点位");
      return;
    }
    modal.confirm({
      title: scope === "chapter" ? "刷新本章教材证据？" : "刷新当前点位教材证据？",
      content:
        scope === "chapter"
          ? "系统会为本章缺失、失败或过期的点位调用 Qwen Embedding 与 Rerank，并把命中的教材 chunk 绑定到点位。已有可用证据默认不会重复付费检索。"
          : "系统会调用 Qwen Embedding 与 Rerank，为当前点位的实验原理、现象解释和安全提示绑定教材依据。",
      okText: "开始刷新",
      cancelText: "取消",
      onOk: () =>
        refreshEvidence.mutate({
          chapter_id: scope === "chapter" ? chapterId : undefined,
          point_node_id: scope === "point" ? selectedPoint?.node_id : undefined,
          force,
          process_now: true,
          process_limit: scope === "chapter" ? 200 : 1,
        }),
    });
  };

  const totals = catalog.data?.totals;
  const selectedCounts = selectedPoint?.counts;
  const visibleQuestions = questions.data?.items || [];
  const visibleDrafts = drafts.data?.items || [];

  return (
    <Space orientation="vertical" size={18} className="full question-bank-catalog-page">
      <PageTitle
        title="题库管理"
        description="按章节目录和主点位管理题目。题目只归属一个点位，AI 出题会先读取该点位三段式内容并检索教材证据。"
      />

      <div className="stat-grid question-bank-stat-grid">
        <Card>
          <Statistic title="目录点位" value={totals?.point_count || 0} suffix="个" prefix={<ExperimentOutlined />} />
        </Card>
        <Card>
          <Statistic title="当前题库" value={totals?.question_count || 0} suffix="题" prefix={<DatabaseOutlined />} />
        </Card>
        <Card>
          <Statistic title="已发布" value={totals?.published_count || 0} suffix="题" prefix={<CheckCircleOutlined />} />
        </Card>
        <Card>
          <Statistic title="草稿候选" value={totals?.draft_candidate_count || 0} suffix="题" prefix={<FileTextOutlined />} />
        </Card>
        <Card>
          <Statistic title="待覆盖" value={Math.max(0, (totals?.point_count || 0) - (totals?.published_count || 0))} suffix="点" />
        </Card>
      </div>

      <div className="question-bank-catalog-layout">
        <Card
          className="question-catalog-panel"
          title="章节目录与点位"
          extra={
            <Space size={6}>
              <Button
                size="small"
                icon={<ReloadOutlined />}
                loading={refreshEvidence.isPending}
                disabled={!chapterId || refreshEvidence.isPending}
                onClick={() => confirmRefreshEvidence("chapter")}
              >
                刷新本章证据
              </Button>
              <Tag color="green">{points.length} 个点位</Tag>
            </Space>
          }
        >
          <Space orientation="vertical" size={12} className="full">
            <Select
              value={chapterId}
              onChange={(value) => {
                setChapterId(value);
                setSelectedNodeId(undefined);
                setQuestionType(undefined);
                setSearch("");
              }}
              options={(catalog.data?.chapters || []).map((chapter) => ({
                value: chapter.chapter_id,
                label: formatChapterTitle(chapter.chapter_title, chapter.chapter_id),
              }))}
              className="full"
              loading={catalog.isLoading}
            />
            <div className="question-catalog-chapter-line">
              <Text strong>{selectedChapter ? formatChapterTitle(selectedChapter.chapter_title, selectedChapter.chapter_id) : chapterId}</Text>
              <Text type="secondary">目录 {totals?.directory_count || 0} · 点位 {totals?.point_count || 0}</Text>
            </div>
            <QueryState loading={catalog.isLoading} error={catalog.error} empty={!treeData.length}>
              <Tree
                key={chapterId}
                showIcon
                blockNode
                defaultExpandedKeys={expandedRootKeys}
                selectedKeys={selectedNodeId ? [selectedNodeId] : []}
                treeData={treeData}
                onSelect={(keys) => {
                  const key = String(keys[0] || "");
                  const nextNode = nodes.find((node) => node.node_id === key);
                  if (nextNode?.node_kind === "point") {
                    setSelectedNodeId(key);
                    setSelectedQuestion(null);
                    setQuestionType(undefined);
                    setSearch("");
                  }
                }}
              />
            </QueryState>
          </Space>
        </Card>

        <div className="question-point-workspace">
          <Card className="question-point-header-card">
            {selectedPoint ? (
              <Flex justify="space-between" gap={16} wrap="wrap" align="start">
                <div className="question-point-heading">
                  <Text type="secondary">{nodePath(selectedPoint)}</Text>
                  <Title level={3}>{selectedPoint.title}</Title>
                  <Space size={6} wrap>
                    <Tag color={selectedPoint.content_status === "published" ? "green" : "default"}>
                      内容{selectedPoint.content_status === "published" ? "已发布" : selectedPoint.content_status || "未发布"}
                    </Tag>
                    <Tag color={nodeEvidenceTone(selectedPoint)}>{nodeEvidenceLabel(selectedPoint)}</Tag>
                    <Tag>{statusCountLine(selectedPoint)}</Tag>
                    <Tag>草稿 {selectedCounts?.draft_candidate_count || 0}</Tag>
                  </Space>
                </div>
                <Space wrap>
                  <Button
                    icon={<ReloadOutlined />}
                    loading={refreshEvidence.isPending}
                    disabled={refreshEvidence.isPending}
                    onClick={() => confirmRefreshEvidence("point", selectedEvidenceReady)}
                  >
                    刷新当前点位证据
                  </Button>
                  <Tooltip
                    title={
                      !questionWorkbenchGate.healthy
                        ? questionWorkbenchGate.message
                        : selectedEvidenceReady
                          ? "基于该点位三段式内容和已绑定教材证据生成候选题"
                          : evidenceBlockedText
                    }
                  >
                    <Button
                      type="primary"
                      icon={<MessageOutlined />}
                      onClick={openAddSuggestion}
                      loading={startWorkbench.isPending}
                      disabled={!questionWorkbenchGate.healthy || !selectedEvidenceReady}
                    >
                      AI 出题
                    </Button>
                  </Tooltip>
                </Space>
              </Flex>
            ) : (
              <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="请选择一个点位" />
            )}
          </Card>

          {selectedPoint ? (
            <>
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
                </div>
              </div>

              <Card className="question-point-content-card" title="点位内容">
                <div className="question-point-content-grid">
                  <section>
                    <Text strong>实验原理</Text>
                    <Text className="block-text">{principleText(selectedPoint) || "暂无实验原理"}</Text>
                  </section>
                  <section>
                    <Text strong>现象解释</Text>
                    <Text className="block-text">{cleanText(selectedPoint.phenomenon_explanation) || "暂无现象解释"}</Text>
                  </section>
                  <section>
                    <Text strong>安全提示</Text>
                    <Text className="block-text">{cleanText(selectedPoint.safety_note) || "暂无安全提示"}</Text>
                  </section>
                </div>
              </Card>

              <Card
                className="question-bank-question-panel"
                title="点位题目"
                extra={
                  <Space wrap>
                    <Select
                      allowClear
                      placeholder="题型"
                      value={questionType}
                      onChange={setQuestionType}
                      className="question-bank-compact-select"
                      options={[
                        { value: "single_choice", label: "选择" },
                        { value: "true_false", label: "判断" },
                        { value: "fill_blank", label: "填空" },
                      ]}
                    />
                    <Select
                      value={statusFilter}
                      onChange={setStatusFilter}
                      className="question-bank-compact-select"
                      options={[
                        { value: "all", label: "全部状态" },
                        { value: "published", label: "已发布" },
                        { value: "draft", label: "草稿" },
                        { value: "disabled", label: "已停用" },
                      ]}
                    />
                    <Input.Search
                      allowClear
                      placeholder="搜索题干或解析"
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                      onSearch={setSearch}
                      className="question-bank-catalog-search"
                    />
                  </Space>
                }
              >
                <QueryState loading={questions.isLoading} error={questions.error} empty={!visibleQuestions.length}>
                  <Table
                    rowKey="id"
                    size="middle"
                    dataSource={visibleQuestions}
                    pagination={{ pageSize: 8, showSizeChanger: false }}
                    onRow={(record) => ({ onClick: () => openQuestionDetail(record) })}
                    columns={[
                      { title: "题型", width: 76, dataIndex: "question_type", render: questionTypeLabel },
                      { title: "题干", dataIndex: "stem" },
                      {
                        title: "主点位",
                        width: 180,
                        render: (_: unknown, row: Question) => questionPointTitles(row)[0] || selectedPoint.title,
                      },
                      {
                        title: "证据",
                        width: 112,
                        render: (_: unknown, row: Question) => (
                          <Space orientation="vertical" size={2}>
                            {evidenceStatusTag(row)}
                            <Text type="secondary">{row.source_refs?.length || 0} 条</Text>
                          </Space>
                        ),
                      },
                      { title: "状态", width: 84, dataIndex: "status", render: questionBankStatusTag },
                    ]}
                  />
                </QueryState>
              </Card>

              <Card className="question-bank-draft-panel" title="待审草稿" extra={<Tag>{visibleDrafts.length} 条</Tag>}>
                <QueryState loading={drafts.isLoading} error={drafts.error} empty={!visibleDrafts.length}>
                  <Table
                    rowKey="id"
                    size="small"
                    dataSource={visibleDrafts}
                    pagination={{ pageSize: 5, showSizeChanger: false }}
                    columns={[
                      {
                        title: "题型",
                        width: 76,
                        render: (_: unknown, row: QuestionDraft) => questionTypeLabel(String(row.payload?.question_type || "")),
                      },
                      {
                        title: "题干",
                        render: (_: unknown, row: QuestionDraft) => String(row.payload?.stem || "未生成题干"),
                      },
                      {
                        title: "校验",
                        width: 140,
                        render: (_: unknown, row: QuestionDraft) =>
                          row.validation_errors?.length ? <Tag color="red">需修订</Tag> : <Tag color="green">可发布</Tag>,
                      },
                      {
                        title: "操作",
                        width: 132,
                        render: (_: unknown, row: QuestionDraft) => (
                          <Space size={4}>
                            <Popconfirm
                              title="发布这条草稿？"
                              disabled={Boolean(row.validation_errors?.length) || row.status !== "draft"}
                              onConfirm={() => publishDraft.mutate(row.id)}
                            >
                              <Button
                                type="link"
                                size="small"
                                disabled={Boolean(row.validation_errors?.length) || row.status !== "draft"}
                                loading={publishDraft.isPending}
                              >
                                发布
                              </Button>
                            </Popconfirm>
                            <Button
                              type="link"
                              danger
                              size="small"
                              disabled={row.status !== "draft"}
                              loading={rejectDraft.isPending}
                              onClick={() => rejectDraft.mutate(row.id)}
                            >
                              拒绝
                            </Button>
                          </Space>
                        ),
                      },
                    ]}
                  />
                </QueryState>
              </Card>
            </>
          ) : null}
        </div>
      </div>

      <Modal
        title="题目详情"
        open={detailOpen}
        width={920}
        onCancel={() => setDetailOpen(false)}
        footer={<Button onClick={() => setDetailOpen(false)}>关闭</Button>}
      >
        {selectedQuestion ? (
          <Space orientation="vertical" size={16} className="full question-detail-card">
            <Title level={4}>{selectedQuestion.stem}</Title>
            <Space wrap>
              <Tag color="blue">{questionTypeLabel(selectedQuestion.question_type)}</Tag>
              {questionBankStatusTag(selectedQuestion.status)}
              <Tag>{evidenceStatusText(selectedQuestion)}</Tag>
            </Space>
            {selectedQuestion.options?.length ? (
              <div className="question-options">
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
            <Descriptions size="small" column={1}>
              <Descriptions.Item label="答案">{answerText(selectedQuestion.answer)}</Descriptions.Item>
              <Descriptions.Item label="解析">{selectedQuestion.explanation || "暂无解析"}</Descriptions.Item>
              <Descriptions.Item label="主点位">{questionPointTitles(selectedQuestion)[0] || selectedPoint?.title || "-"}</Descriptions.Item>
            </Descriptions>
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
          </Space>
        ) : (
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="请选择题目" />
        )}
      </Modal>

      <Drawer
        title="AI 点位出题工作台"
        open={aiWorkbenchOpen}
        size="min(1280px, 96vw)"
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
              <Flex justify="space-between" align="center" gap={10} className="ai-workbench-section-head">
                <div>
                  <Text className="eyebrow">点位上下文</Text>
                  <Title level={4}>{selectedPoint?.title || aiWorkbench.data?.experiment_title || "当前点位"}</Title>
                </div>
                <Space size={6} wrap>
                  <Tag color={workbenchEvidenceSourceCount ? "green" : "orange"}>{workbenchEvidenceSourceCount || 0} 条证据</Tag>
                  <Tag color="blue">新增会话</Tag>
                </Space>
              </Flex>
              <div className={`question-workbench-status question-workbench-status-${workbenchStatusTone}`}>
                <div className="question-workbench-status-main">
                  <span className="question-workbench-status-icon">
                    {workbenchStatusTone === "ready" ? <CheckCircleOutlined /> : workbenchStatusTone === "checking" ? <ReloadOutlined /> : <CloseCircleOutlined />}
                  </span>
                  <div className="question-workbench-status-copy">
                    <Text strong>{workbenchRagGate?.healthy === false ? "证据未生成" : "教材证据"}</Text>
                    <Text type="secondary">
                      {workbenchRagGate?.healthy === false
                        ? String(workbenchRagGate.message || questionWorkbenchGate.message)
                        : workbenchEvidenceStatusText}
                    </Text>
                  </div>
                </div>
              </div>
              <Descriptions size="small" column={1} className="question-workbench-descriptions">
                <Descriptions.Item label="目录路径">{nodePath(selectedPoint) || "-"}</Descriptions.Item>
                <Descriptions.Item label="现有题量">{selectedPoint?.counts.question_count || 0}</Descriptions.Item>
                <Descriptions.Item label="草稿候选">{selectedPoint?.counts.draft_candidate_count || 0}</Descriptions.Item>
              </Descriptions>
              {workbenchEvidenceSections.length ? (
                <div className="question-source-section">
                  <Text strong>教材证据分组</Text>
                  <Space orientation="vertical" size={8} className="full">
                    {workbenchEvidenceSections.map((item) => (
                      <div key={`${item.pointKey}-${item.section}`} className="question-evidence-row">
                        <Text type="secondary">
                          {item.pointTitle} · {textbookSectionLabels[item.section] || item.section}
                        </Text>
                        <div className="question-evidence-values">
                          <Tag color={item.sufficient ? "green" : "orange"}>
                            {item.sufficient ? `${item.sourceCount} 条证据` : item.missingReason || "证据不足"}
                          </Tag>
                          {item.sources.slice(0, 3).map((source: Record<string, unknown>, index: number) => (
                            <Tag key={`${source.chunk_id || index}`} color="default">
                              {sourceRefLabel(source)}
                            </Tag>
                          ))}
                        </div>
                      </div>
                    ))}
                  </Space>
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
                      {turn.error_state ? <Alert type="error" showIcon title="本轮生成失败" description={String(turn.error_state.message || "")} /> : null}
                    </div>
                  ))
                ) : (
                  <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="发送提示后生成候选题" />
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
                <Space orientation="vertical" size={10} className="full">
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
                      disabled={workbenchStreaming || !questionWorkbenchGate.healthy}
                      className="ai-workbench-type-select"
                    />
                    <InputNumber
                      min={1}
                      max={20}
                      value={workbenchCount}
                      onChange={(value) => setWorkbenchCount(Number(value || 1))}
                      addonBefore="数量"
                      disabled={workbenchStreaming || !questionWorkbenchGate.healthy}
                    />
                  </Space>
                  <Input.TextArea
                    rows={4}
                    value={workbenchPrompt}
                    disabled={workbenchStreaming || !questionWorkbenchGate.healthy}
                    onChange={(event) => setWorkbenchPrompt(event.target.value)}
                    placeholder="例如：生成 1 道选择题、1 道判断题、1 道填空题；题目必须能从教材证据直接推出答案。"
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
                        <Space orientation="vertical" size={8} className="full">
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
                              <Tag key={point.point_node_id || point.point_key || point.point_title} color="cyan">
                                {point.point_title || point.point_key || point.point_node_id}
                              </Tag>
                            ))}
                          </Space>
                          {errors.length ? <Alert type="warning" showIcon title={errors.join("；")} /> : null}
                          <Flex justify="space-between" align="center" gap={8} wrap="wrap">
                            <Button size="small" onClick={() => setWorkbenchPrompt(`请继续修订候选 ${candidate.id.slice(0, 8)}：`)}>
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
