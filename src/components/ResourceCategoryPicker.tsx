import { FC, useEffect, useState } from "react";
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
import { Badge } from "@/components/ui/badge";
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
  ResourceCategory,
  ResourceCategoryParent,
  ResourceCategoryType,
} from "@/types/productKnowledge";

type Breadcrumb = {
  slug: string;
  title: string;
};

type ResourceCategoryPickerProps = {
  facilityId: string;
  resourceType: ResourceCategoryType;
  /** Slug of the selected category. */
  value?: string;
  onValueChange: (category: ResourceCategory | undefined) => void;
  placeholder?: string;
  className?: string;
};

const ResourceCategoryPicker: FC<ResourceCategoryPickerProps> = ({
  facilityId,
  resourceType,
  value,
  onValueChange,
  placeholder,
  className,
}) => {
  const { t } = useTranslation(I18N_NAMESPACE);
  const [open, setOpen] = useState(false);
  const [breadcrumbs, setBreadcrumbs] = useState<Breadcrumb[]>([]);
  const [currentParent, setCurrentParent] = useState<string | undefined>();
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  useEffect(() => {
    const timeout = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timeout);
  }, [search]);

  const {
    data: categoriesData,
    isLoading,
    isError,
  } = useQuery({
    queryKey: [
      "dvdms_resource_categories",
      facilityId,
      resourceType,
      currentParent,
      debouncedSearch,
    ],
    queryFn: () =>
      apis.resourceCategories.list(facilityId, {
        resource_type: resourceType,
        parent: currentParent || undefined,
        title: debouncedSearch || undefined,
        limit: LIST_FETCH_LIMIT,
      }),
    enabled: open,
  });
  const categories = categoriesData?.results ?? [];

  const { data: selectedCategory, isLoading: isLoadingSelected } = useQuery({
    queryKey: ["dvdms_resource_category", facilityId, value],
    queryFn: () => apis.resourceCategories.get(facilityId, value!),
    enabled: !!value,
  });

  const resetSearch = () => {
    setSearch("");
    setDebouncedSearch("");
  };

  const handleCategorySelect = (category: ResourceCategory) => {
    if (category.has_children) {
      setBreadcrumbs((prev) => [
        ...prev,
        { slug: category.slug, title: category.title },
      ]);
      setCurrentParent(category.slug);
      resetSearch();
      return;
    }
    onValueChange(category);
    setOpen(false);
    resetSearch();
  };

  const handleBreadcrumbClick = (index: number) => {
    const next = breadcrumbs.slice(0, index + 1);
    setBreadcrumbs(next);
    setCurrentParent(next[index]?.slug);
    resetSearch();
  };

  const handleBackToRoot = () => {
    setBreadcrumbs([]);
    setCurrentParent(undefined);
    resetSearch();
  };

  const renderDisplayValue = () => {
    if (isLoadingSelected) {
      return <Skeleton className="h-4 w-20" />;
    }
    if (!selectedCategory) {
      return (
        <span className="text-gray-500">
          {placeholder || t("select_category")}
        </span>
      );
    }

    const pathParts: string[] = [];
    let parent: ResourceCategoryParent | undefined = selectedCategory.parent;
    while (parent) {
      if (parent.title) pathParts.unshift(parent.title);
      parent = parent.parent;
    }
    pathParts.push(selectedCategory.title);

    return (
      <div className="flex items-center gap-1 min-w-0">
        <Folder className="size-4 shrink-0 text-gray-500" />
        <span className="truncate">
          {pathParts.length > 2
            ? `${pathParts[0]} > ... > ${pathParts[pathParts.length - 1]}`
            : pathParts.join(" > ")}
        </span>
      </div>
    );
  };

  const currentLevelTitle =
    breadcrumbs[breadcrumbs.length - 1]?.title ?? t("root");

  return (
    <Popover
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (!nextOpen) resetSearch();
      }}
      modal
    >
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn(
            "justify-between h-9 min-h-9 px-3 py-2 hover:bg-gray-50 hover:text-gray-900",
            className,
          )}
        >
          <div className="flex items-center gap-2 min-w-0 flex-1">
            {renderDisplayValue()}
          </div>
          <ChevronDown
            className={cn(
              "size-4 shrink-0 opacity-50 transition-transform duration-200",
              open && "rotate-180",
            )}
          />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[420px] p-0 shadow-lg border-0"
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
                {breadcrumbs.length > 0 && (
                  <Badge variant="secondary" className="text-xs">
                    {t("level")} {breadcrumbs.length + 1}
                  </Badge>
                )}
              </div>
              {value && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    onValueChange(undefined);
                    setOpen(false);
                    resetSearch();
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
            <div className="px-4 py-2 border-b bg-gray-100">
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
                placeholder={t("search_categories")}
                value={search}
                onValueChange={setSearch}
                className="h-9 border-0 focus:ring-0 text-base sm:text-sm"
              />
            </div>
            <CommandList className="max-h-[300px]">
              <CommandEmpty>
                {isLoading ? (
                  <div className="p-6 space-y-3">
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-4 w-2/3" />
                  </div>
                ) : isError ? (
                  <div className="p-6 text-center text-sm text-gray-500">
                    {t("failed_to_load_categories")}
                  </div>
                ) : debouncedSearch ? (
                  <div className="p-6 text-center text-gray-500">
                    <Search className="size-8 mx-auto mb-2 opacity-50" />
                    <div className="text-sm">{t("no_categories_found")}</div>
                  </div>
                ) : (
                  <div className="p-6 text-center text-gray-500">
                    <Folder className="size-8 mx-auto mb-2 opacity-50" />
                    <div className="text-sm">{t("no_categories_found")}</div>
                  </div>
                )}
              </CommandEmpty>
              <CommandGroup>
                {categories.map((category) => (
                  <CommandItem
                    key={category.id}
                    value={category.title}
                    onSelect={() => handleCategorySelect(category)}
                    className="flex items-center justify-between px-3 py-3 cursor-pointer border-b border-gray-200 last:border-b-0"
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      {category.has_children ? (
                        <FolderOpen className="size-5 shrink-0 text-gray-500" />
                      ) : (
                        <Folder className="size-5 shrink-0 text-gray-500" />
                      )}
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
                    <div className="flex items-center gap-2 shrink-0">
                      {value === category.slug && (
                        <Check className="size-4 text-gray-700" />
                      )}
                      {category.has_children && (
                        <ChevronRight className="size-4 text-gray-500" />
                      )}
                    </div>
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

export default ResourceCategoryPicker;
