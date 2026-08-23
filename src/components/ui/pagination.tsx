import { FC } from "react";
import { useTranslation } from "react-i18next";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";

import { I18N_NAMESPACE } from "@/lib/constants";
import { Button } from "@/components/ui/button";

type PaginationProps = {
  page: number;
  pageSize: number;
  totalCount: number;
  onPageChange: (page: number) => void;
};

export const Pagination: FC<PaginationProps> = ({
  page,
  pageSize,
  totalCount,
  onPageChange,
}) => {
  const { t } = useTranslation(I18N_NAMESPACE);
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  if (totalPages <= 1) {
    return null;
  }

  return (
    <div className="flex items-center justify-between gap-4 pt-2">
      <p className="text-sm text-gray-500">
        {t("pagination_page_of", { page, totalPages })}
      </p>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
        >
          <ChevronLeftIcon />
          {t("previous")}
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
        >
          {t("next")}
          <ChevronRightIcon />
        </Button>
      </div>
    </div>
  );
};
