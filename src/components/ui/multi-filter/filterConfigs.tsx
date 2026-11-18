import { CalendarFold, CircleDashed } from "lucide-react";

import { getDateOperations, SelectedDateBadge } from "./dateFilter";
import { SelectedFacilityUserBadge } from "./facilityUserFilter";
import { GenericSelectedBadge } from "./genericFilter";
import {
  createFilterConfig,
  DateRangeOption,
  FilterDateRange,
  FilterUser,
  FilterValues,
  getVariantColorClasses,
} from "./utils/Utils";

/** A single-select filter whose options are badge-coloured like the table. */
export const optionsFilter = (
  key: string,
  label: string,
  values: string[],
  variants: Record<string, string>,
  t: (key: string) => string,
  icon?: React.ReactNode,
) =>
  createFilterConfig(
    key,
    label,
    "command",
    values.map((value) => ({
      value,
      label: t(value),
      color: getVariantColorClasses(variants[value] ?? "secondary"),
    })),
    {
      renderSelected: (selected: FilterValues) => {
        const [first] = selected as string[];
        return typeof first === "string" ? (
          <GenericSelectedBadge
            selectedValue={first}
            selectedLength={(selected as string[]).length}
            variant={(variants[first] ?? "secondary") as never}
          />
        ) : (
          <></>
        );
      },
      icon: icon ?? <CircleDashed className="size-4" />,
    },
  );

export const createdByFilter = (key: string, label: string) =>
  createFilterConfig(key, label, "facility_user", [], {
    renderSelected: (selected: FilterValues) => (
      <SelectedFacilityUserBadge selected={selected as FilterUser[]} />
    ),
  });

export const dateFilter = (
  key: string,
  label: string,
  dateRangeOptions: DateRangeOption[],
) =>
  createFilterConfig(key, label, "date", [], {
    renderSelected: (selected, filter, onFilterChange) => (
      <SelectedDateBadge
        selected={selected as FilterDateRange}
        filter={filter!}
        onFilterChange={onFilterChange!}
      />
    ),
    getOperations: (selected: FilterValues) =>
      getDateOperations(selected as FilterDateRange),
    icon: <CalendarFold className="size-4" />,
    dateRangeOptions,
  });
