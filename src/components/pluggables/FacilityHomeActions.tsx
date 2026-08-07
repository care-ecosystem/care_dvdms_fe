import { FC, useRef, useState } from "react";
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
      suppliers: [],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "suppliers",
  });

  const [open, setOpen] = useState(false);
  const [draftSupplierCode, setDraftSupplierCode] = useState("");
  const [draftSupplierError, setDraftSupplierError] = useState("");
  const draftSupplierInputRef = useRef<HTMLInputElement>(null);

  const commitDraftSupplier = () => {
    const supplier_code = draftSupplierCode.trim();
    if (!supplier_code) return;
    const isDuplicate = fields.some(
      (f) => f.supplier_code.toLowerCase() === supplier_code.toLowerCase(),
    );
    if (isDuplicate) {
      setDraftSupplierError(t("supplier_code_duplicate"));
      return;
    }
    append({ supplier_code }, { shouldFocus: false });
    setDraftSupplierCode("");
    setDraftSupplierError("");
    form.clearErrors("suppliers");
    draftSupplierInputRef.current?.focus();
  };

  const onOpenChange = (next: boolean) => {
    if (!next) {
      form.reset();
      setDraftSupplierCode("");
      setDraftSupplierError("");
    }
    setOpen(next);
  };

  if (!facility) {
    return null;
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetTrigger asChild>
        <button
          type="button"
          className="hover:bg-gray-100 hover:text-gray-900 flex w-full cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-hidden select-none [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0"
        >
          <SettingsIcon className="size-4 text-gray-500" />
          {t("configure_dvdms")}
        </button>
      </SheetTrigger>
      <SheetContent
        className="w-full sm:max-w-2xl overflow-y-auto"
        closeLabel={t("close")}
      >
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
                if (fields.length === 0) {
                  form.setError("suppliers", {
                    type: "manual",
                    message: t("supplier_code_required"),
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
                    <div key={field.id} className="flex items-end gap-2">
                      <FormField
                        control={form.control}
                        name={`suppliers.${index}.supplier_code`}
                        render={({ field }) => (
                          <FormItem className="flex-1">
                            <FormControl>
                              <Input
                                aria-label={t("supplier_code")}
                                className="h-9"
                                {...field}
                              />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        onClick={() => remove(index)}
                        className="shrink-0"
                        aria-label={t("remove_supplier")}
                      >
                        <Trash2Icon className="size-4" />
                      </Button>
                    </div>
                  ))}

                  <div key="draft-supplier-row" className="flex items-end gap-2">
                    <div className="flex-1">
                      <Input
                        ref={draftSupplierInputRef}
                        aria-label={t("supplier_code")}
                        value={draftSupplierCode}
                        onChange={(e) => {
                          setDraftSupplierCode(e.target.value);
                          setDraftSupplierError("");
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            commitDraftSupplier();
                          }
                        }}
                        placeholder={t("supplier_code_placeholder")}
                        className="h-9"
                      />
                      {draftSupplierError && (
                        <p className="text-sm text-red-500 mt-1">
                          {draftSupplierError}
                        </p>
                      )}
                    </div>
                    <Button
                      type="button"
                      variant="primary"
                      size="icon"
                      onClick={commitDraftSupplier}
                      disabled={!draftSupplierCode.trim()}
                      className="shrink-0"
                      aria-label={t("add_supplier")}
                    >
                      <PlusIcon className="size-4" />
                    </Button>
                  </div>

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

export default FacilityHomeActions;
