import { Alert, Button, Descriptions, Input, InputNumber, Space, Tag, Typography } from "antd";

import type { CatalogNodeCard, CatalogNodeDetail } from "../../api/catalogTree";
import type { CatalogMutations } from "./catalogTreeHooks";
import { buildMovePayload, hasDivergentPointTitle } from "./catalogTreeMappers";

const { Text, Title } = Typography;

function prettyJson(value: unknown) {
  return JSON.stringify(value || {}, null, 2);
}

export function CatalogAdvancedPanel({
  detail,
  siblings,
  moveParentId,
  setMoveParentId,
  moveDisplayOrder,
  setMoveDisplayOrder,
  mutations,
}: {
  detail: CatalogNodeDetail;
  siblings: CatalogNodeCard[];
  moveParentId: string;
  setMoveParentId: (value: string) => void;
  moveDisplayOrder: number | null;
  setMoveDisplayOrder: (value: number | null) => void;
  mutations: CatalogMutations;
}) {
  const { node } = detail;
  const divergentTitle = hasDivergentPointTitle(detail);

  return (
    <section className="catalog-editor-section catalog-editor-panel-section">
      <div>
        <Title level={4}>高级</Title>
        <Text type="secondary">调试、定位、移动与索引诊断集中放在这里。</Text>
      </div>
      <Descriptions size="small" column={2} bordered>
        <Descriptions.Item label="Node ID">{node.node_id}</Descriptions.Item>
        <Descriptions.Item label="父节点">{node.parent_id || "根节点"}</Descriptions.Item>
        <Descriptions.Item label="显示顺序">{node.display_order}</Descriptions.Item>
        <Descriptions.Item label="同级节点">{siblings.length}</Descriptions.Item>
      </Descriptions>
      {divergentTitle ? (
        <Alert
          type="warning"
          showIcon
          title="点位名和节点标题不一致"
          description="默认编辑器会以点位名为主，并在保存点位内容时同步节点标题。"
        />
      ) : null}
      <div className="catalog-form-grid">
        <Input value={moveParentId} onChange={(event) => setMoveParentId(event.target.value)} placeholder="父节点 ID；留空为章节根目录" />
        <InputNumber value={moveDisplayOrder ?? undefined} min={1} className="full" onChange={(value) => setMoveDisplayOrder(value ?? null)} placeholder="显示顺序" />
      </div>
      <Space wrap>
        <Button
          onClick={() => mutations.moveNode.mutate({ nodeId: node.node_id, payload: buildMovePayload(moveParentId, moveDisplayOrder) })}
          loading={mutations.moveNode.isPending}
        >
          移动节点
        </Button>
        <Button onClick={() => void navigator.clipboard?.writeText(node.node_id)}>复制 Node ID</Button>
      </Space>
      <div className="catalog-index-diagnostics">
        <div className="catalog-panel-title-row">
          <Title level={5}>搜索预览与索引状态</Title>
          {detail.index_state ? <Tag color={detail.index_state.sync_status === "synced" ? "green" : "gold"}>{detail.index_state.sync_status}</Tag> : <Tag>未入队</Tag>}
        </div>
        {detail.search_preview ? (
          <pre className="catalog-search-preview">{prettyJson(detail.search_preview)}</pre>
        ) : (
          <Alert type="info" showIcon title="当前节点没有学生可见搜索文档" />
        )}
        <Descriptions size="small" column={2}>
          <Descriptions.Item label="期望动作">{detail.index_state?.desired_action || "-"}</Descriptions.Item>
          <Descriptions.Item label="尝试次数">{detail.index_state?.attempts ?? "-"}</Descriptions.Item>
          <Descriptions.Item label="最近索引">{detail.index_state?.indexed_at || "-"}</Descriptions.Item>
          <Descriptions.Item label="错误">{detail.index_state?.last_error || "-"}</Descriptions.Item>
        </Descriptions>
      </div>
    </section>
  );
}
