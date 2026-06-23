import { lazy, Suspense } from "react";
import { BookOpen } from "lucide-react";

import NoteCreate from "./pages/NoteCreate";
import NoteList from "./pages/NoteList";
import en from "../public/locale/en.json";

// TODO: rename care_myplugin to your plugin name throughout this file.

function PageWrapper({ children }: { children: React.ReactNode }) {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center p-8 text-gray-500 text-sm">
          Loading...
        </div>
      }
    >
      {children}
    </Suspense>
  );
}

const manifest = {
  plugin: "care_myplugin", // TODO: rename

  // i18n translations merged into care_fe's i18n at runtime
  i18n: { en },

  // URL routes handled by this plugin.
  // Key = path pattern (raviger syntax), Value = component factory.
  routes: {
    "/facility/:facilityId/notes": ({
      facilityId,
    }: {
      facilityId: string;
    }) => (
      <PageWrapper>
        <NoteList facilityId={facilityId} />
      </PageWrapper>
    ),

    "/facility/:facilityId/notes/create": ({
      facilityId,
    }: {
      facilityId: string;
    }) => (
      <PageWrapper>
        <NoteCreate facilityId={facilityId} />
      </PageWrapper>
    ),
  },

  // Components care_fe can inject into its own UI.
  // care_fe accesses these via careApp.components?.ComponentName
  components: {
    // TODO: add or remove pluggable components
    NoteActionButton: lazy(
      () => import("./components/pluggables/NoteActionButton"),
    ),
  },

  // Encounter detail page tabs — add keys here to inject tabs.
  // Each value is a lazy-loaded component factory.
  encounterTabs: {
    // TODO: add encounter tabs if needed
    // "my_tab": lazy(() => import("./pages/MyEncounterTab")),
  },

  // Links shown in the main sidebar (all authenticated users)
  navItems: [],

  // Links shown in the admin sidebar
  adminNavItems: [
    {
      url: "/admin/myplugin/notes", // TODO: update url
      name: "Notes",                // TODO: update name
      icon: <BookOpen className="size-4" />,
    },
  ],

  extends: [],
};

export default manifest;
