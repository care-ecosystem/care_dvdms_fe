import RenderDateFilter from "./dateFilter";
import RenderFacilityUserFilter from "./facilityUserFilter";
import GenericFilter from "./genericFilter";
import {
  FilterDateRange,
  FilterState,
  FilterUser,
  FilterValues,
} from "./utils/Utils";

export default function FilterRenderer({
  activeFilter,
  selectedFilters,
  facilityId,
  onFilterChange,
  handleBack,
}: {
  activeFilter: string;
  selectedFilters: Record<string, FilterState>;
  facilityId?: string;
  onFilterChange: (filterKey: string, values: FilterValues) => void;
  handleBack?: () => void;
}) {
  const filter = selectedFilters[activeFilter]?.filter;
  if (!filter) return null;

  const selected = selectedFilters[filter.key].selected || [];
  const commonProps = { filter, handleBack, onFilterChange };

  switch (filter.type) {
    case "date":
      return (
        <RenderDateFilter
          {...commonProps}
          selected={selected as FilterDateRange}
        />
      );
    case "facility_user":
      return (
        <>
          <RenderFacilityUserFilter
            {...commonProps}
            facilityId={facilityId}
            selectedUsers={selected as FilterUser[]}
          />
        </>
      );
    default:
      return (
        <>
          <GenericFilter
            {...commonProps}
            selectedValues={selected as string[]}
            showColorIndicators={filter.showColorIndicators ?? true}
          />
        </>
      );
  }
}
