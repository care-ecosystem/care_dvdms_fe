import {
  Check,
  ChevronDown,
  ChevronRight,
  Folder,
  FolderOpen,
  Home,
  Search,
} from "lucide-react";
import { FC, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { I18N_NAMESPACE } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { DvdmsLookupStore } from "@/types/dvdms_config";

export type EaushadhiStorePickerProps = {
  storeOptions: DvdmsLookupStore[];
  value?: string;
  onValueChange: (store: DvdmsLookupStore | undefined) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
};

export const EaushadhiStorePicker: FC<EaushadhiStorePickerProps> = ({
  storeOptions,
  value,
  onValueChange,
  placeholder,
  disabled = false,
  className,
}) => {
  const { t } = useTranslation(I18N_NAMESPACE);
  const [open, setOpen] = useState(false);
  const [activeType, setActiveType] = useState<string | undefined>(undefined);
  const [searchQuery, setSearchQuery] = useState("");

  const selectedStore = storeOptions.find(
    (store) => String(store.hstnumStoreId) === value,
  );

  const resetSearch = () => setSearchQuery("");

  useEffect(() => {
    if (open) {
      setActiveType(selectedStore?.sststrTypeName);
      resetSearch();
    }
  }, [open]);

  const storeTypes = useMemo(
    () =>
      [...new Set(storeOptions.map((store) => store.sststrTypeName))].sort(
        (a, b) => a.localeCompare(b),
      ),
    [storeOptions],
  );

  const storesForActiveType = useMemo(
    () =>
      storeOptions
        .filter((store) => store.sststrTypeName === activeType)
        .filter((store) =>
          searchQuery
            ? store.hststrStoreName
                .toLowerCase()
                .includes(searchQuery.toLowerCase())
            : true,
        )
        .sort((a, b) => a.hststrStoreName.localeCompare(b.hststrStoreName)),
    [storeOptions, activeType, searchQuery],
  );

  const handleTypeSelect = (type: string) => {
    setActiveType(type);
    resetSearch();
  };

  const handleStoreSelect = (store: DvdmsLookupStore) => {
    onValueChange(store);
    setOpen(false);
    resetSearch();
  };

  const handleBackToTypes = () => {
    setActiveType(undefined);
    resetSearch();
  };

  const getDisplayValue = () => {
    if (!selectedStore) {
      return (
        <span className="text-gray-500">
          {placeholder || t("eaushadhi_store_placeholder")}
        </span>
      );
    }
    return (
      <span className="truncate">
        {selectedStore.hststrStoreName} ({selectedStore.hstnumStoreId})
      </span>
    );
  };

  return (
    <Popover
      open={open}
      onOpenChange={(newOpen) => {
        setOpen(newOpen);
        if (!newOpen) {
          resetSearch();
        }
      }}
    >
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn(
            "justify-between h-9 min-h-9 w-full px-3 py-2 font-normal",
            "hover:bg-gray-50 hover:text-gray-900",
            disabled && "opacity-50 cursor-not-allowed",
            className,
          )}
        >
          <div className="flex items-center gap-2 min-w-0 flex-1">
            {getDisplayValue()}
          </div>
          <ChevronDown
            className={cn(
              "h-4 w-4 shrink-0 opacity-50 transition-transform duration-200",
              open && "rotate-180",
            )}
          />
        </Button>
      </PopoverTrigger>

      <PopoverContent
        className="w-[var(--radix-popover-trigger-width)] min-w-[300px] max-w-[420px] p-0 shadow-lg border-0"
        align="start"
        sideOffset={4}
        onWheel={(e) => e.stopPropagation()}
      >
        <div className="flex flex-col">
          <div className="px-4 py-3 border-b bg-gray-50">
            <div className="flex items-center gap-2 min-w-0">
              <Home className="h-4 w-4 text-gray-500 shrink-0" />
              <span className="text-sm font-medium text-gray-600 truncate">
                {activeType || t("eaushadhi_store_type")}
              </span>
            </div>
          </div>

          {activeType && (
            <div className="px-4 py-2 border-b bg-gray-100">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleBackToTypes}
                className="h-6 px-2 text-xs hover:bg-white"
              >
                <Home className="h-3 w-3 mr-1" />
                {t("eaushadhi_store_type_back")}
              </Button>
            </div>
          )}

          <Command className="border-0">
            {activeType && (
              <div className="px-3 py-2 border-b">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
                  <CommandInput
                    placeholder={t("eaushadhi_store_search_placeholder")}
                    value={searchQuery}
                    onValueChange={setSearchQuery}
                    className="pl-9 h-9 border-0 focus:ring-0"
                  />
                </div>
              </div>
            )}

            <CommandList className="max-h-[300px]">
              <CommandEmpty>
                {activeType ? (
                  <div className="p-6 text-center text-gray-500">
                    <Search className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <div className="text-sm">
                      {t("eaushadhi_store_no_options")}
                    </div>
                  </div>
                ) : (
                  <div className="p-6 text-center text-gray-500">
                    <Folder className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <div className="text-sm">
                      {t("eaushadhi_store_type_no_options")}
                    </div>
                  </div>
                )}
              </CommandEmpty>

              <CommandGroup>
                {!activeType
                  ? storeTypes.map((type) => (
                      <CommandItem
                        key={type}
                        value={type}
                        onSelect={() => handleTypeSelect(type)}
                        className="flex items-center justify-between px-3 py-3 cursor-pointer hover:bg-gray-50 hover:text-gray-900 transition-colors duration-150 border-b border-gray-200 last:border-b-0"
                      >
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          <FolderOpen className="h-5 w-5 text-gray-500 shrink-0" />
                          <span className="font-medium text-sm truncate">
                            {type}
                          </span>
                        </div>
                        <ChevronRight className="h-4 w-4 text-gray-500 shrink-0" />
                      </CommandItem>
                    ))
                  : storesForActiveType.map((store) => (
                      <CommandItem
                        key={store.hstnumStoreId}
                        value={`${store.hststrStoreName} ${store.hstnumStoreId}`}
                        onSelect={() => handleStoreSelect(store)}
                        className="flex items-center justify-between px-3 py-3 cursor-pointer hover:bg-gray-50 hover:text-gray-900 transition-colors duration-150 border-b border-gray-200 last:border-b-0"
                      >
                        <span className="font-medium text-sm truncate">
                          {store.hststrStoreName} ({store.hstnumStoreId})
                        </span>
                        {String(store.hstnumStoreId) === value && (
                          <Check className="h-4 w-4 text-gray-700 shrink-0" />
                        )}
                      </CommandItem>
                    ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </div>
      </PopoverContent>
    </Popover>
  );
};

export default EaushadhiStorePicker;
