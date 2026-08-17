import { FC, useEffect, useRef } from "react";
import { navigate } from "raviger";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useFieldArray, useForm } from "react-hook-form";
import { PlusIcon, Trash2Icon } from "lucide-react";
import { toast } from "sonner";

import { apis } from "@/apis";
import { I18N_NAMESPACE } from "@/lib/constants";
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

const SUPPLIER_ORG_TYPE = "product_supplier";
const EMPTY_STORES: DvdmsLookupStore[] = [];
const EMPTY_SUPPLIERS: Organization[] = [];
const NEW_SUPPLIER_ROW: DvdmsSupplierMapping = {
  eaushadhi_store_id: "",
  eaushadhi_store_name: "",
  eaushadhi_warehouse_id: "",
  eaushadhi_warehouse_name: "",
  location: null,
  supplier_id: "",
  is_default: false,
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

  const invalidateMappingQueries = () => {
    queryClient.invalidateQueries({
      queryKey: ["dvdms_store_mappings", facilityId, institute?.id],
    });
    queryClient.invalidateQueries({
      queryKey: ["dvdms_supplier_mappings", institute?.id],
    });
  };

  const { mutate: saveInstitute, isPending: isSaving } = useMutation({
    mutationFn: (payload: DvdmsInstitutePayload) =>
      institute
        ? apis.institutes.update(facilityId, payload)
        : apis.institutes.create(facilityId, payload),
    onSuccess: async (savedInstitute) => {
      try {
        if (hasInstitute) {
          const rows = form.getValues("suppliers");
          for (const row of rows) {
            if (!row.store_mapping_id && row.location) {
              await apis.storeMappings.create(facilityId, savedInstitute.id, {
                store: row.location.id,
                eaushadhi_store_id: row.eaushadhi_store_id,
                eaushadhi_store_name: row.eaushadhi_store_name,
                is_default: row.is_default,
              });
            }
            if (!row.supplier_mapping_id && row.supplier_id) {
              await apis.supplierMappings.create(savedInstitute.id, {
                supplier: row.supplier_id,
                eaushadhi_warehouse_id: row.eaushadhi_warehouse_id,
                eaushadhi_warehouse_name: row.eaushadhi_warehouse_name,
                is_default: row.is_default,
              });
            }
          }
        }
        toast.success(t("dvdms_institute_save_success"));
        queryClient.invalidateQueries({
          queryKey: ["dvdms_institute", facilityId],
        });
        invalidateMappingQueries();
      } catch (error: unknown) {
        const message = (error as { message?: string })?.message;
        toast.error(message || t("dvdms_mapping_save_error"));
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
        disable_auto_sync: false,
        allow_manual_entry: false,
      },
      suppliers: [{ ...NEW_SUPPLIER_ROW, is_default: true }],
    },
  });

  useEffect(() => {
    if (!institute) return;
    form.reset({
      ...form.getValues(),
      eaushadhi_institute_id: institute.eaushadhi_institute_id,
      eaushadhi_user_ref_id: institute.eaushadhi_user_ref_id,
      eaushadhi_institute_name: institute.eaushadhi_institute_name,
      schema_version: institute.schema_version,
    });
  }, [institute]);

  const { fields, append, remove, replace } = useFieldArray({
    control: form.control,
    name: "suppliers",
  });

  const hydratedInstituteId = useRef<string | null>(null);

  useEffect(() => {
    if (!institute) {
      hydratedInstituteId.current = null;
      return;
    }
    if (!storeMappingsData || !supplierMappingsData) return;
    // Only hydrate once per institute load — after that, the form is the
    // source of truth and server refetches (from saves/deletes) must not
    // clobber rows the user is still editing.
    if (hydratedInstituteId.current === institute.id) return;

    const storeRows = storeMappingsData.results;
    const supplierRows = supplierMappingsData.results;
    const count = Math.max(storeRows.length, supplierRows.length);
    if (count > 0) {
      const rows: DvdmsSupplierMapping[] = Array.from(
        { length: count },
        (_, i) => {
          const store = storeRows[i];
          const supplier = supplierRows[i];
          return {
            eaushadhi_store_id: store?.eaushadhi_store_id ?? "",
            eaushadhi_store_name: store?.eaushadhi_store_name ?? "",
            eaushadhi_warehouse_id: supplier?.eaushadhi_warehouse_id ?? "",
            eaushadhi_warehouse_name: supplier?.eaushadhi_warehouse_name ?? "",
            location: store?.store ?? null,
            supplier_id: supplier?.supplier?.id ?? "",
            is_default: store?.is_default || supplier?.is_default || false,
            store_mapping_id: store?.id,
            supplier_mapping_id: supplier?.id,
          };
        },
      );
      replace(rows);
    }
    hydratedInstituteId.current = institute.id;
  }, [institute, storeMappingsData, supplierMappingsData, replace]);

  const { data: suppliersData } = useQuery({
    queryKey: ["dvdms_supplier_organizations"],
    queryFn: () =>
      apis.organizations.list({ org_type: SUPPLIER_ORG_TYPE, limit: 100 }),
  });
  const supplierOptions = suppliersData?.results ?? EMPTY_SUPPLIERS;

  const addSupplier = () => {
    append(NEW_SUPPLIER_ROW, { shouldFocus: false });
    form.clearErrors("suppliers");
  };

  const setDefaultSupplier = (index: number) => {
    fields.forEach((_, i) => {
      form.setValue(`suppliers.${i}.is_default`, i === index);
    });
  };

  const removeSupplier = async (index: number) => {
    const row = form.getValues(`suppliers.${index}`);
    try {
      if (row.store_mapping_id) {
        await apis.storeMappings.delete(
          facilityId,
          institute!.id,
          row.store_mapping_id,
        );
      }
      if (row.supplier_mapping_id) {
        await apis.supplierMappings.delete(
          institute!.id,
          row.supplier_mapping_id,
        );
      }
    } catch (error: unknown) {
      const message = (error as { message?: string })?.message;
      toast.error(message || t("dvdms_mapping_delete_error"));
      return;
    }
    remove(index);
    invalidateMappingQueries();
  };

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
                if (hasInstitute && fields.length === 0) {
                  form.setError("suppliers", {
                    type: "manual",
                    message: t("suppliers_required"),
                  });
                  return;
                }
                saveInstitute({
                  eaushadhi_institute_id: values.eaushadhi_institute_id,
                  eaushadhi_user_ref_id: values.eaushadhi_user_ref_id,
                  eaushadhi_institute_name: values.eaushadhi_institute_name,
                  schema_version: values.schema_version,
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
                            placeholder={t("eaushadhi_institute_id_placeholder")}
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
                    name="eaushadhi_institute_name"
                    rules={{ required: t("eaushadhi_institute_name_required") }}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel aria-required>
                          {t("eaushadhi_institute_name")}
                        </FormLabel>
                        <FormControl>
                          <Input
                            placeholder={t("eaushadhi_institute_name_placeholder")}
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

                <div className="space-y-3">
                  {fields.map((field, index) => (
                    <div
                      key={field.id}
                      className="relative border border-gray-200 rounded-lg p-3 pt-5"
                    >
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => removeSupplier(index)}
                        className="absolute top-1 right-1 shrink-0 hover:bg-white hover:text-gray-900"
                        aria-label={t("remove_supplier")}
                      >
                        <Trash2Icon className="size-4" />
                      </Button>
                      <div className="space-y-3">
                        <FormField
                          control={form.control}
                          name={`suppliers.${index}.eaushadhi_store_id`}
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
                                      `suppliers.${index}.eaushadhi_store_name`,
                                      store?.hststrStoreName ?? "",
                                    );
                                    form.setValue(
                                      `suppliers.${index}.eaushadhi_warehouse_id`,
                                      store ? String(store.hstnumParentStoreId) : "",
                                    );
                                    form.setValue(
                                      `suppliers.${index}.eaushadhi_warehouse_name`,
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
                            name={`suppliers.${index}.location`}
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
                            name={`suppliers.${index}.eaushadhi_warehouse_name`}
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
                          name={`suppliers.${index}.supplier_id`}
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

                        <FormField
                          control={form.control}
                          name={`suppliers.${index}.is_default`}
                          render={({ field }) => (
                            <FormItem className="flex items-center gap-2 space-y-0 mt-4">
                              <FormControl>
                                <Switch
                                  checked={field.value}
                                  onCheckedChange={(checked) => {
                                    if (checked) {
                                      setDefaultSupplier(index);
                                    } else {
                                      field.onChange(false);
                                    }
                                  }}
                                />
                              </FormControl>
                              <FormLabel className="text-xs text-gray-600 cursor-pointer">
                                {t("set_as_default")}
                              </FormLabel>
                            </FormItem>
                          )}
                        />
                      </div>
                    </div>
                  ))}

                  <Button
                    type="button"
                    variant="outline"
                    onClick={addSupplier}
                    className="w-full"
                  >
                    <PlusIcon className="mr-2 size-4" />
                    {t("add_supplier")}
                  </Button>

                  {form.formState.errors.suppliers?.message && (
                    <p className="text-sm text-red-500">
                      {form.formState.errors.suppliers.message}
                    </p>
                  )}
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
                    name="meta.disable_auto_sync"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-start justify-between">
                        <div className="space-y-0.5">
                          <FormLabel className="text-sm font-medium text-gray-900">
                            {t("disable_auto_sync")}
                          </FormLabel>
                          <FormDescription>
                            {t("disable_auto_sync_description")}
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

                  <FormField
                    control={form.control}
                    name="meta.allow_manual_entry"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-start justify-between">
                        <div className="space-y-0.5">
                          <FormLabel className="text-sm font-medium text-gray-900">
                            {t("allow_manual_entry")}
                          </FormLabel>
                          <FormDescription>
                            {t("allow_manual_entry_description")}
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
