import { useEffect, useMemo, useState, type Key, type ReactNode } from "react";
import { App as AntApp, Button, Dropdown, Flex, Spin, Tag, Tooltip, Tree, Typography } from "antd";
import {
  CheckCircleOutlined,
  DeleteOutlined,
  FileTextOutlined,
  FolderOpenOutlined,
  MoreOutlined,
  PlusOutlined,
  StopOutlined,
  WarningOutlined,
} from "@ant-design/icons";

import { listCatalogChildren, type CatalogNodeCard, type CatalogNodeMovePayload } from "../../api/catalogTree";
import { QueryState } from "../../components/QueryState";
import { catalogNodeKindLabel, catalogStatusColor } from "./catalogTreeMappers";

const { Text } = Typography;

type CatalogTreeDataNode = {
  key: string;
  title: string;
  isLeaf: boolean;
  children?: CatalogTreeDataNode[];
  catalogNode: CatalogNodeCard;
};

function nodeIcon(kind: CatalogNodeCard["node_kind"]) {
  return kind === "point" ? <FileTextOutlined /> : <FolderOpenOutlined />;
}

function toTreeNode(node: CatalogNodeCard, existing?: CatalogTreeDataNode): CatalogTreeDataNode {
  return {
    key: node.node_id,
    title: node.title,
    isLeaf: node.node_kind === "point" || !node.has_children,
    children: existing?.children,
    catalogNode: node,
  };
}

function mergeTreeData(nodes: CatalogNodeCard[], previous: CatalogTreeDataNode[]): CatalogTreeDataNode[] {
  const previousByKey = new Map(previous.map((item) => [item.key, item]));
  return nodes.map((node) => toTreeNode(node, previousByKey.get(node.node_id)));
}

function replaceChildren(tree: CatalogTreeDataNode[], key: string, children: CatalogTreeDataNode[]): CatalogTreeDataNode[] {
  return tree.map((item) => {
    if (item.key === key) return { ...item, isLeaf: children.length === 0 && item.catalogNode.node_kind === "point", children };
    if (item.children) return { ...item, children: replaceChildren(item.children, key, children) };
    return item;
  });
}

function findTreeNode(tree: CatalogTreeDataNode[], key: string): CatalogTreeDataNode | undefined {
  for (const item of tree) {
    if (item.key === key) return item;
    const child = item.children ? findTreeNode(item.children, key) : undefined;
    if (child) return child;
  }
  return undefined;
}

function findParentKey(tree: CatalogTreeDataNode[], key: string, parentKey: string | null = null): string | null {
  for (const item of tree) {
    if (item.key === key) return parentKey;
    const found = item.children ? findParentKey(item.children, key, item.key) : null;
    if (found !== null) return found;
  }
  return null;
}

function siblingNodes(tree: CatalogTreeDataNode[], parentKey: string | null): CatalogTreeDataNode[] {
  if (!parentKey) return tree;
  return findTreeNode(tree, parentKey)?.children || [];
}

