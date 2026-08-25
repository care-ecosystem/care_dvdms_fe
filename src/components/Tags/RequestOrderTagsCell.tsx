import { FC } from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { apis } from "@/apis";
import { I18N_NAMESPACE } from "@/lib/constants";
import { Badge } from "@/components/ui/badge";
import TagSelector from "@/components/Tags/TagSelector";
import { TagConfig } from "@/types/tagConfig";

type RequestOrderTagsCellProps = {
  facilityId: string;
  requestOrderId: string;
  tags: TagConfig[];
  /** Slim trigger + separate badge row, matching DeliveryOrderShow's tags block. */
  compact?: boolean;
};

const RequestOrderTagsCell: FC<RequestOrderTagsCellProps> = ({
  facilityId,
  requestOrderId,
  tags,
  compact = false,
}) => {
  const { t } = useTranslation(I18N_NAMESPACE);
  const queryClient = useQueryClient();

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["dvdms_request_orders"] });
    queryClient.invalidateQueries({
      queryKey: ["dvdms_request_order", facilityId, requestOrderId],
    });
  };

  const { mutateAsync: setTags, isPending: isSettingTags } = useMutation({
    mutationFn: (tagIds: string[]) =>
      apis.requestOrders.setTags(facilityId, requestOrderId, tagIds),
    onError: () => toast.error(t("failed_to_update_tags")),
  });

  const { mutateAsync: removeTags, isPending: isRemovingTags } = useMutation({
    mutationFn: (tagIds: string[]) =>
      apis.requestOrders.removeTags(facilityId, requestOrderId, tagIds),
    onError: () => toast.error(t("failed_to_remove_tags")),
  });

  const handleChange = async (nextTags: TagConfig[]) => {
    const prevIds = new Set(tags.map((tag) => tag.id));
    const nextIds = new Set(nextTags.map((tag) => tag.id));

    const tagsToAdd = nextTags.filter((tag) => !prevIds.has(tag.id));
    const tagsToRemove = tags.filter((tag) => !nextIds.has(tag.id));

    try {
      if (tagsToRemove.length > 0) {
        await removeTags(tagsToRemove.map((tag) => tag.id));
      }
      if (tagsToAdd.length > 0) {
        await setTags(tagsToAdd.map((tag) => tag.id));
      }
      invalidate();
      toast.success(t("tags_updated_successfully"));
    } catch {
      // errors are surfaced via the mutation onError handlers above
    }
  };

  return (
    <>
      <TagSelector
        selected={tags}
        onChange={handleChange}
        facilityId={facilityId}
        isMutating={isSettingTags || isRemovingTags}
        compact={compact}
      />
      {compact &&
        tags.map((tag) => (
          <Badge key={tag.id} variant="secondary" className="rounded-sm">
            {tag.display}
          </Badge>
        ))}
    </>
  );
};

export default RequestOrderTagsCell;
