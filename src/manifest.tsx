import { lazy } from "react";
import { Pill } from "lucide-react";

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
  },
  encounterTabs: {
    // TODO: add encounter tabs if needed
  },
  navItems: [
    {
      name: "DVDMS",
      url: "dvdms",
      icon: <Pill />,
    },
  ],
  adminNavItems: [],
  extends: [],
};

export default manifest;
