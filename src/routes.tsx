// Standalone route map — mirrors manifest.routes.
// Keep in sync with manifest.tsx.

import { lazy } from "react";

const DvdmsConfigurePage = lazy(() => import("./pages/DvdmsConfigurePage"));
const ExternalSupplyPage = lazy(() => import("./pages/ExternalSupplyPage"));
const LinkOrderFormPage = lazy(() => import("./pages/LinkOrderFormPage"));
const RequestOrderShowPage = lazy(() => import("./pages/RequestOrderShowPage"));

const routes = {
  "/facility/:facilityId/settings/general/dvdms": ({
    facilityId,
  }: {
    facilityId: string;
  }) => <DvdmsConfigurePage facilityId={facilityId} />,
  "/facility/:facilityId/locations/:locationId/inventory/external/dvdms": ({
    facilityId,
    locationId,
  }: {
    facilityId: string;
    locationId: string;
  }) => <ExternalSupplyPage facilityId={facilityId} locationId={locationId} />,
  "/facility/:facilityId/locations/:locationId/inventory/external/dvdms/new": ({
    facilityId,
    locationId,
  }: {
    facilityId: string;
    locationId: string;
  }) => <LinkOrderFormPage facilityId={facilityId} locationId={locationId} />,
  "/facility/:facilityId/locations/:locationId/inventory/external/dvdms/:requestOrderId":
    ({
      facilityId,
      locationId,
      requestOrderId,
    }: {
      facilityId: string;
      locationId: string;
      requestOrderId: string;
    }) => (
      <RequestOrderShowPage
        facilityId={facilityId}
        locationId={locationId}
        requestOrderId={requestOrderId}
      />
    ),
};

export default routes;
