import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { ChevronRight, FolderOpen, LoaderCircle, PlayCircle, Search, Trash2 } from "lucide-react";

import {
  errorMessage,
  getStudentCatalogNode,
  getStudentChapterCatalog,
  getStudentLearningPage,
  type StudentCatalogBreadcrumb,
  type StudentCatalogChapterResponse,
  type StudentCatalogNodeCard,
  type StudentLearningPageResponse,
} from "../../api";
import { navigateToCatalogNode, navigateToPoint, navigateToSearch } from "../../app/router/navigation";
import type { StudentRouteSearch } from "../../app/router/routeTypes";
import { useDetailBack } from "../../app/shell/useDetailBack";
import { MobileEmptyState } from "../../mobile/primitives";
import { BackArrowIcon } from "../../shared/mobile/BackArrowIcon";
import { LearningState } from "../../shared/mobile/LearningState";
import { catalogPathLabel } from "../../features/catalog/CatalogNodeCards";
import { formatChapterEntryTitle } from "../../features/learning/learningFormat";

const CATALOG_SEARCH_HISTORY_KEY = "student.catalogSearch.history.v1";

type CatalogSearchRecord = {
  node: StudentCatalogNodeCard;
  breadcrumbs: StudentCatalogBreadcrumb[];
};

function compactText(value: string | null | undefined): string {
  return String(value || "").trim();
}

function readSearchHistory(): string[] {
  try {
    const payload = window.localStorage.getItem(CATALOG_SEARCH_HISTORY_KEY);
    const parsed = payload ? JSON.parse(payload) : [];
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string" && Boolean(item.trim())).slice(0, 8) : [];
  } catch {
    return [];
  }
}

function writeSearchHistory(items: string[]) {
  window.localStorage.setItem(CATALOG_SEARCH_HISTORY_KEY, JSON.stringify(items.slice(0, 8)));
}

function rememberSearchQuery(query: string): string[] {
  const text = compactText(query);
  if (!text) return readSearchHistory();
  const next = [text, ...readSearchHistory().filter((item) => item !== text)].slice(0, 8);
  writeSearchHistory(next);
  return next;
}

function nodeMeta(node: StudentCatalogNodeCard): string {
  if (node.node_kind === "point") return (node.published_media_count || node.media_count) > 0 ? "有视频" : "实验点";
  return node.has_children ? "目录" : "目录";
}

function breadcrumbForNode(node: StudentCatalogNodeCard): StudentCatalogBreadcrumb {
  return {
    node_id: node.node_id,
    title: node.title,
    node_kind: node.node_kind,
    chapter_id: node.chapter_id,
  };
}

function recordPath(record: CatalogSearchRecord): string {
  return catalogPathLabel([...record.breadcrumbs, breadcrumbForNode(record.node)]);
}

function recordParentLabel(record: CatalogSearchRecord, rootLabel: string): string {
  return record.breadcrumbs[record.breadcrumbs.length - 1]?.title || rootLabel;
}

function recordAncestorHint(record: CatalogSearchRecord, rootLabel: string): string {
  if (!record.breadcrumbs.length) return "";
  const ancestors = [rootLabel, ...record.breadcrumbs.slice(0, -1).map((item) => item.title)].filter(Boolean);
  if (!ancestors.length) return "";
  if (ancestors.length <= 2) return ancestors.join(" / ");
  return `… / ${ancestors.slice(-2).join(" / ")}`;
}

function recordMatches(record: CatalogSearchRecord, query: string): boolean {
  const path = recordPath(record);
  return [record.node.title, record.node.summary, nodeMeta(record.node), path].filter(Boolean).join(" ").toLowerCase().includes(query);
}

