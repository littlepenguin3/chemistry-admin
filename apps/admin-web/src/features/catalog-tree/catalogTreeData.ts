import type { CatalogNodeCard, CatalogNodeMovePayload } from "../../api/catalogTree";

export type CatalogArboristNode = {
  id: string;
  name: string;
  kind: CatalogNodeCard["node_kind"];
  catalogNode: CatalogNodeCard;
  loaded: boolean;
  children?: CatalogArboristNode[] | null;
};

export type CatalogTreeDataNode = CatalogArboristNode;

export type CatalogTreeMoveResult =
  | { kind: "invalid"; reason: string }
  | { kind: "reorder"; items: Array<{ node_id: string; display_order: number }> }
  | { kind: "move"; nodeId: string; payload: CatalogNodeMovePayload };

export type CatalogTreeDropResult = CatalogTreeMoveResult;

export function toCatalogTreeNode(node: CatalogNodeCard, previous?: CatalogArboristNode): CatalogArboristNode {
  const isPoint = node.node_kind === "point";
  const existingChildren = previous?.children ?? [];
  return {
    id: node.node_id,
    name: node.title,
    kind: node.node_kind,
    catalogNode: node,
    loaded: isPoint ? true : previous?.loaded ?? !node.has_children,
    children: isPoint ? null : existingChildren,
  };
}

export function mergeCatalogTreeData(nodes: CatalogNodeCard[], previous: CatalogArboristNode[] = []): CatalogArboristNode[] {
  const previousById = new Map(previous.map((item) => [item.id, item]));
  return nodes.map((node) => toCatalogTreeNode(node, previousById.get(node.node_id)));
}

export function replaceCatalogTreeChildren(
  tree: CatalogArboristNode[],
  nodeId: string,
  children: CatalogArboristNode[],
): CatalogArboristNode[] {
  return tree.map((item) => {
    if (item.id === nodeId) {
      return { ...item, loaded: true, children };
    }
    if (!item.children?.length) return item;
    return { ...item, children: replaceCatalogTreeChildren(item.children, nodeId, children) };
  });
}

export function findCatalogTreeNode(tree: CatalogArboristNode[], nodeId: string): CatalogArboristNode | undefined {
  for (const item of tree) {
    if (item.id === nodeId) return item;
    if (item.children?.length) {
      const match = findCatalogTreeNode(item.children, nodeId);
      if (match) return match;
    }
  }
  return undefined;
}

export function findCatalogTreeParentKey(
  tree: CatalogArboristNode[],
  nodeId: string,
  parentId: string | null = null,
): string | null | undefined {
  for (const item of tree) {
    if (item.id === nodeId) return parentId;
    if (item.children?.length) {
      const match = findCatalogTreeParentKey(item.children, nodeId, item.id);
      if (match !== undefined) return match;
    }
  }
  return undefined;
}

export function catalogTreeSiblings(tree: CatalogArboristNode[], parentId: string | null): CatalogArboristNode[] {
  if (!parentId) return tree;
  const parent = findCatalogTreeNode(tree, parentId);
  return parent?.children || [];
}

export function isCatalogTreeDescendant(tree: CatalogArboristNode[], parentId: string, candidateId: string): boolean {
  const parent = findCatalogTreeNode(tree, parentId);
  if (!parent?.children?.length) return false;
  return Boolean(findCatalogTreeNode(parent.children, candidateId));
}

function clampIndex(index: number, maxLength: number): number {
  if (!Number.isFinite(index)) return maxLength;
  return Math.max(0, Math.min(index, maxLength));
}

function moveItemWithinSiblings(
  siblings: CatalogArboristNode[],
  nodeId: string,
  index: number,
): Array<{ node_id: string; display_order: number }> {
  const currentIndex = siblings.findIndex((item) => item.id === nodeId);
  if (currentIndex < 0) return [];
  const next = siblings.slice();
  const [item] = next.splice(currentIndex, 1);
  next.splice(clampIndex(index, next.length), 0, item);
  return next.map((sibling, position) => ({ node_id: sibling.id, display_order: position + 1 }));
}

export function resolveCatalogArboristMove({
  tree,
  dragIds,
  parentId,
  index,
}: {
  tree: CatalogArboristNode[];
  dragIds: string[];
  parentId: string | null;
  index: number;
}): CatalogTreeMoveResult {
  if (dragIds.length !== 1) {
    return { kind: "invalid", reason: "一次只能移动一个目录或点位" };
  }

  const nodeId = dragIds[0];
  const draggedNode = findCatalogTreeNode(tree, nodeId);
  if (!draggedNode) {
    return { kind: "invalid", reason: "未找到要移动的节点" };
  }

  const targetParent = parentId ? findCatalogTreeNode(tree, parentId) : undefined;
  if (parentId && !targetParent) {
    return { kind: "invalid", reason: "未找到目标目录" };
  }
  if (targetParent?.kind === "point") {
    return { kind: "invalid", reason: "点位不能作为父级目录" };
  }
  if (parentId && isCatalogTreeDescendant(tree, nodeId, parentId)) {
    return { kind: "invalid", reason: "不能把目录移动到自己的子级中" };
  }
  if (targetParent && targetParent.catalogNode.chapter_id !== draggedNode.catalogNode.chapter_id) {
    return { kind: "invalid", reason: "不能跨章节移动节点" };
  }

  const currentParentId = findCatalogTreeParentKey(tree, nodeId) || null;
  const siblings = catalogTreeSiblings(tree, parentId);
  if (currentParentId === parentId) {
    return { kind: "reorder", items: moveItemWithinSiblings(siblings, nodeId, index) };
  }

  return {
    kind: "move",
    nodeId,
    payload: {
      parent_id: parentId,
      display_order: clampIndex(index, siblings.length) + 1,
    },
  };
}

export function resolveCatalogDropDisabled({
  tree,
  dragIds,
  parentId,
}: {
  tree: CatalogArboristNode[];
  dragIds: string[];
  parentId: string | null;
}): boolean {
  if (dragIds.length !== 1) return true;
  const draggedNode = findCatalogTreeNode(tree, dragIds[0]);
  if (!draggedNode) return true;
  const targetParent = parentId ? findCatalogTreeNode(tree, parentId) : undefined;
  if (targetParent?.kind === "point") return true;
  if (parentId && isCatalogTreeDescendant(tree, dragIds[0], parentId)) return true;
  return Boolean(targetParent && targetParent.catalogNode.chapter_id !== draggedNode.catalogNode.chapter_id);
}

export function fallbackCatalogTreeReorder(
  tree: CatalogArboristNode[],
  nodeId: string,
  direction: "before" | "after",
): CatalogTreeMoveResult {
  const parentId = findCatalogTreeParentKey(tree, nodeId) || null;
  const siblings = catalogTreeSiblings(tree, parentId);
  const currentIndex = siblings.findIndex((item) => item.id === nodeId);
  if (currentIndex < 0) {
    return { kind: "invalid", reason: "未找到要移动的节点" };
  }
  const targetIndex = direction === "before" ? currentIndex - 1 : currentIndex + 1;
  if (targetIndex < 0 || targetIndex >= siblings.length) {
    return { kind: "invalid", reason: "已经在当前层级的边界" };
  }
  return { kind: "reorder", items: moveItemWithinSiblings(siblings, nodeId, targetIndex) };
}
