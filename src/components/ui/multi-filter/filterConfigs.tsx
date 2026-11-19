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

export const optionsFilter = (
  key: string,
  label: string,
  values: string[],
  variants: Record<string, string>,
  t: (key: string) => string,
  icon?: React.ReactNode,
  labels: Record<string, string> = {},
) =>
  createFilterConfig(
    key,
    label,
    "command",
    values.map((value) => {
      const shown = labels[value] ?? value;
      return {
        value,
        label: t(shown),
        color: getVariantColorClasses(variants[shown] ?? "secondary"),
      };
    }),
    {
      renderSelected: (selected: FilterValues) => {
        const [first] = selected as string[];
        const shown = labels[first] ?? first;
        return typeof first === "string" ? (
          <GenericSelectedBadge
            selectedValue={shown}
            selectedLength={(selected as string[]).length}
            variant={(variants[shown] ?? "secondary") as never}
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
