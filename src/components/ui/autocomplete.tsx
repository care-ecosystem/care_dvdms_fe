import { Check, ChevronsUpDown, X } from "lucide-react";
import * as React from "react";

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
  popoverContentClassName?: string;
  freeInput?: boolean;
  closeOnSelect?: boolean;
  showClearButton?: boolean;
  clearLabel?: string;
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
  popoverContentClassName,
  freeInput = false,
  closeOnSelect = true,
  showClearButton = true,
  clearLabel = "Clear",
}: AutocompleteProps) {
  const [open, setOpen] = React.useState(false);

  const [inputValue, setInputValue] = React.useState(value);

  const selectedOption = options.find((option) => option.value === value);

  const orderedOptions = React.useMemo(() => {
    if (!selectedOption) return options;
    return [
      selectedOption,
      ...options.filter((option) => option.value !== selectedOption.value),
    ];
  }, [options, selectedOption]);

  React.useEffect(() => {
    const selected = options.find((option) => option.value === value);
    setInputValue(value ? (selected ? selected.label : value) : "");
  }, [value, options]);

  const displayText = freeInput
    ? inputValue || placeholder
    : selectedOption
      ? selectedOption.label
      : placeholder;

  const handleInputChange = (newValue: string) => {
    if (freeInput) {
      setInputValue(newValue);
      const matchingOption = options.find(
        (option) => option.label.toLowerCase() === newValue.toLowerCase(),
      );
      onChange(matchingOption ? matchingOption.value : newValue);
    } else {
      onSearch?.(newValue);
    }
  };

  const handleClear = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onChange("");
    if (freeInput) setInputValue("");
    onSearch?.("");
    setOpen(false);
  };

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
            type="button"
            title={selectedOption ? selectedOption.label : undefined}
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className={cn(
              "w-full min-w-0 justify-between pr-8",
              className,
              selectedOption && showClearButton && "rounded-r-none",
            )}
            disabled={disabled}
          >
            <span
              className={cn(
                "min-w-0",
                inputValue && "truncate",
                !selectedOption && "text-gray-500",
              )}
            >
              {displayText}
            </span>
          </Button>
        </PopoverTrigger>
        <PopoverContent
          align={align}
          style={{
            minWidth: "var(--radix-popover-trigger-width)",
            maxWidth: "min(28rem, calc(100vw - 2rem))",
          }}
          className={cn(
            "p-0 pointer-events-auto w-auto",
            popoverContentClassName,
          )}
        >
          <Command>
            <CommandInput
              placeholder={inputPlaceholder}
              disabled={disabled}
              onValueChange={handleInputChange}
              autoFocus
            />
            <CommandList className="overflow-y-auto">
              {isLoading ? (
                <div className="p-6 text-center text-sm text-gray-500">
                  {inputPlaceholder}...
                </div>
              ) : (
                <CommandEmpty>{noOptionsMessage}</CommandEmpty>
              )}
              <CommandGroup>
                {orderedOptions.map((option) => (
                  <CommandItem
                    key={option.value}
                    value={`${option.label} - ${option.value}`}
                    onSelect={(v) => {
                      const currentValue =
                        options.find((o) => `${o.label} - ${o.value}` === v)
                          ?.value || "";
                      onChange(currentValue);
                      if (freeInput) {
                        const selected = options.find(
                          (o) => o.value === currentValue,
                        );
                        setInputValue(selected ? selected.label : currentValue);
                      }
                      if (closeOnSelect) setOpen(false);
                    }}
                  >
                    <Check
                      className={cn(
                        "mr-2 size-4 shrink-0",
                        value === option.value ? "opacity-100" : "opacity-0",
                      )}
                    />
                    <span
                      className="min-w-0 flex-1"
                      style={{
                        flex: 1,
                        minWidth: 0,
                        overflowWrap: "anywhere",
                      }}
                      title={option.label}
                    >
                      {option.label}
                    </span>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      {selectedOption && showClearButton ? (
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="rounded-l-none border-l-0 text-gray-400 h-auto shrink-0"
          onClick={handleClear}
          title={clearLabel}
          hidden={disabled}
        >
          <X className="size-4" />
          <span className="sr-only">{clearLabel}</span>
        </Button>
      ) : (
        <ChevronsUpDown className="absolute right-3 top-1/2 -translate-y-1/2 ml-2 size-4 shrink-0 opacity-50" />
      )}
    </div>
  );
}
