import { lazy } from "react";

import en from "../public/locale/en.json";

const manifest = {
  plugin: "care_dvdms",
  i18n: { en },
  routes: {},
  components: {
    FacilityHomeActions: lazy(
      () => import("./components/pluggables/FacilityHomeActions"),
    ),
  },
  encounterTabs: {
    // TODO: add encounter tabs if needed
  },
  navItems: [],
  adminNavItems: [],
  extends: [],
};

export default manifest;
