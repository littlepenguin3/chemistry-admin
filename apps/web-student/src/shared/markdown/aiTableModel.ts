import type { ParsedMarkdownTable } from "./aiRichContentArtifacts";

export type AiTableColumnModel = {
  id: string;
  index: number;
  header: string;
  label: string;
  isFirst: boolean;
};

export type AiTableCellModel = {
  id: string;
  rowId: string;
  columnId: string;
  columnIndex: number;
  header: string;
  value: string;
};

export type AiTableRowModel = {
  id: string;
  index: number;
  title: string;
  values: Record<string, string>;
  cells: AiTableCellModel[];
};

export type AiTableModel = {
  columns: AiTableColumnModel[];
  rows: AiTableRowModel[];
  firstColumnHeader: string;
  isWide: boolean;
};

function textValue(value: string | null | undefined): string {
  return typeof value === "string" ? value.trim() : "";
}

export function createAiTableModel(table: ParsedMarkdownTable): AiTableModel {
  const columnCount = Math.max(table.headers.length, ...table.rows.map((row) => row.length), 1);
  const columns = Array.from({ length: columnCount }, (_, index) => {
    const header = textValue(table.headers[index]);
    return {
      id: `col_${index}`,
      index,
      header,
      label: header || `列 ${index + 1}`,
      isFirst: index === 0,
    };
  });

  const rows = table.rows.map((sourceRow, rowIndex) => {
    const rowId = `row_${rowIndex}`;
    const values: Record<string, string> = {};
    const cells = columns.map((column) => {
      const value = textValue(sourceRow[column.index]);
      values[column.id] = value;
      return {
        id: `${rowId}_${column.id}`,
        rowId,
        columnId: column.id,
        columnIndex: column.index,
        header: column.header,
        value,
      };
    });
    const firstValue = cells[0]?.value || "";
    return {
      id: rowId,
      index: rowIndex,
      title: firstValue || `第 ${rowIndex + 1} 行`,
      values,
      cells,
    };
  });

  return {
    columns,
    rows,
    firstColumnHeader: columns[0]?.label || "首列",
    isWide: columns.length > 2,
  };
}
