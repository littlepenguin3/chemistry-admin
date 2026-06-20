import { describe, expect, it } from "vitest";

import type { CatalogNodeCard } from "../../api/catalogTree";
import {
  fallbackCatalogTreeReorder,
  isCatalogTreeDescendant,
  mergeCatalogTreeData,
  replaceCatalogTreeChildren,
  resolveCatalogArboristMove,
  resolveCatalogDropDisabled,
  toCatalogTreeNode,
  type CatalogTreeDataNode,
} from "./catalogTreeData";

function node(partial: Partial<CatalogNodeCard> & { node_id: string; title: string; node_kind: "directory" | "point" }): CatalogNodeCard {
  return {
    chapter_id: "CH13",
    parent_id: null,
    summary: "",
    status: "draft",
    display_order: 1,
    student_description: "",
    card_layout: "default",
    card_presentation: {},
    point_card_presentation: {},
    actions: [],
    has_children: false,
    descendant_point_count: 0,
    has_point_content: partial.node_kind === "point",
    media_count: 0,
    published_media_count: 0,
    validation: { ok: true, errors: [], warnings: [] },
    ...partial,
  };
}

function sampleTree(): CatalogTreeDataNode[] {
  const root = toCatalogTreeNode(node({ node_id: "dir-a", title: "A", node_kind: "directory", has_children: true }));
  root.children = [
    toCatalogTreeNode(node({ node_id: "point-a", title: "P1", node_kind: "point", parent_id: "dir-a", display_order: 1 })),
    toCatalogTreeNode(node({ node_id: "point-b", title: "P2", node_kind: "point", parent_id: "dir-a", display_order: 2 })),
    toCatalogTreeNode(node({ node_id: "dir-b", title: "B", node_kind: "directory", parent_id: "dir-a", display_order: 3, has_children: true })),
  ];
  root.children[2].children = [
    toCatalogTreeNode(node({ node_id: "point-c", title: "P3", node_kind: "point", parent_id: "dir-b", display_order: 1 })),
  ];
  return [root];
}

describe("catalog tree data helpers", () => {
  it("builds Arborist internal directory nodes and point leaves", () => {
    const point = toCatalogTreeNode(node({ node_id: "p", title: "Point", node_kind: "point" }));
    const directory = toCatalogTreeNode(node({ node_id: "d", title: "Directory", node_kind: "directory", has_children: true, descendant_point_count: 4 }));

    expect(point.children).toBeNull();
    expect(point.loaded).toBe(true);
    expect(directory.children).toEqual([]);
    expect(directory.loaded).toBe(false);
    expect(directory.catalogNode.descendant_point_count).toBe(4);
  });

  it("preserves loaded children when root cards refresh", () => {
    const previous = sampleTree();
    const merged = mergeCatalogTreeData([node({ node_id: "dir-a", title: "A updated", node_kind: "directory", has_children: true })], previous);

    expect(merged[0].name).toBe("A updated");
    expect(merged[0].children?.map((item) => item.id)).toEqual(["point-a", "point-b", "dir-b"]);
  });

  it("replaces lazy-loaded directory children", () => {
    const tree = [toCatalogTreeNode(node({ node_id: "dir-a", title: "A", node_kind: "directory", has_children: true }))];
    const next = replaceCatalogTreeChildren(tree, "dir-a", [
      toCatalogTreeNode(node({ node_id: "point-a", title: "P1", node_kind: "point", parent_id: "dir-a" })),
    ]);

    expect(next[0].loaded).toBe(true);
    expect(next[0].children?.[0].id).toBe("point-a");
  });

  it("detects descendant moves", () => {
    expect(isCatalogTreeDescendant(sampleTree(), "dir-a", "point-c")).toBe(true);
    expect(isCatalogTreeDescendant(sampleTree(), "dir-b", "point-a")).toBe(false);
  });

  it("rejects moving a node into a point", () => {
    expect(
      resolveCatalogArboristMove({
        tree: sampleTree(),
        dragIds: ["point-b"],
        parentId: "point-a",
        index: 0,
      }),
    ).toMatchObject({ kind: "invalid" });
  });

  it("rejects moving a directory into its descendant", () => {
    expect(resolveCatalogDropDisabled({ tree: sampleTree(), dragIds: ["dir-a"], parentId: "dir-b" })).toBe(true);
  });

  it("builds sibling reorder payloads from Arborist moves", () => {
    expect(
      resolveCatalogArboristMove({
        tree: sampleTree(),
        dragIds: ["point-b"],
        parentId: "dir-a",
        index: 0,
      }),
    ).toEqual({
      kind: "reorder",
      items: [
        { node_id: "point-b", display_order: 1 },
        { node_id: "point-a", display_order: 2 },
        { node_id: "dir-b", display_order: 3 },
      ],
    });
  });

  it("builds move payloads into a directory", () => {
    expect(
      resolveCatalogArboristMove({
        tree: sampleTree(),
        dragIds: ["point-a"],
        parentId: "dir-b",
        index: 1,
      }),
    ).toEqual({
      kind: "move",
      nodeId: "point-a",
      payload: { parent_id: "dir-b", display_order: 2 },
    });
  });

  it("builds move payloads back to the chapter root", () => {
    expect(
      resolveCatalogArboristMove({
        tree: sampleTree(),
        dragIds: ["point-a"],
        parentId: null,
        index: 1,
      }),
    ).toEqual({
      kind: "move",
      nodeId: "point-a",
      payload: { parent_id: null, display_order: 2 },
    });
  });

  it("builds directory move payloads", () => {
    expect(
      resolveCatalogArboristMove({
        tree: sampleTree(),
        dragIds: ["dir-b"],
        parentId: null,
        index: 0,
      }),
    ).toEqual({
      kind: "move",
      nodeId: "dir-b",
      payload: { parent_id: null, display_order: 1 },
    });
  });

  it("keeps fallback movement for menus and keyboard-adjacent controls", () => {
    expect(fallbackCatalogTreeReorder(sampleTree(), "point-b", "before")).toEqual({
      kind: "reorder",
      items: [
        { node_id: "point-b", display_order: 1 },
        { node_id: "point-a", display_order: 2 },
        { node_id: "dir-b", display_order: 3 },
      ],
    });
  });
});
