import {
  FC,
  SyntheticEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { navigate } from "raviger";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useFieldArray, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Loader2Icon, PlusIcon, XIcon } from "lucide-react";

import { apis } from "@/apis";
import { performSuperBatchRequest } from "@/apis/query";
import { HttpMethod } from "@/apis/types";
import { I18N_NAMESPACE } from "@/lib/constants";
import { goBack } from "@/lib/navigation";
import { LocationPicker } from "@/components/LocationPicker";
import { EaushadhiStorePicker } from "@/components/EaushadhiStorePicker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
  DvdmsStoreMeta,
  DvdmsSupplierMapping,
} from "@/types/dvdms_config";
import { LocationRead } from "@/types/location";
import { Organization } from "@/types/organization";

const getErrorMessage = (error: unknown) =>
  (error as { message?: string })?.message;

const SHOW_SUBSTORES = false;
const ID_CHANGE_WARNING_DELAY_MS = 600;
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
  const [areMappingsCleared, setAreMappingsCleared] = useState(false);
  const [isIdChangeWarningOpen, setIsIdChangeWarningOpen] = useState(false);
  const [isWarningPending, setIsWarningPending] = useState(false);
  const [areIdsEdited, setAreIdsEdited] = useState(false);
  const showMappings = hasInstitute && !areMappingsCleared && !areIdsEdited;
  const [removedStoreIds, setRemovedStoreIds] = useState<string[]>([]);

  const { data: stores } = useQuery({
    queryKey: ["dvdms_lookup_stores", institute?.id],
    queryFn: () => apis.institutes.lookupStores(institute!.id),
    enabled: hasInstitute,
  });
  const storeOptions = stores ?? EMPTY_STORES;

  const storeMeta = (storeId: string): DvdmsStoreMeta | undefined => {
    const store = storeOptions.find(
      (option) => String(option.hstnumStoreId) === storeId,
    );
    return (
      store && {
        sststrTypeName: store.sststrTypeName,
        hstnumParentStoreId: store.hstnumParentStoreId,
        hststrParentStoreName: store.hststrParentStoreName,
        parentTypeName: store.parentTypeName,
      }
    );
  };

  const { data: defaultStoreMappingsData } = useQuery({
    queryKey: ["dvdms_store_mappings", facilityId, institute?.id, "default"],
    queryFn: () =>
      apis.storeMappings.list(facilityId, institute!.id, { is_default: true }),
    enabled: hasInstitute,
  });

  const { data: substoreMappingsData } = useQuery({
    queryKey: ["dvdms_store_mappings", facilityId, institute?.id, "substores"],
    queryFn: () =>
      apis.storeMappings.list(facilityId, institute!.id, {
        is_default: false,
      }),
    enabled: hasInstitute,
  });

  const { data: supplierMappingsData } = useQuery({
    queryKey: ["dvdms_supplier_mappings", institute?.id, "default"],
    queryFn: () =>
      apis.supplierMappings.list(institute!.id, { is_default: true }),
    enabled: hasInstitute,
  });

  const { mutate: saveInstitute, isPending: isSaving } = useMutation({
    mutationFn: async (payload: DvdmsInstitutePayload) => {
      const row = form.getValues("mapping");
      const substores = form.getValues("substores");
      let savedInstitute;
      try {
        savedInstitute = institute
          ? await apis.institutes.update(facilityId, payload)
          : await apis.institutes.create(facilityId, payload);
      } catch (error: unknown) {
        throw new Error(
          getErrorMessage(error) || t("dvdms_institute_save_error"),
        );
      }

      if (showMappings) {
        try {
          if (removedStoreIds.length)
            await performSuperBatchRequest({
              requests: removedStoreIds.map((id) => ({
                reference_id: `store-${id}`,
                url: apis.storeMappings.path(facilityId, savedInstitute.id, id),
                method: HttpMethod.DELETE,
              })),
            });
          setRemovedStoreIds([]);

          if (row.store_mapping_id) {
            const updated = await apis.storeMappings.update(
              facilityId,
              savedInstitute.id,
              row.store_mapping_id,
              {
                store: row.location?.id,
                eaushadhi_store_id: row.eaushadhi_store_id,
                eaushadhi_store_name: row.eaushadhi_store_name,
                meta: storeMeta(row.eaushadhi_store_id),
              },
            );
            form.setValue("mapping.store_mapping_id", updated.id);
          } else if (row.location) {
            const created = await apis.storeMappings.create(
              facilityId,
              savedInstitute.id,
              {
                store: row.location.id,
                eaushadhi_store_id: row.eaushadhi_store_id,
                eaushadhi_store_name: row.eaushadhi_store_name,
                is_default: true,
                meta: storeMeta(row.eaushadhi_store_id),
              },
            );
            form.setValue("mapping.store_mapping_id", created.id);
          }

          if (row.supplier_mapping_id) {
            const updated = await apis.supplierMappings.update(
              savedInstitute.id,
              row.supplier_mapping_id,
              {
                supplier: row.supplier_id,
                eaushadhi_warehouse_id: row.eaushadhi_warehouse_id,
                eaushadhi_warehouse_name: row.eaushadhi_warehouse_name,
              },
            );
            form.setValue("mapping.supplier_mapping_id", updated.id);
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

          for (const [index, substore] of substores.entries()) {
            const payload = {
              store: substore.location!.id,
              eaushadhi_store_id: substore.eaushadhi_store_id,
              eaushadhi_store_name: substore.eaushadhi_store_name,
              meta: storeMeta(substore.eaushadhi_store_id),
            };
            if (substore.store_mapping_id) {
              const updated = await apis.storeMappings.update(
                facilityId,
                savedInstitute.id,
                substore.store_mapping_id,
                payload,
              );
              form.setValue(`substores.${index}.store_mapping_id`, updated.id);
            } else {
              const created = await apis.storeMappings.create(
                facilityId,
                savedInstitute.id,
                { ...payload, is_default: false },
              );
              form.setValue(`substores.${index}.store_mapping_id`, created.id);
            }
          }
        } catch (error: unknown) {
          throw new Error(
            getErrorMessage(error) || t("dvdms_mapping_save_error"),
          );
        }
      }

      return savedInstitute;
    },
    onSuccess: (savedInstitute) => {
      setAreMappingsCleared(false);
      setAreIdsEdited(false);
      setRemovedStoreIds([]);
      // Stores are looked up with the institute's IDs, so cached ones are stale.
      queryClient.invalidateQueries({ queryKey: ["dvdms_lookup_stores"] });
      toast.success(t("dvdms_institute_save_success"));
      queryClient.invalidateQueries({
        queryKey: ["dvdms_institute", facilityId],
      });
      queryClient.invalidateQueries({
        queryKey: ["dvdms_store_mappings", facilityId, savedInstitute.id],
      });
      queryClient.invalidateQueries({
        queryKey: ["dvdms_supplier_mappings", savedInstitute.id],
      });
    },
  });

  const formSchema = useMemo(() => {
    const requiredIfInstitute = (value: unknown) => !showMappings || !!value;
    return z.object({
      eaushadhi_institute_id: z
        .string()
        .trim()
        .min(1, t("eaushadhi_institute_id_required")),
      eaushadhi_user_ref_id: z
        .string()
        .trim()
        .min(1, t("eaushadhi_user_ref_id_required")),
      eaushadhi_institute_name: z
        .string()
        .trim()
        .min(1, t("eaushadhi_institute_name_required")),
      mapping: z.object({
        eaushadhi_store_id: z
          .string()
          .refine(requiredIfInstitute, t("eaushadhi_store_required")),
        eaushadhi_store_name: z.custom<string>(),
        eaushadhi_warehouse_id: z.custom<string>(),
        eaushadhi_warehouse_name: z.custom<string>(),
        location: z.custom<LocationRead | null>(
          requiredIfInstitute,
          t("location_required"),
        ),
        supplier_id: z
          .string()
          .refine(requiredIfInstitute, t("supplier_required")),
        store_mapping_id: z.custom<string | undefined>(),
        supplier_mapping_id: z.custom<string | undefined>(),
      }),
      substores: z.array(
        z.object({
          eaushadhi_store_id: z.string().min(1, t("eaushadhi_store_required")),
          eaushadhi_store_name: z.custom<string>(),
          location: z.custom<LocationRead | null>(
            (value) => !!value,
            t("location_required"),
          ),
          store_mapping_id: z.custom<string | undefined>(),
        }),
      ),
    });
  }, [t, showMappings]);

  const form = useForm<DvdmsFacilityConfig>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      eaushadhi_institute_id: "",
      eaushadhi_user_ref_id: "",
      eaushadhi_institute_name: "",
      mapping: EMPTY_MAPPING,
      substores: [],
    },
  });
  const isDirty = form.formState.isDirty;
  const {
    fields: substoreFields,
    append: appendSubstore,
    remove: removeSubstore,
    replace: replaceSubstores,
  } = useFieldArray({ control: form.control, name: "substores" });

  useEffect(() => {
    if (!institute || isDirty) return;
    form.reset({
      ...form.getValues(),
      eaushadhi_institute_id: institute.eaushadhi_institute_id,
      eaushadhi_user_ref_id: institute.eaushadhi_user_ref_id,
      eaushadhi_institute_name: institute.eaushadhi_institute_name,
    });
  }, [institute, isDirty]);

  const applySavedMappings = () => {
    if (
      !defaultStoreMappingsData ||
      !substoreMappingsData ||
      !supplierMappingsData
    )
      return;

    const store = defaultStoreMappingsData.results[0];
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
    form.setValue(
      "substores",
      substoreMappingsData.results.map((s) => ({
        eaushadhi_store_id: s.eaushadhi_store_id,
        eaushadhi_store_name: s.eaushadhi_store_name,
        location: s.store,
        store_mapping_id: s.id,
      })),
    );
  };

  useEffect(() => {
    if (!institute || isDirty) return;
    applySavedMappings();
  }, [
    institute,
    isDirty,
    defaultStoreMappingsData,
    substoreMappingsData,
    supplierMappingsData,
  ]);

  const { data: suppliersData } = useQuery({
    queryKey: ["dvdms_supplier_organizations"],
    queryFn: () =>
      apis.organizations.list({ org_type: SUPPLIER_ORG_TYPE, limit: 100 }),
  });
  const supplierOptions = suppliersData?.results ?? EMPTY_SUPPLIERS;

  const resetMapping = () => {
    form.setValue("mapping", EMPTY_MAPPING, { shouldDirty: true });
    replaceSubstores([]);
    setAreMappingsCleared(true);
  };

  const ID_FIELDS = [
    "eaushadhi_institute_id",
    "eaushadhi_user_ref_id",
  ] as const;
  const hasFieldChanged = (field: (typeof ID_FIELDS)[number]) =>
    !!institute && form.getValues(field).trim() !== institute[field];

  const warningTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(warningTimer.current), []);

  const isWarningRequired = () =>
    ID_FIELDS.some(hasFieldChanged) && !areMappingsCleared;

  const restoreMappings = () => {
    applySavedMappings();
    setAreMappingsCleared(false);
  };

  const onIdChange = (value: string, onChange: (value: string) => void) => {
    onChange(value);
    if (!institute) return;
    clearTimeout(warningTimer.current);
    setAreIdsEdited(ID_FIELDS.some(hasFieldChanged));
    if (areMappingsCleared && !ID_FIELDS.some(hasFieldChanged)) {
      restoreMappings();
    }
    setIsWarningPending(isWarningRequired());
    if (!isWarningRequired()) return;
    warningTimer.current = setTimeout(() => {
      if (isWarningRequired()) setIsIdChangeWarningOpen(true);
      else setIsWarningPending(false);
    }, ID_CHANGE_WARNING_DELAY_MS);
  };

  const confirmIdChange = () => {
    resetMapping();
    setIsIdChangeWarningOpen(false);
    setIsWarningPending(false);
  };

  const cancelIdChange = () => {
    if (institute)
      ID_FIELDS.forEach((field) => form.setValue(field, institute[field]));
    if (areMappingsCleared) restoreMappings();
    setAreIdsEdited(false);
    setIsIdChangeWarningOpen(false);
    setIsWarningPending(false);
  };

  const goBackToFacility = () => {
    goBack(`/facility/${facilityId}/settings/general`);
  };

  const submitForm = form.handleSubmit((values) =>
    saveInstitute(
      {
        eaushadhi_institute_id: values.eaushadhi_institute_id,
        eaushadhi_user_ref_id: values.eaushadhi_user_ref_id,
        eaushadhi_institute_name: values.eaushadhi_institute_name,
      },
      showMappings ? { onSuccess: goBackToFacility } : undefined,
    ),
  );

  const onSubmit = (e: SyntheticEvent) =>
    isWarningPending ? e.preventDefault() : submitForm(e);

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
            {t("manage_dvdms_config_for")} <strong>{facility?.name}</strong>.
          </SheetDescription>
        </SheetHeader>

        <div className="px-1 py-5">
          <Form {...form}>
            <form onSubmit={onSubmit} className="space-y-8">
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
                            className="h-9"
                            {...field}
                            onChange={(e) =>
                              onIdChange(e.target.value, field.onChange)
                            }
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="eaushadhi_user_ref_id"
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
                            onChange={(e) =>
                              onIdChange(e.target.value, field.onChange)
                            }
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="eaushadhi_institute_name"
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
                </div>
              </div>

              {showMappings && (
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
                        <div className="grid grid-cols-2 gap-3 w-full">
                          <FormField
                            control={form.control}
                            name="mapping.eaushadhi_store_id"
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
                                        store
                                          ? String(store.hstnumStoreId)
                                          : "",
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
                                    placeholder={t(
                                      "eaushadhi_store_placeholder",
                                    )}
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

                        <div className="grid grid-cols-2 gap-3 w-full">
                          <FormField
                            control={form.control}
                            name="mapping.location"
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
                            name="mapping.supplier_id"
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

                    {SHOW_SUBSTORES &&
                      substoreFields.map((substore, index) => (
                        <div
                          key={substore.id}
                          className="relative border border-gray-200 rounded-lg p-3 pt-5 mt-3"
                        >
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="absolute top-1 right-1 size-6"
                            aria-label={t("remove")}
                            disabled={isSaving}
                            onClick={() => {
                              const id = substore.store_mapping_id;
                              if (id) setRemovedStoreIds((ids) => [...ids, id]);
                              removeSubstore(index);
                            }}
                          >
                            <XIcon className="size-4" />
                          </Button>

                          <div className="grid grid-cols-2 gap-3 w-full">
                            <FormField
                              control={form.control}
                              name={`substores.${index}.eaushadhi_store_id`}
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
                                          store
                                            ? String(store.hstnumStoreId)
                                            : "",
                                        );
                                        form.setValue(
                                          `substores.${index}.eaushadhi_store_name`,
                                          store?.hststrStoreName ?? "",
                                        );
                                      }}
                                      placeholder={t(
                                        "eaushadhi_store_placeholder",
                                      )}
                                    />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />

                            <FormField
                              control={form.control}
                              name={`substores.${index}.location`}
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
                          </div>
                        </div>
                      ))}

                    {SHOW_SUBSTORES && (
                      <Button
                        type="button"
                        variant="outline"
                        className="w-full mt-3"
                        onClick={() =>
                          appendSubstore({
                            eaushadhi_store_id: "",
                            eaushadhi_store_name: "",
                            location: null,
                          })
                        }
                      >
                        <PlusIcon className="size-4" />
                        {t("add_substore")}
                      </Button>
                    )}
                  </div>

                  <hr className="border-gray-200" />

                  <div>
                    <h3 className="text-base font-semibold text-gray-900 mb-1">
                      {t("product_mappings")}
                    </h3>
                    <p className="text-sm text-gray-500 mb-4">
                      {t("product_mappings_subtitle")}
                    </p>

                    <Button
                      type="button"
                      variant="outline"
                      className="w-full"
                      onClick={() =>
                        navigate(
                          `/facility/${facilityId}/settings/general/dvdms/product-mappings`,
                        )
                      }
                    >
                      {t("configure_product_mappings")}
                    </Button>
                  </div>
                </>
              )}

              <div className="flex justify-end mt-6 gap-3">
                <SheetClose asChild>
                  <Button type="button" variant="outline">
                    {t("cancel")}
                  </Button>
                </SheetClose>
                <Button
                  type="submit"
                  variant="primary"
                  disabled={isSaving || isWarningPending}
                >
                  {isSaving && <Loader2Icon className="size-4 animate-spin" />}
                  {isSaving
                    ? t("saving")
                    : showMappings
                      ? t("save_and_close")
                      : t("save")}
                </Button>
              </div>
            </form>
          </Form>
        </div>
        <Dialog
          open={isIdChangeWarningOpen}
          onOpenChange={(open) => !open && cancelIdChange()}
        >
          <DialogContent closeLabel={t("close")}>
            <DialogHeader>
              <DialogTitle>{t("dvdms_ids_change_title")}</DialogTitle>
              <DialogDescription>
                {t("dvdms_ids_change_description")}
              </DialogDescription>
            </DialogHeader>
            <ul className="list-disc pl-6 text-sm text-gray-600 space-y-1">
              <li>{t("dvdms_ids_change_store_mappings")}</li>
              <li>{t("dvdms_ids_change_product_mappings")}</li>
              <li>{t("dvdms_ids_change_lists")}</li>
              <li>{t("dvdms_ids_change_orders")}</li>
              <li>{t("dvdms_ids_change_acknowledge")}</li>
              <li>{t("dvdms_ids_change_new_orders")}</li>
            </ul>
            <DialogFooter>
              <Button variant="outline" onClick={cancelIdChange}>
                {t("cancel")}
              </Button>
              <Button
                variant="primary"
                disabled={isSaving}
                onClick={confirmIdChange}
              >
                {t("confirm")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </SheetContent>
    </Sheet>
  );
};

export default DvdmsConfigurePage;
