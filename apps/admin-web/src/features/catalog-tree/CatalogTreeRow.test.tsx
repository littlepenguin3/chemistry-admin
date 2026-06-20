import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { CatalogNodeCard } from "../../api/catalogTree";
import type { CatalogArboristNode } from "./catalogTreeData";
import { CatalogTreeRow, type CatalogTreeActionHandler } from "./CatalogTreeRow";

afterEach(cleanup);

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

function renderRow({
  catalogNode,
  isInternal = catalogNode.node_kind === "directory",
  isOpen = false,
  isSelected = false,
}: {
  catalogNode: CatalogNodeCard;
  isInternal?: boolean;
  isOpen?: boolean;
  isSelected?: boolean;
}) {
  const onAction = vi.fn<CatalogTreeActionHandler>();
  const toggle = vi.fn();
  const handleClick = vi.fn();
  const props = {
    style: {},
    dragHandle: vi.fn(),
    tree: {} as never,
    node: {
      id: catalogNode.node_id,
      data: {
        id: catalogNode.node_id,
        name: catalogNode.title,
        kind: catalogNode.node_kind,
        catalogNode,
        loaded: true,
        children: catalogNode.node_kind === "directory" ? [] : null,
      } satisfies CatalogArboristNode,
      level: 1,
      isInternal,
      isOpen,
      isSelected,
      willReceiveDrop: false,
      toggle,
      handleClick,
    } as never,
    onAction,
  };
  const view = render(<CatalogTreeRow {...props} />);
  return { ...view, onAction, toggle, handleClick };
}

describe("CatalogTreeRow", () => {
  it("renders directory rows with a directory chevron and directory-only add actions", () => {
    const { container } = renderRow({
      catalogNode: node({ node_id: "dir-a", title: "氧化性模块", node_kind: "directory", has_children: true, descendant_point_count: 3 }),
      isInternal: true,
    });

    expect(screen.getByText("氧化性模块")).toBeInTheDocument();
    expect(screen.getByLabelText("展开目录")).toBeInTheDocument();
    expect(screen.getByLabelText("新建子节点")).toBeInTheDocument();
    expect(screen.getByLabelText("共 3 个点位")).toHaveTextContent("3");
    expect(screen.getByLabelText("状态：草稿")).toBeInTheDocument();
    expect(container.querySelector(".catalog-sidebar-status-dot")).toHaveClass("is-draft");
    expect(container).not.toHaveTextContent("draft");
    expect(container.querySelector(".catalog-sidebar-switcher-spacer")).toBeNull();
  });

  it("toggles directory rows when the row body is clicked", () => {
    const { container, toggle, handleClick } = renderRow({
      catalogNode: node({ node_id: "dir-click", title: "Directory", node_kind: "directory", has_children: true }),
      isInternal: true,
    });

    const row = container.querySelector(".catalog-sidebar-row");
    expect(row).not.toBeNull();
    fireEvent.click(row!);

    expect(handleClick).toHaveBeenCalledTimes(1);
    expect(toggle).toHaveBeenCalledTimes(1);
  });

  it("renders point rows as leaves with an experiment icon affordance and video metadata", () => {
    const { container } = renderRow({
      catalogNode: node({
        node_id: "point-a",
        title: "氯水 + KBr 溶液 + CCl4",
        node_kind: "point",
        status: "published",
        media_count: 2,
        published_media_count: 1,
      }),
      isInternal: false,
    });

    expect(screen.getByText("氯水 + KBr 溶液 + CCl4")).toBeInTheDocument();
    expect(screen.queryByLabelText("视频 1/2")).toBeNull();
    expect(screen.getByLabelText("点位状态：已发布")).toBeInTheDocument();
    expect(screen.queryByLabelText("展开目录")).toBeNull();
    expect(screen.queryByLabelText("新建子节点")).toBeNull();
    expect(screen.queryByLabelText(/共 \d+ 个点位/)).toBeNull();
    expect(container).not.toHaveTextContent("published");
    expect(container.querySelector(".catalog-sidebar-switcher-spacer")).not.toBeNull();
    expect(container.querySelector(".kind-point .catalog-sidebar-icon svg")).not.toBeNull();
    expect(container.querySelector(".catalog-sidebar-point-status")).toHaveClass("is-published");
  });

  it("keeps selected state and long-title title text on the row shell", () => {
    const title = "氯水对溴离子、碘离子混合溶液的氧化性验证实验";
    const { container } = renderRow({
      catalogNode: node({ node_id: "dir-long", title, node_kind: "directory" }),
      isSelected: true,
    });

    const row = container.querySelector(".catalog-sidebar-item");
    expect(row).toHaveClass("is-selected");
    expect(row).toHaveAttribute("title", title);
  });

  it("does not render archived backend status text visibly", () => {
    const { container } = renderRow({
      catalogNode: node({ node_id: "dir-archived", title: "归档目录", node_kind: "directory", status: "archived" }),
    });

    expect(screen.getByLabelText("状态：已归档")).toBeInTheDocument();
    expect(container).not.toHaveTextContent("archived");
  });
});
