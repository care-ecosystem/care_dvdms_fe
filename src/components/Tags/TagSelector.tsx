import { FC, useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  ArrowRight,
  Component,
  Hash,
  Loader2,
  Tag,
} from "lucide-react";

import { apis } from "@/apis";
import { I18N_NAMESPACE } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { REQUEST_ORDER_TAG_RESOURCE, TagConfig } from "@/types/tagConfig";

type TagSelectorProps = {
  selected: TagConfig[];
  onChange: (tags: TagConfig[]) => void;
  facilityId?: string;
  disabled?: boolean;
  isMutating?: boolean;
  /** Slim "Tags"/"Add Tags" trigger with no inline badges — caller renders the selected tags separately. */
  compact?: boolean;
};

const renderTagNameWithParent = (tag: TagConfig) => (
  <div className="flex items-center gap-2 max-w-xs truncate">
    <span className="text-sm flex flex-row items-center gap-1 min-w-0">
      {tag.parent && <Component className="size-3 text-black/80" />}
      {tag.parent && (
        <span className="flex gap-1 items-center shrink-0">
          <span className="text-gray-700 truncate">{tag.parent.display}</span>
          <ArrowRight className="size-3 shrink-0" />
        </span>
      )}
      <div className="size-3 rounded-full shrink-0 border bg-blue-100 border-blue-300" />
      <span className="truncate">{tag.display}</span>
    </span>
  </div>
);

