/**
 * Pluggable component — care_fe injects this into its own UI via manifest.components.
 *
 * Example usage in care_fe:
 *   const NoteActionButton = careApp.components?.NoteActionButton;
 *   if (NoteActionButton) return <NoteActionButton facilityId={facilityId} />;
 *
 * TODO: rename and add props that care_fe will pass to your component.
 */

interface Props {
  facilityId: string;
}

export default function NoteActionButton({ facilityId }: Props) {
  return (
    <button
      className="border border-gray-300 rounded px-3 py-1 text-sm hover:bg-gray-50"
      onClick={() => {
        window.location.href = `/facility/${facilityId}/notes/create`;
      }}
    >
      Add Note
    </button>
  );
}
