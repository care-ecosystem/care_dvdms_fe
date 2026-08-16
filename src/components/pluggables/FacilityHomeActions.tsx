import { FC } from "react";
import { navigate, usePath } from "raviger";
import { useTranslation } from "react-i18next";
import { SettingsIcon } from "lucide-react";

import { I18N_NAMESPACE } from "@/lib/constants";
import { cn } from "@/lib/utils";

type Facility = {
  id: string;
  name: string;
};

type FacilityHomeActionsProps = {
  facility: Facility;
  className?: string;
};

const FacilityHomeActions: FC<FacilityHomeActionsProps> = ({ facility }) => {
  const { t } = useTranslation(I18N_NAMESPACE);
  const path = usePath();

  if (!facility) {
    return null;
  }

  const href = `/facility/${facility.id}/settings/general/dvdms`;
  const isActive = path === href;

  return (
    <div className="care-dvdms-container">
      <button
        type="button"
        onClick={() => navigate(href)}
        className={cn(
          "flex w-full cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-hidden select-none hover:bg-gray-100 hover:text-gray-900 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
          isActive && "bg-white text-green-700 shadow",
        )}
      >
        <SettingsIcon className="size-4 text-gray-500" />
        {t("configure_dvdms")}
      </button>
    </div>
  );
};

export default FacilityHomeActions;
