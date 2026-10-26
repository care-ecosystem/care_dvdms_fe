import { useQuery } from "@tanstack/react-query";

import { apis } from "@/apis";
import { LIST_FETCH_LIMIT } from "@/lib/constants";

/**
 * Resolves the DVDMS store mapping a facility works through.
 *
 * Pass `locationId` — the location in the URL — to resolve that store instead
 * of the default one, so pages titled by location stay in step with the page
 * they are on.
 */
export default function useDvdmsLocation(
  facilityId: string,
  locationId?: string,
) {
  const { data: institute, isLoading: isInstituteLoading } = useQuery({
    queryKey: ["dvdms_institute", facilityId],
    queryFn: () => apis.institutes.get(facilityId),
  });

  const { data: storesResponse, isLoading: isStoresLoading } = useQuery({
    queryKey: ["dvdms_institute_stores", facilityId, institute?.id],
    queryFn: () =>
      apis.dvdmsInstituteStores.list(facilityId, institute!.id, {
        limit: LIST_FETCH_LIMIT,
      }),
    enabled: !!institute?.id,
  });

  const stores = storesResponse?.results ?? [];
  /** Defensive: a second mapping should not change which location is used. */
  const store =
    (locationId && stores.find((item) => item.store.id === locationId)) ||
    stores.find((item) => item.is_default) ||
    stores[0];

  return {
    institute,
    store,
    locationId: store?.store.id,
    isLoading: isInstituteLoading || isStoresLoading,
  };
}
