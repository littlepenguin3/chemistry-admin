import type { AssistantContext } from "./assistantContext";
import type { StudentAiHistoryEntry } from "./assistantHistoryStore";
import { StudentAiChatPanel, type StudentAiChatPanelVariant } from "./StudentAiChatPanel";

export function StudentAiChatTab({
  context,
  resetContext,
  onResetContext,
  variant = "detail",
  fullControls,
  historyEntry = null,
  onOpenHistory,
  onHistoryChange,
}: {
  context: AssistantContext;
  resetContext?: AssistantContext;
  onResetContext: () => void;
  variant?: StudentAiChatPanelVariant;
  fullControls?: boolean;
  historyEntry?: StudentAiHistoryEntry | null;
  onOpenHistory?: () => void;
  onHistoryChange?: () => void;
}) {
  return (
    <section className={`learning-panel assistant-tab-panel ${variant}`} aria-label="Atom 学习助手">
      <StudentAiChatPanel
        context={context}
        resetContext={resetContext}
        onResetContext={onResetContext}
        variant={variant}
        fullControls={fullControls}
        historyEntry={historyEntry}
        onOpenHistory={onOpenHistory}
        onHistoryChange={onHistoryChange}
      />
    </section>
  );
}
