import type {
  CatalogNodeCard,
  CatalogNodeCreatePayload,
  CatalogNodeDetail,
  CatalogNodeKind,
  CatalogNodeMovePayload,
  CatalogNodeUpdatePayload,
  CatalogPointContentPayload,
  CatalogPrincipleMode,
  CatalogReactionEquationInput,
  CatalogRelatedLinksPayload,
} from "../../api/catalogTree";

export type CatalogNodeFormValues = {
  title: string;
  summary?: string;
  node_kind: CatalogNodeKind;
  teacher_note?: string;
  student_description?: string;
  card_image_asset_id?: string;
  card_icon_key?: string;
  card_accent?: string;
  card_layout?: string;
  point_card_cover_image_asset_id?: string;
  point_card_short_description?: string;
  point_card_icon_key?: string;
  point_card_accent?: string;
  point_card_emphasis?: boolean;
  canonical_point_id?: string;
};

export type CatalogPointContentFormValues = {
  point_title: string;
  teacher_note?: string;
  principle_mode: CatalogPrincipleMode;
  principle_equation?: string;
  reaction_equations_text?: string;
  reaction_equations?: CatalogReactionEquationInput[];
  principle_text?: string;
  phenomenon_explanation?: string;
  safety_note?: string;
};

export type CatalogRelatedLinkFormItem = {
  target_node_id?: string;
  relation_type?: "manual" | "default_override" | "generated_default";
  hidden?: boolean;
  sort_order?: number;
  label?: string;
};

export type CatalogRelatedLinksFormValues = {
  links?: CatalogRelatedLinkFormItem[];
};

export function isPointCapable(kind?: CatalogNodeKind | null): boolean {
  return kind === "point";
}

export function hydrateCatalogNodeForm(detail: CatalogNodeDetail | null | undefined): CatalogNodeFormValues {
  const node = detail?.node;
  return {
    title: node?.title || "",
    summary: node?.summary || "",
    node_kind: node?.node_kind || "directory",
    teacher_note: node?.teacher_note || node?.summary || "",
    student_description: node?.student_description || "",
    card_image_asset_id: node?.card_image_asset_id || "",
    card_icon_key: node?.card_icon_key || "",
    card_accent: node?.card_accent || "",
    card_layout: node?.card_layout || "default",
    point_card_cover_image_asset_id: String(node?.point_card_presentation?.cover_image_asset_id || ""),
    point_card_short_description: String(node?.point_card_presentation?.short_description || ""),
    point_card_icon_key: String(node?.point_card_presentation?.icon_key || ""),
    point_card_accent: String(node?.point_card_presentation?.accent || ""),
    point_card_emphasis: Boolean(node?.point_card_presentation?.emphasis),
    canonical_point_id: node?.canonical_point_id || "",
  };
}

export function buildCatalogNodeCreatePayload(values: CatalogNodeFormValues, chapterId: string, parentId?: string | null): CatalogNodeCreatePayload {
  const pointCard = {
    cover_image_asset_id: values.point_card_cover_image_asset_id?.trim() || "",
    short_description: values.point_card_short_description?.trim() || "",
    icon_key: values.point_card_icon_key?.trim() || "",
    accent: values.point_card_accent?.trim() || "",
    emphasis: Boolean(values.point_card_emphasis),
  };
  return {
    chapter_id: chapterId,
    parent_id: parentId || null,
    node_kind: values.node_kind,
    title: values.title.trim(),
    summary: values.summary?.trim() || "",
    teacher_note: values.teacher_note?.trim() || "",
    student_description: values.student_description?.trim() || "",
    card_image_asset_id: values.card_image_asset_id?.trim() || null,
    card_icon_key: values.card_icon_key?.trim() || null,
    card_accent: values.card_accent?.trim() || null,
    card_layout: values.card_layout || "default",
    card_presentation: values.node_kind === "directory" ? {} : {},
    point_card_presentation: values.node_kind === "point" ? pointCard : {},
    canonical_point_id: values.node_kind === "point" ? values.canonical_point_id?.trim() || null : null,
  };
}

export function buildCatalogNodeUpdatePayload(values: CatalogNodeFormValues): CatalogNodeUpdatePayload {
  const pointCard = {
    cover_image_asset_id: values.point_card_cover_image_asset_id?.trim() || "",
    short_description: values.point_card_short_description?.trim() || "",
    icon_key: values.point_card_icon_key?.trim() || "",
    accent: values.point_card_accent?.trim() || "",
    emphasis: Boolean(values.point_card_emphasis),
  };
  return {
    title: values.title.trim(),
    summary: values.summary?.trim() || "",
    node_kind: values.node_kind,
    teacher_note: values.teacher_note?.trim() || "",
    student_description: values.student_description?.trim() || "",
    card_image_asset_id: values.card_image_asset_id?.trim() || null,
    card_icon_key: values.card_icon_key?.trim() || null,
    card_accent: values.card_accent?.trim() || null,
    card_layout: values.card_layout || "default",
    card_presentation: values.node_kind === "directory" ? {} : {},
    point_card_presentation: values.node_kind === "point" ? pointCard : {},
  };
}

