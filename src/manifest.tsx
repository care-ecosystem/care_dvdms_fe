import { lazy } from "react";
import { PillIcon } from "lucide-react";

import en from "../public/locale/en.json";
import routes from "./routes";

const getFacilityBaseUrl = () => {
  const match = window.location.href.match(/^(.*\/facility\/[0-9a-fA-F-]{36})/);
  return match ? match[1] : window.location.href;
};

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
      icon: <PillIcon className="care-svg-icon__baseline" />,
      children: [
        {
          name: "Product Mappings",
          get url() {
            const baseUrl = getFacilityBaseUrl();
            return `${baseUrl}/settings/dvdms/product-mappings`;
          },
        },
      ],
    },
  ],
  adminNavItems: [],
  extends: [],
};

export default manifest;
