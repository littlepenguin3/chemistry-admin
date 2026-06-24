import { useCallback, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { Atom, Bookmark, ClipboardList, Clock3, Eye, Flag, FlaskConical, LoaderCircle, MoreHorizontal, PlayCircle, Share2, ShieldAlert, ThumbsUp } from "lucide-react";

import { buildReactionEquationRows } from "../../../../shared/reactionEquations";
import type { StudentPointDetailResponse, StudentPointVideo, StudentVideoSaveRequest, StudentVideoSaveResponse } from "../../api";
import { errorMessage, getStudentCatalogPointDetail, removeStudentVideoSave, saveStudentVideo, studentMediaUrl } from "../../api";
import type { StudentRouteSearch } from "../../app/router/routeTypes";
import { ChemEquation } from "../../components/ChemEquation";
import { MobileEmptyState } from "../../mobile/primitives";
import { LearningState } from "../../shared/mobile/LearningState";
import { compactText } from "../../shared/utils/text";
import type { AssistantContext } from "../assistant/assistantContext";
import { catalogPathLabel } from "./CatalogNodeCards";
import { PointVideoPlayer } from "./PointVideoPlayer";

export function CatalogPointDetailPanel({
  nodeId,
  search,
  onBack,
  onFinishLearning,
  finishing,
  finishError,
  assistantEnabled,
  onOpenAssistant,
  onOpenRelatedPoint,
  onOpenFeedback,
  previewMode = false,
  loadPointDetail = getStudentCatalogPointDetail,
  resolveMediaUrl = studentMediaUrl,
}: {
  nodeId: string;
  search: StudentRouteSearch;
  onBack: () => void;
  onFinishLearning: (detail: StudentPointDetailResponse | null) => void;
  finishing: boolean;
  finishError: string;
  assistantEnabled: boolean;
  onOpenAssistant: (context: AssistantContext) => void;
  onOpenRelatedPoint: (nodeId: string, pointTitle: string) => void;
  onOpenFeedback?: (detail: StudentPointDetailResponse) => void;
  previewMode?: boolean;
  loadPointDetail?: (nodeId: string) => Promise<StudentPointDetailResponse>;
  resolveMediaUrl?: (path: string) => string;
}) {
  const [detail, setDetail] = useState<StudentPointDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [liked, setLiked] = useState(false);
  const [saved, setSaved] = useState(false);
  const [watchLater, setWatchLater] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [actionStatus, setActionStatus] = useState("");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    setLiked(false);
    setSaved(false);
    setWatchLater(false);
    setMoreOpen(false);
    setActionStatus("");
    loadPointDetail(nodeId)
      .then((payload) => {
        if (!cancelled) {
          setDetail(payload);
          setSaved(Boolean(payload.personal_state.favorite));
          setWatchLater(Boolean(payload.personal_state.watch_later));
        }
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
  }, [loadPointDetail, nodeId]);

  const video = detail?.videos[0] || null;
  const principleText =
    detail?.principle_mode === "equation"
      ? buildReactionEquationRows({
          equations: detail.reaction_equations,
          legacyText: detail.principle_equation,
          presentation: "studentMobile",
          filterInvalid: true,
        })
          .map((row) => [row.fallback, row.annotation ? `补充说明：${row.annotation}` : ""].filter(Boolean).join("\n"))
          .filter(Boolean)
          .join("\n")
      : detail?.principle_text;
  const pathText = detail ? catalogPathLabel(detail.breadcrumbs) : search.catalogPath || "";
  const assistantContext = useMemo<AssistantContext | null>(() => {
    if (!detail) return null;
    const path = detail.assessment_context.catalog_path.map((item) => item.title).filter(Boolean);
    return {
      context_type: "learning_point",
      context_title: detail.title,
      context_summary: compactText([
        path.length ? `目录路径：${path.join(" / ")}` : null,
        principleText ? `实验原理：${principleText}` : null,
        detail.phenomenon_explanation ? `现象解释：${detail.phenomenon_explanation}` : null,
        detail.safety_note ? `安全提示：${detail.safety_note}` : null,
      ]),
      chapter_id: detail.chapter_id,
      point_node_id: detail.assessment_context.point_node_id,
      source_node_id: detail.assessment_context.source_node_id || detail.source_node_id || null,
      catalog_path: path,
      prompts: ["这个点位主要观察什么？", "解释这个现象背后的化学原理", "学习这个点位要注意哪些安全事项？"],
    };
  }, [detail, principleText]);

  const sharePoint = useCallback(() => {
    if (!detail) return;
    const shareText = compactText([pathText, principleText || detail.phenomenon_explanation || detail.summary]);
    if (typeof navigator.share === "function") {
      void navigator
        .share({
          title: detail.title,
          text: shareText || detail.title,
          url: window.location.href,
        })
        .then(() => setActionStatus("已打开系统分享"))
        .catch(() => undefined);
      return;
    }
    setActionStatus("当前环境暂不支持系统分享");
  }, [detail, pathText, principleText]);

  const applySaveResponse = useCallback((response: StudentVideoSaveResponse) => {
    setSaved(response.personal_state.favorite);
    setWatchLater(response.personal_state.watch_later);
    setDetail((current) =>
      current
        ? {
            ...current,
            personal_state: response.personal_state,
          }
        : current,
    );
  }, []);

  useEffect(() => {
    if (!moreOpen) return undefined;
    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") setMoreOpen(false);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [moreOpen]);

  const buildSavePayload = useCallback((targetDetail: StudentPointDetailResponse, targetVideo: StudentPointVideo, source: string): StudentVideoSaveRequest => {
    return {
      placement_node_id: targetDetail.placement_node_id || targetDetail.node_id,
      canonical_point_id: targetDetail.canonical_point_id,
      media_id: targetVideo.media_id,
      source,
    };
  }, []);

  const toggleFavorite = useCallback(() => {
    if (!detail || !video) {
      setActionStatus("当前实验还没有可收藏的视频");
      return;
    }
    const active = saved;
    const request = active
      ? removeStudentVideoSave("favorite", buildSavePayload(detail, video, "point_detail"))
      : saveStudentVideo("favorite", buildSavePayload(detail, video, "point_detail"));
    void request
      .then((response) => {
        applySaveResponse(response);
        setActionStatus(active ? `已取消收藏：${detail.title}` : `已收藏：${detail.title}`);
      })
      .catch((requestError) => setActionStatus(errorMessage(requestError)));
  }, [applySaveResponse, buildSavePayload, detail, saved, video]);

  const markWatchLater = useCallback(() => {
    if (!detail || !video) {
      setMoreOpen(false);
      setActionStatus("当前实验还没有可稍后学习的视频");
      return;
    }
    setMoreOpen(false);
    const active = watchLater;
    const request = active
      ? removeStudentVideoSave("watch_later", buildSavePayload(detail, video, "point_detail"))
      : saveStudentVideo("watch_later", buildSavePayload(detail, video, "point_detail"));
    void request
      .then((response) => {
        applySaveResponse(response);
        setActionStatus(active ? `已移出稍后学习：${detail.title}` : `已记录稍后学习：${detail.title}`);
      })
      .catch((requestError) => setActionStatus(errorMessage(requestError)));
  }, [applySaveResponse, buildSavePayload, detail, video, watchLater]);

  const openFeedback = useCallback(() => {
    if (!detail) return;
    setMoreOpen(false);
    onOpenFeedback?.(detail);
  }, [detail, onOpenFeedback]);

  return (
    <section className="learning-panel catalog-point-detail" aria-label="点位视频详情">
      {loading ? <LearningState icon={<LoaderCircle className="spin" size={23} />} text="正在加载点位详情" /> : null}
      {error ? <LearningState icon={<FlaskConical size={23} />} text={error} /> : null}
      {detail ? (
        <>
          <PointVideoPlayer
            src={video?.stream_path ? resolveMediaUrl(video.stream_path) : null}
            poster={video?.thumbnail_path ? resolveMediaUrl(video.thumbnail_path) : null}
            emptyReason={detail.no_video_reason}
            onBack={onBack}
          />

          <section className="catalog-point-summary">
            <p>{pathText}</p>
            <h2>{detail.title}</h2>
          </section>

          <LearningContentSection title="现象解释" body={detail.phenomenon_explanation || ""} icon={<Eye size={18} />} className="phenomenon-section" />
          <PrincipleContentSection detail={detail} body={principleText || ""} />
          <LearningContentSection title="安全提示" body={detail.safety_note || ""} icon={<ShieldAlert size={18} />} className="safety-section" />

          {!previewMode ? (
            <section className="point-learning-actions" aria-label="学习操作">
              <div className="point-learning-main-row">
                <button
                  type="button"
                  className="point-learning-main-action primary"
                  disabled={finishing}
                  onClick={() => onFinishLearning(detail)}
                >
                  <ClipboardList size={20} />
                  <span>{finishing ? "生成中" : "学完测一测"}</span>
                </button>
                <button
                  type="button"
                  className="point-learning-main-action"
                  disabled={!assistantEnabled || !assistantContext}
                  onClick={() => assistantContext && onOpenAssistant(assistantContext)}
                >
                  <Atom size={20} />
                  <span>问问Atom</span>
                </button>
              </div>
              <div className="point-learning-utility-row" aria-label="次要操作">
                <button
                  type="button"
                  className={liked ? "point-learning-utility-action active" : "point-learning-utility-action"}
                  aria-label={liked ? "取消点赞" : "点赞"}
                  aria-pressed={liked}
                  onClick={() => setLiked((value) => !value)}
                >
                  <ThumbsUp size={18} />
                  <span>{liked ? "已赞" : "点赞"}</span>
                </button>
                <button
                  type="button"
                  className={saved ? "point-learning-utility-action active" : "point-learning-utility-action"}
                  aria-label={saved ? "取消收藏" : "收藏"}
                  aria-pressed={saved}
                  onClick={toggleFavorite}
                >
                  <Bookmark size={18} />
                  <span>{saved ? "已收藏" : "收藏"}</span>
                </button>
                <button type="button" className="point-learning-utility-action" aria-label="分享" onClick={sharePoint}>
                  <Share2 size={18} />
                  <span>分享</span>
                </button>
                <button
                  type="button"
                  className={moreOpen ? "point-learning-utility-action active" : "point-learning-utility-action"}
                  aria-haspopup="dialog"
                  aria-expanded={moreOpen}
                  onClick={() => setMoreOpen((value) => !value)}
                >
                  <MoreHorizontal size={19} />
                  <span>更多</span>
                </button>
              </div>
              {finishError ? <div className="form-error">{finishError}</div> : null}
              {actionStatus ? <div className="point-learning-action-hint">{actionStatus}</div> : null}
              {moreOpen ? (
                <PointLearningMoreSheet title={detail.title} watchLater={watchLater} onClose={() => setMoreOpen(false)} onWatchLater={markWatchLater} onFeedback={openFeedback} />
              ) : null}
            </section>
          ) : null}

          <section className="detail-section related-point-section">
            <h3>相关实验链接</h3>
            {detail.related_points.length ? (
              <div className="related-point-list">
                {detail.related_points.map((item) => (
                  <button type="button" key={item.node_id} disabled={previewMode} onClick={() => onOpenRelatedPoint(item.node_id, item.title)}>
                    <span className="related-point-thumb" aria-hidden="true">
                      <PlayCircle size={22} />
                    </span>
                    <span className="related-point-copy">
                      <span>{item.title}</span>
                      <small>{relatedPointRelationLabel(item.relation_type)}</small>
                    </span>
                  </button>
                ))}
              </div>
            ) : (
              <MobileEmptyState className="empty-learning-card">暂无相关实验链接</MobileEmptyState>
            )}
          </section>

        </>
      ) : null}
    </section>
  );
}

function relatedPointRelationLabel(relationType?: string | null) {
  switch (relationType) {
    case "default":
    case "default_override":
    case "generated_default":
      return "推荐实验";
    case "manual":
    default:
      return "相关实验";
  }
}

function PointLearningMoreSheet({
  title,
  watchLater,
  onClose,
  onWatchLater,
  onFeedback,
}: {
  title: string;
  watchLater: boolean;
  onClose: () => void;
  onWatchLater: () => void;
  onFeedback: () => void;
}) {
  return (
    <div
      className="point-learning-more-backdrop"
      role="presentation"
      onPointerDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section className="point-learning-more-sheet" role="dialog" aria-modal="true" aria-label={`更多学习操作：${title}`}>
        <div className="point-learning-more-head">
          <p>更多</p>
          <h3>{title}</h3>
        </div>
        <button type="button" onClick={onWatchLater}>
          <Clock3 size={22} />
          <span>
            <b>{watchLater ? "移出稍后学习" : "稍后学习"}</b>
            <small>{watchLater ? "不再放在首页稍后学习标签里" : "先把这个实验留到稍后再看"}</small>
          </span>
        </button>
        <button type="button" onClick={onFeedback}>
          <Flag size={22} />
          <span>
            <b>反馈问题</b>
            <small>记录这个视频卡片的问题</small>
          </span>
        </button>
      </section>
    </div>
  );
}

function LearningContentSection({
  title,
  body,
  mode,
  icon,
  className = "",
}: {
  title: string;
  body: string;
  mode?: string;
  icon?: ReactNode;
  className?: string;
}) {
  const sectionClassName = [
    "detail-section",
    "point-learning-section",
    className,
    mode === "equation" ? "equation-mode" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <section className={sectionClassName}>
      <h3>
        {icon}
        <span>{title}</span>
      </h3>
      {body ? <p>{body}</p> : <MobileEmptyState className="empty-learning-card">暂无内容</MobileEmptyState>}
    </section>
  );
}

function PrincipleContentSection({ detail, body }: { detail: StudentPointDetailResponse; body: string }) {
  if (detail.principle_mode !== "equation") {
    return <LearningContentSection title="实验原理" mode={detail.principle_mode} body={body} icon={<FlaskConical size={18} />} className="principle-section" />;
  }

  const rows = buildReactionEquationRows({
    equations: detail.reaction_equations,
    legacyText: detail.principle_equation,
    presentation: "studentMobile",
    filterInvalid: true,
  });

  return (
    <section className="detail-section point-learning-section principle-section equation-mode">
      <h3>
        <FlaskConical size={18} />
        <span>实验原理</span>
      </h3>
      {rows.length ? (
        <div className="point-equation-list">
          {rows.map((row, index) => (
              <div className="point-equation-row" key={row.key}>
                <span className="point-equation-index" aria-hidden="true">{index + 1}</span>
                <ChemEquation latex={row.latex} fallback={row.fallback} className="point-chem-equation" />
                {row.annotation ? (
                  <p className="point-equation-note">
                    {row.annotation}
                  </p>
                ) : null}
              </div>
          ))}
        </div>
      ) : (
        <MobileEmptyState className="empty-learning-card">暂无内容</MobileEmptyState>
      )}
    </section>
  );
}
