// Standalone route map — mirrors manifest.routes.
// Keep in sync with manifest.tsx.

import { lazy } from "react";

const DvdmsConfigurePage = lazy(() => import("./pages/DvdmsConfigurePage"));

const routes = {
  "/facility/:facilityId/settings/general/dvdms": ({
    facilityId,
  }: {
    facilityId: string;
  }) => <DvdmsConfigurePage facilityId={facilityId} />,
};

export default routes;
