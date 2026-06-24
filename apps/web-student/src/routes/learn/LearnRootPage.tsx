import { useNavigate } from "@tanstack/react-router";
import { LearningEntryPanel } from "../../features/learning/LearningEntryPanel";
import { navigateToChapter, navigateToSearch } from "../../app/router/navigation";

export function LearnRootPage() {
  const navigate = useNavigate();
  return (
    <LearningEntryPanel
      onOpenSearch={() => navigateToSearch(navigate, { from: "learn" })}
      onSelectProfile={(profile, options) => {
        navigateToChapter(navigate, profile.profile_id, { from: "learn", elementSymbol: options?.elementSymbol });
      }}
    />
  );
}
