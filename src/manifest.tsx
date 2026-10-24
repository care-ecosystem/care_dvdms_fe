import { lazy } from "react";
import { Pill } from "lucide-react";

import en from "../public/locale/en.json";
import routes from "./routes";
import RequestOrderShowDvdmsFooter from "./components/pluggables/RequestOrderShowDvdmsFooter";

const manifest = {
  plugin: "care_dvdms",
  i18n: { en },
  routes,
  components: {
    FacilityHomeActions: lazy(
      () => import("./components/pluggables/FacilityHomeActions"),
    ),
  },
  overrides: [
    {
      component: "RequestOrderShow",
      replacement: RequestOrderShowDvdmsFooter,
      // Query params are not part of the override context (raviger's usePath
      // drops them), so match the route here and gate on ?flow=dvdms inside
      // the component, where it stays reactive.
      condition: {
        custom: (ctx: { route?: string }) =>
          /\/inventory\/external\/orders\/[^/]+\/[^/]+$/.test(ctx.route ?? ""),
      },
      priority: 10,
    },
  ],
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
