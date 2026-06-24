import { type ReactNode, type RefObject, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Ban, Clock3, Flag, FlaskConical, LoaderCircle, MoreVertical, Share2, Video } from "lucide-react";
import {
  errorMessage,
  getStudentHomeVideoFeed,
  removeStudentVideoSave,
  saveStudentVideo,
  studentMediaUrl,
  type StudentHomeVideoFeedItem,
  type StudentHomeVideoFeedReason,
  type StudentHomeVideoFeedResponse,
  type StudentVideoSaveRequest,
} from "../../api";
import { navigateToPoint } from "../../app/router/navigation";
import { useStudentRuntime } from "../../app/shell/studentAppContext";
import { MobileEmptyState } from "../../mobile/primitives";
import { LearningState } from "../../shared/mobile/LearningState";

const reasonLabels: Record<StudentHomeVideoFeedReason, string> = {
  catalog: "目录实验",
  recommended: "推荐观看",
  recent: "最近更新",
  weakness: "薄弱章节",
};

const genericHomeMetadata = new Set(["experiment video", "video point", "实验视频"]);
const homeMetadataSeparator = " · ";
const HOME_FEED_BATCH_SIZE = 20;

const homeTopicEmptyText: Record<string, string> = {
  discover: "暂时没有可发现的实验视频",
  watch_later: "还没有稍后学习的视频",
  all: "暂无已发布实验视频",
};

type HomeFeedCandidate = {
  id: string;
  ratio: number;
  centerDistance: number;
};

function pushHomeMetadataPart(parts: string[], value: string | null | undefined, title: string, options?: { skipGeneric?: boolean }) {
  const part = value?.trim();
  if (!part) return;
  const normalized = part.toLocaleLowerCase();
  if (part === title.trim()) return;
  if (options?.skipGeneric && genericHomeMetadata.has(normalized)) return;
  const duplicate = parts.some((current) => current.toLocaleLowerCase() === normalized);
  if (!duplicate) parts.push(part);
}

function buildHomeVideoMetadata(item: StudentHomeVideoFeedItem): string {
  const parts: string[] = [];
  item.badges.forEach((badge) => pushHomeMetadataPart(parts, badge, item.title, { skipGeneric: true }));
  pushHomeMetadataPart(parts, item.snippet, item.title);

  const path = item.target.catalog_path?.length ? item.target.catalog_path : item.catalog_path;
  path.forEach((part, index) => {
    if (index === path.length - 1 && part.trim() === item.title.trim()) return;
    pushHomeMetadataPart(parts, part, item.title);
  });

  if (!parts.length) pushHomeMetadataPart(parts, reasonLabels[item.reason], item.title);
  return parts.slice(0, 3).join(homeMetadataSeparator);
}

function homePreviewViewportBounds() {
  const visualTop = window.visualViewport?.offsetTop ?? 0;
  const visualHeight = window.visualViewport?.height || window.innerHeight || document.documentElement.clientHeight || 0;
  let top = visualTop;
  let bottom = visualTop + visualHeight;
  const headerRect = document.querySelector<HTMLElement>(".student-app-shell.root-home .student-app-header")?.getBoundingClientRect();
  const bottomNavRect = document.querySelector<HTMLElement>(".student-bottom-nav")?.getBoundingClientRect();

  if (headerRect && headerRect.bottom > top && headerRect.bottom < bottom) top = headerRect.bottom;
  if (bottomNavRect && bottomNavRect.top > top && bottomNavRect.top < bottom) bottom = bottomNavRect.top;
  if (bottom <= top) {
    top = visualTop;
    bottom = visualTop + visualHeight;
  }
  return { top, bottom, center: (top + bottom) / 2 };
}

function homeFeedCandidateForNode(id: string, node: HTMLElement, viewport: ReturnType<typeof homePreviewViewportBounds>): HomeFeedCandidate | null {
  const rect = node.getBoundingClientRect();
  const height = Math.max(1, rect.height);
  const visibleHeight = Math.max(0, Math.min(rect.bottom, viewport.bottom) - Math.max(rect.top, viewport.top));
  if (!visibleHeight && (rect.bottom <= viewport.top || rect.top >= viewport.bottom)) return null;
  return {
    id,
    ratio: Math.min(1, visibleHeight / height),
    centerDistance: Math.abs((rect.top + rect.bottom) / 2 - viewport.center),
  };
}

