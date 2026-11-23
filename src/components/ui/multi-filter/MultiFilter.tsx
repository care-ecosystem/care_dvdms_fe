import { ChevronRight, ListFilter, X } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { I18N_NAMESPACE } from "@/lib/constants";

import { cn } from "@/lib/utils";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import FilterRenderer from "./filterRenderer";
import { SelectedFilterBar } from "./selectedFilterBar";
import { FilterState, FilterValues } from "./utils/Utils";

interface MultiFilterProps {
  selectedFilters: Record<string, FilterState>;
  onFilterChange: (filterKey: string, values: FilterValues) => void;
  onOperationChange: (filterKey: string, operation: string) => void;
  onClearAll: () => void;
  onClearFilter: (filterKey: string) => void;
  placeholder?: string;
  className?: string;
  triggerButtonClassName?: string;
  clearAllButtonClassName?: string;
  selectedBarClassName?: string;
  selectedValueClassName?: string;
  facilityId?: string;
  disabled?: boolean;
  align?: "start" | "end";
}
export default function MultiFilter({
  selectedFilters,
  onFilterChange,
  onOperationChange,
  onClearAll,
  onClearFilter,
  placeholder,
  className,
  triggerButtonClassName,
  clearAllButtonClassName,
  selectedBarClassName,
  selectedValueClassName,
  facilityId,
  disabled = false,
  align = "start",
}: MultiFilterProps) {
  const [open, setOpen] = useState(false);
  const [activeFilter, setActiveFilter] = useState<string | null>(null);
  const [openStates, setOpenStates] = useState<Record<string, boolean>>({});
  const { t } = useTranslation(I18N_NAMESPACE);

  const activeFiltersCount = Object.values(selectedFilters).reduce(
    (sum, filterState) => {
      if (Array.isArray(filterState.selected)) {
        if (filterState.selected.length === 0) {
          return sum;
        }
      }
      return sum + 1;
    },
    0,
  );

  const nonClearableFilterCount = Object.values(selectedFilters).reduce(
    (sum, filterState) => {
      if (filterState.filter.disableClear) {
        return sum;
      }
      if (Array.isArray(filterState.selected)) {
        if (filterState.selected.length === 0) {
          return sum;
        }
      }
      return sum + 1;
    },
    0,
  );

  const hasAnyFilters = nonClearableFilterCount > 0;

  const handleFilterSelect = (filterKey: string) => {
    setActiveFilter(filterKey);
    setOpen(true);
  };

  const handleSelectedFilterClick = (filterKey: string) => {
    setActiveFilter(filterKey);
    setOpenStates((prev) => ({ ...prev, [filterKey]: true }));
  };

  const handleBack = () => {
    setActiveFilter(null);
  };

  const handleClearAll = () => {
    onClearAll();
    setOpen(false);
  };

  useEffect(() => {
    if (!open) {
      setActiveFilter(null);
    }
  }, [open]);

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <DropdownMenu open={open} onOpenChange={setOpen}>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            className={cn(
              "justify-between font-semibold",
              hasAnyFilters && "border-blue-300 bg-blue-50",
              triggerButtonClassName,
            )}
            disabled={disabled}
          >
            <ListFilter className="h-3 w-3" />
            <span className="truncate">{placeholder ?? t("filter")}</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          className="w-[calc(100vw)] max-w-[calc(100vw-3rem)] sm:max-w-xs p-0"
          align={align}
        >
          {activeFilter ? (
            <FilterRenderer
              activeFilter={activeFilter}
              selectedFilters={selectedFilters}
              handleBack={handleBack}
              onFilterChange={onFilterChange}
              facilityId={facilityId}
            />
          ) : (
            <FilterList
              handleFilterSelect={handleFilterSelect}
              selectedFilters={selectedFilters}
            />
          )}
        </DropdownMenuContent>
      </DropdownMenu>
      {Object.entries(selectedFilters).map(([key, _]) => {
        const filterState = selectedFilters[key];
        if (
          (Array.isArray(filterState.selected) &&
            filterState.selected.length === 0) ||
          (!Array.isArray(filterState.selected) &&
            !("from" in filterState.selected) &&
            !("to" in filterState.selected)) ||
          !filterState
        ) {
          return null;
        }
        return (
          <SelectedFilterBar
            key={key}
            selectedFilterKey={key}
            selectedFilters={selectedFilters}
            onClick={() => handleSelectedFilterClick(key)}
            clearFilter={() => onClearFilter(key)}
            openState={openStates[key] || false}
            setOpenState={(isOpen) =>
              setOpenStates((prev) => ({ ...prev, [key]: isOpen }))
            }
            onFilterChange={onFilterChange}
            onOperationChange={onOperationChange}
            selectedBarClassName={selectedBarClassName}
            selectedValueClassName={selectedValueClassName}
            facilityId={facilityId}
          />
        );
      })}
      {activeFiltersCount > 1 && (
        <Button
          variant="ghost"
          onClick={handleClearAll}
          className={cn(
            "text-sm text-gray-950 underline items-center w-auto self-start",
            clearAllButtonClassName,
          )}
        >
          <X strokeWidth={1.5} />
          {t("clear_all")}
        </Button>
      )}
    </div>
  );
}
function FilterList({
  handleFilterSelect,
  selectedFilters,
}: {
  handleFilterSelect: (filterKey: string) => void;
  selectedFilters: Record<string, FilterState>;
}) {
  const { t } = useTranslation(I18N_NAMESPACE);
  return (
    <div className="px-2 pt-2">
      {Object.values(selectedFilters).map(({ filter }) => {
        const selected = selectedFilters[filter.key]?.selected as string[];
        return (
          <DropdownMenuItem
            key={filter.key}
            onSelect={(e) => {
              e.preventDefault();
              handleFilterSelect(filter.key);
            }}
            className={cn(
              "flex items-center justify-between px-3 py-2 cursor-pointer",
            )}
          >
            <div className="flex items-center gap-2">
              <span className="border border-dotted border-gray-600 rounded w-3 h-3 mb-0.5"></span>
              <span className="text-sm">{t(filter.label)}</span>
            </div>
            <div className="flex items-center gap-2">
              {selected.length > 0 && (
                <span className="text-xs text-gray-500">{selected.length}</span>
              )}
              <ChevronRight className="h-4 w-4" />
            </div>
          </DropdownMenuItem>
        );
      })}
    </div>
  );
}
