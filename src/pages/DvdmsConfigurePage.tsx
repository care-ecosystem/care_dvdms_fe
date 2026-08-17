import { FC, useEffect } from "react";
import { navigate } from "raviger";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { apis } from "@/apis";
import { I18N_NAMESPACE } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { LocationPicker } from "@/components/LocationPicker";
import { EaushadhiStorePicker } from "@/components/EaushadhiStorePicker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  DvdmsFacilityConfig,
  DvdmsInstitutePayload,
  DvdmsLookupStore,
  DvdmsSupplierMapping,
} from "@/types/dvdms_config";
import { Organization } from "@/types/organization";

const getErrorMessage = (error: unknown) =>
  (error as { message?: string })?.message;

const SUPPLIER_ORG_TYPE = "product_supplier";
const EMPTY_STORES: DvdmsLookupStore[] = [];
const EMPTY_SUPPLIERS: Organization[] = [];
const EMPTY_MAPPING: DvdmsSupplierMapping = {
  eaushadhi_store_id: "",
  eaushadhi_store_name: "",
  eaushadhi_warehouse_id: "",
  eaushadhi_warehouse_name: "",
  location: null,
  supplier_id: "",
};

type DvdmsConfigurePageProps = {
  facilityId: string;
};

const DvdmsConfigurePage: FC<DvdmsConfigurePageProps> = ({ facilityId }) => {
  const { t } = useTranslation(I18N_NAMESPACE);
  const queryClient = useQueryClient();

  const { data: facility } = useQuery({
    queryKey: ["facility", facilityId],
    queryFn: () => apis.facilities.get(facilityId),
  });

  const { data: institute } = useQuery({
    queryKey: ["dvdms_institute", facilityId],
    queryFn: () => apis.institutes.get(facilityId),
  });
  const hasInstitute = !!institute;

  const { data: stores } = useQuery({
    queryKey: ["dvdms_lookup_stores", institute?.id],
    queryFn: () => apis.institutes.lookupStores(institute!.id),
    enabled: hasInstitute,
  });
  const storeOptions = stores ?? EMPTY_STORES;

  const { data: storeMappingsData } = useQuery({
    queryKey: ["dvdms_store_mappings", facilityId, institute?.id],
    queryFn: () => apis.storeMappings.list(facilityId, institute!.id),
    enabled: hasInstitute,
  });

  const { data: supplierMappingsData } = useQuery({
    queryKey: ["dvdms_supplier_mappings", institute?.id],
    queryFn: () => apis.supplierMappings.list(institute!.id),
    enabled: hasInstitute,
  });

  const { mutate: saveInstitute, isPending: isSaving } = useMutation({
    mutationFn: (payload: DvdmsInstitutePayload) =>
      institute
        ? apis.institutes.update(facilityId, payload)
        : apis.institutes.create(facilityId, payload),
    onSuccess: async (savedInstitute) => {
      try {
        if (hasInstitute) {
          const row = form.getValues("mapping");

          if (row.store_mapping_id) {
            await apis.storeMappings.update(
              facilityId,
              savedInstitute.id,
              row.store_mapping_id,
              {
                store: row.location?.id,
                eaushadhi_store_id: row.eaushadhi_store_id,
                eaushadhi_store_name: row.eaushadhi_store_name,
              },
            );
          } else if (row.location) {
            const created = await apis.storeMappings.create(
              facilityId,
              savedInstitute.id,
              {
                store: row.location.id,
                eaushadhi_store_id: row.eaushadhi_store_id,
                eaushadhi_store_name: row.eaushadhi_store_name,
                is_default: true,
              },
            );
            form.setValue("mapping.store_mapping_id", created.id);
          }

          if (row.supplier_mapping_id) {
            await apis.supplierMappings.update(
              savedInstitute.id,
              row.supplier_mapping_id,
              {
                supplier: row.supplier_id,
                eaushadhi_warehouse_id: row.eaushadhi_warehouse_id,
                eaushadhi_warehouse_name: row.eaushadhi_warehouse_name,
              },
            );
          } else if (row.supplier_id) {
            const created = await apis.supplierMappings.create(
              savedInstitute.id,
              {
                supplier: row.supplier_id,
                eaushadhi_warehouse_id: row.eaushadhi_warehouse_id,
                eaushadhi_warehouse_name: row.eaushadhi_warehouse_name,
                is_default: true,
              },
            );
            form.setValue("mapping.supplier_mapping_id", created.id);
          }
        }

        toast.success(t("dvdms_institute_save_success"));
        queryClient.invalidateQueries({
          queryKey: ["dvdms_institute", facilityId],
        });
      } catch (error: unknown) {
        toast.error(getErrorMessage(error) || t("dvdms_mapping_save_error"));
      }
    },
    onError: (error: { message?: string }) =>
      toast.error(error?.message || t("dvdms_institute_save_error")),
  });

  const form = useForm<DvdmsFacilityConfig>({
    defaultValues: {
      eaushadhi_institute_id: "",
      eaushadhi_user_ref_id: "",
      eaushadhi_institute_name: "",
      schema_version: "",
      meta: {
        allow_updating_quantity_after_received: false,
      },
      mapping: EMPTY_MAPPING,
    },
  });
  const isDirty = form.formState.isDirty;

  useEffect(() => {
    if (!institute || isDirty) return;
    form.reset({
      ...form.getValues(),
      eaushadhi_institute_id: institute.eaushadhi_institute_id,
      eaushadhi_user_ref_id: institute.eaushadhi_user_ref_id,
      eaushadhi_institute_name: institute.eaushadhi_institute_name,
      schema_version: institute.schema_version,
      meta: {
        allow_updating_quantity_after_received:
          institute.meta?.allow_updating_quantity_after_received ?? false,
      },
    });
  }, [institute, isDirty]);

  useEffect(() => {
    if (!institute || isDirty) return;
    if (!storeMappingsData || !supplierMappingsData) return;

    const store = storeMappingsData.results[0];
    const supplier = supplierMappingsData.results[0];
    if (store || supplier) {
      const mapping: DvdmsSupplierMapping = {
        eaushadhi_store_id: store?.eaushadhi_store_id ?? "",
        eaushadhi_store_name: store?.eaushadhi_store_name ?? "",
        eaushadhi_warehouse_id: supplier?.eaushadhi_warehouse_id ?? "",
        eaushadhi_warehouse_name: supplier?.eaushadhi_warehouse_name ?? "",
        location: store?.store ?? null,
        supplier_id: supplier?.supplier?.id ?? "",
        store_mapping_id: store?.id,
        supplier_mapping_id: supplier?.id,
      };
      form.setValue("mapping", mapping);
    }
  }, [institute, isDirty, storeMappingsData, supplierMappingsData]);

  const { data: suppliersData } = useQuery({
    queryKey: ["dvdms_supplier_organizations"],
    queryFn: () =>
      apis.organizations.list({ org_type: SUPPLIER_ORG_TYPE, limit: 100 }),
  });
  const supplierOptions = suppliersData?.results ?? EMPTY_SUPPLIERS;

  const goBackToFacility = () => {
    navigate(`/facility/${facilityId}/settings/general`);
  };

  const onOpenChange = (next: boolean) => {
    if (!next) {
      goBackToFacility();
    }
  };

  return (
    <Sheet open onOpenChange={onOpenChange}>
      <SheetContent
        className="w-full sm:max-w-2xl overflow-y-auto"
        closeLabel={t("close")}
      >
        <SheetHeader>
          <SheetTitle>{t("dvdms_configuration")}</SheetTitle>
          <SheetDescription>
            {t("manage_dvdms_config_for")}{" "}
            <strong>{facility?.name ?? facilityId}</strong>.
          </SheetDescription>
        </SheetHeader>

        <div className="px-1 py-5">
          <Form {...form}>
            <form
              onSubmit={form.handleSubmit((values) => {
                saveInstitute({
                  eaushadhi_institute_id: values.eaushadhi_institute_id,
                  eaushadhi_user_ref_id: values.eaushadhi_user_ref_id,
                  eaushadhi_institute_name: values.eaushadhi_institute_name,
                  schema_version: values.schema_version,
                  meta: values.meta,
                });
              })}
              className="space-y-8"
            >
              <div>
                <h3 className="text-base font-semibold text-gray-900 mb-1">
                  {t("institute_details")}
                </h3>
                <p className="text-sm text-gray-500 mb-4">
                  {t("institute_details_subtitle")}
                </p>

                <div className="space-y-4">
                  <FormField
                    control={form.control}
                    name="eaushadhi_institute_id"
                    rules={{ required: t("eaushadhi_institute_id_required") }}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel aria-required>
                          {t("eaushadhi_institute_id")}
                        </FormLabel>
                        <FormControl>
                          <Input
                            placeholder={t(
                              "eaushadhi_institute_id_placeholder",
                            )}
                            className={cn(
                              "h-9",
                              hasInstitute && "bg-gray-50 cursor-default",
                            )}
                            readOnly={hasInstitute}
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="eaushadhi_user_ref_id"
                    rules={{ required: t("eaushadhi_user_ref_id_required") }}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel aria-required>
                          {t("eaushadhi_user_ref_id")}
                        </FormLabel>
                        <FormControl>
                          <Input
                            placeholder={t("eaushadhi_user_ref_id_placeholder")}
                            className={cn(
                              "h-9",
                              hasInstitute && "bg-gray-50 cursor-default",
                            )}
                            readOnly={hasInstitute}
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="eaushadhi_institute_name"
                    rules={{ required: t("eaushadhi_institute_name_required") }}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel aria-required>
                          {t("eaushadhi_institute_name")}
                        </FormLabel>
                        <FormControl>
                          <Input
                            placeholder={t(
                              "eaushadhi_institute_name_placeholder",
                            )}
                            className="h-9"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="schema_version"
                    rules={{ required: t("schema_version_required") }}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel aria-required>
                          {t("schema_version")}
                        </FormLabel>
                        <FormControl>
                          <Input
                            placeholder={t("schema_version_placeholder")}
                            className="h-9"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              {hasInstitute && (
                <>
                  <hr className="border-gray-200" />

                  <div>
                    <h3 className="text-base font-semibold text-gray-900 mb-1">
                      {t("store_supplier_mapping")}{" "}
                      <span className="text-red-500">*</span>
                    </h3>
                    <p className="text-sm text-gray-500 mb-4">
                      {t("store_supplier_mapping_subtitle")}
                    </p>

                    <div className="relative border border-gray-200 rounded-lg p-3 pt-5">
                      <div className="space-y-3">
                        <FormField
                          control={form.control}
                          name="mapping.eaushadhi_store_id"
                          rules={{ required: t("eaushadhi_store_required") }}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel
                                aria-required
                                className="text-xs font-medium text-gray-600"
                              >
                                {t("eaushadhi_store")}
                              </FormLabel>
                              <FormControl>
                                <EaushadhiStorePicker
                                  storeOptions={storeOptions}
                                  value={field.value}
                                  onValueChange={(store) => {
                                    field.onChange(
                                      store ? String(store.hstnumStoreId) : "",
                                    );
                                    form.setValue(
                                      "mapping.eaushadhi_store_name",
                                      store?.hststrStoreName ?? "",
                                    );
                                    form.setValue(
                                      "mapping.eaushadhi_warehouse_id",
                                      store
                                        ? String(store.hstnumParentStoreId)
                                        : "",
                                    );
                                    form.setValue(
                                      "mapping.eaushadhi_warehouse_name",
                                      store?.hststrParentStoreName ?? "",
                                    );
                                  }}
                                  placeholder={t("eaushadhi_store_placeholder")}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <div className="grid grid-cols-2 gap-3 w-full">
                          <FormField
                            control={form.control}
                            name="mapping.location"
                            rules={{ required: t("location_required") }}
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel
                                  aria-required
                                  className="text-xs font-medium text-gray-600"
                                >
                                  {t("location")}
                                </FormLabel>
                                <FormControl>
                                  <LocationPicker
                                    facilityId={facilityId}
                                    value={field.value}
                                    onValueChange={field.onChange}
                                    placeholder={t("location_placeholder")}
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />

                          <FormField
                            control={form.control}
                            name="mapping.eaushadhi_warehouse_name"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-xs font-medium text-gray-600">
                                  {t("eaushadhi_warehouse_name")}
                                </FormLabel>
                                <FormControl>
                                  <Input
                                    className="h-9 bg-gray-50 cursor-default"
                                    readOnly
                                    {...field}
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>

                        <FormField
                          control={form.control}
                          name="mapping.supplier_id"
                          rules={{ required: t("supplier_required") }}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel
                                aria-required
                                className="text-xs font-medium text-gray-600"
                              >
                                {t("supplier")}
                              </FormLabel>
                              <Select
                                onValueChange={field.onChange}
                                value={field.value}
                              >
                                <FormControl>
                                  <SelectTrigger className="w-full h-9">
                                    <SelectValue
                                      placeholder={t("supplier_placeholder")}
                                    />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  {supplierOptions.map((org) => (
                                    <SelectItem key={org.id} value={org.id}>
                                      {org.name}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                    </div>
                  </div>

                  <hr className="border-gray-200" />

                  <div>
                    <h3 className="text-base font-semibold text-gray-900 mb-1">
                      {t("settings")}
                    </h3>
                    <p className="text-sm text-gray-500 mb-4">
                      {t("settings_subtitle")}
                    </p>

                    <div className="space-y-5">
                      <FormField
                        control={form.control}
                        name="meta.allow_updating_quantity_after_received"
                        render={({ field }) => (
                          <FormItem className="flex flex-row items-start justify-between">
                            <div className="space-y-0.5">
                              <FormLabel className="text-sm font-medium text-gray-900">
                                {t("allow_updating_quantity_after_received")}
                              </FormLabel>
                              <FormDescription>
                                {t(
                                  "allow_updating_quantity_after_received_description",
                                )}
                              </FormDescription>
                            </div>
                            <FormControl>
                              <Switch
                                checked={field.value}
                                onCheckedChange={field.onChange}
                              />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>
                </>
              )}

              <div className="flex justify-end mt-6 gap-3">
                <SheetClose asChild>
                  <Button type="button" variant="outline">
                    {t("cancel")}
                  </Button>
                </SheetClose>
                <Button type="submit" variant="primary" disabled={isSaving}>
                  {isSaving ? t("saving") : t("save")}
                </Button>
              </div>
            </form>
          </Form>
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default DvdmsConfigurePage;
