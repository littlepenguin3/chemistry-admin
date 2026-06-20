import { describe, expect, it } from "vitest";

import type { CatalogNodeDetail } from "../../api/catalogTree";
import {
  buildCatalogNodeCreatePayload,
  buildCatalogPointContentPayload,
  buildCatalogRelatedLinksPayload,
  hydrateCatalogNodeForm,
  hydrateCatalogPointContentForm,
  hydrateCatalogRelatedLinksForm,
  siblingReorderItems,
} from "./catalogTreeMappers";

describe("catalog tree mappers", () => {
  it("builds directory create payloads with card fields", () => {
    expect(
      buildCatalogNodeCreatePayload(
        {
          title: "  Observation branch  ",
          summary: "  nested  ",
          node_kind: "directory",
          teacher_note: " private ",
          student_description: " student card ",
          card_icon_key: " flask ",
          card_accent: " green ",
          card_layout: "compact",
        },
        "CH1",
        "cat-parent",
      ),
    ).toEqual({
      chapter_id: "CH1",
      parent_id: "cat-parent",
      node_kind: "directory",
      title: "Observation branch",
      summary: "nested",
      teacher_note: "private",
      student_description: "student card",
      card_image_asset_id: null,
      card_icon_key: "flask",
      card_accent: "green",
      card_layout: "compact",
      card_presentation: {},
      point_card_presentation: {},
    });
  });

  it("hydrates and serializes constrained point card overrides", () => {
    const detail = {
      node: {
        title: "Video point",
        summary: "summary",
        node_kind: "point",
        point_card_presentation: {
          cover_image_asset_id: "asset-1",
          short_description: "Watch the color change",
          icon_key: "play",
          accent: "blue",
          emphasis: true,
        },
      },
    } as unknown as CatalogNodeDetail;

    expect(hydrateCatalogNodeForm(detail)).toMatchObject({
      point_card_cover_image_asset_id: "asset-1",
      point_card_short_description: "Watch the color change",
      point_card_icon_key: "play",
      point_card_accent: "blue",
      point_card_emphasis: true,
    });
  });

  it("keeps teacher note in authoring payload while separating principle modes", () => {
    expect(
      buildCatalogPointContentPayload({
        point_title: "Sodium thiosulfate and acid",
        teacher_note: "teacher-only note",
        principle_mode: "equation",
        principle_equation: "Na2S2O3 + 2HCl = 2NaCl + S + SO2 + H2O",
        principle_text: "hidden by mode",
        phenomenon_explanation: "Sulfur precipitate appears.",
        safety_note: "Use ventilation.",
      }),
    ).toEqual({
      point_title: "Sodium thiosulfate and acid",
      teacher_note: "teacher-only note",
      principle_mode: "equation",
      principle_equation: "Na2S2O3 + 2HCl = 2NaCl + S + SO2 + H2O",
      principle_text: "",
      phenomenon_explanation: "Sulfur precipitate appears.",
      safety_note: "Use ventilation.",
    });
  });

  it("hydrates point content from node title when content is missing", () => {
    const detail = {
      node: { title: "Fallback title", node_kind: "point" },
      point_content: null,
    } as CatalogNodeDetail;

    expect(hydrateCatalogPointContentForm(detail)).toMatchObject({
      point_title: "Fallback title",
      teacher_note: "",
      principle_mode: "text",
    });
  });

  it("uses point node ids for editable related links", () => {
    const detail = {
      related_links: [
        {
          source_node_id: "cat-source",
          target_node_id: "cat-target-a",
          target_title: "Generated neighbor",
          relation_type: "generated_default",
          hidden: false,
          sort_order: 3,
          label: null,
          source: "generated_default",
        },
      ],
    } as CatalogNodeDetail;

    const form = hydrateCatalogRelatedLinksForm(detail);
    expect(form.links?.[0]).toMatchObject({ target_node_id: "cat-target-a", relation_type: "manual" });
    expect(
      buildCatalogRelatedLinksPayload({
        links: [
          { target_node_id: "cat-target-a", relation_type: "manual", sort_order: 2, label: "Neighbor" },
          { target_node_id: "cat-target-a", relation_type: "manual", sort_order: 3 },
          { target_node_id: "" },
        ],
      }),
    ).toEqual({
      links: [
        {
          target_node_id: "cat-target-a",
          relation_type: "manual",
          hidden: false,
          sort_order: 2,
          label: "Neighbor",
        },
      ],
    });
  });

  it("creates sibling reorder payloads by node id", () => {
    expect(
      siblingReorderItems(
        [
          { node_id: "cat-a", title: "A", display_order: 1 } as never,
          { node_id: "cat-b", title: "B", display_order: 2 } as never,
          { node_id: "cat-c", title: "C", display_order: 3 } as never,
        ],
        "cat-c",
        "up",
      ),
    ).toEqual([
      { node_id: "cat-a", display_order: 1 },
      { node_id: "cat-c", display_order: 2 },
      { node_id: "cat-b", display_order: 3 },
    ]);
  });
});
