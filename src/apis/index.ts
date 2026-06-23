// TODO: add your API endpoint functions here.
// The base path matches your Django plugin name: /api/care_myplugin/
// Update BASE when you rename your plugin.

import { HttpMethod, PaginatedResponse } from "@/apis/types";
import { request } from "@/apis/query";
import { Note, NoteCreate, NoteUpdate } from "@/types/note";

const BASE = "/api/care_myplugin"; // TODO: rename to /api/care_yourplugin

export const apis = {
  notes: {
    list: (facilityId: string) =>
      request<PaginatedResponse<Note>>(`${BASE}/notes/`, HttpMethod.GET, {
        facility_id: facilityId,
      }),

    retrieve: (id: string) =>
      request<Note>(`${BASE}/notes/${id}/`, HttpMethod.GET),

    create: (data: NoteCreate) =>
      request<Note>(
        `${BASE}/notes/`,
        HttpMethod.POST,
        data as unknown as Record<string, unknown>,
      ),

    update: (id: string, data: NoteUpdate) =>
      request<Note>(
        `${BASE}/notes/${id}/`,
        HttpMethod.PATCH,
        data as unknown as Record<string, unknown>,
      ),
  },
};
