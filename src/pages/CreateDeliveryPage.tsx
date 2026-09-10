import { FC, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { navigate, useQueryParams } from "raviger";
import { useForm } from "react-hook-form";
import { XIcon } from "lucide-react";
import { toast } from "sonner";

import { apis } from "@/apis";
import { BatchError, performSuperBatchRequest } from "@/apis/query";
import { HttpMethod } from "@/apis/types";
import { I18N_NAMESPACE, LIST_FETCH_LIMIT } from "@/lib/constants";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { ShortcutBadge } from "@/components/keyboardShortcutComponents";
import SupplierSelect from "@/components/SupplierSelect";
import {
  ShortcutProvider,
  useShortcutSubContext,
} from "@/context/ShortcutContext";
import { Organization } from "@/types/organization";
import { DeliveryOrderStatus } from "@/types/deliveryOrder";
import { RecordDeliveryStatus } from "@/types/recordOrder";
import { REQUEST_ORDER_STATUS_VARIANTS } from "@/types/requestOrder";
import {
  SuperBatchReplacement,
  SuperBatchRequestItem,
} from "@/types/superBatch";
import useRecordInwardDeliveries from "@/hooks/useRecordInwardDeliveries";

type CreateDeliveryPageProps = {
  facilityId: string;
  locationId: string;
  requestOrderId: string;
  recordOrderId: string;
};

const INWARD_RECORD_REF = "inward-record";
const DELIVERY_ORDER_REF = "delivery-order";
const RECORD_DELIVERY_REF = "record-delivery";
/** Placeholder the super batch swaps for the inward record it just created. */
const INWARD_RECORD_URL_TOKEN = "inward_record";

type DeliveryFormValues = {
  name: string;
  note: string;
  supplier?: Organization;
};

const CreateDeliveryPage: FC<CreateDeliveryPageProps> = (props) => (
  <ShortcutProvider>
    <CreateDeliveryPageContent {...props} />
  </ShortcutProvider>
);

const CreateDeliveryPageContent: FC<CreateDeliveryPageProps> = ({
  facilityId,
  locationId,
  requestOrderId,
  recordOrderId,
}) => {
  const { t } = useTranslation(I18N_NAMESPACE);
  useShortcutSubContext("facility:inventory");
  const queryClient = useQueryClient();
  const hasSubmitted = useRef(false);

  const [{ issue: issueId }] = useQueryParams<{ issue?: string }>();

  const returnPath = `/facility/${facilityId}/locations/${locationId}/inventory/external/dvdms/${requestOrderId}/record/${recordOrderId}`;

  const { data: institute } = useQuery({
    queryKey: ["dvdms_institute", facilityId],
    queryFn: () => apis.institutes.get(facilityId),
  });

  const { data: recordOrdersData, isLoading: isRecordOrderLoading } = useQuery({
    queryKey: ["dvdms_record_order_status", institute?.id, requestOrderId],
    queryFn: () =>
      apis.recordOrders.list(institute!.id, {
        order: requestOrderId,
        limit: LIST_FETCH_LIMIT,
      }),
    enabled: !!institute?.id,
  });
  const recordOrder = recordOrdersData?.results?.find(
    (item) => item.id === recordOrderId,
  );

  const { data: outwardData, isLoading: isOutwardLoading } = useQuery({
    queryKey: ["dvdms_record_order_outward", institute?.id, recordOrder?.id],
    queryFn: () =>
      apis.recordOrderOutward.list(institute!.id, recordOrder!.id, {
        limit: 1,
      }),
    enabled: !!institute?.id && !!recordOrder?.id,
  });
  const outward = outwardData?.results?.[0];

  const {
    inwardRecord,
    deliveries: recordDeliveries,
    isLoading: isInwardRecordLoading,
  } = useRecordInwardDeliveries(institute?.id, outward?.id, {
    inwardRecordId: issueId,
  });

  const form = useForm<DeliveryFormValues>({
    defaultValues: {
      name: "",
      note: "",
      supplier: undefined,
    },
  });

  useEffect(() => {
    if (!recordOrder) return;
    form.reset({
      name: recordOrder.name,
      note: "",
      supplier: recordOrder.institute_supplier
        ? {
            id: recordOrder.institute_supplier.supplier.id,
            name: recordOrder.institute_supplier.supplier.name,
            org_type: recordOrder.institute_supplier.supplier.org_type,
          }
        : undefined,
    });
  }, [recordOrder, form]);

  useEffect(() => {
    if (
      hasSubmitted.current ||
      isInwardRecordLoading ||
      !inwardRecord ||
      recordDeliveries.length === 0
    )
      return;
    toast.info(t("delivery_already_created"));
    navigate(returnPath, { replace: true });
  }, [inwardRecord, recordDeliveries, isInwardRecordLoading, returnPath, t]);

  const { mutate: createDeliveryOrder, isPending: isCreating } = useMutation({
    onMutate: () => {
      hasSubmitted.current = true;
    },
    mutationFn: async () => {
      if (
        !institute?.id ||
        !outward?.id ||
        !outward.eaushadhi_indent_no ||
        !recordOrder?.id
      ) {
        throw new Error("Missing DVDMS indent number for this outward record");
      }
      const instituteId = institute.id;

      const requests: SuperBatchRequestItem[] = [];
      const replacements: SuperBatchReplacement[] = [];

      if (!inwardRecord) {
        requests.push({
          reference_id: INWARD_RECORD_REF,
          url: apis.recordInwards.listPath(instituteId),
          method: HttpMethod.POST,
          body: {
            eaushadhi_issue_no: outward.eaushadhi_indent_no,
            outward_record: outward.id,
          },
        });
        replacements.push({
          source_path: { reference_id: INWARD_RECORD_REF, path: "id" },
          value_path: {
            reference_id: RECORD_DELIVERY_REF,
            path: INWARD_RECORD_URL_TOKEN,
            type: "url",
          },
        });
      }

      requests.push({
        reference_id: DELIVERY_ORDER_REF,
        url: apis.deliveryOrders.listPath(facilityId),
        method: HttpMethod.POST,
        body: {
          status: DeliveryOrderStatus.draft,
          name: form.getValues("name"),
          note: form.getValues("note") || undefined,
          supplier: form.getValues("supplier")?.id,
          destination: locationId,
          extensions: {},
        },
      });
      replacements.push({
        source_path: { reference_id: DELIVERY_ORDER_REF, path: "id" },
        value_path: {
          reference_id: RECORD_DELIVERY_REF,
          path: "delivery_order",
        },
      });

      requests.push({
        reference_id: RECORD_DELIVERY_REF,
        url: apis.recordInwards.deliveriesPath(
          instituteId,
          inwardRecord?.id ?? `{${INWARD_RECORD_URL_TOKEN}}`,
        ),
        method: HttpMethod.POST,
        body: {
          delivery_order: "",
          record_order: recordOrder.id,
          status: RecordDeliveryStatus.pending,
        },
        replacements,
      });

      const results = await performSuperBatchRequest({ requests });
      const dataByRef = new Map(
        results.map((result) => [result.reference_id, result.data]),
      );
      const deliveryOrderId = (
        dataByRef.get(DELIVERY_ORDER_REF) as { id?: string } | undefined
      )?.id;
      const inwardRecordId =
        inwardRecord?.id ??
        (dataByRef.get(INWARD_RECORD_REF) as { id?: string } | undefined)?.id;

      if (!deliveryOrderId || !inwardRecordId) {
        throw new Error("Super batch did not return the created records");
      }

      return { deliveryOrderId, inwardRecordId };
    },
    onSuccess: ({ deliveryOrderId, inwardRecordId }) => {
      toast.success(t("delivery_order_created_successfully"));
      queryClient.invalidateQueries({ queryKey: ["dvdms_record_inwards"] });
      queryClient.invalidateQueries({ queryKey: ["dvdms_record_deliveries"] });
      navigate(
        `${returnPath}/delivery/${deliveryOrderId}?issue=${inwardRecordId}`,
        { replace: true },
      );
    },
    onError: (error: unknown) => {
      const message =
        error instanceof BatchError ? error.errorMessages[0] : undefined;
      toast.error(message || t("failed_to_create_delivery_order"));
    },
  });

  const onSubmit = form.handleSubmit(() => createDeliveryOrder());

  const isLoadingContext =
    isRecordOrderLoading || isOutwardLoading || isInwardRecordLoading;

  return (
    <div className="md:px-6 py-0 min-w-0">
      <div className="container mx-auto max-w-6xl">
        <div className="flex justify-between items-start mb-6">
          <div>
            <h1 className="text-xl font-semibold text-gray-900">
              {t("create_delivery")}
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              {t("create_delivery_description")}
            </p>
          </div>
          <Button
            variant="outline"
            size="icon"
            onClick={() => navigate(returnPath)}
          >
            <XIcon className="size-5" />
            <span className="sr-only">{t("close")}</span>
          </Button>
        </div>

        {isLoadingContext ? (
          <div className="space-y-4">
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-64 w-full" />
          </div>
        ) : (
          <div className="space-y-4">
            <Card>
              <CardContent className="space-y-1 p-4">
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
                  <div>
                    <label className="text-sm font-medium text-gray-700">
                      {t("deliver_to")}
                    </label>
                    <div className="text-lg font-semibold text-gray-950">
                      {recordOrder?.institute_store?.store.name ?? "—"}
                    </div>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700">
                      {t("supplier")}
                    </label>
                    <div className="text-lg font-semibold text-gray-950">
                      {recordOrder?.institute_supplier?.supplier?.name ?? "—"}
                    </div>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700">
                      {t("status")}
                    </label>
                    <div>
                      <Badge
                        className="rounded-sm"
                        variant={
                          REQUEST_ORDER_STATUS_VARIANTS[
                            DeliveryOrderStatus.draft
                          ] ?? "secondary"
                        }
                      >
                        {t(DeliveryOrderStatus.draft)}
                      </Badge>
                    </div>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700 whitespace-nowrap">
                      {t("eaushadhi_indent_status")}
                    </label>
                    <div>
                      <Badge className="rounded-sm" variant="secondary">
                        {outward?.eaushadhi_indent_status ?? "—"}
                      </Badge>
                    </div>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700">
                      {t("care_indent_no")}
                    </label>
                    <div className="text-lg font-semibold text-gray-950">
                      {recordOrder?.care_indent_no ?? "—"}
                    </div>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700">
                      {t("eaushadhi_indent_no")}
                    </label>
                    <div className="text-lg font-semibold text-gray-950">
                      {outward?.eaushadhi_indent_no ?? "—"}
                    </div>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700">
                      {t("issue_no")}
                    </label>
                    <div className="text-lg font-semibold text-gray-950">
                      {inwardRecord?.eaushadhi_issue_no ?? "—"}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Form {...form}>
              <form onSubmit={onSubmit} className="space-y-6">
                <input type="submit" hidden />
                <Card className="p-0 bg-white">
                  <CardContent className="space-y-4 p-4 rounded-md">
                    <FormField
                      control={form.control}
                      name="name"
                      rules={{ required: true }}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t("name")}</FormLabel>
                          <FormControl>
                            <Input
                              className="h-9"
                              placeholder={t("name")}
                              {...field}
                              autoFocus
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="supplier"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t("supplier")}</FormLabel>
                          <FormControl>
                            <SupplierSelect
                              value={field.value}
                              onChange={field.onChange}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="note"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t("note")}</FormLabel>
                          <FormControl>
                            <Input
                              className="h-9"
                              placeholder={t("note")}
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="border-t border-gray-200 pt-4 flex justify-end space-x-3">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => navigate(returnPath)}
                      >
                        {t("cancel")}
                        <ShortcutBadge actionId="cancel-action" />
                      </Button>
                      <Button type="submit" disabled={isCreating}>
                        {isCreating ? t("creating") : t("create")}
                        <ShortcutBadge actionId="enter-action" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </form>
            </Form>
          </div>
        )}
      </div>
    </div>
  );
};

export default CreateDeliveryPage;
