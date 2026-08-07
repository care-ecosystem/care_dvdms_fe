import { Suspense } from "react";

import en from "../public/locale/en.json";

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
  plugin: "care_dvdms",
  i18n: { en },
  routes: {},
  components: {
    // TODO: add or remove pluggable components
  },
  encounterTabs: {
    // TODO: add encounter tabs if needed
  },
  navItems: [],
  adminNavItems: [],
  extends: [],
};

export default manifest;
