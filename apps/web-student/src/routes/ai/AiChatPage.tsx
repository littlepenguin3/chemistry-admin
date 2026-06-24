import { useSearch } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { Atom } from "lucide-react";
import { loadAssistantContext } from "../../app/router/assistantContextStore";
import type { StudentRouteSearch } from "../../app/router/routeTypes";
import { DetailPageFrame } from "../../app/shell/DetailPageFrame";
import { useStudentRuntime } from "../../app/shell/studentAppContext";
import { AtomHistoryPanel } from "../../features/assistant/AtomHistoryPanel";
import { defaultAssistantContext } from "../../features/assistant/assistantContext";
import {
  clearActiveStudentAiHistoryId,
  clearStudentAiHistory,
  deleteStudentAiHistory,
  listStudentAiHistory,
  readActiveStudentAiHistoryId,
  readStudentAiHistory,
  type StudentAiHistoryEntry,
} from "../../features/assistant/assistantHistoryStore";
import { StudentAiChatTab } from "../../features/assistant/StudentAiChatTab";
import { MobileEmptyState } from "../../mobile/primitives";

export function AiChatPage() {
  const search = useSearch({ strict: false }) as StudentRouteSearch;
  const { canUseAssistant } = useStudentRuntime();
  const context = loadAssistantContext(search.contextKey);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyEntries, setHistoryEntries] = useState<StudentAiHistoryEntry[]>([]);
  const [selectedHistory, setSelectedHistory] = useState<StudentAiHistoryEntry | null>(() => {
    const activeHistoryId = readActiveStudentAiHistoryId();
    const activeHistory = activeHistoryId ? readStudentAiHistory(activeHistoryId) : null;
    return activeHistory?.source === "detail" ? activeHistory : null;
  });

  const refreshHistory = useCallback(() => {
    setHistoryEntries(listStudentAiHistory());
  }, []);

  useEffect(() => {
    refreshHistory();
  }, [refreshHistory]);

  const openHistory = () => {
    refreshHistory();
    setHistoryOpen(true);
  };

  const selectHistory = (entry: StudentAiHistoryEntry) => {
    setSelectedHistory(readStudentAiHistory(entry.id) || entry);
    setHistoryOpen(false);
  };

  const deleteHistory = (id: string) => {
    deleteStudentAiHistory(id);
    if (selectedHistory?.id === id) {
      setSelectedHistory(null);
      clearActiveStudentAiHistoryId();
    }
    refreshHistory();
  };

  const clearHistory = () => {
    clearStudentAiHistory();
    setSelectedHistory(null);
    refreshHistory();
  };

  return (
    <DetailPageFrame title="Atom 对话" source={search.from || "ai"} className="ai-chat-detail-frame">
      {canUseAssistant ? (
        <>
          <StudentAiChatTab
            context={context}
            resetContext={context}
            onResetContext={() => {
              setSelectedHistory(null);
              clearActiveStudentAiHistoryId();
            }}
            variant="detail"
            fullControls
            historyEntry={selectedHistory}
            onOpenHistory={openHistory}
            onHistoryChange={refreshHistory}
          />
          <AtomHistoryPanel
            open={historyOpen}
            entries={historyEntries}
            selectedId={selectedHistory?.id}
            onClose={() => setHistoryOpen(false)}
            onSelect={selectHistory}
            onDelete={deleteHistory}
            onClear={clearHistory}
          />
        </>
      ) : (
        <section className="learning-panel">
          <MobileEmptyState className="empty-learning-card" icon={<Atom size={20} />}>
            <span>{defaultAssistantContext().context_title}暂未开放</span>
          </MobileEmptyState>
        </section>
      )}
    </DetailPageFrame>
  );
}
