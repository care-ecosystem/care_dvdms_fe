import { ReactNode } from "react";
import { useTranslation } from "react-i18next";

import { I18N_NAMESPACE } from "@/lib/constants";
import { cn } from "@/lib/utils";

type DisablingCoverProps = {
  disabled: boolean;
  message?: string;
  className?: string;
  children: ReactNode;
};

const DisablingCover = ({
  disabled,
  message,
  className,
  children,
}: DisablingCoverProps) => {
  const { t } = useTranslation(I18N_NAMESPACE);

  return (
    <div className={cn("relative", className)}>
      {disabled && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-white/75">
          <div className="rounded-lg bg-white p-4 shadow-xl">
            <span className="block max-w-sm text-center text-sm font-semibold">
              {message ?? t("loading")}
            </span>
          </div>
        </div>
      )}
      {children}
    </div>
  );
};

export default DisablingCover;
