import { FC } from "react";
import { navigate, usePath } from "raviger";
import { useTranslation } from "react-i18next";

import { I18N_NAMESPACE } from "@/lib/constants";
import { cn } from "@/lib/utils";

type ExternalSupplyNavItemsProps = {
  facilityId: string;
  locationId: string;
};

const ExternalSupplyNavItems: FC<ExternalSupplyNavItemsProps> = ({
  facilityId,
  locationId,
}) => {
  const { t } = useTranslation(I18N_NAMESPACE);
  const path = usePath();

  if (!facilityId || !locationId) {
    return null;
  }

  const href = `/facility/${facilityId}/locations/${locationId}/inventory/external/dvdms`;
  const isActive = !!path && path.startsWith(href);

  return (
    <button
      type="button"
      onClick={() => navigate(href)}
      data-active={isActive}
      className={cn(
        "flex h-7 w-full min-w-0 -translate-x-px cursor-pointer items-center gap-2 overflow-hidden rounded-md px-2 text-sm font-normal text-gray-600 outline-hidden transition select-none",
        "ring-sidebar-ring focus-visible:ring-2",
        "hover:bg-gray-200 hover:text-green-700",
        "disabled:pointer-events-none disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50",
        "[&>span:last-child]:truncate [&>svg]:size-4 [&>svg]:shrink-0 [&>svg]:text-sidebar-accent-foreground",
        "group-data-[collapsible=icon]:hidden",
        isActive && "bg-white text-green-700 shadow",
      )}
    >
      {t("dvdms_external_supply")}
    </button>
  );
};

export default ExternalSupplyNavItems;