function rankHomeFeedCandidates(left: HomeFeedCandidate, right: HomeFeedCandidate) {
  const ratioDelta = right.ratio - left.ratio;
  if (Math.abs(ratioDelta) > 0.08) return ratioDelta;
  return left.centerDistance - right.centerDistance;
}

function clampHomeProgress(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

function homeMediaDuration(video: HTMLVideoElement) {
  const duration = video.duration;
  return Number.isFinite(duration) && duration > 0 ? duration : 0;
}

function homeLoadedRatio(video: HTMLVideoElement, duration: number) {
  if (!duration || !video.buffered?.length) return 0;
  let loadedEnd = 0;
  for (let index = 0; index < video.buffered.length; index += 1) {
    try {
      loadedEnd = Math.max(loadedEnd, video.buffered.end(index));
    } catch {
      return 0;
    }
  }
  return clampHomeProgress(loadedEnd / duration);
}

function readHomeVideoProgress(video: HTMLVideoElement) {
  const duration = homeMediaDuration(video);
  const currentTime = Number.isFinite(video.currentTime) ? video.currentTime : 0;
  return {
    playedPercent: duration ? clampHomeProgress(currentTime / duration) * 100 : 0,
    loadedPercent: homeLoadedRatio(video, duration) * 100,
  };
}

function useHomeVideoProgress(videoRef: RefObject<HTMLVideoElement | null>, enabled: boolean) {
  const [progress, setProgress] = useState({ playedPercent: 0, loadedPercent: 0 });

  useEffect(() => {
    if (!enabled) {
      setProgress({ playedPercent: 0, loadedPercent: 0 });
      return undefined;
    }
    const video = videoRef.current;
    if (!video) return undefined;

    const sync = () => setProgress(readHomeVideoProgress(video));
    sync();

    const events = ["loadedmetadata", "durationchange", "timeupdate", "progress", "seeking", "seeked", "play"] as const;
    events.forEach((eventName) => video.addEventListener(eventName, sync));
    return () => events.forEach((eventName) => video.removeEventListener(eventName, sync));
  }, [enabled, videoRef]);

  return progress;
}

function useActiveFeedItem(items: StudentHomeVideoFeedItem[]) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const activeIdRef = useRef<string | null>(null);
  const itemIdsRef = useRef<string[]>([]);
  const nodesRef = useRef(new Map<string, HTMLElement>());
  const observerRef = useRef<IntersectionObserver | null>(null);
  const frameRef = useRef<number | null>(null);

  const setStableActiveId = useCallback((next: string | null) => {
    activeIdRef.current = next;
    setActiveId((current) => (current === next ? current : next));
  }, []);

  const updateActive = useCallback(() => {
    const itemIds = itemIdsRef.current;
    if (!itemIds.length) {
      setStableActiveId(null);
      return;
    }

    const itemSet = new Set(itemIds);
    const viewport = homePreviewViewportBounds();
    const candidates = Array.from(nodesRef.current.entries())
      .filter(([id]) => itemSet.has(id))
      .map(([id, node]) => homeFeedCandidateForNode(id, node, viewport))
      .filter((candidate): candidate is HomeFeedCandidate => Boolean(candidate));

    if (!candidates.length) {
      const current = activeIdRef.current;
      setStableActiveId(current && itemSet.has(current) ? current : itemIds[0]);
      return;
    }

    candidates.sort(rankHomeFeedCandidates);
    const best = candidates[0];
    const current = activeIdRef.current;
    const currentCandidate = candidates.find((candidate) => candidate.id === current);
    if (
      currentCandidate &&
      currentCandidate.ratio >= 0.24 &&
      best.id !== current &&
      best.ratio < currentCandidate.ratio + 0.18 &&
      best.centerDistance > currentCandidate.centerDistance - 36
    ) {
      return;
    }
    setStableActiveId(best.id);
  }, [setStableActiveId]);

  const scheduleActiveUpdate = useCallback(() => {
    if (frameRef.current !== null) return;
    frameRef.current = window.requestAnimationFrame(() => {
      frameRef.current = null;
      updateActive();
    });
  }, [updateActive]);

  const registerCard = useCallback(
    (id: string, node: HTMLElement | null) => {
      const previous = nodesRef.current.get(id);
      if (previous && observerRef.current) observerRef.current.unobserve(previous);
      if (!node) {
        nodesRef.current.delete(id);
        scheduleActiveUpdate();
        return;
      }
      nodesRef.current.set(id, node);
      if (observerRef.current) observerRef.current.observe(node);
      scheduleActiveUpdate();
    },
    [scheduleActiveUpdate],
  );

  useEffect(() => {
    itemIdsRef.current = items.map((item) => item.instance_id);
    if (!items.length) {
      setStableActiveId(null);
      return;
    }
    const current = activeIdRef.current;
    if (!current || !itemIdsRef.current.includes(current)) setStableActiveId(items[0].instance_id);
    scheduleActiveUpdate();
  }, [items, scheduleActiveUpdate, setStableActiveId]);

  useEffect(() => {
    if (!items.length || !("IntersectionObserver" in window)) return undefined;

    const observer = new IntersectionObserver(
      () => scheduleActiveUpdate(),
      {
        root: null,
        rootMargin: "-10% 0px -18% 0px",
        threshold: [0, 0.12, 0.25, 0.42, 0.6, 0.82, 1],
      },
    );

    observerRef.current = observer;
    nodesRef.current.forEach((node) => observer.observe(node));

    return () => {
      observer.disconnect();
      observerRef.current = null;
    };
  }, [items, scheduleActiveUpdate]);

  useEffect(() => {
    window.addEventListener("scroll", scheduleActiveUpdate, { passive: true });
    window.addEventListener("resize", scheduleActiveUpdate);
    window.addEventListener("orientationchange", scheduleActiveUpdate);
    window.visualViewport?.addEventListener("scroll", scheduleActiveUpdate);
    window.visualViewport?.addEventListener("resize", scheduleActiveUpdate);
    return () => {
      window.removeEventListener("scroll", scheduleActiveUpdate);
      window.removeEventListener("resize", scheduleActiveUpdate);
      window.removeEventListener("orientationchange", scheduleActiveUpdate);
      window.visualViewport?.removeEventListener("scroll", scheduleActiveUpdate);
      window.visualViewport?.removeEventListener("resize", scheduleActiveUpdate);
    };
  }, [scheduleActiveUpdate]);

  useEffect(
    () => () => {
      if (frameRef.current !== null) window.cancelAnimationFrame(frameRef.current);
    },
    [],
  );

  return { activeId, registerCard };
}

