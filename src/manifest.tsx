import { lazy } from "react";
import { Truck } from "lucide-react";

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
      // Matches the route only; the component decides whether the order is a
      // DVDMS one.
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
      icon: <Truck />,
    },
  ],
  adminNavItems: [],
  extends: [],
};

export default manifest;
