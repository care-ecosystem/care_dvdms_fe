import { lazy } from "react";

import en from "../public/locale/en.json";
import routes from "./routes";

const manifest = {
  plugin: "care_dvdms",
  i18n: { en },
  routes,
  components: {
    FacilityHomeActions: lazy(
      () => import("./components/pluggables/FacilityHomeActions"),
    ),
    ExternalSupplyNavItems: lazy(
      () => import("./components/pluggables/ExternalSupplyNavItems"),
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
