import { useEffect, useState } from "react";
import { ChevronRight, FlaskConical, LoaderCircle, PlayCircle } from "lucide-react";
import { StudentExperimentGroupResponse, errorMessage, getStudentExperimentGroup } from "../../api";
import { FinishLearningAction } from "../../shared/learning/FinishLearningAction";
import { LearningState } from "../../shared/mobile/LearningState";

export function ExperimentGroupPanel({
  parentCode,
  onGroupLoaded,
  onSelectExperiment,
  onFinishLearning,
  finishing,
  finishError,
}: {
  parentCode: string;
  onGroupLoaded?: (group: StudentExperimentGroupResponse) => void;
  onSelectExperiment: (experimentId: string) => void;
  onFinishLearning: () => void;
  finishing: boolean;
  finishError: string;
}) {
  const [group, setGroup] = useState<StudentExperimentGroupResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    getStudentExperimentGroup(parentCode)
      .then((payload) => {
        if (!cancelled) setGroup(payload);
      })
      .catch((requestError) => {
        if (!cancelled) setError(errorMessage(requestError));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [parentCode]);

  useEffect(() => {
    if (group) onGroupLoaded?.(group);
  }, [group, onGroupLoaded]);

  return (
    <section className="learning-panel" aria-label="实验列表">
      {loading ? <LearningState icon={<LoaderCircle className="spin" size={23} />} text="正在加载实验列表" /> : null}
      {error ? <LearningState icon={<FlaskConical size={23} />} text={error} /> : null}
      {group ? (
        <div className="experiment-list">
          {group.experiments.map((experiment) => (
            <button className="experiment-card" key={experiment.id} type="button" onClick={() => onSelectExperiment(experiment.id)}>
              <div className="experiment-thumb">
                <PlayCircle size={32} />
                <strong>{experiment.code}</strong>
              </div>
              <div>
                <p>{experiment.module_title || group.area_name}</p>
                <h3>{experiment.title}</h3>
                <span>
                  视频 {experiment.published_video_count || experiment.video_candidate_count} / 练习 {experiment.question_count}
                </span>
              </div>
              <ChevronRight size={18} />
            </button>
          ))}
        </div>
      ) : null}
      {group ? <FinishLearningAction loading={finishing} error={finishError} onClick={onFinishLearning} /> : null}
    </section>
  );
}
