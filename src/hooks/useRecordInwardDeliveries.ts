import { useQueries, useQuery } from "@tanstack/react-query";

import { apis } from "@/apis";
import { LIST_FETCH_LIMIT } from "@/lib/constants";
import { RecordDelivery, RecordInward } from "@/types/recordOrder";

/** DVDMS raises issues against an indent only once it reaches this status. */
const DVDMS_ISSUE_IN_PROCESS_STATUS = "Issue in Process";
const DVDMS_ISSUE_POLL_INTERVAL_MS = 30_000;

type UseRecordInwardDeliveriesOptions = {
  indentStatus?: string | null;
  
  inwardRecordId?: string;
};

export default function useRecordInwardDeliveries(
  instituteId: string | undefined,
  outwardId: string | undefined,
  { indentStatus, inwardRecordId }: UseRecordInwardDeliveriesOptions = {},
) {
  const { data: inwardRecordsData, isLoading: isInwardLoading } = useQuery({
    queryKey: ["dvdms_record_inwards", instituteId],
    queryFn: () =>
      apis.recordInwards.list(instituteId!, { limit: LIST_FETCH_LIMIT }),
    enabled: !!instituteId && !!outwardId,
    refetchInterval:
      indentStatus === DVDMS_ISSUE_IN_PROCESS_STATUS
        ? DVDMS_ISSUE_POLL_INTERVAL_MS
        : false,
  });

  const inwardRecords: RecordInward[] = (inwardRecordsData?.results ?? [])
    .filter((item) => item.outward_record === outwardId)
    .sort((a, b) => b.created_at.localeCompare(a.created_at));

  const { deliveriesByInwardId, isDeliveriesLoading } = useQueries({
    queries: inwardRecords.map((record) => ({
      queryKey: ["dvdms_record_deliveries", instituteId, record.id],
      queryFn: () =>
        apis.recordInwards.listDeliveries(instituteId!, record.id, {
          limit: LIST_FETCH_LIMIT,
          ordering: "-created_date",
        }),
      enabled: !!instituteId,
    })),
    combine: (results) => ({
      deliveriesByInwardId: new Map<string, RecordDelivery[]>(
        inwardRecords.map((record, index) => [
          record.id,
          results[index]?.data?.results ?? [],
        ]),
      ),
      isDeliveriesLoading: results.some((result) => result.isLoading),
    }),
  });

  const inwardRecord: RecordInward | undefined =
    inwardRecords.find((record) => record.id === inwardRecordId) ??
    inwardRecords[0];

  return {
    isLoading:
      isInwardLoading || (inwardRecords.length > 0 && isDeliveriesLoading),
    isInwardLoading,
    inwardRecord,
    inwardRecords,
    deliveries: inwardRecord
      ? (deliveriesByInwardId.get(inwardRecord.id) ?? [])
      : [],
    deliveriesByInwardId,
  };
}
