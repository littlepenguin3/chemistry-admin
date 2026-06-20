import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { App as AntApp, Button, Dropdown, Flex, Spin, Typography, type MenuProps } from "antd";
import { Tree, type MoveHandler, type NodeRendererProps, type TreeApi } from "react-arborist";
import { Folder, FlaskConical, Plus } from "lucide-react";

import { listCatalogChildren, type CatalogNodeCard, type CatalogNodeMovePayload } from "../../api/catalogTree";
import { QueryState } from "../../components/QueryState";
import { errorMessage } from "../../lib/errors";
import {
  fallbackCatalogTreeReorder,
  findCatalogTreeNode,
  mergeCatalogTreeData,
  replaceCatalogTreeChildren,
  resolveCatalogArboristMove,
  resolveCatalogDropDisabled,
  toCatalogTreeNode,
  type CatalogArboristNode,
  type CatalogTreeDataNode,
  type CatalogTreeMoveResult,
} from "./catalogTreeData";
import {
  CatalogArboristCursor,
  CatalogArboristDragPreview,
  CatalogTreeRow,
  type CatalogTreeRowAction,
} from "./CatalogTreeRow";

const { Text } = Typography;

function useElementSize<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const update = () => {
      const rect = element.getBoundingClientRect();
      setSize({ width: Math.floor(rect.width), height: Math.floor(rect.height) });
    };
    update();
    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", update);
      return () => window.removeEventListener("resize", update);
    }
    const resizeObserver = new ResizeObserver(update);
    resizeObserver.observe(element);
    return () => resizeObserver.disconnect();
  }, []);

  return [ref, size] as const;
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
  onAddRoot: (kind: CatalogNodeCard["node_kind"]) => void;
  onAddChild: (node: CatalogNodeCard, kind?: CatalogNodeCard["node_kind"]) => void;
  onMove: (nodeId: string, payload: CatalogNodeMovePayload) => void;
  onReorder: (items: Array<{ node_id: string; display_order: number }>) => void;
  onChangeStatus: (node: CatalogNodeCard, action: "archive" | "restore" | "publish" | "unpublish") => void;
}) {
  const { message } = AntApp.useApp();
  const [treeData, setTreeData] = useState<CatalogTreeDataNode[]>([]);
  const [loadingDirectoryIds, setLoadingDirectoryIds] = useState<Set<string>>(() => new Set());
  const [treeBoxRef, treeBoxSize] = useElementSize<HTMLDivElement>();
  const arboristRef = useRef<TreeApi<CatalogArboristNode> | null>(null);

  useEffect(() => {
    setTreeData((previous) => mergeCatalogTreeData(nodes, previous));
  }, [nodes]);

  const addRootItems: MenuProps["items"] = useMemo(
    () => [
      { key: "directory", icon: <Folder size={14} />, label: "新建目录" },
      { key: "point", icon: <FlaskConical size={14} />, label: "新建点位" },
    ],
    [],
  );

  const loadDirectory = useCallback(
    async (nodeId: string) => {
      const current = findCatalogTreeNode(treeData, nodeId);
      if (!current || current.kind === "point" || current.loaded || loadingDirectoryIds.has(nodeId)) return;
      setLoadingDirectoryIds((previous) => new Set(previous).add(nodeId));
      try {
        const response = await listCatalogChildren(nodeId);
        setTreeData((existing) => replaceCatalogTreeChildren(existing, nodeId, response.children.map((child) => toCatalogTreeNode(child))));
      } catch (caught) {
        message.error(errorMessage(caught));
      } finally {
        setLoadingDirectoryIds((previous) => {
          const next = new Set(previous);
          next.delete(nodeId);
          return next;
        });
      }
    },
    [loadingDirectoryIds, message, treeData],
  );

  const applyMoveResult = useCallback(
    (result: CatalogTreeMoveResult) => {
      if (result.kind === "invalid") {
        message.warning(result.reason);
        return;
      }
      if (result.kind === "reorder") {
        if (!result.items.length) return;
        onReorder(result.items);
        return;
      }
      onMove(result.nodeId, result.payload);
    },
    [message, onMove, onReorder],
  );

  const handleMove: MoveHandler<CatalogArboristNode> = useCallback(
    ({ dragIds, parentId, index }) => {
      applyMoveResult(resolveCatalogArboristMove({ tree: treeData, dragIds, parentId, index }));
    },
    [applyMoveResult, treeData],
  );

  const handleRowAction = useCallback(
    (node: CatalogNodeCard, action: CatalogTreeRowAction) => {
      if (action === "add-directory") {
        onAddChild(node, "directory");
        return;
      }
      if (action === "add-point") {
        onAddChild(node, "point");
        return;
      }
      if (action === "copy-id") {
        void navigator.clipboard?.writeText(node.node_id);
        message.success("Node ID 已复制");
        return;
      }
      if (action === "move-before" || action === "move-after") {
        applyMoveResult(fallbackCatalogTreeReorder(treeData, node.node_id, action === "move-before" ? "before" : "after"));
        return;
      }
      onChangeStatus(node, action);
    },
    [applyMoveResult, message, onAddChild, onChangeStatus, treeData],
  );

  const NodeRenderer = useMemo(
    () =>
      function CatalogTreeNodeRenderer(props: NodeRendererProps<CatalogArboristNode>) {
        return <CatalogTreeRow {...props} onAction={handleRowAction} />;
      },
    [handleRowAction],
  );

  const treeHeight = Math.max(320, treeBoxSize.height || 420);
  const treeWidth = treeBoxSize.width > 0 ? treeBoxSize.width : "100%";

  useEffect(() => {
    if (!selectedNodeId) return;
    if (!findCatalogTreeNode(treeData, selectedNodeId)) return;
    void arboristRef.current?.scrollTo(selectedNodeId, "smart");
  }, [selectedNodeId, treeData]);

  return (
    <div className="catalog-tree-list">
      <Flex align="center" justify="space-between" className="catalog-tree-list-header">
        <Text strong>章节目录树</Text>
        <Dropdown
          trigger={["click"]}
          menu={{
            items: addRootItems,
            onClick: ({ key }) => onAddRoot(key as CatalogNodeCard["node_kind"]),
          }}
        >
          <Button size="small" type="text" icon={<Plus size={17} />} aria-label="添加到本章" title="添加到本章" />
        </Dropdown>
      </Flex>
      <QueryState loading={Boolean(loading)} error={error} empty={!nodes.length}>
        <div ref={treeBoxRef} className="catalog-arborist-shell">
          <Tree<CatalogArboristNode>
            ref={arboristRef}
            aria-label="章节目录树"
            className="catalog-arborist-tree"
            data={treeData}
            width={treeWidth}
            height={treeHeight}
            indent={22}
            rowHeight={38}
            overscanCount={8}
            selection={selectedNodeId || undefined}
            disableMultiSelection
            onActivate={(node) => onSelect(node.data.catalogNode)}
            onToggle={(id) => void loadDirectory(id)}
            onMove={handleMove}
            disableDrop={({ parentNode, dragNodes }) =>
              resolveCatalogDropDisabled({
                tree: treeData,
                dragIds: dragNodes.map((dragNode) => dragNode.id),
                parentId: parentNode?.isRoot ? null : parentNode?.id ?? null,
              })
            }
            renderCursor={CatalogArboristCursor}
            renderDragPreview={CatalogArboristDragPreview}
            openByDefault={false}
          >
            {NodeRenderer}
          </Tree>
          {loadingDirectoryIds.size ? <Spin size="small" className="catalog-tree-inline-spinner" /> : null}
        </div>
      </QueryState>
    </div>
  );
}
