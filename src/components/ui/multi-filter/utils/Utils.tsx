import React from "react";

import { isSameDay, subDays, subMonths, subWeeks, subYears } from "date-fns";

import { GenericSelectedBadge } from "@/components/ui/multi-filter/genericFilter";

// Generic color palette for cycling through options
export const COLOR_PALETTE = [
  "bg-blue-100 border-blue-300",
  "bg-green-100 border-green-300",
  "bg-yellow-100 border-yellow-300",
  "bg-orange-100 border-orange-300",
  "bg-red-100 border-red-300",
  "bg-purple-100 border-purple-300",
  "bg-pink-100 border-pink-300",
  "bg-indigo-100 border-indigo-300",
  "bg-teal-100 border-teal-300",
  "bg-cyan-100 border-cyan-300",
  "bg-emerald-100 border-emerald-300",
  "bg-violet-100 border-violet-300",
] as const;
export const getColorForOption = (index: number) => {
  return COLOR_PALETTE[index % COLOR_PALETTE.length];
};

export interface FilterOption {
  value: string;
  label: string;
  color?: string;
  icon?: string;
}

export interface FilterUser {
  id: string;
  username: string;
  first_name: string;
  last_name: string;
  profile_picture_url?: string;
}

export type FilterValues = string[] | FilterDateRange | FilterUser[];

export type FilterMode = "single" | "multi";

export type DateFilterMeta = {
  presetOptions?: DateRangeOption[];
};

export type FilterConfig = {
  key: string;
  label: string;
  type: "command" | "date" | "facility_user";
  options: FilterOption[];
  icon?: React.ReactNode;
  operationKey?: string;
  renderSelected?: (
    selected: FilterValues,
    filter?: FilterConfig,
    onFilterChange?: (filterKey: string, values: FilterValues) => void,
  ) => React.ReactNode;
  getOperations?: (selected: FilterValues) => Operation[];
  mode?: FilterMode;
  disableClear?: boolean;
  showColorIndicators?: boolean;
  meta?: DateFilterMeta;
};

export interface OperationConfig {
  selectedOperation: Operation | null;
  availableOperations: Operation[];
}

export interface FilterState {
  filter: FilterConfig;
  operation: OperationConfig;
  selected: FilterValues;
}

export interface FilterDateRange {
  from?: Date;
  to?: Date;
}

export interface DateRangeOption {
  label: string;
  /** Ranges may be open ended, i.e. bound on only one end. */
  getDateRange: () => FilterDateRange;
  count?: number;
}

function isSameBoundary(a?: Date, b?: Date) {
  return a && b ? isSameDay(a, b) : !a && !b;
}

/**
 * Compares two (possibly open ended) date ranges with a day's precision.
 */
export function isSameDateRange(a: FilterDateRange, b: FilterDateRange) {
  return isSameBoundary(a.from, b.from) && isSameBoundary(a.to, b.to);
}

export type Operation = {
  value?: string;
  label: string;
};

function defaultRenderSelected(selected: FilterValues) {
  const selectedValues = selected as string[];
  if (typeof selectedValues[0] === "string") {
    return (
      <GenericSelectedBadge
        selectedValue={selectedValues[0]}
        selectedLength={selectedValues.length}
      />
    );
  }
  return <></>;
}

export function createFilterConfig(
  key: string,
  label: string,
  type: FilterConfig["type"],
  options: FilterOption[],
  meta: Partial<FilterConfig> & { dateRangeOptions?: DateRangeOption[] } = {},
): FilterConfig {
  const { dateRangeOptions, ...rest } = meta;
  return {
    renderSelected: defaultRenderSelected,
    getOperations: () => [{ label: "is" }],
    mode: "single",
    ...rest,
    key,
    label,
    type,
    options,
    meta: type === "date" ? { presetOptions: dateRangeOptions } : undefined,
  };
}

export const longDateRangeOptions: DateRangeOption[] = [
  {
    label: "today",
    getDateRange: () => ({
      from: new Date(),
      to: new Date(),
    }),
  },
  {
    label: "yesterday",
    getDateRange: () => ({
      from: subDays(new Date(), 1),
      to: subDays(new Date(), 1),
    }),
  },
  {
    label: "last_count_days",
    getDateRange: () => ({
      from: subDays(new Date(), 7),
      to: new Date(),
    }),
    count: 7,
  },
  {
    label: "last_count_weeks",
    getDateRange: () => ({
      from: subWeeks(new Date(), 3),
      to: new Date(),
    }),
    count: 3,
  },
  {
    label: "last_month",
    getDateRange: () => ({
      from: subMonths(new Date(), 1),
      to: new Date(),
    }),
  },
  {
    label: "last_count_months",
    getDateRange: () => ({
      from: subMonths(new Date(), 3),
      to: new Date(),
    }),
    count: 3,
  },
  {
    label: "last_count_months",
    getDateRange: () => ({
      from: subMonths(new Date(), 6),
      to: new Date(),
    }),
    count: 6,
  },
  {
    label: "last_year",
    getDateRange: () => ({
      from: subYears(new Date(), 1),
      to: new Date(),
    }),
  },
];

const variantMap: Record<string, string> = {
  primary: "border-primary-300 bg-primary-100 text-primary-900",
  secondary: "border-gray-300 bg-gray-100 text-gray-900",
  destructive: "border-red-300 bg-red-100 text-red-900",
  indigo: "border-indigo-300 bg-indigo-100 text-indigo-900",
  blue: "border-blue-300 bg-blue-100 text-blue-900",
  green: "border-green-300 bg-green-100 text-green-900",
  yellow: "border-yellow-300 bg-yellow-100/80 text-yellow-900",
  orange: "border-orange-300 bg-orange-100 text-orange-900",
  purple: "border-purple-300 bg-purple-100 text-purple-900",
};

export const getVariantColorClasses = (variant: string) => {
  return variantMap[variant] || variantMap.secondary;
};
