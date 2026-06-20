import { ClipboardList } from "lucide-react";
import { MobileEmptyState } from "../../mobile/primitives";

export function AssessmentHomePanel() {
  return (
    <section className="learning-panel assessment-home-panel" aria-label="测评">
      <MobileEmptyState className="empty-learning-card assessment-empty-state" icon={<ClipboardList size={20} />}>
        <div>
          <strong>完成章节学习后进入后测</strong>
          <small>完成后这里会显示报告和错题讲解。</small>
        </div>
      </MobileEmptyState>
    </section>
  );
}
