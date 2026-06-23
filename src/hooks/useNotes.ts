import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { apis } from "@/apis/index";
import { NoteCreate, NoteUpdate } from "@/types/note";

// Query key factory — keeps cache keys consistent across hooks
export const noteKeys = {
  list: (facilityId: string) => ["myplugin", "notes", facilityId] as const,
  detail: (id: string) => ["myplugin", "notes", id] as const,
};

export function useNoteList(facilityId: string) {
  return useQuery({
    queryKey: noteKeys.list(facilityId),
    queryFn: () => apis.notes.list(facilityId),
    enabled: !!facilityId,
  });
}

export function useNote(id: string) {
  return useQuery({
    queryKey: noteKeys.detail(id),
    queryFn: () => apis.notes.retrieve(id),
    enabled: !!id,
  });
}

export function useCreateNote() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: NoteCreate) => apis.notes.create(data),
    onSuccess: (note) => {
      queryClient.invalidateQueries({
        queryKey: noteKeys.list(note.facility_id),
      });
    },
  });
}

export function useUpdateNote(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: NoteUpdate) => apis.notes.update(id, data),
    onSuccess: (note) => {
      queryClient.invalidateQueries({ queryKey: noteKeys.detail(id) });
      queryClient.invalidateQueries({
        queryKey: noteKeys.list(note.facility_id),
      });
    },
  });
}
