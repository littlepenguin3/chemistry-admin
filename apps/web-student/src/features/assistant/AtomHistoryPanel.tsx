import { Atom, Clock3, Trash2 } from "lucide-react";
import type { StudentAiHistoryEntry } from "./assistantHistoryStore";

function formatHistoryTime(value: string): string {
  const time = new Date(value);
  if (Number.isNaN(time.getTime())) return "";
  return time.toLocaleString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function AtomHistoryPanel({
  open,
  entries,
  selectedId,
  onClose,
  onSelect,
  onDelete,
  onClear,
}: {
  open: boolean;
  entries: StudentAiHistoryEntry[];
  selectedId?: string | null;
  onClose: () => void;
  onSelect: (entry: StudentAiHistoryEntry) => void;
  onDelete: (id: string) => void;
  onClear: () => void;
}) {
  if (!open) return null;
  return (
    <div className="ai-history-layer" role="dialog" aria-modal="true" aria-label="Atom 历史记录">
      <button type="button" className="ai-history-backdrop" onClick={onClose} aria-label="关闭 Atom 历史记录背景" />
      <section className="ai-history-sheet">
        <header className="ai-history-head">
          <div>
            <p>近期对话</p>
            <h2>Atom 历史记录</h2>
          </div>
          <div className="ai-history-actions">
            <button type="button" className="ai-history-clear-all" onClick={onClear} aria-label="清除全部 Atom 历史记录">
              <span>清除全部</span>
              <Trash2 size={17} />
            </button>
          </div>
        </header>

        {entries.length ? (
          <div className="ai-history-list">
            {entries.map((entry) => (
              <article className={entry.id === selectedId ? "ai-history-item selected" : "ai-history-item"} key={entry.id}>
                <button type="button" className="ai-history-main" onClick={() => onSelect(entry)}>
                  <strong>{entry.title}</strong>
                  <span>{entry.contextTitle}</span>
                  <small>
                    <Clock3 size={12} />
                    {formatHistoryTime(entry.updatedAt)}
                  </small>
                </button>
                <button type="button" className="ai-history-delete" onClick={() => onDelete(entry.id)} aria-label="删除这条 Atom 历史记录">
                  <Trash2 size={15} />
                </button>
              </article>
            ))}
          </div>
        ) : (
          <div className="ai-history-empty">
            <Atom size={18} />
            <strong>还没有历史记录</strong>
            <span>从 Atom 页面或学习内容中提问后，会保存最近对话。</span>
          </div>
        )}
      </section>
    </div>
  );
}
