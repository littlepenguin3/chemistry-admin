import type { ReactNode } from "react";
import { Button, Popconfirm, Space, Typography } from "antd";
import { CheckCircleOutlined, DeleteOutlined, EyeOutlined, StopOutlined } from "@ant-design/icons";
import { AlertTriangle, CircleCheck, FlaskConical, Folder, Image, Link2, ListTree, Video } from "lucide-react";

import type { CatalogNodeDetail } from "../../api/catalogTree";
import {
  catalogStatusDotClass,
  catalogStatusLabel,
  displayCatalogPointTitle,
  isPointCapable,
} from "./catalogTreeMappers";
import type { CatalogMutations } from "./catalogTreeHooks";

const { Text, Title } = Typography;

type SummaryTone = "ok" | "warning" | "muted" | "published" | "draft" | "archived";

type SummaryItem = {
  key: string;
  icon: ReactNode;
  label: string;
  value: string;
  note?: string;
  tone?: SummaryTone;
  emphasis?: boolean;
};

function pointContentStatusLabel(status?: string | null): string {
  if (status === "published") return "已发布";
  if (status === "archived") return "已归档";
  if (status === "draft") return "草稿";
  return "待补充";
}

function pointContentTone(status?: string | null): SummaryTone {
  if (status === "published") return "ok";
  if (status === "archived") return "archived";
  return "warning";
}

function statusNote(status: string): string {
  if (status === "published") return "学生端可见";
  if (status === "archived") return "已从常规目录隐藏";
  return "可继续维护";
}

function hasText(value: unknown): boolean {
  return typeof value === "string" ? value.trim().length > 0 : Boolean(value);
}

function hasStudentCard(detail: CatalogNodeDetail, pointCapable: boolean): boolean {
  const { node } = detail;
  if (!pointCapable) {
    return Boolean(
      hasText(node.student_description) ||
        hasText(node.card_image_asset_id) ||
        hasText(node.card_icon_key) ||
        hasText(node.card_accent) ||
        node.card_layout !== "default",
    );
  }

  const pointCard = node.point_card_presentation || {};
  return Boolean(
    hasText(pointCard.cover_image_asset_id) ||
      hasText(pointCard.short_description) ||
      hasText(pointCard.icon_key) ||
      hasText(pointCard.accent) ||
      Boolean(pointCard.emphasis),
  );
}

function validationSummary(validationIssues: number): SummaryItem {
  return {
    key: "validation",
    icon: validationIssues > 0 ? <AlertTriangle size={16} /> : <CircleCheck size={16} />,
    label: "发布检查",
    value: validationIssues > 0 ? `${validationIssues} 项待处理` : "通过",
    note: validationIssues > 0 ? "发布前需修正" : "暂无阻断",
    tone: validationIssues > 0 ? "warning" : "ok",
    emphasis: validationIssues > 0,
  };
}

function buildDirectorySummaryItems(detail: CatalogNodeDetail, validationIssues: number): SummaryItem[] {
  const { node } = detail;
  const directChildren = detail.children.length;
  const pointCount = node.descendant_point_count;
  const structureValue =
    directChildren === pointCount
      ? `${pointCount} 个点位`
      : `${directChildren} 个直接子项 · ${pointCount} 个点位`;

  return [
    {
      key: "structure",
      icon: <ListTree size={16} />,
      label: "目录结构",
      value: structureValue,
      note: pointCount > 0 ? "组织学生学习路径" : "还没有点位内容",
      tone: pointCount > 0 ? "muted" : "warning",
      emphasis: pointCount === 0,
    },
    validationSummary(validationIssues),
    {
      key: "visibility",
      icon: node.status === "published" ? <CircleCheck size={16} /> : <AlertTriangle size={16} />,
      label: "学生可见性",
      value: catalogStatusLabel(node.status),
      note: statusNote(node.status),
      tone: node.status,
      emphasis: node.status !== "published",
    },
  ];
}

