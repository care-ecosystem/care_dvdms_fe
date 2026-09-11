import { FC, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { ChevronDownIcon, XIcon } from "lucide-react";

import { apis } from "@/apis";
import { I18N_NAMESPACE } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { Organization } from "@/types/organization";

const SUPPLIER_ORG_TYPE = "product_supplier";
const SEARCH_DEBOUNCE_MS = 300;

type SupplierSelectProps = {
  value?: Organization;
  onChange: (supplier?: Organization) => void;
  className?: string;
  disabled?: boolean;
};

const SupplierSelect: FC<SupplierSelectProps> = ({
  value,
  onChange,
  className,
  disabled,
}) => {
  const { t } = useTranslation(I18N_NAMESPACE);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const timeout = setTimeout(
      () => setDebouncedSearch(search),
      SEARCH_DEBOUNCE_MS,
    );
    return () => clearTimeout(timeout);
  }, [search]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const { data, isLoading } = useQuery({
    queryKey: ["dvdms_suppliers", debouncedSearch],
    queryFn: () =>
      apis.organizations.list({
        org_type: SUPPLIER_ORG_TYPE,
        limit: 20,
        name: debouncedSearch || undefined,
      }),
    enabled: open && !disabled,
  });

  const options = data?.results ?? [];

  const handleSelect = (supplier: Organization) => {
    onChange(supplier);
    setSearch("");
    setOpen(false);
  };

  const handleClear = () => {
    onChange(undefined);
    setSearch("");
  };

  return (
    <div ref={containerRef} className={cn("relative w-full", className)}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((prev) => !prev)}
        className={cn(
          "flex h-9 w-full items-center justify-between gap-2 rounded-md border border-gray-400 px-3 text-sm shadow-sm",
          disabled
            ? "bg-gray-50 cursor-default disabled:opacity-100"
            : "bg-white",
        )}
      >
        <span
          className={cn(
            "truncate",
            value ? "text-gray-900" : "text-gray-500",
            disabled && value && "text-gray-950",
          )}
        >
          {value?.name ?? t("search_by_supplier")}
        </span>
        <div className="flex shrink-0 items-center gap-1">
          {value && !disabled && (
            <XIcon
              className="size-4 text-gray-400 hover:text-gray-700"
              onClick={(event) => {
                event.stopPropagation();
                handleClear();
              }}
            />
          )}
          <ChevronDownIcon className="size-4 text-gray-400" />
        </div>
      </button>

      {open && !disabled && (
        <div className="absolute z-10 mt-1 w-full rounded-md border border-gray-200 bg-white shadow-md">
          <div className="p-2">
            <input
              autoFocus
              type="text"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={t("search_vendor")}
              className="h-8 w-full rounded-md border border-gray-300 px-2 text-sm outline-hidden focus:border-primary-500"
            />
          </div>
          <div className="max-h-60 overflow-y-auto border-t border-gray-100">
            {isLoading && (
              <div className="p-3 text-sm text-gray-500">{t("loading")}</div>
            )}
            {!isLoading && options.length === 0 && (
              <div className="p-3 text-sm text-gray-500">
                {t("no_vendor_found")}
              </div>
            )}
            {options.map((org) => (
              <button
                key={org.id}
                type="button"
                onClick={() => handleSelect(org)}
                className={cn(
                  "block w-full truncate px-3 py-2 text-left text-sm hover:bg-gray-100",
                  value?.id === org.id && "bg-primary-50 text-primary-800",
                )}
              >
                {org.name}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default SupplierSelect;
