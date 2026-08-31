import { FC, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery } from "@tanstack/react-query";
import { navigate } from "raviger";
import { useForm } from "react-hook-form";
import { XIcon } from "lucide-react";
import { toast } from "sonner";

import { apis } from "@/apis";
import { I18N_NAMESPACE } from "@/lib/constants";
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
import useRecordInwardDeliveries from "@/hooks/useRecordInwardDeliveries";

type CreateDeliveryPageProps = {
  facilityId: string;
  locationId: string;
  requestOrderId: string;
};

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
}) => {
  const { t } = useTranslation(I18N_NAMESPACE);
  useShortcutSubContext("facility:inventory");

  const returnPath = `/facility/${facilityId}/locations/${locationId}/inventory/external/dvdms/${requestOrderId}`;

  const { data: institute } = useQuery({
    queryKey: ["dvdms_institute", facilityId],
    queryFn: () => apis.institutes.get(facilityId),
  });

  const { data: recordOrdersData, isLoading: isRecordOrderLoading } = useQuery(
    {
      queryKey: ["dvdms_record_order_status", institute?.id, requestOrderId],
      queryFn: () =>
        apis.recordOrders.list(institute!.id, {
          order: requestOrderId,
          limit: 1,
        }),
      enabled: !!institute?.id,
    },
  );
  const recordOrder = recordOrdersData?.results?.[0];

  const { data: outwardData, isLoading: isOutwardLoading } = useQuery({
    queryKey: ["dvdms_record_order_outward", institute?.id, recordOrder?.id],
    queryFn: () =>
      apis.recordOrderOutward.list(institute!.id, recordOrder!.id, {
        limit: 1,
      }),
    enabled: !!institute?.id && !!recordOrder?.id,
  });
  const outward = outwardData?.results?.[0];

  const { inwardRecord, isLoading: isInwardRecordLoading } =
    useRecordInwardDeliveries(institute?.id, outward?.id);

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

  const { mutate: createDeliveryOrder, isPending: isCreating } = useMutation({
    mutationFn: async () => {
      const deliveryOrder = await apis.deliveryOrders.create(facilityId, {
        status: DeliveryOrderStatus.draft,
        name: form.getValues("name"),
        note: form.getValues("note") || undefined,
        supplier: form.getValues("supplier")?.id,
        destination: locationId,
        extensions: {},
      });

      if (
        !institute?.id ||
        !outward?.id ||
        !outward.eaushadhi_indent_no ||
        !recordOrder?.id
      ) {
        throw new Error("Missing DVDMS indent number for this outward record");
      }

      const resolvedInwardRecord =
        inwardRecord ??
        (await apis.recordInwards.create(institute.id, {
          eaushadhi_issue_no: outward.eaushadhi_indent_no,
          outward_record: outward.id,
        }));

      await apis.recordInwards.createDelivery(institute.id, resolvedInwardRecord.id, {
        delivery_order: deliveryOrder.id,
        record_order: recordOrder.id,
        status: RecordDeliveryStatus.pending,
      });

      return deliveryOrder;
    },
    onSuccess: (deliveryOrder) => {
      toast.success(t("delivery_order_created_successfully"));
      navigate(`${returnPath}/create-delivery/${deliveryOrder.id}`, {
        replace: true,
      });
    },
    onError: () => toast.error(t("failed_to_create_delivery_order")),
  });

  const onSubmit = form.handleSubmit(() => createDeliveryOrder());

  const isLoadingContext =
    isRecordOrderLoading || isOutwardLoading || isInwardRecordLoading;

  return (
    <div className="md:px-6 py-0 min-w-0">
      <div className="container mx-auto max-w-3xl">
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
            <Card className="bg-white">
              <CardContent className="grid sm:grid-cols-4 gap-4 py-4">
                <div>
                  <p className="text-xs font-medium text-gray-500 uppercase">
                    {t("care_indent_no")}
                  </p>
                  <p className="font-semibold text-gray-950">
                    {recordOrder?.care_indent_no ?? "—"}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-medium text-gray-500 uppercase">
                    {t("eaushadhi_indent_no")}
                  </p>
                  <p className="font-semibold text-gray-950">
                    {outward?.eaushadhi_indent_no ?? "—"}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-medium text-gray-500 uppercase">
                    {t("eaushadhi_indent_status")}
                  </p>
                  <Badge className="rounded-sm" variant="secondary">
                    {outward?.eaushadhi_indent_status ?? "—"}
                  </Badge>
                </div>
                <div>
                  <p className="text-xs font-medium text-gray-500 uppercase">
                    {t("deliver_to")}
                  </p>
                  <p className="font-semibold text-gray-950">
                    {recordOrder?.institute_store?.store.name ?? "—"}
                  </p>
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
