// Standalone route map — mirrors manifest.routes.
// Keep in sync with manifest.tsx.

import { lazy } from "react";

const DvdmsConfigurePage = lazy(() => import("./pages/DvdmsConfigurePage"));
const ExternalSupplyPage = lazy(() => import("./pages/ExternalSupplyPage"));
const LinkOrderFormPage = lazy(() => import("./pages/LinkOrderFormPage"));
const RequestOrderShowPage = lazy(() => import("./pages/RequestOrderShowPage"));
const RequestOrderEditPage = lazy(() => import("./pages/RequestOrderEditPage"));
const PrintRequestOrderPage = lazy(
  () => import("./pages/PrintRequestOrderPage"),
);
const ProductMappings = lazy(() => import("./pages/ProductMappings"));
const CreateDeliveryPage = lazy(() => import("./pages/CreateDeliveryPage"));
const AddDeliveryItemsPage = lazy(
  () => import("./pages/AddDeliveryItemsPage"),
);

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
  "/facility/:facilityId/locations/:locationId/inventory/external/dvdms/:requestOrderId/record/:recordOrderId":
    ({
      facilityId,
      locationId,
      requestOrderId,
      recordOrderId,
    }: {
      facilityId: string;
      locationId: string;
      requestOrderId: string;
      recordOrderId: string;
    }) => (
      <RequestOrderShowPage
        facilityId={facilityId}
        locationId={locationId}
        requestOrderId={requestOrderId}
        recordOrderId={recordOrderId}
      />
    ),
  "/facility/:facilityId/locations/:locationId/inventory/external/dvdms/:requestOrderId/record/:recordOrderId/edit":
    ({
      facilityId,
      locationId,
      requestOrderId,
      recordOrderId,
    }: {
      facilityId: string;
      locationId: string;
      // tab: string;
      requestOrderId: string;
      recordOrderId: string;
    }) => (
      <RequestOrderEditPage
        facilityId={facilityId}
        locationId={locationId}
        requestOrderId={requestOrderId}
        recordOrderId={recordOrderId}
      />
    ),
  "/facility/:facilityId/locations/:locationId/inventory/external/dvdms/:requestOrderId/record/:recordOrderId/print":
    ({
      facilityId,
      locationId,
      requestOrderId,
      recordOrderId,
    }: {
      facilityId: string;
      locationId: string;
      requestOrderId: string;
      recordOrderId: string;
    }) => (
      <PrintRequestOrderPage
        facilityId={facilityId}
        locationId={locationId}
        requestOrderId={requestOrderId}
        recordOrderId={recordOrderId}
      />
    ),

  "/facility/:facilityId/locations/:locationId/inventory/external/dvdms/:requestOrderId/record/:recordOrderId/create-delivery":
    ({
      facilityId,
      locationId,
      requestOrderId,
      recordOrderId,
    }: {
      facilityId: string;
      locationId: string;
      requestOrderId: string;
      recordOrderId: string;
    }) => (
      <CreateDeliveryPage
        facilityId={facilityId}
        locationId={locationId}
        requestOrderId={requestOrderId}
        recordOrderId={recordOrderId}
      />
    ),

  "/facility/:facilityId/locations/:locationId/inventory/external/dvdms/:requestOrderId/record/:recordOrderId/delivery/:deliveryOrderId":
    ({
      facilityId,
      locationId,
      requestOrderId,
      recordOrderId,
      deliveryOrderId,
    }: {
      facilityId: string;
      locationId: string;
      requestOrderId: string;
      recordOrderId: string;
      deliveryOrderId: string;
    }) => (
      <AddDeliveryItemsPage
        facilityId={facilityId}
        locationId={locationId}
        requestOrderId={requestOrderId}
        recordOrderId={recordOrderId}
        deliveryOrderId={deliveryOrderId}
      />
    ),

  "/facility/:facilityId/settings/general/dvdms/product-mappings": ({
    facilityId,
  }: {
    facilityId: string;
  }) => <ProductMappings facilityId={facilityId} />,
};

export default routes;
