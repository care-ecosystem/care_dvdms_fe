/**
 * Base path for every DVDMS page.
 */
export const dvdmsBasePath = (facilityId: string, locationId: string) =>
  `/facility/${facilityId}/dvdms/locations/${locationId}`;

/**
 * CARE's external outgoing orders, which live under the order's destination
 * location — always the DVDMS store location on these pages.
 */
const careExternalOrdersPath = (facilityId: string, locationId: string) =>
  `/facility/${facilityId}/locations/${locationId}/inventory/external/orders/outgoing`;

export const careExternalOrderCreatePath = (
  facilityId: string,
  locationId: string,
) => `${careExternalOrdersPath(facilityId, locationId)}/new`;

export const careExternalOrderPath = (
  facilityId: string,
  locationId: string,
  requestOrderId: string,
) => `${careExternalOrdersPath(facilityId, locationId)}/${requestOrderId}`;

export const dvdmsRecordPath = (
  facilityId: string,
  locationId: string,
  requestOrderId: string,
  recordOrderId: string,
) =>
  `${dvdmsBasePath(facilityId, locationId)}/orders/${requestOrderId}/records/${recordOrderId}`;