async function buildCatalogSearchIndex(chapterId: string): Promise<{
  chapter: StudentCatalogChapterResponse;
  records: CatalogSearchRecord[];
}> {
  const chapter = await getStudentChapterCatalog(chapterId);
  const records: CatalogSearchRecord[] = chapter.nodes.map((node) => ({ node, breadcrumbs: [] }));
  const visited = new Set<string>();

  async function visit(nodes: StudentCatalogNodeCard[]) {
    for (const node of nodes) {
      if (node.node_kind !== "directory" || visited.has(node.node_id)) continue;
      visited.add(node.node_id);
      const detail = await getStudentCatalogNode(node.node_id);
      const childRecords = detail.children.map((child) => ({ node: child, breadcrumbs: detail.breadcrumbs }));
      records.push(...childRecords);
      await visit(detail.children);
    }
  }

  await visit(chapter.nodes);
  return { chapter, records };
}

export function UnifiedSearchPage() {
  const navigate = useNavigate();
  const search = useSearch({ strict: false }) as StudentRouteSearch;
  const goBack = useDetailBack(search.from || "chapter");
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [draft, setDraft] = useState(search.q || "");
  const [history, setHistory] = useState<string[]>(() => readSearchHistory());
  const [profilePage, setProfilePage] = useState<StudentLearningPageResponse | null>(null);
  const [records, setRecords] = useState<CatalogSearchRecord[]>([]);
  const [chapterTitle, setChapterTitle] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const chapterId = search.chapterId || profilePage?.active_profile?.chapter_id || "";
  const query = compactText(search.q).toLowerCase();

  useEffect(() => {
    setDraft(search.q || "");
  }, [search.q]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!search.profileId) return;
    let cancelled = false;
    getStudentLearningPage(search.profileId)
      .then((payload) => {
        if (!cancelled) setProfilePage(payload);
      })
      .catch(() => {
        if (!cancelled) setProfilePage(null);
      });
    return () => {
      cancelled = true;
    };
  }, [search.profileId]);

  useEffect(() => {
    if (!chapterId) {
      setRecords([]);
      setChapterTitle("");
      setError("");
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError("");
    buildCatalogSearchIndex(chapterId)
      .then(({ chapter, records: nextRecords }) => {
        if (cancelled) return;
        setChapterTitle(chapter.chapter_title);
        setRecords(nextRecords);
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
  }, [chapterId]);

  const suggestions = useMemo(() => {
    const titles = records.map((record) => record.node.title).filter(Boolean);
    const elementHint = search.elementSymbol ? [`${search.elementSymbol} 实验`, `${search.elementSymbol} 性质`] : [];
    return [...elementHint, ...titles].filter((item, index, source) => source.indexOf(item) === index).slice(0, 6);
  }, [records, search.elementSymbol]);

  const results = useMemo(() => {
    if (!query) return [];
    return records.filter((record) => recordMatches(record, query)).slice(0, 24);
  }, [query, records]);

  const rootParentLabel = profilePage?.active_profile ? formatChapterEntryTitle(profilePage.active_profile) : chapterTitle || "章节目录";
  const scopePath = search.catalogPath && search.catalogPath !== rootParentLabel ? search.catalogPath : "";

  const submitSearch = (event?: FormEvent) => {
    event?.preventDefault();
    const nextQuery = compactText(draft);
    setHistory(rememberSearchQuery(nextQuery));
    navigateToSearch(navigate, { ...search, from: search.from || "chapter", q: nextQuery, replace: true });
  };

  const useQuery = (nextQuery: string) => {
    setDraft(nextQuery);
    setHistory(rememberSearchQuery(nextQuery));
    navigateToSearch(navigate, { ...search, from: search.from || "chapter", q: nextQuery, replace: true });
  };

  const clearHistory = () => {
    writeSearchHistory([]);
    setHistory([]);
  };

  const openRecord = (record: CatalogSearchRecord) => {
    const path = recordPath(record);
    const parentNodeId = record.breadcrumbs[record.breadcrumbs.length - 1]?.node_id || search.sourceNodeId || "";
    if (record.node.node_kind === "point") {
      navigateToPoint(navigate, record.node.node_id, {
        from: "search",
        profileId: search.profileId,
        chapterId: record.node.chapter_id || chapterId,
        sourceNodeId: parentNodeId,
        catalogPath: path,
        elementSymbol: search.elementSymbol,
        pointTitle: record.node.title,
      });
      return;
    }
    navigateToCatalogNode(navigate, record.node.node_id, {
      from: "search",
      profileId: search.profileId,
      chapterId: record.node.chapter_id || chapterId,
      catalogPath: path,
      elementSymbol: search.elementSymbol,
    });
  };

  return (
    <section className="unified-search-page" aria-label="搜索">
      <form className="unified-search-bar" role="search" onSubmit={submitSearch}>
        <button className="unified-search-back" type="button" aria-label="返回" onClick={goBack}>
          <BackArrowIcon />
        </button>
        <label className="unified-search-input">
          <Search size={17} />
          <input
            ref={inputRef}
            type="search"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="搜索本章目录内容"
            aria-label="搜索内容"
          />
        </label>
        <button className="unified-search-submit" type="submit">
          搜索
        </button>
      </form>

      <div className="unified-search-scope">
        <span>{rootParentLabel}</span>
        {scopePath ? <small>{scopePath}</small> : null}
      </div>

      {loading ? <LearningState icon={<LoaderCircle className="spin" size={23} />} text="正在准备搜索" /> : null}
      {error ? <LearningState icon={<FolderOpen size={23} />} text={error} /> : null}

      {!loading && !error && !query ? (
        <div className="unified-search-idle">
          {history.length ? (
            <section className="unified-search-section" aria-label="搜索历史">
              <div className="unified-search-section-head">
                <h2>历史记录</h2>
                <button type="button" onClick={clearHistory} aria-label="清空搜索历史">
                  <Trash2 size={18} />
                </button>
              </div>
              <div className="unified-search-chip-grid">
                {history.map((item) => (
                  <button type="button" key={item} onClick={() => useQuery(item)}>
                    {item}
                  </button>
                ))}
              </div>
            </section>
          ) : null}
          <section className="unified-search-section" aria-label="猜你想搜">
            <div className="unified-search-section-head">
              <h2>猜你想搜</h2>
            </div>
            {suggestions.length ? (
              <div className="unified-search-suggestion-grid">
                {suggestions.map((item) => (
                  <button type="button" key={item} onClick={() => useQuery(item)}>
                    {item}
                  </button>
                ))}
              </div>
            ) : (
              <MobileEmptyState className="empty-learning-card" icon={<Search size={20} />}>
                <span>输入关键词搜索本章目录</span>
              </MobileEmptyState>
            )}
          </section>
        </div>
      ) : null}

      {!loading && !error && query ? (
        <section className="unified-search-results" aria-label="搜索结果">
          <div className="unified-search-results-head">
            <h2>搜索结果</h2>
            <span>{results.length} 个匹配</span>
          </div>
          {results.length ? (
            <div className="unified-search-result-list">
              {results.map((record) => {
                const ancestorHint = recordAncestorHint(record, rootParentLabel);
                return (
                  <button type="button" key={record.node.node_id} className="unified-search-result" onClick={() => openRecord(record)}>
                    <span className="unified-search-result-icon">{record.node.node_kind === "point" ? <PlayCircle size={19} /> : <FolderOpen size={19} />}</span>
                    <span className="unified-search-result-copy">
                      <strong>{record.node.title}</strong>
                      <small className="unified-search-result-parent">父目录：{recordParentLabel(record, rootParentLabel)}</small>
                      {record.node.summary ? <small>{record.node.summary}</small> : null}
                      {ancestorHint ? <em>{ancestorHint}</em> : null}
                    </span>
                    <ChevronRight size={18} />
                  </button>
                );
              })}
            </div>
          ) : (
            <MobileEmptyState className="empty-learning-card" icon={<Search size={20} />}>
              <span>没有找到相关目录内容</span>
            </MobileEmptyState>
          )}
        </section>
      ) : null}
    </section>
  );
}
