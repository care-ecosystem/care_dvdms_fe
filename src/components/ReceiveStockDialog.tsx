import { FC, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { I18N_NAMESPACE } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { ShortcutBadge } from "@/components/keyboardShortcutComponents";
import {
  SupplyDeliveryCondition,
  SupplyDeliveryStatus,
} from "@/types/supplyDelivery";

const RADIO_LABEL_CLASS =
  "flex items-center justify-center px-4 py-3 rounded-md border-[1.5px] cursor-pointer transition-all border-gray-300 bg-white hover:border-gray-400";

type ReceiveStockDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedCount: number;
  isPending: boolean;
  onConfirm: (
    status: SupplyDeliveryStatus,
    condition: SupplyDeliveryCondition,
  ) => void;
};


const ReceiveStockDialog: FC<ReceiveStockDialogProps> = ({
  open,
  onOpenChange,
  selectedCount,
  isPending,
  onConfirm,
}) => {
  const { t } = useTranslation(I18N_NAMESPACE);
  const [status, setStatus] = useState(SupplyDeliveryStatus.completed);
  const [condition, setCondition] = useState(SupplyDeliveryCondition.normal);

  useEffect(() => {
    if (!open) return;
    setStatus(SupplyDeliveryStatus.completed);
    setCondition(SupplyDeliveryCondition.normal);
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent closeLabel={t("close")} className="md:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("receive_update_stock")}</DialogTitle>
          <DialogDescription>
            {t("apply_updates_selected", { count: selectedCount })}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 bg-gray-50 p-4 rounded-md">
          <div className="space-y-4">
            <Label>{t("receiving_status")}</Label>
            <RadioGroup
              value={status}
              onValueChange={(value: SupplyDeliveryStatus) => setStatus(value)}
              className="flex flex-wrap gap-3"
            >
              {[
                SupplyDeliveryStatus.completed,
                SupplyDeliveryStatus.abandoned,
              ].map((option) => (
                <Label
                  key={option}
                  htmlFor={`receiving-status-${option}`}
                  className={RADIO_LABEL_CLASS}
                >
                  <RadioGroupItem
                    value={option}
                    id={`receiving-status-${option}`}
                  />
                  <div className="flex items-center space-x-2">
                    <span className="font-medium">{t(option)}</span>
                  </div>
                </Label>
              ))}
            </RadioGroup>
          </div>

          {status === SupplyDeliveryStatus.completed && (
            <div className="space-y-4">
              <Label>{t("item_condition")}</Label>
              <RadioGroup
                value={condition}
                onValueChange={(value: SupplyDeliveryCondition) =>
                  setCondition(value)
                }
                className="flex flex-wrap gap-3"
              >
                {[
                  SupplyDeliveryCondition.normal,
                  SupplyDeliveryCondition.damaged,
                ].map((option) => (
                  <Label
                    key={option}
                    htmlFor={`item-condition-${option}`}
                    className={RADIO_LABEL_CLASS}
                  >
                    <RadioGroupItem
                      value={option}
                      id={`item-condition-${option}`}
                    />
                    <div className="flex items-center space-x-2">
                      <span className="font-medium">{t(option)}</span>
                    </div>
                  </Label>
                ))}
              </RadioGroup>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t("cancel")}
          </Button>
          <Button
            variant={
              status === SupplyDeliveryStatus.abandoned
                ? "destructive"
                : "primary"
            }
            onClick={() => onConfirm(status, condition)}
            disabled={isPending}
          >
            {isPending ? t("updating") : t("confirm")}
            <ShortcutBadge actionId="submit-action" />
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ReceiveStockDialog;
