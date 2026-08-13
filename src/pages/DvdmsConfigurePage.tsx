import { FC } from "react";
import { navigate } from "raviger";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { useFieldArray, useForm } from "react-hook-form";
import { PlusIcon, Trash2Icon } from "lucide-react";

import { apis } from "@/apis";
import { I18N_NAMESPACE } from "@/lib/constants";
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
import { DvdmsFacilityConfig } from "@/types/dvdms_config";

const SUPPLIER_ORG_TYPE = "product_supplier";

type DvdmsConfigurePageProps = {
  facilityId: string;
};

const DvdmsConfigurePage: FC<DvdmsConfigurePageProps> = ({ facilityId }) => {
  const { t } = useTranslation(I18N_NAMESPACE);

  const form = useForm<DvdmsFacilityConfig>({
    defaultValues: {
      institute_code: "",
      store_code: "",
      store_name: "",
      meta: {
        disable_auto_sync: false,
        allow_manual_entry: false,
      },
      suppliers: [{ supplier_id: "", supplier_code: "", is_default: true }],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "suppliers",
  });

  const { data: suppliersData } = useQuery({
    queryKey: ["dvdms_supplier_organizations"],
    queryFn: () =>
      apis.organizations.list({ org_type: SUPPLIER_ORG_TYPE, limit: 100 }),
  });
  const supplierOptions = suppliersData?.results ?? [];

  const addSupplier = () => {
    append(
      {
        supplier_id: "",
        supplier_code: "",
        is_default: false,
      },
      { shouldFocus: false },
    );
    form.clearErrors("suppliers");
  };

  const setDefaultSupplier = (index: number) => {
    fields.forEach((_, i) => {
      form.setValue(`suppliers.${i}.is_default`, i === index);
    });
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
            {t("manage_dvdms_config_for")} <strong>{facilityId}</strong>.
          </SheetDescription>
        </SheetHeader>

        <div className="px-1 py-5">
          <Form {...form}>
            <form
              onSubmit={form.handleSubmit(() => {
                if (fields.length === 0) {
                  form.setError("suppliers", {
                    type: "manual",
                    message: t("suppliers_required"),
                  });
                  return;
                }
                // TODO: wire up create/update API call
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
                    name="institute_code"
                    rules={{ required: t("institute_code_required") }}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel aria-required>
                          {t("institute_code")}
                        </FormLabel>
                        <FormControl>
                          <Input
                            placeholder={t("institute_code_placeholder")}
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
                    name="store_code"
                    rules={{ required: t("store_code_required") }}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel aria-required>{t("store_code")}</FormLabel>
                        <FormControl>
                          <Input
                            placeholder={t("store_code_placeholder")}
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
                    name="store_name"
                    rules={{ required: t("store_name_required") }}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel aria-required>{t("store_name")}</FormLabel>
                        <FormControl>
                          <Input
                            placeholder={t("store_name_placeholder")}
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

              <hr className="border-gray-200" />

              <div>
                <h3 className="text-base font-semibold text-gray-900 mb-1">
                  {t("suppliers")} <span className="text-red-500">*</span>
                </h3>
                <p className="text-sm text-gray-500 mb-4">
                  {t("suppliers_subtitle")}
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
                        onClick={() => remove(index)}
                        className="absolute top-1 right-1 shrink-0 hover:bg-white hover:text-gray-900"
                        aria-label={t("remove_supplier")}
                      >
                        <Trash2Icon className="size-4" />
                      </Button>
                      <div className="space-y-3">
                        <div className="grid grid-cols-2 gap-3 w-full">
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
                            name={`suppliers.${index}.supplier_code`}
                            rules={{ required: t("supplier_code_required") }}
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel
                                  aria-required
                                  className="text-xs font-medium text-gray-600"
                                >
                                  {t("supplier_code")}
                                </FormLabel>
                                <FormControl>
                                  <Input className="h-9" {...field} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>

                        <FormField
                          control={form.control}
                          name={`suppliers.${index}.is_default`}
                          render={({ field }) => (
                            <FormItem className="flex items-center gap-2">
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

              <div className="flex justify-end mt-6 gap-3">
                <SheetClose asChild>
                  <Button type="button" variant="outline">
                    {t("cancel")}
                  </Button>
                </SheetClose>
                <Button type="submit" variant="primary">
                  {t("save")}
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
