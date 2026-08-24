import { FC, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { Check, ChevronDown, Search } from "lucide-react";

import { apis } from "@/apis";
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
import { ProductKnowledge } from "@/types/productKnowledge";

type ProductKnowledgeComboboxProps = {
  facilityId: string;
  value: ProductKnowledge | null;
  onChange: (productKnowledge: ProductKnowledge) => void;
};

const ProductKnowledgeCombobox: FC<ProductKnowledgeComboboxProps> = ({
  facilityId,
  value,
  onChange,
}) => {
  const { t } = useTranslation(I18N_NAMESPACE);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  useEffect(() => {
    const timeout = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timeout);
  }, [search]);

  const { data, isLoading } = useQuery({
    queryKey: ["dvdms_product_knowledge_search", facilityId, debouncedSearch],
    queryFn: () =>
      apis.productKnowledge.list({
        facility: facilityId,
        name: debouncedSearch || undefined,
        limit: 10,
      }),
    enabled: open,
  });

  const results = data?.results ?? [];

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
            {value ? value.name : t("product_knowledge_placeholder")}
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
                placeholder={t("search_product_knowledge")}
                value={search}
                onValueChange={setSearch}
                className="pl-9 h-9 border-0 focus:ring-0"
              />
            </div>
          </div>
          <CommandList className="max-h-[300px]">
            <CommandEmpty>
              <div className="p-6 text-center text-gray-500">
                <div className="text-sm">
                  {isLoading
                    ? t("loading")
                    : t("no_product_knowledge_found")}
                </div>
              </div>
            </CommandEmpty>
            <CommandGroup>
              {results.map((productKnowledge) => (
                <CommandItem
                  key={productKnowledge.id}
                  value={productKnowledge.name}
                  onSelect={() => {
                    onChange(productKnowledge);
                    setOpen(false);
                    setSearch("");
                  }}
                  className="flex items-center justify-between px-3 py-2"
                >
                  <span className="truncate text-sm">
                    {productKnowledge.name}
                  </span>
                  {value?.id === productKnowledge.id && (
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

export default ProductKnowledgeCombobox;
