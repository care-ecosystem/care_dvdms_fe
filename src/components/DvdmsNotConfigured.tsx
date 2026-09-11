import { FC } from "react";
import { useTranslation } from "react-i18next";
import { SettingsIcon } from "lucide-react";

import { I18N_NAMESPACE } from "@/lib/constants";
import { EmptyState } from "@/components/ui/empty-state";

type DvdmsNotConfiguredProps = {
  /** True when an institute exists but no store is mapped to a location. */
  hasInstitute?: boolean;
};

const DvdmsNotConfigured: FC<DvdmsNotConfiguredProps> = ({ hasInstitute }) => {
  const { t } = useTranslation(I18N_NAMESPACE);

  return (
    <EmptyState
      icon={<SettingsIcon className="text-primary size-6" />}
      title={
        hasInstitute
          ? t("dvdms_store_not_configured")
          : t("dvdms_not_configured")
      }

      action={
        <p className="text-sm text-gray-500">
          {t("dvdms_configure_hint")}{" "}
          <span className="font-medium text-gray-900">
            {t("settings")} › {t("general")} › {t("configure_dvdms")}
          </span>
        </p>
      }
    />
  );
};

export default DvdmsNotConfigured;
