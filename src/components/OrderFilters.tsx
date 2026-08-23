import { FC, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  CheckIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  Filter as FilterIcon,
  XIcon,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { I18N_NAMESPACE } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

const STATUS_OPTIONS = ["pending", "draft"];
const PRIORITY_OPTIONS = ["routine", "urgent", "asap", "stat"];

type FilterKey = "status" | "priority";

type FilterField = {
  key: FilterKey;
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
};

type OrderFiltersProps = {
  status: string;
  priority: string;
  onStatusChange: (value: string) => void;
  onPriorityChange: (value: string) => void;
};

const OrderFilters: FC<OrderFiltersProps> = ({
  status,
  priority,
  onStatusChange,
  onPriorityChange,
}) => {
  const { t } = useTranslation(I18N_NAMESPACE);
  const [open, setOpen] = useState(false);
  const [activeField, setActiveField] = useState<FilterKey | null>(null);
  const [openChip, setOpenChip] = useState<FilterKey | null>(null);

  const closePopovers = () => {
    setOpen(false);
    setActiveField(null);
    setOpenChip(null);
  };

  const fields: FilterField[] = [
    {
      key: "status",
      label: t("status"),
      value: status,
      options: STATUS_OPTIONS,
      onChange: onStatusChange,
    },
    {
      key: "priority",
      label: t("priority"),
      value: priority,
      options: PRIORITY_OPTIONS,
      onChange: onPriorityChange,
    },
  ];

  const activeFields = fields.filter((field) => field.value);

  const renderOptions = (field: FilterField) => (
    <div className="p-1">
      {field.options.map((option) => (
        <button
          key={option}
          type="button"
          onClick={() => {
            field.onChange(field.value === option ? "" : option);
            closePopovers();
          }}
          className="flex w-full items-center justify-between gap-2 rounded-sm px-3 py-2 text-sm hover:bg-gray-100"
        >
          <span className="text-gray-900">{t(option)}</span>
          {field.value === option && (
            <CheckIcon className="size-4 text-primary-700" />
          )}
        </button>
      ))}
    </div>
  );

  const hasFiltersRemaining = activeFields.length < fields.length;

  return (
    <div className="flex shrink-0 flex-nowrap items-center gap-2">
      {activeFields.map((field) => (
        <Popover
          key={field.key}
          open={openChip === field.key}
          onOpenChange={(next) => setOpenChip(next ? field.key : null)}
        >
          <div className="flex shrink-0 items-center whitespace-nowrap rounded-md border border-gray-200 bg-white">
            <PopoverTrigger asChild>
              <button
                type="button"
                className="flex h-9 items-center gap-2 px-3 text-sm"
              >
                <span className="font-medium text-gray-950">
                  {field.label}
                </span>
                <span className="text-gray-500 underline">{t("is")}</span>
                <span className="font-medium text-gray-950">
                  {t(field.value)}
                </span>
              </button>
            </PopoverTrigger>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-9 w-9 rounded-l-none border-l border-gray-200"
              onClick={() => field.onChange("")}
            >
              <XIcon className="size-4 text-gray-500" />
            </Button>
          </div>
          <PopoverContent align="start" className="w-64 p-0">
            {renderOptions(field)}
          </PopoverContent>
        </Popover>
      ))}

      {activeFields.length > 1 && (
        <button
          type="button"
          className="shrink-0 whitespace-nowrap text-xs text-gray-600 underline"
          onClick={() => {
            onStatusChange("");
            onPriorityChange("");
          }}
        >
          {t("clear_filters")}
        </button>
      )}

      {hasFiltersRemaining && (
        <Popover
          open={open}
          onOpenChange={(next) => {
            setOpen(next);
            if (!next) setActiveField(null);
          }}
        >
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className={cn(
                "h-9 shrink-0 gap-2 font-semibold",
                activeFields.length > 0 && "border-primary-300 bg-primary-50",
              )}
            >
              <FilterIcon className="size-4" />
              {t("filter")}
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-48 p-0">
            {activeField ? (
              <div>
                <div className="flex items-center gap-2 border-b border-gray-200 px-3 py-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0"
                    onClick={() => setActiveField(null)}
                  >
                    <ChevronLeftIcon className="size-4" />
                  </Button>
                  <span className="text-sm font-medium">
                    {fields.find((field) => field.key === activeField)?.label}
                  </span>
                </div>
                {renderOptions(
                  fields.find((field) => field.key === activeField)!,
                )}
              </div>
            ) : (
              <div className="p-1">
                {fields
                  .filter((field) => !field.value)
                  .map((field) => (
                    <button
                      key={field.key}
                      type="button"
                      onClick={() => setActiveField(field.key)}
                      className="flex w-full items-center justify-between rounded-sm px-3 py-2 text-sm hover:bg-gray-100"
                    >
                      <span>{field.label}</span>
                      <ChevronRightIcon className="size-4 text-gray-500" />
                    </button>
                  ))}
              </div>
            )}
          </PopoverContent>
        </Popover>
      )}
    </div>
  );
};

export default OrderFilters;
