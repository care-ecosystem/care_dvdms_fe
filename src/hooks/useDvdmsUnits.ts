import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";

import { apis } from "@/apis";
import { DVDMS_LOOKUP_STALE_TIME_MS } from "@/lib/constants";
import { DvdmsLookupUnit } from "@/types/dvdms_config";

/**
 * How many base units one of these units holds — the pack size.
 *
 * Defensive on purpose: the value is DVDMS master data that reaches us as
 * whatever JSON carried (`1.0`, `"1.0"`, null, absent), and it is written
 * straight onto stock records. Anything that is not a positive, finite number
 * — including a missing unit — falls back to 1, which is what "no conversion"
 * means.
 */
export const packSizeOf = (unit?: DvdmsLookupUnit) => {
  const packSize = Number(unit?.gnumBaseUnitvalue);
  return Number.isFinite(packSize) && packSize > 0 ? packSize : 1;
};

/**
 * DVDMS inventory units, keyed by the id a mapped drug's `unit_id` carries.
 *
 * Master data: held for a working day so the lookup is fetched once per
 * session rather than on every delivery screen.
 */
export default function useDvdmsUnits(instituteId?: string) {
  const { data: units, isLoading } = useQuery({
    queryKey: ["dvdms_lookup_units", instituteId],
    queryFn: () => apis.institutes.lookupUnits(instituteId!),
    enabled: !!instituteId,
    staleTime: DVDMS_LOOKUP_STALE_TIME_MS,
    gcTime: DVDMS_LOOKUP_STALE_TIME_MS,
  });

  const unitById = useMemo(
    () =>
      new Map<string, DvdmsLookupUnit>(
        (units ?? []).map((unit) => [String(unit.gnumUnitId), unit]),
      ),
    [units],
  );

  return { unitById, isLoading: !!instituteId && isLoading };
}
