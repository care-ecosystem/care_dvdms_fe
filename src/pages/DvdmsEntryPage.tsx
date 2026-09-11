import { FC, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { navigate } from "raviger";

import { I18N_NAMESPACE } from "@/lib/constants";
import { dvdmsBasePath } from "@/lib/paths";
import DvdmsNotConfigured from "@/components/DvdmsNotConfigured";
import { Skeleton } from "@/components/ui/skeleton";
import useDvdmsLocation from "@/hooks/useDvdmsLocation";

type DvdmsEntryPageProps = {
  facilityId: string;
};

const DvdmsEntryPage: FC<DvdmsEntryPageProps> = ({ facilityId }) => {
  const { t } = useTranslation(I18N_NAMESPACE);
  const { institute, locationId, isLoading } = useDvdmsLocation(facilityId);

  useEffect(() => {
    if (!locationId) return;
    navigate(dvdmsBasePath(facilityId, locationId), { replace: true });
  }, [facilityId, locationId]);

  if (isLoading || locationId) {
    return (
      <div className="md:px-6 py-0 min-w-0">
        <div className="container mx-auto max-w-6xl space-y-4">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    );
  }

  return (
    <div className="md:px-6 py-0 min-w-0">
      <div className="container mx-auto max-w-6xl space-y-4">
        <h1 className="text-xl font-semibold text-gray-900">
          {t("dvdms_external_supply")}
        </h1>
        <DvdmsNotConfigured hasInstitute={!!institute} />
      </div>
    </div>
  );
};

export default DvdmsEntryPage;