export function hydrateCatalogPointContentForm(detail: CatalogNodeDetail | null | undefined): CatalogPointContentFormValues {
  const content = detail?.point_content;
  const reactionEquations =
    content?.reaction_equations?.length
      ? content.reaction_equations.map((equation, index) => ({
          raw_text: equation.raw_text || equation.canonical_display || "",
          row_order: equation.row_order || index + 1,
        }))
      : content?.principle_equation
        ? [{ raw_text: content.principle_equation, row_order: 1 }]
        : [];
  return {
    point_title: content?.point_title || detail?.node.title || "",
    teacher_note: content?.teacher_note || "",
    principle_mode: content?.principle_mode || "text",
    principle_equation: content?.principle_equation || "",
    reaction_equations_text: reactionEquations.map((equation) => equation.raw_text).filter(Boolean).join("\n"),
    reaction_equations: reactionEquations,
    principle_text: content?.principle_text || "",
    phenomenon_explanation: content?.phenomenon_explanation || "",
    safety_note: content?.safety_note || "",
  };
}

export function displayCatalogPointTitle(detail: CatalogNodeDetail | null | undefined): string {
  return detail?.point_content?.point_title?.trim() || detail?.node.title || "";
}

export function hasDivergentPointTitle(detail: CatalogNodeDetail | null | undefined): boolean {
  const nodeTitle = detail?.node.title?.trim();
  const pointTitle = detail?.point_content?.point_title?.trim();
  return Boolean(nodeTitle && pointTitle && nodeTitle !== pointTitle);
}

export function buildCatalogPointContentPayload(values: CatalogPointContentFormValues): CatalogPointContentPayload {
  const principleMode = values.principle_mode || "text";
  const rowsFromText = (values.reaction_equations_text || "")
    .split(/\r?\n/)
    .map((rawText, index) => ({ raw_text: rawText.trim(), row_order: index + 1, metadata: {} }))
    .filter((equation) => equation.raw_text);
  const reactionEquations = (rowsFromText.length ? rowsFromText : values.reaction_equations || [])
    .map((equation, index) => ({
      raw_text: equation.raw_text?.trim() || "",
      row_order: index + 1,
      metadata: equation.metadata || {},
    }))
    .filter((equation) => equation.raw_text);
  const legacyEquationText = reactionEquations.map((equation) => equation.raw_text).join("\n");
  return {
    point_title: values.point_title.trim(),
    teacher_note: values.teacher_note?.trim() || "",
    principle_mode: principleMode,
    principle_equation: principleMode === "equation" ? legacyEquationText || values.principle_equation?.trim() || "" : "",
    reaction_equations: principleMode === "equation" ? reactionEquations : [],
    principle_text: principleMode === "text" ? values.principle_text?.trim() || "" : "",
    phenomenon_explanation: values.phenomenon_explanation?.trim() || "",
    safety_note: values.safety_note?.trim() || "",
  };
}

export function hydrateCatalogRelatedLinksForm(detail: CatalogNodeDetail | null | undefined): CatalogRelatedLinksFormValues {
  return {
    links: (detail?.related_links || []).map((link, index) => ({
      target_node_id: link.target_node_id,
      relation_type: link.relation_type === "generated_default" ? "manual" : link.relation_type === "default_override" ? "default_override" : "manual",
      hidden: Boolean(link.hidden),
      sort_order: link.sort_order || index + 1,
      label: link.label || "",
    })),
  };
}

export function buildCatalogRelatedLinksPayload(values: CatalogRelatedLinksFormValues): CatalogRelatedLinksPayload {
  const seen = new Set<string>();
  const links: CatalogRelatedLinksPayload["links"] = [];
  (values.links || []).forEach((link, index) => {
      const targetNodeId = String(link.target_node_id || "").trim();
      if (!targetNodeId || seen.has(targetNodeId)) return;
      seen.add(targetNodeId);
      links.push({
        target_node_id: targetNodeId,
        relation_type: link.relation_type || "manual",
        hidden: Boolean(link.hidden),
        sort_order: Number(link.sort_order || index + 1),
        label: link.label?.trim() || null,
      });
    });
  return { links };
}

export function buildMovePayload(parentId: string | null | undefined, displayOrder?: number | null): CatalogNodeMovePayload {
  return {
    parent_id: parentId || null,
    display_order: displayOrder ?? null,
  };
}

export function siblingReorderItems(siblings: CatalogNodeCard[], movedNodeId: string, direction: "up" | "down"): Array<{ node_id: string; display_order: number }> {
  const ordered = [...siblings].sort((left, right) => left.display_order - right.display_order || left.title.localeCompare(right.title));
  const index = ordered.findIndex((node) => node.node_id === movedNodeId);
  const targetIndex = direction === "up" ? index - 1 : index + 1;
  if (index < 0 || targetIndex < 0 || targetIndex >= ordered.length) return [];
  const [moved] = ordered.splice(index, 1);
  ordered.splice(targetIndex, 0, moved);
  return ordered.map((node, orderIndex) => ({ node_id: node.node_id, display_order: orderIndex + 1 }));
}

export function catalogNodeKindLabel(kind: CatalogNodeKind): string {
  const labels: Record<CatalogNodeKind, string> = {
    directory: "目录",
    point: "点位",
  };
  return labels[kind];
}

export function catalogStatusColor(status: string): string {
  if (status === "published") return "green";
  if (status === "archived") return "default";
  return "default";
}

export function catalogStatusLabel(status: string): string {
  if (status === "published") return "已发布";
  if (status === "archived") return "已归档";
  return "草稿";
}

export function catalogStatusDotClass(status: string): string {
  if (status === "published") return "is-published";
  if (status === "archived") return "is-archived";
  return "is-draft";
}
