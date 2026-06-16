import { useQuery } from "@tanstack/react-query";

import { api } from "../../api";
import type { ApiList, Chapter, Experiment } from "../../api";

export function useChapters() {
  return useQuery({ queryKey: ["chapters"], queryFn: () => api<Chapter[]>("/api/chapters") });
}

export function useExperiments(params = "") {
  return useQuery({
    queryKey: ["admin-experiments", params],
    queryFn: () => api<ApiList<Experiment>>(`/api/admin/experiments${params}`),
  });
}
