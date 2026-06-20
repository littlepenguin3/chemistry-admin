import { Button, Flex, Popconfirm, Space, Tag, Typography } from "antd";
import { CheckCircleOutlined, DeleteOutlined, EyeOutlined, StopOutlined } from "@ant-design/icons";

import type { CatalogNodeDetail } from "../../api/catalogTree";
import { catalogNodeKindLabel, catalogStatusColor, catalogStatusLabel, displayCatalogPointTitle, isPointCapable } from "./catalogTreeMappers";
import type { CatalogMutations } from "./catalogTreeHooks";

const { Text, Title } = Typography;

export function CatalogEditorHeader({ detail, mutations }: { detail: CatalogNodeDetail; mutations: CatalogMutations }) {
  const { node } = detail;
  const pointCapable = isPointCapable(node.node_kind);
  const title = pointCapable ? displayCatalogPointTitle(detail) : node.title;

  return (
    <div className="catalog-editor-header">
      <Flex align="start" justify="space-between" gap={16}>
        <div className="catalog-editor-title-block">
          <Space size={8} wrap>
            <Tag color={catalogStatusColor(node.status)}>{catalogStatusLabel(node.status)}</Tag>
            <Tag>{catalogNodeKindLabel(node.node_kind)}</Tag>
            {pointCapable ? <Tag color="purple">视频 {node.published_media_count}/{node.media_count}</Tag> : null}
            {!pointCapable && node.has_children ? <Tag color="blue">子节点 {detail.children.length}</Tag> : null}
          </Space>
          <Title level={3}>{title}</Title>
          <Text type="secondary">{detail.breadcrumbs.map((item) => item.title).join(" / ")}</Text>
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
      </Flex>
    </div>
  );
}
