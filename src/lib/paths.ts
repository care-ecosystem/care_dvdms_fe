/**
 * Base path for every DVDMS page.
 */
export const dvdmsBasePath = (facilityId: string, locationId: string) =>
  `/facility/${facilityId}/dvdms/locations/${locationId}`;

export const dvdmsRecordPath = (
  facilityId: string,
  locationId: string,
  requestOrderId: string,
  recordOrderId: string,
) =>
  `${dvdmsBasePath(facilityId, locationId)}/orders/${requestOrderId}/records/${recordOrderId}`;
