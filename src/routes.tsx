// Standalone route map — mirrors manifest.routes.
// Keep in sync with manifest.tsx.
// TODO: update routes to match your plugin's pages.

import NoteCreate from "./pages/NoteCreate";
import NoteList from "./pages/NoteList";

const routes = {
  "/facility/:facilityId/notes": ({
    facilityId,
  }: {
    facilityId: string;
  }) => <NoteList facilityId={facilityId} />,

  "/facility/:facilityId/notes/create": ({
    facilityId,
  }: {
    facilityId: string;
  }) => <NoteCreate facilityId={facilityId} />,
};

export default routes;
