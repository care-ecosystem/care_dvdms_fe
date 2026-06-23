import { useNoteList } from "@/hooks/useNotes";
import { formatDate } from "@/lib/utils";

interface Props {
  facilityId: string;
}

// TODO: replace with your domain list page
export default function NoteList({ facilityId }: Props) {
  const { data, isLoading, isError } = useNoteList(facilityId);

  if (isLoading) {
    return <div className="p-4 text-gray-500 text-sm">Loading notes...</div>;
  }

  if (isError) {
    return (
      <div className="p-4 text-red-500 text-sm">Failed to load notes.</div>
    );
  }

  const notes = data?.results ?? [];

  return (
    <div className="p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Notes</h2>
        <a
          href={`/facility/${facilityId}/notes/create`}
          className="bg-blue-600 text-white px-3 py-1.5 rounded text-sm hover:bg-blue-700"
        >
          + New Note
        </a>
      </div>

      {notes.length === 0 && (
        <p className="text-gray-500 text-sm py-6 text-center">No notes found.</p>
      )}

      {notes.map((note) => (
        <div
          key={note.id}
          className="border rounded-lg p-3 bg-white shadow-sm hover:shadow-md transition-shadow"
        >
          <p className="font-medium text-gray-900">{note.title}</p>
          {note.content && (
            <p className="text-sm text-gray-600 mt-1 line-clamp-2">
              {note.content}
            </p>
          )}
          <p className="text-xs text-gray-400 mt-2">
            {formatDate(note.created_date)}
            {note.created_by && (
              <span>
                {" · "}
                {note.created_by.first_name} {note.created_by.last_name}
              </span>
            )}
          </p>
        </div>
      ))}
    </div>
  );
}
