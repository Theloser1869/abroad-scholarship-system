"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { queryKeys } from "../api/query-keys";
import * as reportsApi from "./api";

export function useExecutiveDashboard(enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.reports.executive(),
    queryFn: reportsApi.getExecutiveDashboard,
    enabled,
  });
}

export function useManagerDashboard(enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.reports.manager(),
    queryFn: reportsApi.getManagerDashboard,
    enabled,
  });
}

export function useMyDashboard(enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.reports.me(),
    queryFn: reportsApi.getMyDashboard,
    enabled,
  });
}

export function useExportCases() {
  return useMutation({
    mutationFn: (reason: string) => reportsApi.exportCases(reason),
  });
}
