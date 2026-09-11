import { useQuery } from "@tanstack/react-query";

import { apis } from "@/apis";
import { LIST_FETCH_LIMIT } from "@/lib/constants";

export default function useDvdmsLocation(facilityId: string) {
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
  const store = stores.find((item) => item.is_default) ?? stores[0];

  return {
    institute,
    locationId: store?.store.id,
    isLoading: isInstituteLoading || isStoresLoading,
  };
}
