import { FC, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";

import { apis } from "@/apis";
import { I18N_NAMESPACE, LIST_FETCH_LIMIT } from "@/lib/constants";
import Autocomplete from "@/components/ui/autocomplete";
import { Organization } from "@/types/organization";

const SUPPLIER_ORG_TYPE = "product_supplier";
const SEARCH_DEBOUNCE_MS = 300;

type SupplierSelectProps = {
  value?: Organization;
  onChange: (supplier?: Organization) => void;
  className?: string;
  disabled?: boolean;
};

/**
 * Supplier picker, built on the same `Autocomplete` core's `OrgSelect` uses so
 * the DVDMS screens match the external supply screens they sit next to.
 */
const SupplierSelect: FC<SupplierSelectProps> = ({
  value,
  onChange,
  className,
  disabled,
}) => {
  const { t } = useTranslation(I18N_NAMESPACE);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  useEffect(() => {
    const timeout = setTimeout(
      () => setDebouncedSearch(search),
      SEARCH_DEBOUNCE_MS,
    );
    return () => clearTimeout(timeout);
  }, [search]);

  const { data, isLoading } = useQuery({
    queryKey: ["dvdms_suppliers", debouncedSearch],
    queryFn: () =>
      apis.organizations.list({
        org_type: SUPPLIER_ORG_TYPE,
        limit: LIST_FETCH_LIMIT,
        name: debouncedSearch || undefined,
      }),
    enabled: !disabled,
  });

  const results = data?.results ?? [];
  /** The chosen supplier stays listed even once a search stops returning it. */
  const options =
    value && !results.some((org) => org.id === value.id)
      ? [...results, value]
      : results;

  return (
    <Autocomplete
      value={value?.id ?? ""}
      onChange={(organizationId) =>
        onChange(options.find((org) => org.id === organizationId))
      }
      onSearch={setSearch}
      options={options.map((org) => ({ label: org.name, value: org.id }))}
      isLoading={isLoading}
      placeholder={t("search_by_supplier")}
      inputPlaceholder={t("search_vendor")}
      noOptionsMessage={t("no_vendor_found")}
      disabled={disabled}
      className={className}
      closeOnSelect
    />
  );
};

export default SupplierSelect;
