import { useQuery } from "@tanstack/react-query";

import { apis } from "@/apis";
import { RecordInward } from "@/types/recordOrder";

/**
 * An inward_record is created once per outward/issue, but may have multiple
 * record_deliveries linked to it over time (partial imports, supplier
 * splits) — each backed by its own CARE delivery_order.
 */
export default function useRecordInwardDeliveries(
  instituteId: string | undefined,
  outwardId: string | undefined,
) {
  const { data: inwardRecordsData, isLoading: isInwardLoading } = useQuery({
    queryKey: ["dvdms_record_inwards", instituteId],
    queryFn: () => apis.recordInwards.list(instituteId!, { limit: 100 }),
    enabled: !!instituteId && !!outwardId,
  });

  const inwardRecord: RecordInward | undefined =
    inwardRecordsData?.results.find((item) => item.outward_record === outwardId);

  const { data: deliveriesData, isLoading: isDeliveriesLoading } = useQuery({
    queryKey: ["dvdms_record_deliveries", instituteId, inwardRecord?.id],
    queryFn: () =>
      apis.recordInwards.listDeliveries(instituteId!, inwardRecord!.id, {
        limit: 100,
        ordering: "-created_date",
      }),
    enabled: !!instituteId && !!inwardRecord?.id,
  });

  return {
    isLoading: isInwardLoading || (!!inwardRecord?.id && isDeliveriesLoading),
    inwardRecord,
    deliveries: deliveriesData?.results ?? [],
  };
}
