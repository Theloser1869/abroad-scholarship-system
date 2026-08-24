"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "../api/query-keys";
import * as studentsApi from "./api";
import type { CreateStudentContactInput, CreateStudentInput, StudentListParams, UpdateStudentInput } from "./types";

export function useStudents(params: StudentListParams) {
  return useQuery({
    queryKey: queryKeys.students.list(params),
    queryFn: () => studentsApi.listStudents(params),
  });
}

export function useStudent(id: string | undefined) {
  return useQuery({
    queryKey: queryKeys.students.detail(id ?? ""),
    queryFn: () => studentsApi.getStudent(id as string),
    enabled: !!id,
  });
}

export function useStudentTimeline(id: string | undefined) {
  return useQuery({
    queryKey: queryKeys.students.timeline(id ?? ""),
    queryFn: () => studentsApi.getStudentTimeline(id as string),
    enabled: !!id,
  });
}

export function useStudentContacts(id: string | undefined) {
  return useQuery({
    queryKey: queryKeys.students.contacts(id ?? ""),
    queryFn: () => studentsApi.listStudentContacts(id as string),
    enabled: !!id,
  });
}

/// Reuses `GET /cases?studentId=` — keyed under the `cases` list key (not a separate
/// `students` key) since it IS the cases list, just scoped, so a Case mutation's
/// `queryKeys.cases.lists()` invalidation also covers this view.
export function useCasesForStudent(studentId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.cases.list({ studentId: studentId ?? "" }),
    queryFn: () => studentsApi.listCasesForStudent(studentId as string),
    enabled: !!studentId,
  });
}

export function useCreateStudent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateStudentInput) => studentsApi.createStudent(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.students.lists() });
    },
  });
}

export function useUpdateStudent(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateStudentInput) => studentsApi.updateStudent(id, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.students.detail(id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.students.lists() });
    },
  });
}

export function useArchiveStudent(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => studentsApi.archiveStudent(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.students.detail(id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.students.lists() });
    },
  });
}

export function useAddStudentNote(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ body, visibility }: { body: string; visibility?: "internal" | "shared" }) =>
      studentsApi.addStudentNote(id, body, visibility),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.students.timeline(id) });
    },
  });
}

export function useCreateCaseForStudent(studentId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { ownerId?: string; stage?: string; department?: string }) =>
      studentsApi.createCaseForStudent(studentId, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.cases.lists() });
      queryClient.invalidateQueries({ queryKey: queryKeys.students.detail(studentId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.students.timeline(studentId) });
    },
  });
}

export function useCreateStudentContact(studentId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateStudentContactInput) => studentsApi.createStudentContact(studentId, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.students.contacts(studentId) });
    },
  });
}

export function useInviteParent(studentId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (contactId: string) => studentsApi.inviteParent(studentId, contactId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.students.contacts(studentId) }),
  });
}

export function useRevokeParentAccess(studentId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (contactId: string) => studentsApi.revokeParentAccess(studentId, contactId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.students.contacts(studentId) }),
  });
}
