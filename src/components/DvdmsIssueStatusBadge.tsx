import { FC } from "react";
import { useTranslation } from "react-i18next";

import { I18N_NAMESPACE } from "@/lib/constants";
import { Badge } from "@/components/ui/badge";
import {
  DVDMS_INDENT_STATUS_LABELS,
  DVDMS_INDENT_STATUS_VARIANTS,
  toDvdmsIndentStatusKey,
} from "@/types/recordOrder";

type DvdmsIssueStatusBadgeProps = {
  status: string | null | undefined;
};

const DvdmsIssueStatusBadge: FC<DvdmsIssueStatusBadgeProps> = ({ status }) => {
  const { t } = useTranslation(I18N_NAMESPACE);

  /** A status DVDMS has not reported yet reads as a plain dash. */
  if (!status) return <>—</>;

  const key = toDvdmsIndentStatusKey(status);
  const label = DVDMS_INDENT_STATUS_LABELS[key];

  // Any status beyond the known ones keeps DVDMS' own wording on a plain badge.
  return (
    <Badge
      className="rounded-sm"
      variant={DVDMS_INDENT_STATUS_VARIANTS[key] ?? "secondary"}
    >
      {label ? t(label) : status}
    </Badge>
  );
};

export default DvdmsIssueStatusBadge;
