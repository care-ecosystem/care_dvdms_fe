import { useQuery } from "@tanstack/react-query";

import { apis } from "@/apis";

const STALE_TIME = 5 * 60 * 1000;

// Slugs registered by care_dvdms' CareDVDMSPermissions.
const CAN_USE = "can_use_dvdms_integration";
const CAN_MANAGE = "can_manage_dvdms_integration";

/**
 * The current user's DVDMS permissions in a facility, matching the backend's
 * facility-organization check (superusers always pass). Both flags stay false
 * until resolved. A false flag is a confirmed denial only when `isError` is
 * also false; `isError` means a lookup failed, so they are unknown.
 *
 * `canManage` is what creating and updating record orders requires; `canUse`
 * is enough to read them.
 */
export default function useDvdmsPermissions(facilityId: string) {
  const user = useQuery({
    queryKey: ["dvdms_current_user"],
    queryFn: () => apis.users.current(),
    staleTime: STALE_TIME,
  });
  const facility = useQuery({
    queryKey: ["dvdms_facility", facilityId],
    queryFn: () => apis.facilities.get(facilityId),
    staleTime: STALE_TIME,
  });

  const has = (permission: string) =>
    !!user.data?.is_superuser ||
    !!facility.data?.permissions?.includes(permission);

  const canUse = has(CAN_USE);
  const canManage = has(CAN_MANAGE);

  // A failed background refetch that kept earlier data is not a failed lookup.
  const isLookupFailed =
    (user.isError && !user.data) || (facility.isError && !facility.data);

  return {
    canUse,
    canManage,
    isLoading: user.isLoading || facility.isLoading,
    isError: !(canUse && canManage) && isLookupFailed,
  };
}
