import * as React from "react";
import { useTranslation } from "react-i18next";
import { Check, ChevronsUpDown, X } from "lucide-react";

import { cn } from "@/lib/utils";

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
import { Skeleton } from "@/components/ui/skeleton";

interface AutoCompleteOption {
  label: string;
  value: string;
}

interface AutocompleteProps {
  options: AutoCompleteOption[];
  isLoading?: boolean;
  value: string;
  onChange: (value: string) => void;
  onSearch?: (value: string) => void;
  onOpenChange?: (open: boolean) => void;
  placeholder?: string;
  inputPlaceholder?: string;
  noOptionsMessage?: string;
  disabled?: boolean;
  align?: "start" | "center" | "end";
  className?: string;
}

export default function Autocomplete({
  options,
  isLoading = false,
  value,
  onChange,
  onSearch,
  onOpenChange,
  placeholder = "Select...",
  inputPlaceholder = "Search option...",
  noOptionsMessage = "No options found",
  disabled,
  align = "start",
  className,
}: AutocompleteProps) {
  const { t } = useTranslation();
  const [open, setOpen] = React.useState(false);

  const selectedOption = options.find((option) => option.value === value);

  return (
    <div className="flex relative w-full">
      <Popover
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          onOpenChange?.(next);
        }}
        modal={true}
      >
        <PopoverTrigger asChild>
          <Button
            title={selectedOption?.label}
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className={cn(
              "w-full justify-between font-normal",
              className,
              selectedOption && "rounded-r-none",
            )}
            disabled={disabled}
            type="button"
          >
            <span
              className={cn("truncate", !selectedOption && "text-gray-500")}
            >
              {selectedOption ? selectedOption.label : placeholder}
            </span>
            <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          className="p-0 pointer-events-auto w-[var(--radix-popover-trigger-width)]"
          align={align}
        >
          <Command shouldFilter={!onSearch}>
            <CommandInput
              placeholder={inputPlaceholder}
              onValueChange={onSearch}
              className="outline-hidden border-none ring-0 shadow-none text-base md:pr-0"
              autoFocus
            />
            <CommandList className="overflow-y-auto">
              {isLoading ? (
                <div className="space-y-2 p-2">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <Skeleton key={i} className="h-8 w-full" />
                  ))}
                </div>
              ) : (
                <CommandEmpty>{noOptionsMessage}</CommandEmpty>
              )}
              <CommandGroup>
                {options.map((option) => (
                  <CommandItem
                    key={option.value}
                    value={`${option.label} - ${option.value}`}
                    onSelect={() => {
                      onChange(option.value === value ? "" : option.value);
                      setOpen(false);
                    }}
                  >
                    <Check
                      className={cn(
                        "mr-2 size-4",
                        value === option.value ? "opacity-100" : "opacity-0",
                      )}
                    />
                    {option.label}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      {selectedOption && (
        <Button
          variant="outline"
          size="icon"
          className="rounded-l-none border-l-0 text-gray-400 h-auto"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onChange("");
            onSearch?.("");
          }}
          title={t("clear")}
          hidden={disabled}
        >
          <X className="size-4" />
          <span className="sr-only">{t("clear")}</span>
        </Button>
      )}
    </div>
  );
}
