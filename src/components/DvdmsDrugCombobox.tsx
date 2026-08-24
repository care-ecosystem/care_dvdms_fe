import { FC, useState } from "react";
import { useTranslation } from "react-i18next";
import { Check, ChevronDown, Search } from "lucide-react";

import { cn } from "@/lib/utils";
import { I18N_NAMESPACE } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

export interface DvdmsDrug {
  id: string;
  name: string;
}

type DvdmsDrugComboboxProps = {
  value: DvdmsDrug | null;
  onChange: (drug: DvdmsDrug) => void;
};

// TODO: replace with an API call once the DVDMS drug lookup endpoint exists
const DVDMS_DRUGS: DvdmsDrug[] = [];

const DvdmsDrugCombobox: FC<DvdmsDrugComboboxProps> = ({
  value,
  onChange,
}) => {
  const { t } = useTranslation(I18N_NAMESPACE);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const filteredDrugs = DVDMS_DRUGS.filter((drug) =>
    drug.name.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <Popover
      open={open}
      onOpenChange={(newOpen) => {
        setOpen(newOpen);
        if (!newOpen) setSearch("");
      }}
    >
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between h-9 min-h-9 px-3 py-2 font-normal hover:bg-gray-50 hover:text-gray-900"
        >
          <span className={cn("truncate", !value && "text-gray-500")}>
            {value ? value.name : t("dvdms_drug_placeholder")}
          </span>
          <ChevronDown
            className={cn(
              "h-4 w-4 shrink-0 opacity-50 transition-transform duration-200",
              open && "rotate-180",
            )}
          />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        sideOffset={4}
        className="w-[var(--radix-popover-trigger-width)] min-w-[300px] p-0 shadow-lg border-0"
      >
        <Command className="border-0">
          <div className="px-3 py-2 border-b">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
              <CommandInput
                placeholder={t("search_dvdms_drug")}
                value={search}
                onValueChange={setSearch}
                className="pl-9 h-9 border-0 focus:ring-0"
              />
            </div>
          </div>
          <CommandList className="max-h-[300px]">
            <CommandEmpty>
              <div className="p-6 text-center text-gray-500">
                <div className="text-sm">{t("no_dvdms_drug_found")}</div>
              </div>
            </CommandEmpty>
            <CommandGroup>
              {filteredDrugs.map((drug) => (
                <CommandItem
                  key={drug.id}
                  value={drug.name}
                  onSelect={() => {
                    onChange(drug);
                    setOpen(false);
                    setSearch("");
                  }}
                  className="flex items-center justify-between px-3 py-2"
                >
                  <span className="truncate text-sm">{drug.name}</span>
                  {value?.id === drug.id && (
                    <Check className="h-4 w-4 shrink-0 text-gray-700" />
                  )}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
};

export default DvdmsDrugCombobox;
