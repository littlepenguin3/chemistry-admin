import { describe, expect, it } from "vitest";

import catalogTreeApiSource from "../../api/catalogTree.ts?raw";
import editorSource from "./CatalogTreeEditor.tsx?raw";
import treeSource from "./CatalogTreeNodeList.tsx?raw";

describe("catalog tree UI contracts", () => {
  it("keeps directory and point editor panels separate", () => {
    expect(editorSource).toContain('getFieldValue("node_kind") === "directory"');
    expect(editorSource).toContain('name="student_description"');
    expect(editorSource).toContain('name="card_image_asset_id"');
    expect(editorSource).toContain('name="point_card_short_description"');
    expect(editorSource).toContain("useCatalogMediaAssets(pointCapable)");
    expect(editorSource).not.toContain("shortcut_target_node_id");
    expect(editorSource).not.toContain("uploadCatalogPointMedia");
    expect(editorSource).not.toContain('type="file"');
  });

  it("keeps the video panel as existing-media binding only", () => {
    expect(editorSource).toContain("mutations.bindMedia.mutate");
    expect(editorSource).toContain("getMediaAssetFileUrl");
    expect(editorSource).toContain("getMediaAssetThumbnailUrl");
    expect(catalogTreeApiSource).not.toContain("media/upload");
    expect(catalogTreeApiSource).not.toContain("uploadCatalogPointMedia");
  });

  it("uses draggable tree movement with invalid point-drop feedback instead of row arrow clutter", () => {
    expect(treeSource).toContain("draggable");
    expect(treeSource).toContain("onDrop");
    expect(treeSource).toContain("target.catalogNode.node_kind === \"point\"");
    expect(treeSource).toContain("message.warning");
    expect(treeSource).toContain("onReorder");
    expect(treeSource).toContain("onMove");
    expect(treeSource).not.toContain("ArrowUpOutlined");
    expect(treeSource).not.toContain("ArrowDownOutlined");
  });
});
