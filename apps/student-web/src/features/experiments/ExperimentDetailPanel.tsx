import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { ClipboardList, FlaskConical, LoaderCircle, MessageCircle, ShieldAlert, Video } from "lucide-react";
import { StudentExperimentDetailResponse, errorMessage, getStudentExperimentDetail, studentMediaUrl } from "../../api";
import { MobileButton, MobileEmptyState } from "../../mobile/primitives";
import { FinishLearningAction } from "../../shared/learning/FinishLearningAction";
import { LearningState } from "../../shared/mobile/LearningState";
import { PageBar } from "../../shared/mobile/PageBar";
import { compactText } from "../../shared/utils/text";
import type { ChapterLearningView } from "../../app/router/routeTypes";
import type { AssistantContext } from "../assistant/assistantContext";
import { stripExperimentPrefix } from "./experimentFormat";

export function ExperimentDetailPanel({
  experimentId,
  profileId,
  propertyKey,
  propertyTitle,
  elementSymbol,
  chapterView,
  pointKey,
  pointTitle,
  onBack,
  onFinishLearning,
  finishing,
  finishError,
  assistantEnabled,
  onOpenAssistant,
  onOpenRelatedPoint,
}: {
  experimentId: string;
  profileId?: string | null;
  propertyKey?: string | null;
  propertyTitle?: string | null;
  elementSymbol?: string | null;
  chapterView?: ChapterLearningView | null;
  pointKey?: string | null;
  pointTitle?: string | null;
  onBack: () => void;
  onFinishLearning: () => void;
  finishing: boolean;
  finishError: string;
  assistantEnabled: boolean;
  onOpenAssistant: (context: AssistantContext) => void;
  onOpenRelatedPoint: (target: { experimentId: string; pointKey: string; pointTitle: string }) => void;
}) {
  const [detail, setDetail] = useState<StudentExperimentDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    getStudentExperimentDetail(experimentId, pointKey)
      .then((payload) => {
        if (!cancelled) setDetail(payload);
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
  }, [experimentId, pointKey]);

  const video = detail?.videos[0] || null;
  const effectivePointTitle =
    detail?.selected_point_title || pointTitle || video?.point_title || detail?.video_candidates[0] || detail?.title || "实验点位";
  const published = detail?.point_content_status === "published";
  const principleText =
    detail?.principle_mode === "equation" ? detail.principle_equation : detail?.principle_text;
  const unavailableText =
    detail?.point_content_status === "draft"
      ? "该点位内容仍在编辑中，学生端暂不展示草稿。"
      : detail?.point_content_status === "archived"
        ? "该点位内容已归档，暂不可学习。"
        : "该点位还没有发布学习内容。";
  const detailAssistantContext: AssistantContext | null = detail
    ? {
        context_type: "learning_point",
        context_title: effectivePointTitle,
        context_summary: compactText([
          chapterView ? `当前视图：${chapterView === "experiments" ? "实验视频" : "性质学习"}` : null,
          propertyTitle ? `关联属性：${propertyTitle}` : null,
          elementSymbol ? `当前元素：${elementSymbol}` : null,
          `实验：${detail.title}`,
          detail.summary || null,
          detail.selected_point_key ? `点位：${detail.selected_point_key}` : pointKey ? `点位：${pointKey}` : null,
          published && principleText ? `实验原理：${principleText}` : null,
          published && detail.phenomenon_explanation ? `现象解释：${detail.phenomenon_explanation}` : null,
          published && detail.safety_note ? `安全提示：${detail.safety_note}` : null,
        ]),
        chapter_id: detail.assessment_context.chapter_ids[0] || detail.chapter_ids[0] || null,
        experiment_id: detail.id,
        point_key: detail.selected_point_key || pointKey || null,
        prompts: ["解释这个实验现象", "帮我梳理实验原理", "这个实验有哪些安全注意点"],
      }
    : null;

  return (
    <section className="learning-panel" aria-label="实验点位详情">
      <PageBar title={effectivePointTitle} onBack={onBack} />
      {loading ? <LearningState icon={<LoaderCircle className="spin" size={23} />} text="正在加载实验详情" /> : null}
      {error ? <LearningState icon={<FlaskConical size={23} />} text={error} /> : null}
      {detail ? (
        <>
          <section className="video-stage">
            {video?.stream_path ? (
              <video
                controls
                playsInline
                poster={video.thumbnail_path ? studentMediaUrl(video.thumbnail_path) : undefined}
                src={studentMediaUrl(video.stream_path)}
              />
            ) : (
              <div className="video-placeholder">
                <Video size={34} />
                <strong>暂无可播放视频</strong>
                <span>学习内容仍可阅读，视频发布后会自动出现在这里。</span>
              </div>
            )}
          </section>

          <section className="experiment-detail-card">
            <p>{propertyTitle || detail.module_title || detail.parent_title}</p>
            <h2>{effectivePointTitle}</h2>
            <small>{stripExperimentPrefix(detail.title)}</small>
            {detail.summary ? <span>{detail.summary}</span> : null}
          </section>

          {published ? (
            <>
              <LearningContentSection
                title="实验原理"
                mode={detail.principle_mode}
                body={principleText || ""}
              />
              <LearningContentSection title="现象解释" body={detail.phenomenon_explanation || ""} />
              <LearningContentSection
                title="安全提示"
                body={detail.safety_note || ""}
                icon={<ShieldAlert size={18} />}
              />
            </>
          ) : (
            <MobileEmptyState className="empty-learning-card" icon={<FlaskConical size={20} />}>
              <span>{unavailableText}</span>
            </MobileEmptyState>
          )}

          <section className="detail-section related-point-section">
            <h3>相关实验链接</h3>
            {detail.related_points.length ? (
              <div className="related-point-list">
                {detail.related_points.map((item) => (
                  <button
                    type="button"
                    key={`${item.experiment_id}-${item.point_key}`}
                    onClick={() =>
                      onOpenRelatedPoint({
                        experimentId: item.experiment_id,
                        pointKey: item.point_key,
                        pointTitle: item.point_title,
                      })
                    }
                  >
                    <span>{item.point_title}</span>
                    {item.experiment_title ? <small>{stripExperimentPrefix(item.experiment_title)}</small> : null}
                  </button>
                ))}
              </div>
            ) : (
              <MobileEmptyState className="empty-learning-card">暂无相关实验链接</MobileEmptyState>
            )}
          </section>

          <section className="detail-section practice-strip">
            <div>
              <p>去测试</p>
              <h3>{detail.question_count} 题</h3>
            </div>
            <button type="button" disabled={finishing} onClick={onFinishLearning}>
              <ClipboardList size={17} />
              <span>开始测试</span>
            </button>
          </section>
          {assistantEnabled && detailAssistantContext ? (
            <MobileButton className="secondary-action full context-assistant-action" type="button" variant="secondary" onClick={() => onOpenAssistant(detailAssistantContext)}>
              <MessageCircle size={18} />
              <span>带着这个点位问 AI</span>
            </MobileButton>
          ) : null}
          <FinishLearningAction loading={finishing} error={finishError} onClick={onFinishLearning} />
        </>
      ) : null}
    </section>
  );
}

function LearningContentSection({
  title,
  body,
  mode,
  icon,
}: {
  title: string;
  body: string;
  mode?: string;
  icon?: ReactNode;
}) {
  return (
    <section className={mode === "equation" ? "detail-section principle-section equation-mode" : "detail-section principle-section"}>
      <h3>
        {icon}
        <span>{title}</span>
      </h3>
      {body ? <p>{body}</p> : <MobileEmptyState className="empty-learning-card">暂无内容</MobileEmptyState>}
    </section>
  );
}
