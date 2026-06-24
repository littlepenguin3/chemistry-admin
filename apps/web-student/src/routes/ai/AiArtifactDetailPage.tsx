import { useEffect, useId, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { flexRender, getCoreRowModel, useReactTable, type ColumnDef } from "@tanstack/react-table";
import { useParams, useSearch } from "@tanstack/react-router";
import { ChevronRight, Maximize2, RotateCcw, Table2, Workflow, X, ZoomIn, ZoomOut } from "lucide-react";
import { TransformComponent, TransformWrapper } from "react-zoom-pan-pinch";
import type { StudentRouteSearch } from "../../app/router/routeTypes";
import { DetailPageFrame } from "../../app/shell/DetailPageFrame";
import { readStudentAiHistory } from "../../features/assistant/assistantHistoryStore";
import { MobileEmptyState } from "../../mobile/primitives";
import { AiStaticMarkdown } from "../../components/AiMarkdown";
import { findAiRichContentArtifact, parseMarkdownTable, type AiRichContentArtifact } from "../../shared/markdown/aiRichContentArtifacts";
import { createAiTableModel, type AiTableRowModel } from "../../shared/markdown/aiTableModel";
import { renderStudentMermaid } from "../../shared/markdown/studentMermaid";

function motionTime(): number {
  if (typeof window === "undefined" || !window.matchMedia) return 160;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 160;
}

function ensureResizeObserverFallback(): void {
  if (typeof window === "undefined") return;
  const target = window as Window & { ResizeObserver?: typeof ResizeObserver };
  if (target.ResizeObserver) return;
  class NoopResizeObserver {
    observe() {
      // Older WebViews and jsdom can still use explicit viewer controls without resize observation.
    }
    unobserve() {
      // no-op
    }
    disconnect() {
      // no-op
    }
  }
  target.ResizeObserver = NoopResizeObserver as unknown as typeof ResizeObserver;
}

type ArtifactZoomHandlers = {
  zoomIn: (step?: number, animationTime?: number) => void;
  zoomOut: (step?: number, animationTime?: number) => void;
  resetTransform: (animationTime?: number) => void;
  centerView: (scale?: number, animationTime?: number) => void;
};

type ArtifactCanvasPageProps = {
  kind: "table" | "mermaid";
  label: string;
  icon: ReactNode;
  controls?: ReactNode;
  summary?: ReactNode;
  children: ReactNode;
  overlay?: ReactNode;
  style?: CSSProperties;
  ariaLabel: string;
};

function ArtifactCanvasPage({ kind, label, icon, controls, summary, children, overlay, style, ariaLabel }: ArtifactCanvasPageProps) {
  return (
    <section
      className={`ai-artifact-viewer ai-artifact-canvas-page ai-artifact-${kind}-viewer`}
      data-artifact-kind={kind}
      aria-label={ariaLabel}
      style={style}
    >
      <div className="ai-artifact-canvas-toolbar">
        <div className="ai-artifact-canvas-title">
          <span className="ai-artifact-canvas-label">
            {icon}
            <span>{label}</span>
          </span>
          {summary}
        </div>
        {controls}
      </div>
      <div className="ai-artifact-canvas-workspace">{children}</div>
      {overlay}
    </section>
  );
}

function ArtifactMissingState() {
  return (
    <section className="ai-artifact-empty">
      <MobileEmptyState className="empty-learning-card" icon={<Maximize2 size={20} />}>
        <span>这段内容暂时无法打开详情</span>
      </MobileEmptyState>
    </section>
  );
}

function EnhancedTableDetailViewer({ artifact }: { artifact: AiRichContentArtifact }) {
  ensureResizeObserverFallback();
  const scrollRef = useRef<HTMLDivElement>(null);
  const zoomHandlersRef = useRef<ArtifactZoomHandlers | null>(null);
  const [selectedRowId, setSelectedRowId] = useState<string | null>(null);
  const parsedTable = useMemo(() => artifact.table || parseMarkdownTable(artifact.source), [artifact.source, artifact.table]);
  const tableModel = useMemo(() => (parsedTable ? createAiTableModel(parsedTable) : null), [parsedTable]);
  const tableColumns = useMemo<ColumnDef<AiTableRowModel, string>[]>(
    () =>
      tableModel
        ? tableModel.columns.map((column) => ({
            id: column.id,
            header: column.label,
            accessorFn: (row) => row.values[column.id] || "",
          }))
        : [],
    [tableModel],
  );
  const tableInstance = useReactTable({
    data: tableModel?.rows || [],
    columns: tableColumns,
    getCoreRowModel: getCoreRowModel(),
    getRowId: (row) => row.id,
  });
  const columnIndexById = useMemo(() => new Map(tableModel?.columns.map((column) => [column.id, column.index]) || []), [tableModel]);
  const selectedRow = tableModel?.rows.find((row) => row.id === selectedRowId) || null;

  useEffect(() => {
    setSelectedRowId(null);
  }, [artifact.id]);

  useEffect(() => {
    if (!selectedRowId) return undefined;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSelectedRowId(null);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [selectedRowId]);

  if (!tableModel) return <ArtifactMissingState />;

  const resetTableView = () => {
    const animationTime = motionTime();
    zoomHandlersRef.current?.resetTransform(animationTime);
    scrollRef.current?.scrollTo({ left: 0, top: 0, behavior: animationTime ? "smooth" : "auto" });
  };

  const openRow = (row: AiTableRowModel) => {
    setSelectedRowId(row.id);
  };

  const tableControls = (
    <div className="ai-artifact-zoom-controls ai-artifact-table-controls">
      <button type="button" onClick={() => zoomHandlersRef.current?.zoomOut(0.18, motionTime())} aria-label="缩小表格" title="缩小表格">
        <ZoomOut size={15} />
      </button>
      <button type="button" onClick={() => zoomHandlersRef.current?.zoomIn(0.18, motionTime())} aria-label="放大表格" title="放大表格">
        <ZoomIn size={15} />
      </button>
      <button type="button" onClick={() => zoomHandlersRef.current?.centerView(0.92, motionTime())} aria-label="适合屏幕" title="适合屏幕">
        <Maximize2 size={15} />
      </button>
      <button type="button" onClick={resetTableView} aria-label="重置表格视图" title="重置表格视图">
        <RotateCcw size={15} />
      </button>
    </div>
  );

  const tableSummary = (
    <div className="ai-artifact-table-context" aria-hidden="true">
      <span>{tableModel.firstColumnHeader}</span>
      <span>{tableModel.rows.length} 行</span>
      <span>{tableModel.columns.length} 列</span>
    </div>
  );

  const rowReader = selectedRow ? (
    <aside className="ai-artifact-row-reader" role="dialog" aria-label="表格行详情">
      <div className="ai-artifact-row-reader-head">
        <span>{tableModel.firstColumnHeader}</span>
        <button type="button" onClick={() => setSelectedRowId(null)} aria-label="关闭行详情">
          <X size={16} />
        </button>
      </div>
      <div className="ai-artifact-row-reader-title">
        <AiStaticMarkdown text={selectedRow.title} className="ai-artifact-row-title-markdown" />
      </div>
      <dl className="ai-artifact-row-fields">
        {(selectedRow.cells.length > 1 ? selectedRow.cells.slice(1) : selectedRow.cells).map((cell) => (
          <div className="ai-artifact-row-field" key={cell.id}>
            <dt>
              <AiStaticMarkdown text={cell.header || `列 ${cell.columnIndex + 1}`} className="ai-artifact-row-label-markdown" />
            </dt>
            <dd>
              <AiStaticMarkdown text={cell.value || " "} className="ai-artifact-row-value-markdown" />
            </dd>
          </div>
        ))}
      </dl>
    </aside>
  ) : null;

  return (
    <ArtifactCanvasPage
      kind="table"
      label="表格详情"
      icon={<Table2 size={15} />}
      controls={tableControls}
      summary={tableSummary}
      overlay={rowReader}
      ariaLabel="AI 表格详情"
      style={{ "--ai-table-row-count": String(Math.max(tableModel.rows.length, 1)) } as CSSProperties}
    >
      <div className="ai-artifact-table-canvas" data-wide={tableModel.isWide ? "true" : "false"}>
        <div className="ai-artifact-table-scroll" ref={scrollRef}>
          <TransformWrapper
            minScale={0.55}
            maxScale={3}
            initialScale={1}
            centerOnInit
            limitToBounds={false}
            doubleClick={{ disabled: true }}
            wheel={{ step: 0.1 }}
          >
            {({ zoomIn, zoomOut, resetTransform, centerView }) => {
              zoomHandlersRef.current = { zoomIn, zoomOut, resetTransform, centerView };
              return (
                <TransformComponent wrapperClass="ai-artifact-table-pan" contentClass="ai-artifact-table-content">
                  <table className="ai-artifact-table">
                    <thead>
                      {tableInstance.getHeaderGroups().map((headerGroup) => (
                        <tr key={headerGroup.id}>
                          {headerGroup.headers.map((header) => {
                            const columnIndex = columnIndexById.get(header.column.id) || 0;
                            return (
                              <th key={header.id} data-column-index={columnIndex}>
                                <AiStaticMarkdown
                                  text={String(flexRender(header.column.columnDef.header, header.getContext()) || " ")}
                                  className="ai-artifact-cell-markdown"
                                />
                              </th>
                            );
                          })}
                        </tr>
                      ))}
                    </thead>
                    <tbody>
                      {tableInstance.getRowModel().rows.map((row) => (
                        <tr
                          key={row.id}
                          role="button"
                          tabIndex={0}
                          aria-label={`查看${row.original.title}详情`}
                          onClick={() => openRow(row.original)}
                          onKeyDown={(event) => {
                            if (event.key !== "Enter" && event.key !== " ") return;
                            event.preventDefault();
                            openRow(row.original);
                          }}
                        >
                          {row.getVisibleCells().map((cell) => {
                            const columnIndex = columnIndexById.get(cell.column.id) || 0;
                            return (
                              <td key={cell.id} data-column-index={columnIndex}>
                                <div className={columnIndex === 0 ? "ai-artifact-first-cell" : undefined}>
                                  <AiStaticMarkdown text={String(cell.getValue() || " ")} className="ai-artifact-cell-markdown" />
                                  {columnIndex === 0 ? <ChevronRight className="ai-artifact-row-open-icon" size={16} aria-hidden="true" /> : null}
                                </div>
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </TransformComponent>
              );
            }}
          </TransformWrapper>
        </div>
      </div>
    </ArtifactCanvasPage>
  );
}

function MermaidDetailViewer({ artifact }: { artifact: AiRichContentArtifact }) {
  ensureResizeObserverFallback();
  const rawId = useId();
  const zoomHandlersRef = useRef<ArtifactZoomHandlers | null>(null);
  const [svg, setSvg] = useState("");
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const id = `ai-artifact-mermaid-${rawId.replace(/[^a-zA-Z0-9_-]/g, "")}`;
    setSvg("");
    setFailed(false);
    renderStudentMermaid(id, artifact.source)
      .then((result) => {
        if (cancelled) return;
        setSvg(result);
      })
      .catch(() => {
        if (cancelled) return;
        setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [artifact.source, rawId]);

  const mermaidControls = (
    <div className="ai-artifact-zoom-controls">
      <button type="button" onClick={() => zoomHandlersRef.current?.zoomOut(0.22, motionTime())} aria-label="缩小流程图">
        <ZoomOut size={15} />
      </button>
      <button type="button" onClick={() => zoomHandlersRef.current?.zoomIn(0.22, motionTime())} aria-label="放大流程图">
        <ZoomIn size={15} />
      </button>
      <button type="button" onClick={() => zoomHandlersRef.current?.centerView(1, motionTime())} aria-label="适合屏幕">
        <Maximize2 size={15} />
      </button>
      <button type="button" onClick={() => zoomHandlersRef.current?.resetTransform(motionTime())} aria-label="重置流程图视图">
        <RotateCcw size={15} />
      </button>
    </div>
  );

  return (
    <ArtifactCanvasPage kind="mermaid" label="流程图详情" icon={<Workflow size={15} />} controls={mermaidControls} ariaLabel="AI 流程图详情">
      {failed ? (
        <div className="ai-artifact-mermaid-fallback">
          <strong>流程图暂时无法渲染</strong>
          <pre>{artifact.source}</pre>
        </div>
      ) : (
        <TransformWrapper
          minScale={0.4}
          maxScale={4}
          initialScale={1}
          centerOnInit
          limitToBounds={false}
          doubleClick={{ disabled: true }}
          wheel={{ step: 0.12 }}
        >
          {({ zoomIn, zoomOut, resetTransform, centerView }) => {
            zoomHandlersRef.current = { zoomIn, zoomOut, resetTransform, centerView };
            return (
              <TransformComponent wrapperClass="ai-artifact-mermaid-pan" contentClass="ai-artifact-mermaid-content">
                {svg ? (
                  <div className="ai-artifact-mermaid-svg" role="img" aria-label={artifact.title} dangerouslySetInnerHTML={{ __html: svg }} />
                ) : (
                  <div className="ai-artifact-mermaid-loading">正在生成流程图...</div>
                )}
              </TransformComponent>
            );
          }}
        </TransformWrapper>
      )}
    </ArtifactCanvasPage>
  );
}

export function AiArtifactDetailPage() {
  const params = useParams({ strict: false }) as { historyId?: string; messageId?: string; artifactId?: string };
  const search = useSearch({ strict: false }) as StudentRouteSearch;
  const entry = params.historyId ? readStudentAiHistory(params.historyId) : null;
  const message = entry?.messages.find((item) => item.role === "assistant" && item.id === params.messageId);
  const artifact =
    message && params.messageId && params.artifactId
      ? findAiRichContentArtifact(message.content, message.id || params.messageId, params.artifactId)
      : null;
  const title = artifact?.kind === "table" ? "表格详情" : artifact?.kind === "mermaid" ? "流程图详情" : "内容详情";

  return (
    <DetailPageFrame title={title} source={search.from || "ai"} className="ai-artifact-page">
      {artifact?.kind === "table" ? <EnhancedTableDetailViewer artifact={artifact} /> : null}
      {artifact?.kind === "mermaid" ? <MermaidDetailViewer artifact={artifact} /> : null}
      {!artifact ? <ArtifactMissingState /> : null}
    </DetailPageFrame>
  );
}