const TagSelector: FC<TagSelectorProps> = ({
  selected,
  onChange,
  facilityId,
  disabled = false,
  isMutating = false,
  compact = false,
}) => {
  const { t } = useTranslation(I18N_NAMESPACE);
  const [open, setOpen] = useState(false);
  const [groupPopoverOpen, setGroupPopoverOpen] = useState<string | null>(
    null,
  );
  const [search, setSearch] = useState("");

  const { data: rootTags, isLoading: isLoadingRoot } = useQuery({
    queryKey: ["dvdms_tag_configs", facilityId, search],
    queryFn: () =>
      apis.tagConfigs.list({
        resource: REQUEST_ORDER_TAG_RESOURCE,
        status: "active",
        facility: facilityId,
        ...(search ? { display: search } : { parent_is_null: true }),
      }),
    enabled: open,
  });

  const { data: childTags, isLoading: isLoadingChildren } = useQuery({
    queryKey: ["dvdms_tag_configs", facilityId, "parent", groupPopoverOpen],
    queryFn: () =>
      apis.tagConfigs.list({
        resource: REQUEST_ORDER_TAG_RESOURCE,
        status: "active",
        facility: facilityId,
        parent: groupPopoverOpen ?? undefined,
      }),
    enabled: open && !!groupPopoverOpen,
  });

  const isSelected = (tag: TagConfig) => selected.some((t) => t.id === tag.id);

  const handleSelect = (tag: TagConfig) => {
    const parentId = tag.parent?.id;
    const alreadySelectedInGroup = selected.find(
      (t) => parentId !== undefined && t.parent?.id === parentId,
    );

    if (isSelected(tag)) {
      onChange(selected.filter((t) => t.id !== tag.id));
    } else {
      onChange([
        ...selected.filter((t) => t.id !== alreadySelectedInGroup?.id),
        tag,
      ]);
    }
  };

  const otherTags =
    rootTags?.results.filter((tag) => !tag.has_children && !isSelected(tag)) ??
    [];
  const groupTags = rootTags?.results.filter((tag) => tag.has_children) ?? [];

  const triggerButton = compact ? (
    <Button type="button" variant="outline" size="xs" disabled={disabled}>
      <Hash className="size-3" />
      {selected.length > 0 ? t("tags") : t("add_tags")}
    </Button>
  ) : (
    <Button
      type="button"
      variant="outline"
      className={cn(
        "h-10",
        selected.length > 0 && "border-blue-300 bg-blue-50 h-auto",
      )}
      disabled={disabled || isMutating}
    >
      <div className="flex items-center gap-2 min-w-0 w-full">
        {isMutating ? (
          <Loader2 className="size-3 animate-spin" />
        ) : (
          <Tag className="size-3" />
        )}
        {isMutating ? (
          <span>{t("updating_tags")}</span>
        ) : selected.length > 0 ? (
          <div className="flex gap-1 flex-wrap min-w-0 w-full overflow-hidden">
            {selected.slice(0, 3).map((tag) => (
              <Badge
                key={tag.id}
                className="bg-blue-100 text-blue-900 border-blue-300 whitespace-normal wrap-break-word"
              >
                {tag.display}
              </Badge>
            ))}
            {selected.length > 3 && (
              <Badge className="bg-gray-100 text-gray-900 border-gray-300 shrink-0">
                +{selected.length - 3} {t("more")}
              </Badge>
            )}
          </div>
        ) : (
          <span>{t("add_tags")}</span>
        )}
      </div>
    </Button>
  );

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>{triggerButton}</DropdownMenuTrigger>
      <DropdownMenuContent className="w-72 p-0" align="start">
        <div className="flex items-center gap-2 p-2 border-b border-gray-200">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => setOpen(false)}
            className="size-6 p-0"
          >
            <ArrowLeft className="size-4" />
          </Button>
          <span className="text-sm font-medium">{t("tags")}</span>
        </div>

        <div className="p-2 max-h-80 overflow-y-auto">
          <Input
            placeholder={t("search_tags")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-8 mb-2"
          />

          {selected.length > 0 && (
            <>
              <div className="px-2 py-0.5 text-xs font-medium text-gray-500 uppercase tracking-wide">
                {t("selected_tags")}
              </div>
              {selected.map((tag) => (
                <div
                  key={tag.id}
                  className="rounded-sm text-sm flex items-center gap-2 px-2 py-2.5 cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSelect(tag)}
                >
                  <Checkbox checked className="size-4" />
                  {renderTagNameWithParent(tag)}
                </div>
              ))}
            </>
          )}

          {isLoadingRoot ? (
            <div className="px-2 py-4 text-sm text-gray-500 text-center">
              {t("loading")}
            </div>
          ) : !rootTags?.results.length ? (
            <div className="px-2 py-4 text-sm text-gray-500 text-center">
              {t("no_tags_found")}
            </div>
          ) : (
            <div>
              {groupTags.length > 0 && (
                <>
                  <div className="bg-gray-200 -mx-1 my-1 h-px" />
                  <div className="px-2 py-1 text-xs font-medium text-gray-500 uppercase tracking-wide mt-2">
                    {t("tag_groups")}
                  </div>
                  {groupTags.map((tag) => (
                    <Popover
                      key={tag.id}
                      open={groupPopoverOpen === tag.id}
                      onOpenChange={(next) =>
                        setGroupPopoverOpen(next ? tag.id : null)
                      }
                    >
                      <PopoverTrigger asChild>
                        <div className="cursor-default rounded-sm text-sm flex items-center gap-2 px-2 py-2.5 hover:bg-gray-100">
                          <div className="flex items-center gap-2 flex-1 justify-between">
                            <div className="flex items-center gap-1">
                              <Component className="size-4 text-black/80" />
                              <span className="text-sm">{tag.display}</span>
                            </div>
                            <Badge className="border-gray-300 bg-gray-100 text-gray-900 text-xs p-0.5">
                              {t("group")}
                            </Badge>
                          </div>
                          <ArrowRight className="ml-auto size-4" />
                        </div>
                      </PopoverTrigger>
                      <PopoverContent
                        className="w-64 p-0"
                        side="right"
                        align="start"
                        sideOffset={5}
                      >
                        <div className="p-2 border-b border-gray-200">
                          <div className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                            {tag.display}
                          </div>
                        </div>
                        {isLoadingChildren ? (
                          <div className="p-2 text-sm text-gray-500">
                            {t("loading")}
                          </div>
                        ) : childTags?.results.length ? (
                          childTags.results.map((childTag) => (
                            <div
                              key={childTag.id}
                              className="text-sm flex items-center gap-2 px-2 py-1 cursor-pointer hover:bg-gray-100"
                              onClick={() => handleSelect(childTag)}
                            >
                              <Checkbox
                                checked={isSelected(childTag)}
                                className="size-4"
                              />
                              <div className="flex items-center gap-2 flex-1">
                                <div className="size-3 rounded-full shrink-0 border bg-green-100 border-green-300" />
                                <span className="text-sm">
                                  {childTag.display}
                                </span>
                              </div>
                            </div>
                          ))
                        ) : (
                          <div className="p-2 text-sm text-gray-500">
                            {t("no_tags_found")}
                          </div>
                        )}
                      </PopoverContent>
                    </Popover>
                  ))}
                </>
              )}

              {otherTags.length > 0 && (
                <>
                  <div className="bg-gray-200 -mx-1 my-1 h-px" />
                  <div className="px-2 py-1 text-xs font-medium text-gray-500 uppercase tracking-wide mt-2">
                    {t("other_tags")}
                  </div>
                  {otherTags.map((tag) => (
                    <div
                      key={tag.id}
                      className="rounded-sm text-sm flex items-center gap-2 px-2 py-2.5 cursor-pointer hover:bg-gray-100"
                      onClick={() => handleSelect(tag)}
                    >
                      <Checkbox checked={isSelected(tag)} className="size-4" />
                      {renderTagNameWithParent(tag)}
                    </div>
                  ))}
                </>
              )}
            </div>
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default TagSelector;
