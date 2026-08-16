import { FC } from "react";
import { navigate } from "raviger";
import { useTranslation } from "react-i18next";

import { I18N_NAMESPACE } from "@/lib/constants";

type ExternalSupplyNavItemsProps = {
  facilityId: string;
  locationId: string;
};

const ExternalSupplyNavItems: FC<ExternalSupplyNavItemsProps> = ({
  facilityId,
  locationId,
}) => {
  const { t } = useTranslation(I18N_NAMESPACE);

  if (!facilityId || !locationId) {
    return null;
  }

  return (
    <button
      type="button"
      onClick={() =>
        navigate(
          `/facility/${facilityId}/locations/${locationId}/inventory/external/dvdms`,
        )
      }
      className="text-gray-600 transition font-normal hover:bg-gray-200 hover:text-green-700 flex w-full cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm outline-hidden select-none [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0"
    >
      {t("dvdms_external_supply")}
    </button>
  );
};

export default ExternalSupplyNavItems;
