// TypeScript types matching the backend NoteReadSpec / NoteCreateSpec / NoteUpdateSpec.
// TODO: replace with your domain model types.

export interface AuditUser {
  id: string;
  username: string;
  first_name: string;
  last_name: string;
}

export interface Note {
  id: string;
  facility_id: string;
  title: string;
  content: string;
  created_by: AuditUser | null;
  updated_by: AuditUser | null;
  created_date: string | null;
  modified_date: string | null;
}

export interface NoteCreate {
  facility_id: string;
  title: string;
  content?: string;
}

export interface NoteUpdate {
  title?: string;
  content?: string;
}
