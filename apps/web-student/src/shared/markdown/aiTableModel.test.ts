import { describe, expect, it } from "vitest";
import { createAiTableModel } from "./aiTableModel";

describe("AI rich table model", () => {
  it("builds stable columns, rows, and cells from parsed Markdown tables", () => {
    const model = createAiTableModel({
      headers: ["试剂/步骤", "观察到的现象", "判断"],
      rows: [
        ["KBr + 氯水", "生成 $\\ce{Br2}$", "溴离子被氧化"],
        ["加入 CCl4", "下层橙红色", "萃取成功"],
      ],
    });

    expect(model.firstColumnHeader).toBe("试剂/步骤");
    expect(model.isWide).toBe(true);
    expect(model.columns.map((column) => column.id)).toEqual(["col_0", "col_1", "col_2"]);
    expect(model.rows.map((row) => row.id)).toEqual(["row_0", "row_1"]);
    expect(model.rows[0].title).toBe("KBr + 氯水");
    expect(model.rows[0].cells.map((cell) => cell.id)).toEqual(["row_0_col_0", "row_0_col_1", "row_0_col_2"]);
    expect(model.rows[1].values.col_2).toBe("萃取成功");
  });

  it("normalizes sparse rows and unnamed headers for row reading", () => {
    const model = createAiTableModel({
      headers: ["", "现象"],
      rows: [["", "浅黄色"], ["静置分层"]],
    });

    expect(model.columns.map((column) => column.label)).toEqual(["列 1", "现象"]);
    expect(model.firstColumnHeader).toBe("列 1");
    expect(model.isWide).toBe(false);
    expect(model.rows[0].title).toBe("第 1 行");
    expect(model.rows[1].cells[1].value).toBe("");
    expect(model.rows[1].values.col_1).toBe("");
  });
});