type HomeVideoFeedCardProps = {
  item: StudentHomeVideoFeedItem;
  isActive: boolean;
  registerCard: (id: string, node: HTMLElement | null) => void;
  onOpen: (item: StudentHomeVideoFeedItem) => void;
  onOpenMenu: (item: StudentHomeVideoFeedItem) => void;
};

function HomeVideoFeedCard({ item, isActive, registerCard, onOpen, onOpenMenu }: HomeVideoFeedCardProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const mediaUrl = item.video.stream_path ? studentMediaUrl(item.video.stream_path) : "";
  const posterUrl = item.video.thumbnail_path ? studentMediaUrl(item.video.thumbnail_path) : "";
  const metadata = buildHomeVideoMetadata(item);
  const titleId = `home-video-title-${item.instance_id.replace(/[^a-zA-Z0-9_-]/g, "-")}`;
  const progress = useHomeVideoProgress(videoRef, isActive && Boolean(mediaUrl));

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    if (!isActive || !mediaUrl) {
      try {
        video.pause();
      } catch {
        // Some test environments do not implement media controls.
      }
      return;
    }
    video.muted = true;
    video.playsInline = true;
    try {
      const playPromise = video.play();
      if (playPromise) void playPromise.catch(() => undefined);
    } catch {
      // Autoplay can be blocked; the poster and action remain usable.
    }
  }, [isActive, mediaUrl]);

  return (
    <article
      ref={(node) => registerCard(item.instance_id, node)}
      data-feed-id={item.instance_id}
      className={`home-video-card${isActive ? " is-active" : ""}`}
      aria-labelledby={titleId}
    >
      <div className="home-video-media">
        <button type="button" className="home-video-media-button" onClick={() => onOpen(item)} aria-label={`查看实验视频：${item.title}`}>
          {isActive && mediaUrl ? (
            <video ref={videoRef} src={mediaUrl} poster={posterUrl || undefined} muted playsInline loop preload="metadata" />
          ) : posterUrl ? (
            <img src={posterUrl} alt="" loading="lazy" />
          ) : (
            <span className="home-video-poster-fallback">
              <Video size={30} />
              <span>实验视频</span>
            </span>
          )}
        </button>
        <div className="home-video-inactive-progress" aria-hidden="true">
          <span className="home-video-progress-loaded" style={{ width: `${progress.loadedPercent}%` }} />
          <span className="home-video-progress-played" style={{ width: `${progress.playedPercent}%` }} />
        </div>
      </div>

      <div className="home-video-body">
        <button
          type="button"
          className="home-video-text-button"
          onClick={() => onOpen(item)}
          aria-label={`打开实验详情：${item.title}`}
        >
          <h2 id={titleId}>{item.title}</h2>
          {metadata ? <p className="home-video-metadata">{metadata}</p> : null}
        </button>
        <button type="button" className="home-video-overflow-trigger" onClick={() => onOpenMenu(item)} aria-label={`更多视频选项：${item.title}`}>
          <MoreVertical size={21} />
        </button>
      </div>
    </article>
  );
}

