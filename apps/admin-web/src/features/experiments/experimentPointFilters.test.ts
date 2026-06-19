import { describe, expect, it } from "vitest";
import type { ExperimentVideoPoint } from "../../api";
import {
  buildPointContentRequest,
  buildPointPublicationRequest,
  buildPointRelatedLinksRequest,
  filterVideoPointsForAdmin,
} from "./ExperimentsPage";

type Filter = Parameters<typeof filterVideoPointsForAdmin>[1];

function point(
  key: string,
  overrides: Partial<ExperimentVideoPoint> = {},
): ExperimentVideoPoint {
  return {
    point_key: key,
    point_title: key,
    source: "manual",
    resources: [],
    resource_count: 0,
    published_count: 0,
    ...overrides,
  };
}

function keys(points: ExperimentVideoPoint[], filter: Filter): string[] {
  return filterVideoPointsForAdmin(points, filter).map((item) => item.point_key);
}

describe("filterVideoPointsForAdmin", () => {
  const points = [
    point("missing", { content: { principle_mode: "text", content_status: "missing" } }),
    point("draft", { content: { principle_mode: "text", content_status: "draft" } }),
    point("published", { content: { principle_mode: "text", content_status: "published" }, resource_count: 1, published_count: 1 }),
    point("unpublished-video", { resource_count: 1, published_count: 0 }),
    point("sync-error", { index_state: { document_id: "point:1", desired_action: "upsert", sync_status: "failed", attempts: 2 } }),
  ];

  it("filters by content status, video status, and search sync state", () => {
    expect(keys(points, "missing_content")).toEqual(["missing", "unpublished-video", "sync-error"]);
    expect(keys(points, "draft_content")).toEqual(["draft"]);
    expect(keys(points, "published_content")).toEqual(["published"]);
    expect(keys(points, "unpublished_video")).toEqual(["unpublished-video"]);
    expect(keys(points, "sync_error")).toEqual(["sync-error"]);
  });
});

describe("point content request builders", () => {
  it("keeps equation and text principle modes mutually exclusive", () => {
    expect(
      buildPointContentRequest({
        point_title: "Na2S2O3 + HCl",
        principle_mode: "equation",
        principle_equation: "Na2S2O3 + 2 HCl = 2 NaCl + S↓ + SO2↑ + H2O",
        principle_text: "should not be primary",
        phenomenon_explanation: "生成硫沉淀和二氧化硫。",
        safety_note: "通风操作。",
      }),
    ).toEqual({
      point_title: "Na2S2O3 + HCl",
      principle_mode: "equation",
      principle_equation: "Na2S2O3 + 2 HCl = 2 NaCl + S↓ + SO2↑ + H2O",
      principle_text: "",
      phenomenon_explanation: "生成硫沉淀和二氧化硫。",
      safety_note: "通风操作。",
    });

    expect(
      buildPointContentRequest({
        point_title: "文字原理",
        principle_mode: "text",
        principle_equation: "H2 + Cl2 = 2 HCl",
        principle_text: "氯气可氧化溴离子。",
      }),
    ).toMatchObject({
      principle_mode: "text",
      principle_equation: "",
      principle_text: "氯气可氧化溴离子。",
    });
  });

  it("builds related link and publication payloads without touching video resources", () => {
    expect(
      buildPointRelatedLinksRequest({
        point_title: "source",
        principle_mode: "text",
        links: [
          { target: "EXP_1::point-a", relation_type: "manual", label: "相邻实验", sort_order: 2 },
          { target: "EXP_1::point-b", relation_type: "default_override", hidden: true },
          { target: "" },
        ],
      }),
    ).toEqual({
      links: [
        {
          target_experiment_id: "EXP_1",
          target_point_key: "point-a",
          relation_type: "manual",
          hidden: false,
          sort_order: 2,
          label: "相邻实验",
        },
        {
          target_experiment_id: "EXP_1",
          target_point_key: "point-b",
          relation_type: "default_override",
          hidden: true,
          sort_order: 2,
          label: null,
        },
      ],
    });
    expect(buildPointPublicationRequest("publish")).toEqual({ action: "publish" });
  });
});