function buildPointSummaryItems(detail: CatalogNodeDetail, validationIssues: number): SummaryItem[] {
  const { node } = detail;
  const contentStatus = detail.point_content?.content_status;
  const hasCard = hasStudentCard(detail, true);
  const hasVideos = node.media_count > 0;
  const relatedCount = detail.related_links.filter((link) => !link.hidden).length;

  return [
    {
      key: "content",
      icon: contentStatus === "published" ? <CircleCheck size={16} /> : <AlertTriangle size={16} />,
      label: "学习内容",
      value: pointContentStatusLabel(contentStatus),
      note: detail.point_content ? "知识字段" : "待维护",
      tone: pointContentTone(contentStatus),
      emphasis: contentStatus !== "published",
    },
    {
      key: "video",
      icon: <Video size={16} />,
      label: "视频",
      value: hasVideos ? `${node.published_media_count}/${node.media_count}` : "未绑定",
      note: hasVideos ? "已发布 / 已绑定" : "建议补充实验资源",
      tone: hasVideos ? (node.published_media_count > 0 ? "ok" : "warning") : "warning",
      emphasis: !hasVideos || node.published_media_count === 0,
    },
    {
      key: "student-card",
      icon: <Image size={16} />,
      label: "学生卡片",
      value: hasCard ? "已配置" : "待配置",
      note: hasCard ? "学生端有展示素材" : "补充描述或封面",
      tone: hasCard ? "ok" : "warning",
      emphasis: !hasCard,
    },
    {
      key: "related",
      icon: <Link2 size={16} />,
      label: "相关实验",
      value: relatedCount > 0 ? `${relatedCount} 个` : "无",
      note: relatedCount > 0 ? "可串联学习" : "可选补充",
      tone: relatedCount > 0 ? "muted" : "muted",
    },
    validationSummary(validationIssues),
  ];
}

export function CatalogEditorHeader({ detail, mutations }: { detail: CatalogNodeDetail; mutations: CatalogMutations }) {
  const { node } = detail;
  const pointCapable = isPointCapable(node.node_kind);
  const title = pointCapable ? displayCatalogPointTitle(detail) : node.title;
  const validationIssues = (detail.validation.errors?.length || 0) + (detail.validation.warnings?.length || 0);
  const summaryItems = pointCapable ? buildPointSummaryItems(detail, validationIssues) : buildDirectorySummaryItems(detail, validationIssues);

  return (
    <div className="catalog-editor-header">
      <div className="catalog-editor-summary-top">
        <div className="catalog-editor-title-block">
          <span className={`catalog-editor-title-status ${catalogStatusDotClass(node.status)}`} aria-hidden="true" />
          <span className={`catalog-editor-kind-icon ${pointCapable ? "is-point" : "is-directory"}`} aria-hidden="true">
            {pointCapable ? <FlaskConical size={20} /> : <Folder size={20} />}
          </span>
          <div className="catalog-editor-title-copy">
            <Title level={3}>{title}</Title>
            <Text type="secondary">
              {pointCapable ? "实验点位" : "目录分组"} · {detail.breadcrumbs.map((item) => item.title).join(" / ")}
            </Text>
          </div>
        </div>
        <Space wrap className="catalog-editor-header-actions">
          {pointCapable ? (
            <Button icon={<EyeOutlined />} disabled title="学生端预览入口待接入">
              预览学生端
            </Button>
          ) : null}
          {node.status === "archived" ? (
            <Button onClick={() => mutations.changeNodeStatus.mutate({ nodeId: node.node_id, action: "restore" })}>恢复</Button>
          ) : (
            <Popconfirm title="归档该节点？" onConfirm={() => mutations.changeNodeStatus.mutate({ nodeId: node.node_id, action: "archive" })}>
              <Button danger icon={<DeleteOutlined />}>
                归档
              </Button>
            </Popconfirm>
          )}
          {node.status === "published" ? (
            <Button icon={<StopOutlined />} onClick={() => mutations.changeNodeStatus.mutate({ nodeId: node.node_id, action: "unpublish" })}>
              取消发布
            </Button>
          ) : (
            <Button
              type="primary"
              icon={<CheckCircleOutlined />}
              onClick={() => mutations.changeNodeStatus.mutate({ nodeId: node.node_id, action: "publish", includeSubtree: false })}
            >
              发布节点
            </Button>
          )}
        </Space>
      </div>
      <div className="catalog-editor-summary-grid" aria-label="节点概览">
        {summaryItems.map((item) => (
          <div className={`catalog-editor-summary-item ${item.tone ? `is-${item.tone}` : ""} ${item.emphasis ? "is-emphasis" : ""}`} key={item.key}>
            <span className="catalog-editor-summary-icon" aria-hidden="true">
              {item.icon}
            </span>
            <div>
              <span>{item.label}</span>
              <strong>{item.value}</strong>
              {item.note ? <small>{item.note}</small> : null}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