type HomeVideoOverflowAction = "watch-later" | "share" | "not-interested" | "feedback";

type HomeVideoOverflowSheetProps = {
  item: StudentHomeVideoFeedItem;
  onAction: (action: HomeVideoOverflowAction, item: StudentHomeVideoFeedItem) => void;
  onClose: () => void;
};

const homeVideoOverflowActions: Array<{
  key: HomeVideoOverflowAction;
  label: string;
  description: string;
  icon: ReactNode;
}> = [
  { key: "watch-later", label: "稍后学习", description: "先把这个实验留到稍后再看", icon: <Clock3 size={22} /> },
  { key: "share", label: "分享", description: "通过系统分享这个实验入口", icon: <Share2 size={22} /> },
  { key: "not-interested", label: "不感兴趣", description: "减少类似推荐的展示", icon: <Ban size={22} /> },
  { key: "feedback", label: "反馈问题", description: "记录这个视频卡片的问题", icon: <Flag size={22} /> },
];

function HomeVideoOverflowSheet({ item, onAction, onClose }: HomeVideoOverflowSheetProps) {
  return (
    <div
      className="home-video-overflow-backdrop"
      role="presentation"
      onPointerDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section className="home-video-overflow-sheet" role="dialog" aria-modal="true" aria-label={`视频选项：${item.title}`}>
        <div className="home-video-overflow-head">
          <p>更多</p>
          <h3>{item.title}</h3>
        </div>
        {homeVideoOverflowActions.map((action) => {
          const isWatchLater = action.key === "watch-later";
          const activeWatchLater = isWatchLater && item.personal_state.watch_later;
          const label = activeWatchLater ? "移出稍后学习" : action.label;
          const description = activeWatchLater ? "不再放在首页稍后学习标签里" : action.description;
          return (
            <button key={action.key} type="button" onClick={() => onAction(action.key, item)}>
              {action.icon}
              <span>
                <b>{label}</b>
                <small>{description}</small>
              </span>
            </button>
          );
        })}
      </section>
    </div>
  );
}

function savePayloadForHomeItem(item: StudentHomeVideoFeedItem, source: string): StudentVideoSaveRequest {
  return {
    placement_node_id: item.placement_node_id || item.target.placement_node_id || item.node_id,
    canonical_point_id: item.canonical_point_id || item.target.canonical_point_id,
    media_id: item.video.media_id,
    source,
  };
}

function sameRenderedVideo(left: StudentHomeVideoFeedItem, right: StudentHomeVideoFeedItem) {
  return (
    left.video.media_id === right.video.media_id &&
    (left.placement_node_id || left.target.placement_node_id || left.node_id) ===
      (right.placement_node_id || right.target.placement_node_id || right.node_id)
  );
}

