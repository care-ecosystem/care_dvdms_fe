/**
 * Base path for every DVDMS page.
 */
export const dvdmsBasePath = (facilityId: string, locationId: string) =>
  `/facility/${facilityId}/dvdms/locations/${locationId}`;

/**
 * A CARE external outgoing order, which lives under the order's destination
 * location — always the DVDMS store location on these pages.
 */
export const careExternalOrderPath = (
  facilityId: string,
  locationId: string,
  requestOrderId: string,
) =>
  `/facility/${facilityId}/locations/${locationId}/inventory/external/orders/outgoing/${requestOrderId}`;

export const dvdmsRecordPath = (
  facilityId: string,
  locationId: string,
  requestOrderId: string,
  recordOrderId: string,
) =>
  `${dvdmsBasePath(facilityId, locationId)}/orders/${requestOrderId}/records/${recordOrderId}`;

/**
 * The DVDMS "link order" form, with a CARE request order preselected — where
 * an order is actually sent across to DVDMS.
 */
export const dvdmsLinkOrderPath = (
  facilityId: string,
  locationId: string,
  requestOrderId: string,
) =>
  `${dvdmsBasePath(facilityId, locationId)}/new?order=${requestOrderId}`;