export function CatalogTreeNodeList({
  nodes,
  selectedNodeId,
  loading,
  error,
  onSelect,
  onAddRoot,
  onAddChild,
  onMove,
  onReorder,
  onChangeStatus,
}: {
  nodes: CatalogNodeCard[];
  selectedNodeId?: string | null;
  loading?: boolean;
  error?: unknown;
  onSelect: (node: CatalogNodeCard) => void;
  onAddRoot: () => void;
  onAddChild: (node: CatalogNodeCard, kind?: CatalogNodeCard["node_kind"]) => void;
  onMove: (nodeId: string, payload: CatalogNodeMovePayload) => void;
  onReorder: (items: Array<{ node_id: string; display_order: number }>) => void;
  onChangeStatus: (node: CatalogNodeCard, action: "archive" | "restore" | "publish" | "unpublish") => void;
}) {
  const { message } = AntApp.useApp();
  const [treeData, setTreeData] = useState<CatalogTreeDataNode[]>([]);
  const [expandedKeys, setExpandedKeys] = useState<Key[]>([]);

  useEffect(() => {
    setTreeData((previous) => mergeTreeData(nodes, previous));
  }, [nodes]);

  const selectedKeys = useMemo(() => (selectedNodeId ? [selectedNodeId] : []), [selectedNodeId]);

  const loadData = async (treeNode: CatalogTreeDataNode) => {
    if (treeNode.catalogNode.node_kind === "point" || treeNode.children) return;
    const response = await listCatalogChildren(treeNode.catalogNode.node_id);
    setTreeData((current) => replaceChildren(current, treeNode.catalogNode.node_id, response.children.map((child) => toTreeNode(child))));
  };

  const titleRender = (item: CatalogTreeDataNode) => {
    const node = item.catalogNode;
    const hasWarnings = Boolean(node.validation?.errors?.length || node.validation?.warnings?.length);
    const statusAction = node.status === "published" ? "unpublish" : "publish";
    const statusLabel = node.status === "published" ? "取消发布" : "发布";
    return (
      <div className={`catalog-tree-row${selectedNodeId === node.node_id ? " is-selected" : ""} kind-${node.node_kind}`}>
        <button className="catalog-tree-row-main" type="button" onClick={() => onSelect(node)}>
          <span className="catalog-tree-node-icon">{nodeIcon(node.node_kind)}</span>
          <span className="catalog-tree-node-copy">
            <strong>{node.title}</strong>
            <span>
              {catalogNodeKindLabel(node.node_kind)}
              {node.node_kind === "point" && node.media_count ? ` · ${node.published_media_count}/${node.media_count} 视频` : ""}
            </span>
          </span>
        </button>
        <Flex align="center" gap={6} className="catalog-tree-row-actions">
          <Tag color={catalogStatusColor(node.status)}>{node.status}</Tag>
          {hasWarnings ? (
            <Tooltip title={[...(node.validation?.errors || []), ...(node.validation?.warnings || [])].join("；")}>
              <WarningOutlined className="catalog-warning-icon" />
            </Tooltip>
          ) : null}
          {node.node_kind === "directory" ? (
            <Tooltip title="新增子节点">
              <Button size="small" icon={<PlusOutlined />} onClick={() => onAddChild(node)} />
            </Tooltip>
          ) : null}
          <Dropdown
            trigger={["click"]}
            menu={{
              items: [
                node.status === "archived"
                  ? { key: "restore", icon: <CheckCircleOutlined />, label: "恢复" }
                  : { key: statusAction, icon: statusAction === "publish" ? <CheckCircleOutlined /> : <StopOutlined />, label: statusLabel },
                node.status !== "archived" ? { key: "archive", danger: true, icon: <DeleteOutlined />, label: "归档" } : null,
              ].filter(Boolean) as Array<{ key: string; label: string; icon?: ReactNode; danger?: boolean }>,
              onClick: ({ key }) => onChangeStatus(node, key as "archive" | "restore" | "publish" | "unpublish"),
            }}
          >
            <Button size="small" icon={<MoreOutlined />} />
          </Dropdown>
        </Flex>
      </div>
    );
  };

  return (
    <div className="catalog-tree-list">
      <Flex align="center" justify="space-between" className="catalog-tree-list-header">
        <Text strong>章节目录树</Text>
        <Button size="small" icon={<PlusOutlined />} onClick={onAddRoot}>
          根节点
        </Button>
      </Flex>
      <QueryState loading={Boolean(loading)} error={error} empty={!nodes.length}>
        <Tree
          blockNode
          draggable
          className="catalog-tree-root"
          treeData={treeData}
          selectedKeys={selectedKeys}
          expandedKeys={expandedKeys}
          loadData={loadData}
          onExpand={(keys) => setExpandedKeys(keys)}
          onSelect={(_, info) => onSelect((info.node as CatalogTreeDataNode).catalogNode)}
          titleRender={(node) => titleRender(node as CatalogTreeDataNode)}
          onDrop={(info) => {
            const dragKey = String(info.dragNode.key);
            const targetKey = String(info.node.key);
            const target = findTreeNode(treeData, targetKey);
            if (!target) return;
            const targetPos = String(info.node.pos).split("-");
            const relativeDropPosition = info.dropPosition - Number(targetPos[targetPos.length - 1]);
            const nextParentId = info.dropToGap ? findParentKey(treeData, targetKey) : targetKey;
            if (!info.dropToGap && target.catalogNode.node_kind === "point") {
              message.warning("点位节点不能接收子节点");
              return;
            }
            const oldParentId = findParentKey(treeData, dragKey);
            const siblings = siblingNodes(treeData, nextParentId);
            const targetIndex = siblings.findIndex((item) => item.key === targetKey);
            const insertIndex = info.dropToGap ? targetIndex + (relativeDropPosition > 0 ? 1 : 0) : siblings.length;
            if (oldParentId === nextParentId && info.dropToGap) {
              const ordered = siblings.filter((item) => item.key !== dragKey);
              const dragged = findTreeNode(treeData, dragKey);
              if (!dragged) return;
              ordered.splice(Math.max(0, insertIndex), 0, dragged);
              onReorder(ordered.map((item, index) => ({ node_id: item.catalogNode.node_id, display_order: index + 1 })));
              return;
            }
            onMove(dragKey, { parent_id: nextParentId, display_order: Math.max(1, insertIndex + 1) });
          }}
        />
        {loading ? <Spin size="small" /> : null}
      </QueryState>
    </div>
  );
}
