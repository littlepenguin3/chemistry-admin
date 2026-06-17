export type AuthUser = {
  id: string;
  username: string;
  role: "admin" | "teacher" | "student";
  display_name: string;
  status: string;
  must_change_password: boolean;
  password_version: number;
  student_id?: string | null;
  class_id?: string | null;
  class_name?: string | null;
};

export type LoginResponse = {
  access_token: string;
  token_type: "bearer";
  expires_at: string;
  user: AuthUser;
};

export type PretestQuestionOption = {
  label?: string;
  key?: string;
  value?: string;
  text?: string;
  [key: string]: unknown;
};

export type PublicPretestQuestion = {
  id: string;
  question_type: "single_choice" | "true_false" | "fill_blank";
  stem: string;
  options: PretestQuestionOption[];
  area: string;
  related_chapter_ids: string[];
  related_knowledge_point_ids: string[];
};

export type StudentPretestResponse = {
  status: "in_progress" | "completed";
  stage: 1 | 2 | null;
  questions: PublicPretestQuestion[];
};

export type StudentPretestAnswer = {
  question_id: string;
  answer: unknown;
};

export type StudentLearningArea = {
  area_id: string;
  area_name: string;
  enabled: boolean;
  parent_codes: string[];
  experiment_count: number;
  published_video_count: number;
  question_count: number;
};

export type StudentExperimentGroupSummary = {
  parent_code: string;
  parent_title: string;
  area_id: string;
  area_name: string;
  chapter_ids: string[];
  experiment_count: number;
  published_video_count: number;
  question_count: number;
  recommended: boolean;
};

export type StudentLearningHomeResponse = {
  recommended_area_id: string | null;
  recommended_parent_code: string | null;
  areas: StudentLearningArea[];
  groups: StudentExperimentGroupSummary[];
};

export type StudentExperimentPointSummary = {
  id: string;
  code: string;
  title: string;
  summary?: string | null;
  parent_code: string;
  parent_title: string;
  module_title?: string | null;
  chapter_ids: string[];
  video_candidate_count: number;
  published_video_count: number;
  question_count: number;
};

export type StudentExperimentGroupResponse = {
  parent_code: string;
  parent_title: string;
  area_id: string;
  area_name: string;
  experiments: StudentExperimentPointSummary[];
};

export type StudentVideoResource = {
  media_id: string;
  title: string;
  point_key?: string | null;
  point_title?: string | null;
  mime_type?: string | null;
  stream_path?: string | null;
  thumbnail_path?: string | null;
};

export type StudentExperimentDetailResponse = StudentExperimentPointSummary & {
  video_candidates: string[];
  videos: StudentVideoResource[];
};

export const apiBase = (import.meta.env.VITE_API_BASE_URL || "").replace(/\/$/, "");
const tokenKey = "chem_student_token";

let authToken = localStorage.getItem(tokenKey) || "";

export function getAuthToken(): string {
  return authToken;
}

export function setAuthToken(token: string): void {
  authToken = token;
  if (token) {
    localStorage.setItem(tokenKey, token);
  } else {
    localStorage.removeItem(tokenKey);
  }
}

export class ApiError extends Error {
  status: number;
  detail: unknown;

  constructor(status: number, detail: unknown) {
    super(typeof detail === "string" ? detail : `HTTP ${status}`);
    this.status = status;
    this.detail = detail;
  }
}

export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 409) {
      if (typeof error.detail === "string" && error.detail.includes("Pretest question bank")) {
        return "课前摸底题库暂未配置，请联系教师";
      }
      return "账号或题库配置异常，请联系教师";
    }
    if (typeof error.detail === "string") return error.detail;
    return "请求失败，请稍后重试";
  }
  if (error instanceof Error) return error.message;
  return "请求失败，请稍后重试";
}

async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers || {});
  if (!(options.body instanceof FormData) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  if (authToken) {
    headers.set("Authorization", `Bearer ${authToken}`);
  }
  const response = await fetch(`${apiBase}${path}`, { ...options, headers });
  const contentType = response.headers.get("content-type") || "";
  const payload = contentType.includes("application/json") ? await response.json() : await response.text();
  if (response.status === 401) {
    setAuthToken("");
  }
  if (!response.ok) {
    throw new ApiError(response.status, typeof payload === "object" && payload ? payload.detail : payload);
  }
  return payload as T;
}

function postJson<T>(path: string, body: unknown): Promise<T> {
  return api<T>(path, { method: "POST", body: JSON.stringify(body) });
}

export function studentLogin(studentId: string, password: string): Promise<LoginResponse> {
  return postJson<LoginResponse>("/api/auth/student/login", {
    student_id: studentId,
    password,
  });
}

export function changeStudentPassword(currentPassword: string, newPassword: string): Promise<LoginResponse> {
  return postJson<LoginResponse>("/api/auth/student/password", {
    current_password: currentPassword,
    new_password: newPassword,
  });
}

export function loadCurrentUser(): Promise<AuthUser> {
  return api<AuthUser>("/api/auth/me");
}

export function startStudentPretest(): Promise<StudentPretestResponse> {
  return postJson<StudentPretestResponse>("/api/student/pretest/start", {});
}

export function submitStudentPretest(stage: 1 | 2, answers: StudentPretestAnswer[]): Promise<StudentPretestResponse> {
  return postJson<StudentPretestResponse>("/api/student/pretest/submit", {
    stage,
    answers,
  });
}

export function getStudentLearningHome(): Promise<StudentLearningHomeResponse> {
  return api<StudentLearningHomeResponse>("/api/student/learning-home");
}

export function getStudentExperimentGroup(parentCode: string): Promise<StudentExperimentGroupResponse> {
  return api<StudentExperimentGroupResponse>(`/api/student/experiment-groups/${encodeURIComponent(parentCode)}`);
}

export function getStudentExperimentDetail(experimentId: string): Promise<StudentExperimentDetailResponse> {
  return api<StudentExperimentDetailResponse>(`/api/student/experiments/${encodeURIComponent(experimentId)}`);
}

export function studentMediaUrl(path: string): string {
  const separator = path.includes("?") ? "&" : "?";
  return `${apiBase}${path}${separator}access_token=${encodeURIComponent(authToken)}`;
}

export async function logout(): Promise<void> {
  if (!authToken) return;
  try {
    await postJson<{ ok: boolean }>("/api/auth/logout", {});
  } finally {
    setAuthToken("");
  }
}