export function HomeRootPage() {
  const navigate = useNavigate();
  const { homeVideoTopic, lockHomeChromeForOverlay, releaseHomeChromeForOverlay } = useStudentRuntime();
  const [items, setItems] = useState<StudentHomeVideoFeedItem[]>([]);
  const [feedMeta, setFeedMeta] = useState<Pick<StudentHomeVideoFeedResponse, "status" | "message" | "topic" | "repeat_mode" | "pool_size"> | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loadingInitial, setLoadingInitial] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");
  const [overflowItem, setOverflowItem] = useState<StudentHomeVideoFeedItem | null>(null);
  const [overflowMessage, setOverflowMessage] = useState("");
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const topicRef = useRef(homeVideoTopic);
  const requestSeqRef = useRef(0);
  const loadingMoreRef = useRef(false);
  const { activeId, registerCard } = useActiveFeedItem(items);

  useEffect(() => {
    topicRef.current = homeVideoTopic;
  }, [homeVideoTopic]);

  useEffect(() => {
    const requestId = requestSeqRef.current + 1;
    requestSeqRef.current = requestId;
    let cancelled = false;
    loadingMoreRef.current = false;
    setLoadingInitial(true);
    setLoadingMore(false);
    setError("");
    setOverflowMessage("");
    setItems([]);
    setNextCursor(null);
    setHasMore(false);
    setFeedMeta(null);
    getStudentHomeVideoFeed({ limit: HOME_FEED_BATCH_SIZE, topic: homeVideoTopic })
      .then((response) => {
        if (cancelled || requestSeqRef.current !== requestId || topicRef.current !== homeVideoTopic) return;
        setItems(response.items);
        setNextCursor(response.next_cursor || null);
        setHasMore(response.has_more);
        setFeedMeta({
          status: response.status,
          message: response.message,
          topic: response.topic,
          repeat_mode: response.repeat_mode,
          pool_size: response.pool_size,
        });
      })
      .catch((requestError) => {
        if (!cancelled && requestSeqRef.current === requestId) setError(errorMessage(requestError));
      })
      .finally(() => {
        if (!cancelled && requestSeqRef.current === requestId) setLoadingInitial(false);
      });
    return () => {
      cancelled = true;
    };
  }, [homeVideoTopic]);

  const loadMore = useCallback(() => {
    if (loadingMoreRef.current || loadingInitial || !hasMore || !nextCursor) return;
    const requestId = requestSeqRef.current + 1;
    requestSeqRef.current = requestId;
    const topic = homeVideoTopic;
    const cursor = nextCursor;
    loadingMoreRef.current = true;
    setLoadingMore(true);
    setError("");
    getStudentHomeVideoFeed({ limit: HOME_FEED_BATCH_SIZE, topic, cursor })
      .then((response) => {
        if (requestSeqRef.current !== requestId || topicRef.current !== topic) return;
        setItems((current) => [...current, ...response.items]);
        setNextCursor(response.next_cursor || null);
        setHasMore(response.has_more);
        setFeedMeta({
          status: response.status,
          message: response.message,
          topic: response.topic,
          repeat_mode: response.repeat_mode,
          pool_size: response.pool_size,
        });
      })
      .catch((requestError) => {
        if (requestSeqRef.current === requestId && topicRef.current === topic) setError(errorMessage(requestError));
      })
      .finally(() => {
        if (requestSeqRef.current === requestId) {
          loadingMoreRef.current = false;
          setLoadingMore(false);
        }
      });
  }, [hasMore, homeVideoTopic, loadingInitial, nextCursor]);

  useEffect(() => {
    const node = sentinelRef.current;
    if (!node || loadingInitial || !hasMore || !nextCursor) return undefined;
    if (!("IntersectionObserver" in window)) return undefined;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) loadMore();
      },
      { root: null, rootMargin: "640px 0px", threshold: 0.01 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [hasMore, loadMore, loadingInitial, nextCursor]);

  const openItem = useCallback(
    (item: StudentHomeVideoFeedItem) => {
      const target = item.target;
      const nodeId = target.node_id || item.placement_node_id || item.node_id;
      navigateToPoint(navigate, nodeId, {
        from: "home",
        profileId: target.profile_id,
        chapterId: target.chapter_id || item.chapter_id,
        sourceNodeId: target.source_node_id,
        catalogPath: (target.catalog_path || item.catalog_path).join(" / "),
        propertyKey: target.property_key,
        propertyTitle: target.property_title,
        elementSymbol: target.element_symbol,
        pointTitle: target.point_title || item.title,
      });
    },
    [navigate],
  );

  const openOverflowMenu = useCallback(
    (item: StudentHomeVideoFeedItem) => {
      lockHomeChromeForOverlay();
      setOverflowItem(item);
    },
    [lockHomeChromeForOverlay],
  );

  const closeOverflowMenu = useCallback(() => {
    setOverflowItem(null);
  }, []);

  useEffect(() => {
    if (!overflowItem) return undefined;
    return () => releaseHomeChromeForOverlay();
  }, [overflowItem, releaseHomeChromeForOverlay]);

  useEffect(() => {
    if (!overflowItem) return undefined;
    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") closeOverflowMenu();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [closeOverflowMenu, overflowItem]);

  useEffect(() => {
    if (!overflowItem || items.some((item) => item.instance_id === overflowItem.instance_id)) return;
    closeOverflowMenu();
  }, [closeOverflowMenu, items, overflowItem]);

  const updateRenderedSaveState = useCallback((sourceItem: StudentHomeVideoFeedItem, response: Awaited<ReturnType<typeof saveStudentVideo>>) => {
    setItems((current) =>
      current.map((item) =>
        sameRenderedVideo(item, sourceItem)
          ? {
              ...item,
              personal_state: response.personal_state,
            }
          : item,
      ),
    );
    setOverflowItem((current) =>
      current && sameRenderedVideo(current, sourceItem)
        ? {
            ...current,
            personal_state: response.personal_state,
          }
        : current,
    );
  }, []);

  const handleOverflowAction = useCallback((action: HomeVideoOverflowAction, item: StudentHomeVideoFeedItem) => {
    closeOverflowMenu();
    if (action === "share") {
      if (typeof navigator.share === "function") {
        void navigator
          .share({
            title: item.title,
            text: buildHomeVideoMetadata(item) || item.summary || item.title,
            url: window.location.href,
          })
          .then(() => setOverflowMessage(`已打开系统分享：${item.title}`))
          .catch(() => undefined);
      } else {
        setOverflowMessage(`当前环境暂不支持系统分享：${item.title}`);
      }
      return;
    }
    if (action === "watch-later") {
      const active = item.personal_state.watch_later;
      const request = active ? removeStudentVideoSave("watch_later", savePayloadForHomeItem(item, "home_feed")) : saveStudentVideo("watch_later", savePayloadForHomeItem(item, "home_feed"));
      void request
        .then((response) => {
          updateRenderedSaveState(item, response);
          if (active && homeVideoTopic === "watch_later") {
            setItems((current) => current.filter((candidate) => !sameRenderedVideo(candidate, item)));
          }
          setOverflowMessage(`${active ? "已移出稍后学习" : "已记录稍后学习"}：${item.title}`);
        })
        .catch((requestError) => setOverflowMessage(errorMessage(requestError)));
      return;
    }
    const messages: Record<Exclude<HomeVideoOverflowAction, "share">, string> = {
      "watch-later": `已记录稍后学习：${item.title}`,
      "not-interested": `已减少类似推荐：${item.title}`,
      feedback: `已记录反馈入口：${item.title}`,
    };
    setOverflowMessage(messages[action]);
  }, [closeOverflowMenu, homeVideoTopic, updateRenderedSaveState]);

  return (
    <section className="learning-panel home-root-page" aria-label="实验视频首页">
      {loadingInitial ? <LearningState icon={<LoaderCircle className="spin" size={23} />} text="正在加载实验视频" /> : null}
      {error ? <LearningState icon={<FlaskConical size={23} />} text={error} /> : null}
      {!loadingInitial && !error && feedMeta?.message && feedMeta.status !== "ok" ? <div className={`home-feed-banner ${feedMeta.status}`}>{feedMeta.message}</div> : null}
      {!loadingInitial && !error && overflowMessage ? <div className="home-video-overflow-feedback">{overflowMessage}</div> : null}

      {!loadingInitial && !error && items.length ? (
        <div className="home-video-feed" aria-live="polite">
          {items.map((item) => (
            <HomeVideoFeedCard
              key={item.instance_id}
              item={item}
              isActive={activeId === item.instance_id}
              registerCard={registerCard}
              onOpen={openItem}
              onOpenMenu={openOverflowMenu}
            />
          ))}
        </div>
      ) : null}

      {!loadingInitial && !error && items.length ? (
        <div className="home-feed-sentinel" ref={sentinelRef} aria-live="polite">
          {loadingMore ? <span>继续加载实验视频…</span> : null}
          {!loadingMore && hasMore && nextCursor && !("IntersectionObserver" in window) ? (
            <button type="button" onClick={loadMore}>
              继续加载
            </button>
          ) : null}
          {!hasMore ? <span>{homeVideoTopic === "discover" ? "" : "已经到底了"}</span> : null}
        </div>
      ) : null}

      {overflowItem ? <HomeVideoOverflowSheet item={overflowItem} onAction={handleOverflowAction} onClose={closeOverflowMenu} /> : null}

      {!loadingInitial && !error && !items.length ? (
        <MobileEmptyState className="empty-learning-card" icon={<Video size={20} />}>
          <span>{homeTopicEmptyText[homeVideoTopic] || "这个分类暂时没有实验视频"}</span>
        </MobileEmptyState>
      ) : null}
    </section>
  );
}
