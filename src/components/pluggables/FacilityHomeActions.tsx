import { FC } from "react";
import { navigate } from "raviger";
import { useTranslation } from "react-i18next";
import { SettingsIcon } from "lucide-react";

import { I18N_NAMESPACE } from "@/lib/constants";

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

  if (!facility) {
    return null;
  }

  return (
    <div className="care-dvdms-container">
      <button
        type="button"
        onClick={() =>
          navigate(`/facility/${facility.id}/settings/general/dvdms`)
        }
        className="hover:bg-gray-100 hover:text-gray-900 flex w-full cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-hidden select-none [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0"
      >
        <SettingsIcon className="size-4 text-gray-500" />
        {t("configure_dvdms")}
      </button>
    </div>
  );
};

export default FacilityHomeActions;
