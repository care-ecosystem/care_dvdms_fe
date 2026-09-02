import { FC, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import {
  Check,
  ChevronDown,
  ChevronRight,
  Folder,
  FolderOpen,
  Home,
  Search,
  X,
} from "lucide-react";

import { apis } from "@/apis";
import { I18N_NAMESPACE, LIST_FETCH_LIMIT } from "@/lib/constants";
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
import {
  ProductKnowledge,
  ResourceCategoryType,
} from "@/types/productKnowledge";

type Breadcrumb = {
  slug: string;
  title: string;
};

type ProductKnowledgeSelectProps = {
  facilityId: string;
  value?: ProductKnowledge;
  onChange: (value: ProductKnowledge | undefined) => void;
  placeholder?: string;
  className?: string;
  hideClearButton?: boolean;
  defaultOpen?: boolean;
};

const ProductKnowledgeSelect: FC<ProductKnowledgeSelectProps> = ({
  facilityId,
  value,
  onChange,
  placeholder,
  className,
  hideClearButton = false,
  defaultOpen = false,
}) => {
  const { t } = useTranslation(I18N_NAMESPACE);
  const [open, setOpen] = useState(defaultOpen);
  const [breadcrumbs, setBreadcrumbs] = useState<Breadcrumb[]>([]);
  const [currentParent, setCurrentParent] = useState<string | undefined>();
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  useEffect(() => {
    if (defaultOpen) setOpen(true);
  }, [defaultOpen]);

  useEffect(() => {
    const timeout = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timeout);
  }, [search]);

  const { data: categoriesData, isLoading: isLoadingCategories } = useQuery({
    queryKey: ["dvdms_pk_categories", facilityId, currentParent],
    queryFn: () =>
      apis.resourceCategories.list(facilityId, {
        resource_type: ResourceCategoryType.product_knowledge,
        parent: currentParent || "",
        limit: LIST_FETCH_LIMIT,
      }),
    enabled: open,
  });
  const categories = categoriesData?.results ?? [];

  const { data: productsData, isLoading: isLoadingProducts } = useQuery({
    queryKey: [
      "dvdms_pk_definitions",
      facilityId,
      currentParent,
      debouncedSearch,
    ],
    queryFn: () =>
      apis.productKnowledge.list({
        facility: facilityId,
        category: currentParent || "",
        name: debouncedSearch || undefined,
        status: "active",
        limit: LIST_FETCH_LIMIT,
      }),
    enabled: open && (!!debouncedSearch || !!currentParent),
  });
  const productKnowledges = useMemo(
    () => productsData?.results ?? [],
    [productsData],
  );

  const isLoading = isLoadingCategories || isLoadingProducts;
  const showDefinitions = !!debouncedSearch || !!currentParent;

  const resetNavigation = () => {
    setSearch("");
    setDebouncedSearch("");
    setBreadcrumbs([]);
    setCurrentParent(undefined);
  };

  const handleCategorySelect = (slug: string, title: string) => {
    setBreadcrumbs((prev) => [...prev, { slug, title }]);
    setCurrentParent(slug);
    setSearch("");
    setDebouncedSearch("");
  };

  const handleBreadcrumbClick = (index: number) => {
    const next = breadcrumbs.slice(0, index + 1);
    setBreadcrumbs(next);
    setCurrentParent(next[index]?.slug);
    setSearch("");
    setDebouncedSearch("");
  };

  const handleBackToRoot = () => {
    setBreadcrumbs([]);
    setCurrentParent(undefined);
    setSearch("");
    setDebouncedSearch("");
  };

  const currentLevelTitle =
    breadcrumbs[breadcrumbs.length - 1]?.title ?? t("root");

  return (
    <Popover
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (!nextOpen) resetNavigation();
      }}
      modal
    >
      <div className="flex relative">
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className={cn(
              "justify-between px-3 py-2 w-full shadow-xs border-gray-300 h-auto min-h-9",
              "hover:bg-gray-50 hover:text-gray-900",
              className,
            )}
          >
            <span
              className={cn(
                "min-w-0 flex-1 text-left text-wrap wrap-break-word",
                !value && "text-gray-500",
              )}
            >
              {value?.name || placeholder || t("select_product")}
            </span>
            <ChevronDown
              className={cn(
                "size-4 shrink-0 opacity-50 transition-transform duration-200",
                open && "rotate-180",
              )}
            />
          </Button>
        </PopoverTrigger>
        {value && !hideClearButton && (
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              onChange(undefined);
              setOpen(false);
            }}
            className="rounded-l-none -ml-2 shadow-none text-gray-400 border-gray-300"
          >
            <X />
            <span className="sr-only">{t("clear")}</span>
          </Button>
        )}
      </div>

      <PopoverContent
        className="p-0 shadow-lg border-0 min-w-[420px] sm:max-w-[80vw]"
        align="start"
        sideOffset={4}
      >
        <div className="flex flex-col">
          <div className="px-4 py-3 border-b bg-gray-50">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Home className="size-4 text-gray-500" />
                <span className="text-sm font-medium text-gray-600">
                  {currentLevelTitle}
                </span>
              </div>
              {value && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    onChange(undefined);
                    setOpen(false);
                  }}
                  className="h-6 px-2 text-xs text-gray-500 hover:text-gray-700"
                >
                  <X className="size-3 mr-1" />
                  {t("clear")}
                </Button>
              )}
            </div>
          </div>

          {breadcrumbs.length > 0 && (
            <div className="px-3 py-2 border-b bg-gray-100">
              <div className="flex items-center gap-1 text-xs overflow-auto">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleBackToRoot}
                  className="h-6 px-2 text-xs hover:bg-white"
                >
                  <Home className="size-3 mr-1" />
                  {t("root")}
                </Button>
                {breadcrumbs.map((breadcrumb, index) => (
                  <div key={breadcrumb.slug} className="flex items-center">
                    <ChevronRight className="size-3 mx-1 text-gray-500" />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => handleBreadcrumbClick(index)}
                      className="h-6 px-2 text-xs hover:bg-white"
                    >
                      {breadcrumb.title}
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <Command className="border-0" shouldFilter={false}>
            <div className="px-3 border-b">
              <CommandInput
                placeholder={t("search_product_knowledge")}
                value={search}
                onValueChange={setSearch}
                className="h-9 border-0 focus:ring-0 text-base sm:text-sm"
                autoFocus
              />
            </div>
            <CommandList className="max-h-[300px]">
              <CommandEmpty>
                {isLoading ? (
                  <div className="p-6 space-y-3">
                    <div className="flex items-center gap-3">
                      <Skeleton className="size-4 rounded" />
                      <div className="space-y-1 flex-1">
                        <Skeleton className="h-4 w-3/4" />
                        <Skeleton className="h-3 w-1/2" />
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Skeleton className="size-4 rounded" />
                      <div className="space-y-1 flex-1">
                        <Skeleton className="h-4 w-2/3" />
                      </div>
                    </div>
                  </div>
                ) : debouncedSearch ? (
                  <div className="p-6 text-center text-gray-500">
                    <Search className="size-8 mx-auto mb-2 opacity-50" />
                    <div className="text-sm">
                      {t("no_product_knowledge_found")}
                    </div>
                  </div>
                ) : (
                  <div className="p-6 text-center text-gray-500">
                    <Folder className="size-8 mx-auto mb-2 opacity-50" />
                    <div className="text-sm">{t("no_categories_found")}</div>
                  </div>
                )}
              </CommandEmpty>

              <CommandGroup>
                {!debouncedSearch &&
                  categories.map((category) => (
                    <CommandItem
                      key={category.id}
                      value={category.title}
                      onSelect={() =>
                        handleCategorySelect(category.slug, category.title)
                      }
                      className="flex items-center justify-between p-3 cursor-pointer border-b border-gray-200"
                    >
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <FolderOpen className="size-4 shrink-0 text-gray-500" />
                        <div className="min-w-0 flex-1">
                          <div className="font-medium text-sm truncate">
                            {category.title}
                          </div>
                          {category.description && (
                            <div className="text-xs text-gray-500 truncate mt-0.5">
                              {category.description}
                            </div>
                          )}
                        </div>
                      </div>
                      <ChevronRight className="size-4 text-gray-500" />
                    </CommandItem>
                  ))}

                {showDefinitions &&
                  productKnowledges.map((productKnowledge) => (
                    <CommandItem
                      key={productKnowledge.id}
                      value={`${productKnowledge.name}-${productKnowledge.id}`}
                      onSelect={() => {
                        onChange(productKnowledge);
                        setOpen(false);
                        resetNavigation();
                      }}
                      className="flex items-center justify-between p-3 cursor-pointer border-b border-gray-200 last:border-b-0"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="font-medium text-sm break-all">
                          {productKnowledge.name}
                        </div>
                        {debouncedSearch && productKnowledge.category && (
                          <div className="flex items-center gap-1 text-xs text-gray-500 truncate mt-0.5">
                            <Folder className="size-2.5 shrink-0" />
                            <span className="truncate">
                              {productKnowledge.category.title}
                            </span>
                          </div>
                        )}
                      </div>
                      {value?.id === productKnowledge.id && (
                        <Check className="size-4 text-gray-700" />
                      )}
                    </CommandItem>
                  ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </div>
      </PopoverContent>
    </Popover>
  );
};

export default ProductKnowledgeSelect;
