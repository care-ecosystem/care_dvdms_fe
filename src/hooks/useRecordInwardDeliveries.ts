import { useQuery } from "@tanstack/react-query";

import { apis } from "@/apis";
import { HttpMethod, PaginatedResponse } from "@/apis/types";
import { LIST_FETCH_LIMIT } from "@/lib/constants";
import { RecordDelivery, RecordInward } from "@/types/recordOrder";

/** DVDMS raises issues against an indent only once it reaches this indent status. */
const DVDMS_INDENT_ISSUED_STATUS = "Issued";
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
      indentStatus === DVDMS_INDENT_ISSUED_STATUS
        ? DVDMS_ISSUE_POLL_INTERVAL_MS
        : false,
  });

  const inwardRecords: RecordInward[] = (inwardRecordsData?.results ?? [])
    .filter((item) => item.outward_record === outwardId)
    .sort((a, b) => b.created_at.localeCompare(a.created_at));

  const inwardRecordIds = inwardRecords.map((record) => record.id);

  const { data: deliveryResults, isLoading: isDeliveriesLoading } = useQuery({
    queryKey: ["dvdms_record_deliveries", instituteId, inwardRecordIds],
    queryFn: async () => {
      const response = await apis.batchRequests.createChunked({
        requests: inwardRecords.map((record) => ({
          url: apis.recordInwards.deliveriesPath(instituteId!, record.id),
          method: HttpMethod.GET,
          body: { limit: LIST_FETCH_LIMIT, ordering: "-created_date" },
          reference_id: record.id,
        })),
      });
      return response.results;
    },
    enabled: !!instituteId && inwardRecords.length > 0,
  });

  const deliveriesByInwardId = new Map<string, RecordDelivery[]>(
    deliveryResults?.map((result) => [
      result.reference_id,
      (result.data as PaginatedResponse<RecordDelivery> | undefined)?.results ??
        [],
    ]) ?? [],
  );

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
