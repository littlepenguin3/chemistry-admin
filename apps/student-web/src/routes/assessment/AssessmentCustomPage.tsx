import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { CheckCircle2, ClipboardList, FlaskConical, LoaderCircle, Search } from "lucide-react";
import {
  errorMessage,
  getStudentCustomAssessmentOptions,
  startStudentCustomAssessment,
  type CustomAssessmentExperimentOption,
  type StudentCustomAssessmentOptionsResponse,
} from "../../api";
import { storePosttestSession } from "../../app/router/assessmentSessionStore";
import { navigateToAssessmentSession } from "../../app/router/navigation";
import type { StudentRouteSearch } from "../../app/router/routeTypes";
import { DetailPageFrame } from "../../app/shell/DetailPageFrame";
import { stripExperimentPrefix } from "../../features/experiments/experimentFormat";
import { MobileButton, MobileEmptyState, MobileField } from "../../mobile/primitives";

function optionMatches(option: CustomAssessmentExperimentOption, query: string) {
  const text = [option.code, option.title, option.parent_code, option.parent_title].filter(Boolean).join(" ").toLowerCase();
  return text.includes(query.toLowerCase());
}

export function AssessmentCustomPage() {
  const navigate = useNavigate();
  const search = useSearch({ strict: false }) as StudentRouteSearch;
  const [options, setOptions] = useState<StudentCustomAssessmentOptionsResponse | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [questionCount, setQuestionCount] = useState<number | null>(null);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState("");
  const [startError, setStartError] = useState("");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    getStudentCustomAssessmentOptions()
      .then((response) => {
        if (cancelled) return;
        setOptions(response);
        const counts = response.settings.question_count_options;
        const preferred = counts.includes(response.settings.default_question_count)
          ? response.settings.default_question_count
          : counts[0] || null;
        setQuestionCount(preferred);
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
  }, []);

  const visibleExperiments = useMemo(() => {
    const experiments = options?.experiments || [];
    const normalized = query.trim();
    if (!normalized) return experiments;
    return experiments.filter((option) => optionMatches(option, normalized));
  }, [options?.experiments, query]);

  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);

  const toggleExperiment = (experimentId: string) => {
    setSelectedIds((current) => {
      if (current.includes(experimentId)) return current.filter((id) => id !== experimentId);
      return [...current, experimentId];
    });
  };

  const start = async () => {
    if (!questionCount || !selectedIds.length) return;
    setStarting(true);
    setStartError("");
    try {
      const response = await startStudentCustomAssessment(selectedIds, questionCount);
      storePosttestSession(response);
      navigateToAssessmentSession(navigate, response.session_id, "assessment-custom");
    } catch (requestError) {
      setStartError(errorMessage(requestError));
    } finally {
      setStarting(false);
    }
  };

  const disabled = !options?.settings.enabled;
  const empty = !loading && !error && options?.settings.enabled && !options.experiments.length;

  return (
    <DetailPageFrame title="自主测评" source={search.from || "assessment"}>
      <section className="learning-panel custom-assessment-page" aria-label="自主测评">
        {loading ? (
          <MobileEmptyState className="empty-learning-card" icon={<LoaderCircle className="spin" size={20} />}>
            <span>正在读取可测实验</span>
          </MobileEmptyState>
        ) : null}

        {error ? (
          <MobileEmptyState className="empty-learning-card" icon={<ClipboardList size={20} />}>
            <span>{error}</span>
          </MobileEmptyState>
        ) : null}

        {!loading && !error && disabled ? (
          <MobileEmptyState className="empty-learning-card" icon={<ClipboardList size={20} />}>
            <span>老师暂未开放自主测评</span>
          </MobileEmptyState>
        ) : null}

        {empty ? (
          <MobileEmptyState className="empty-learning-card" icon={<FlaskConical size={20} />}>
            <span>当前还没有可测实验</span>
          </MobileEmptyState>
        ) : null}

        {!loading && !error && options?.settings.enabled && options.experiments.length ? (
          <>
            <section className="custom-assessment-toolbar" aria-label="自主测评设置">
              <label className="custom-search-field">
                <Search size={16} />
                <MobileField
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="搜索实验名称或编号"
                  aria-label="搜索实验"
                />
              </label>
              <div className="custom-count-row" aria-label="题量">
                {options.settings.question_count_options.map((count) => (
                  <button
                    key={count}
                    type="button"
                    className={count === questionCount ? "selected" : ""}
                    onClick={() => setQuestionCount(count)}
                  >
                    {count}
                  </button>
                ))}
              </div>
            </section>

            <section className="custom-selection-summary" aria-label="已选实验">
              <span>{selectedIds.length} 个实验</span>
              <span>{questionCount || 0} 题</span>
              <span>每实验最多 {options.settings.max_questions_per_experiment} 题</span>
            </section>

            <section className="custom-experiment-list" aria-label="实验列表">
              {visibleExperiments.map((experiment) => {
                const selected = selectedSet.has(experiment.id);
                return (
                  <button
                    key={experiment.id}
                    type="button"
                    className={selected ? "custom-experiment-option selected" : "custom-experiment-option"}
                    onClick={() => toggleExperiment(experiment.id)}
                    aria-pressed={selected}
                  >
                    <span className="custom-experiment-check">{selected ? <CheckCircle2 size={17} /> : null}</span>
                    <span className="custom-experiment-copy">
                      <b>{stripExperimentPrefix(experiment.title)}</b>
                      <small>{experiment.parent_title || experiment.code}</small>
                    </span>
                    <em>{experiment.question_count} 题</em>
                  </button>
                );
              })}
            </section>

            {!visibleExperiments.length ? (
              <MobileEmptyState className="empty-learning-card" icon={<Search size={20} />}>
                <span>没有匹配的实验</span>
              </MobileEmptyState>
            ) : null}

            {startError ? <div className="form-error">{startError}</div> : null}
            <MobileButton
              className="primary-action full custom-start-action"
              type="button"
              loading={starting}
              disabled={!selectedIds.length || !questionCount}
              onClick={start}
            >
              {starting ? <LoaderCircle className="spin" size={18} /> : <ClipboardList size={18} />}
              <span>{starting ? "正在组卷" : "开始自主测评"}</span>
            </MobileButton>
          </>
        ) : null}
      </section>
    </DetailPageFrame>
  );
}
