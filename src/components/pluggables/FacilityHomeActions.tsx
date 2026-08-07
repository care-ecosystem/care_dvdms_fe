import { FC } from "react";
import { useTranslation } from "react-i18next";
import { useFieldArray, useForm } from "react-hook-form";
import { PlusIcon, SettingsIcon, Trash2Icon } from "lucide-react";

import { I18N_NAMESPACE } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
} from "@/components/ui/form";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { DvdmsFacilityConfig } from "@/types/dvdms_config";

type Facility = {
  id: string;
  name: string;
};

type FacilityHomeActionsProps = {
  facility: Facility;
  className?: string;
};

const FacilityHomeActions: FC<FacilityHomeActionsProps> = ({ facility }) => {
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
      suppliers: [{ supplier_code: "" }],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "suppliers",
  });

  if (!facility) {
    return null;
  }

  return (
    <Sheet>
      <SheetTrigger asChild>
        <button
          type="button"
          className="hover:bg-gray-100 hover:text-gray-900 flex w-full cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-hidden select-none [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0"
        >
          <SettingsIcon className="size-4 text-gray-500" />
          {t("configure_dvdms")}
        </button>
      </SheetTrigger>
      <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{t("dvdms_configuration")}</SheetTitle>
          <SheetDescription>
            {t("manage_dvdms_config_for")} <strong>{facility.name}</strong>.
          </SheetDescription>
        </SheetHeader>

        <div className="px-1 py-5">
          <Form {...form}>
            <form
              onSubmit={form.handleSubmit(() => {
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
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              <hr className="border-gray-200" />

              <div>
                <h3 className="text-base font-semibold text-gray-900 mb-1">
                  {t("suppliers")}
                </h3>
                <p className="text-sm text-gray-500 mb-4">
                  {t("suppliers_subtitle")}
                </p>

                <div className="space-y-3">
                  {fields.map((field, index) => (
                    <div key={field.id} className="flex items-end gap-2">
                      <FormField
                        control={form.control}
                        name={`suppliers.${index}.supplier_code`}
                        rules={{ required: t("supplier_code_required") }}
                        render={({ field }) => (
                          <FormItem className="flex-1">
                            <FormControl>
                              <Input
                                placeholder={t("supplier_code_placeholder")}
                                className="h-9"
                                {...field}
                              />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                      {fields.length > 1 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => remove(index)}
                          className="size-9"
                          aria-label={t("remove_supplier")}
                        >
                          <Trash2Icon className="size-4" />
                        </Button>
                      )}
                    </div>
                  ))}

                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => append({ supplier_code: "" })}
                    className="w-full"
                  >
                    <PlusIcon className="mr-2 size-4" />
                    {t("add_supplier")}
                  </Button>
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
                        <FormLabel className="text-sm font-medium text-gray-900">
                          {t("disable_auto_sync")}
                        </FormLabel>
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
                        <FormLabel className="text-sm font-medium text-gray-900">
                          {t("allow_manual_entry")}
                        </FormLabel>
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

export default FacilityHomeActions;
