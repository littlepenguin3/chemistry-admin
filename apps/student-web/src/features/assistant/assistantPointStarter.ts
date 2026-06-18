import type {
  StudentExperimentDetailResponse,
  StudentExperimentGroupResponse,
  StudentExperimentGroupSummary,
  StudentExperimentPointSummary,
  StudentVideoResource,
} from "../../api";
import { compactText } from "../../shared/utils/text";
import type { AssistantContext } from "./assistantContext";
import type { AssistantStarterIntentId } from "./assistantStarter";

export type AssistantStarterMode = "course" | "point";

export type StudentAssistantPointOption = {
  pointKey: string;
  pointTitle: string;
  pointIndex: number;
  mediaId?: string | null;
  hasPublishedVideo: boolean;
};

export type AssistantPointStarterIntent = {
  id: Extract<AssistantStarterIntentId, "observe" | "phenomenon" | "principle" | "design" | "compare" | "mistake" | "custom">;
  label: string;
  description: string;
  buildQuestion?: (context: AssistantPointStarterContext) => string;
};

export type AssistantPointStarterContext = {
  group: StudentExperimentGroupResponse;
  experiment: StudentExperimentPointSummary;
  detail: StudentExperimentDetailResponse;
  point: StudentAssistantPointOption;
};

function cleanText(value?: string | null): string {
  return String(value || "").trim();
}

function compactExperimentTitle(value?: string | null): string {
  return cleanText(value).replace(/^实验\s*\d+(?:[-－]\d+)?\s*/, "").trim() || cleanText(value);
}

function stablePointKey(prefix: string, index: number, value: string): string {
  return `${prefix}:${index + 1}:${value}`;
}

function pointOptionFromVideo(video: StudentVideoResource, index: number): StudentAssistantPointOption | null {
  const pointTitle = cleanText(video.point_title) || cleanText(video.title) || cleanText(video.point_key);
  const pointKey = cleanText(video.point_key) || cleanText(video.point_title) || cleanText(video.media_id);
  if (!pointTitle && !pointKey) return null;
  return {
    pointKey: pointKey || stablePointKey("video", index, pointTitle),
    pointTitle: pointTitle || `视频点位 ${index + 1}`,
    pointIndex: index + 1,
    mediaId: cleanText(video.media_id) || null,
    hasPublishedVideo: Boolean(video.stream_path || video.media_id),
  };
}

export function deriveAssistantPointOptions(detail?: StudentExperimentDetailResponse | null): StudentAssistantPointOption[] {
  if (!detail) return [];
  const seen = new Set<string>();
  const videoOptions: StudentAssistantPointOption[] = [];

  for (const [index, video] of detail.videos.entries()) {
    const option = pointOptionFromVideo(video, index);
    if (!option || seen.has(option.pointKey)) continue;
    seen.add(option.pointKey);
    videoOptions.push({ ...option, pointIndex: videoOptions.length + 1 });
  }

  if (videoOptions.length) return videoOptions;

  return detail.video_candidates.reduce<StudentAssistantPointOption[]>((options, candidate, index) => {
    const pointTitle = cleanText(candidate);
    if (!pointTitle) return options;
    const pointKey = stablePointKey("candidate", index, pointTitle);
    if (seen.has(pointKey)) return options;
    seen.add(pointKey);
    options.push({
      pointKey,
      pointTitle,
      pointIndex: options.length + 1,
      mediaId: null,
      hasPublishedVideo: false,
    });
    return options;
  }, []);
}

export function preferredStudentExperimentGroup(
  groups: StudentExperimentGroupSummary[],
  recommendedParentCode?: string | null,
): StudentExperimentGroupSummary | null {
  return groups.find((group) => group.parent_code === recommendedParentCode)
    || groups.find((group) => group.recommended)
    || groups[0]
    || null;
}

export function buildPointAssistantContext({
  group,
  experiment,
  detail,
  point,
}: AssistantPointStarterContext): AssistantContext {
  const experimentTitle = cleanText(experiment.title) || cleanText(detail.title) || "当前实验";
  return {
    context_type: "learning_point",
    context_title: point.pointTitle || `点位 ${point.pointIndex}`,
    context_summary: compactText([
      `实验组：${group.parent_title}`,
      `所属区域：${group.area_name}`,
      `实验：${experimentTitle}`,
      cleanText(experiment.summary) || cleanText(detail.summary) || null,
      `点位：${point.pointTitle}`,
      point.hasPublishedVideo ? "已有公开视频" : "暂无公开视频或仅有候选点位",
      detail.video_candidates.length ? `观察点：${detail.video_candidates.join("、")}` : null,
    ]),
    chapter_id: experiment.chapter_ids[0] || detail.chapter_ids[0] || null,
    experiment_id: experiment.id || detail.id,
    point_key: point.pointKey,
    prompts: ["这个现象说明什么？", "帮我解释反应原理", "这个点位和前后点有什么区别？"],
  };
}

function pointSubject(context: AssistantPointStarterContext): string {
  const code = cleanText(context.experiment.code);
  const title = compactExperimentTitle(context.experiment.title || context.detail.title);
  return [code, title].filter(Boolean).join(" ") || "这个实验";
}

export const pointStarterIntents: AssistantPointStarterIntent[] = [
  {
    id: "observe",
    label: "观察什么",
    description: "聚焦对象、现象和依据",
    buildQuestion: (context) =>
      `我正在看「${pointSubject(context)}」的点位 ${context.point.pointIndex}「${context.point.pointTitle}」。这个点位主要要观察什么？请指出观察对象、现象和判断依据。`,
  },
  {
    id: "phenomenon",
    label: "现象说明什么",
    description: "把现象和结论连起来",
    buildQuestion: (context) => `请结合「${context.point.pointTitle}」这个视频点位，说明可能观察到的现象分别说明什么。`,
  },
  {
    id: "principle",
    label: "背后原理",
    description: "解释对应化学原理",
    buildQuestion: (context) => `请解释「${context.point.pointTitle}」背后的化学原理，并说明它和本实验结论的关系。`,
  },
  {
    id: "design",
    label: "为什么这样设计",
    description: "理解试剂和步骤安排",
    buildQuestion: (context) => `为什么本实验要设置「${context.point.pointTitle}」这个点位？这种实验设计想证明什么？`,
  },
  {
    id: "compare",
    label: "和其他点位对比",
    description: "放回同一实验里比较",
    buildQuestion: (context) => `请把「${context.point.pointTitle}」放回「${pointSubject(context)}」中，和相邻点位对比说明它的作用。`,
  },
  {
    id: "mistake",
    label: "易错点",
    description: "找常见误解和判断边界",
    buildQuestion: (context) => `学习「${context.point.pointTitle}」时容易误解哪里？请结合本实验证据帮我梳理易错点。`,
  },
  {
    id: "custom",
    label: "我自己问",
    description: "保留点位上下文，手动输入",
  },
];

export function buildPointStarterQuestion(intent: AssistantPointStarterIntent, context: AssistantPointStarterContext | null): string {
  if (!context) return "";
  return intent.buildQuestion?.(context).trim() || "";
}
