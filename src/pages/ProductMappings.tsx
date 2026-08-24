import { FC, useEffect, useMemo, useState } from "react";
import { navigate } from "raviger";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  ArrowLeftIcon,
  FolderOpenIcon,
  Loader2Icon,
  PencilIcon,
  PlusIcon,
} from "lucide-react";

import { apis } from "@/apis";
import { I18N_NAMESPACE } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import Page from "@/components/ui/page";
import Autocomplete from "@/components/ui/autocomplete";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import FileDropzone from "@/components/FileDropzone";
import { DvdmsProductMapping } from "@/types/dvdms_config";
import { ProductKnowledge } from "@/types/productKnowledge";

type ProductMappingsProps = {
  facilityId: string;
};

type DvdmsDrugValue = {
  id: string;
  name: string;
  group_id: string;
  sub_group_id: string;
};

type MappingForm = {
  productKnowledge: ProductKnowledge | null;
  dvdmsDrug: DvdmsDrugValue | null;
};

const EMPTY_MAPPING: MappingForm = {
  productKnowledge: null,
  dvdmsDrug: null,
};

const getErrorMessage = (error: unknown) =>
  (error as { message?: string })?.message;

const ProductMappings: FC<ProductMappingsProps> = ({ facilityId }) => {
  const { t } = useTranslation(I18N_NAMESPACE);
  const queryClient = useQueryClient();

  const { data: institute } = useQuery({
    queryKey: ["dvdms_institute", facilityId],
    queryFn: () => apis.institutes.get(facilityId),
  });
  const instituteId = institute?.id;

  const { data: mappingsData, isLoading: mappingsLoading } = useQuery({
    queryKey: ["dvdms_product_mappings", instituteId],
    queryFn: () => apis.productMappings.list(instituteId!),
    enabled: !!instituteId,
  });
  const mappings = mappingsData?.results ?? [];

  // Product mapping responses only carry product_knowledge_id — resolve
  // names for display from the facility's product knowledge list.
  const { data: productKnowledgeData } = useQuery({
    queryKey: ["dvdms_product_knowledge_all", facilityId],
    queryFn: () => apis.productKnowledge.list({ facility: facilityId, limit: 100 }),
  });
  const productKnowledgeById = useMemo(() => {
    const map = new Map<string, ProductKnowledge>();
    for (const pk of productKnowledgeData?.results ?? []) {
      map.set(pk.id, pk);
    }
    return map;
  }, [productKnowledgeData]);

  const [csvFile, setCsvFile] = useState<File | null>(null);

  const [mappingOpen, setMappingOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [mappingForm, setMappingForm] = useState<MappingForm>(EMPTY_MAPPING);

  const [groupId, setGroupId] = useState<string | undefined>(undefined);
  const [subgroupId, setSubgroupId] = useState<string | undefined>(undefined);

  const [productKnowledgeSearch, setProductKnowledgeSearch] = useState("");
  const [debouncedProductKnowledgeSearch, setDebouncedProductKnowledgeSearch] =
    useState("");

  useEffect(() => {
    const timeout = setTimeout(
      () => setDebouncedProductKnowledgeSearch(productKnowledgeSearch),
      300,
    );
    return () => clearTimeout(timeout);
  }, [productKnowledgeSearch]);

  const { data: productKnowledgeSearchData, isLoading: isSearchingProductKnowledge } =
    useQuery({
      queryKey: [
        "dvdms_product_knowledge_search",
        facilityId,
        debouncedProductKnowledgeSearch,
      ],
      queryFn: () =>
        apis.productKnowledge.list({
          facility: facilityId,
          name: debouncedProductKnowledgeSearch || undefined,
          limit: 10,
        }),
    });

  const productKnowledgeOptions = useMemo(() => {
    const list = productKnowledgeSearchData?.results ?? [];
    // Keep the currently selected item selectable even if it falls outside
    // the latest search results.
    const selected = mappingForm.productKnowledge;
    return selected && !list.some((pk) => pk.id === selected.id)
      ? [selected, ...list]
      : list;
  }, [productKnowledgeSearchData, mappingForm.productKnowledge]);

  const { data: groups = [] } = useQuery({
    queryKey: ["dvdms_lookup_groups", instituteId],
    queryFn: () => apis.institutes.lookupGroups(instituteId!),
    enabled: !!instituteId,
  });

  const { data: subgroups = [] } = useQuery({
    queryKey: ["dvdms_lookup_subgroups", instituteId, groupId],
    queryFn: () => apis.institutes.lookupSubgroups(instituteId!, groupId!),
    enabled: !!instituteId && !!groupId,
  });

  const { data: drugs = [] } = useQuery({
    queryKey: ["dvdms_lookup_drugs", instituteId, groupId, subgroupId],
    queryFn: () =>
      apis.institutes.lookupDrugs(instituteId!, {
        hstnum_group_id: groupId!,
        hstnum_subgroup_id: subgroupId!,
      }),
    enabled: !!instituteId && !!groupId && !!subgroupId,
  });

  const handleGroupChange = (id: string) => {
    setGroupId(id);
    setSubgroupId(undefined);
    setMappingForm((prev) => ({ ...prev, dvdmsDrug: null }));
  };

  const handleSubgroupChange = (id: string) => {
    setSubgroupId(id);
    setMappingForm((prev) => ({ ...prev, dvdmsDrug: null }));
  };

  const handleDrugChange = (id: string) => {
    const drug = drugs.find((d) => String(d.hstnum_item_id) === id);
    if (!drug) return;
    setMappingForm((prev) => ({
      ...prev,
      dvdmsDrug: {
        id: String(drug.hstnum_item_id),
        name: drug.hststr_item_name,
        group_id: String(drug.hstnum_group_id),
        sub_group_id: String(drug.hstnum_subgroup_id),
      },
    }));
  };

  const invalidateMappings = () =>
    queryClient.invalidateQueries({
      queryKey: ["dvdms_product_mappings", instituteId],
    });

  const { mutate: createMapping, isPending: isCreating } = useMutation({
    mutationFn: () =>
      apis.productMappings.create(instituteId!, {
        eaushadhi_drug_details: {
          id: mappingForm.dvdmsDrug!.id,
          name: mappingForm.dvdmsDrug!.name,
          group_id: mappingForm.dvdmsDrug!.group_id,
          sub_group_id: mappingForm.dvdmsDrug!.sub_group_id,
        },
        product_knowledge_id: mappingForm.productKnowledge!.id,
      }),
    onSuccess: () => {
      toast.success(t("dvdms_product_mapping_save_success"));
      invalidateMappings();
      setMappingOpen(false);
    },
    onError: (error: unknown) =>
      toast.error(
        getErrorMessage(error) || t("dvdms_product_mapping_save_error"),
      ),
  });

  const { mutate: updateMapping, isPending: isUpdating } = useMutation({
    mutationFn: () =>
      apis.productMappings.update(instituteId!, editingId!, {
        eaushadhi_drug_details: {
          id: mappingForm.dvdmsDrug!.id,
          name: mappingForm.dvdmsDrug!.name,
          group_id: mappingForm.dvdmsDrug!.group_id,
          sub_group_id: mappingForm.dvdmsDrug!.sub_group_id,
        },
        product_knowledge_id: mappingForm.productKnowledge!.id,
      }),
    onSuccess: () => {
      toast.success(t("dvdms_product_mapping_save_success"));
      invalidateMappings();
      setMappingOpen(false);
    },
    onError: (error: unknown) =>
      toast.error(
        getErrorMessage(error) || t("dvdms_product_mapping_save_error"),
      ),
  });

  const isSaving = isCreating || isUpdating;

  const goBackToDvdmsConfig = () => {
    navigate(`/facility/${facilityId}/settings/general/dvdms`);
  };

  const openAddMapping = () => {
    setEditingId(null);
    setMappingForm(EMPTY_MAPPING);
    setGroupId(undefined);
    setSubgroupId(undefined);
    setCsvFile(null);
    setMappingOpen(true);
  };

  const openEditMapping = (mapping: DvdmsProductMapping) => {
    setEditingId(mapping.id);
    setMappingForm({
      productKnowledge: productKnowledgeById.get(mapping.product_knowledge_id) ?? {
        id: mapping.product_knowledge_id,
        slug: mapping.product_knowledge_id,
        name: mapping.product_knowledge_id,
      },
      dvdmsDrug: {
        id: mapping.eaushadhi_drug_details.id,
        name: mapping.eaushadhi_drug_details.name,
        group_id: mapping.eaushadhi_drug_details.group_id,
        sub_group_id: mapping.eaushadhi_drug_details.sub_group_id,
      },
    });
    setGroupId(mapping.eaushadhi_drug_details.group_id);
    setSubgroupId(mapping.eaushadhi_drug_details.sub_group_id);
    setMappingOpen(true);
  };

  const saveMapping = () => {
    if (!mappingForm.productKnowledge || !mappingForm.dvdmsDrug) {
      return;
    }
    if (editingId) {
      updateMapping();
    } else {
      createMapping();
    }
  };

  const uploadCsv = () => {
    // TODO: send csvFile to the bulk mapping upload API once available
    setCsvFile(null);
  };

  return (
    <Page
      title={t("product_mappings")}
      hideTitleOnPage
      className="p-0 care-dvdms-container"
    >
      <div className="container mx-auto p-4">
        <Button
          type="button"
          variant="outline"
          className="mb-4"
          onClick={goBackToDvdmsConfig}
        >
          <ArrowLeftIcon className="mr-2 size-4" />
          {t("back")}
        </Button>

        <div className="mb-4 flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">
              {t("product_mappings")}
            </h3>
            <p className="text-sm text-gray-500">
              {t("product_mappings_subtitle")}
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Sheet open={mappingOpen} onOpenChange={setMappingOpen}>
              <SheetTrigger asChild>
                <Button
                  type="button"
                  variant="primary"
                  disabled={!instituteId}
                  onClick={openAddMapping}
                >
                  <PlusIcon className="size-4" />
                  {t("add_mapping")}
                </Button>
              </SheetTrigger>
              <SheetContent
                closeLabel={t("close")}
                showCloseButton={false}
                className="flex w-full flex-col sm:max-w-2xl overflow-y-auto"
              >
                <SheetHeader>
                  <SheetTitle>
                    {editingId ? t("edit_mapping") : t("add_mapping")}
                  </SheetTitle>
                </SheetHeader>
                <div className="px-1 space-y-8">
                  {!editingId && (
                    <>
                      <div className="space-y-2">
                        <Label>{t("upload_mapping_csv")}</Label>
                        <p className="text-sm text-gray-500">
                          {t("upload_mapping_csv_subtitle")}
                        </p>
                        <FileDropzone
                          accept=".csv"
                          selectedFile={csvFile}
                          onFileChange={setCsvFile}
                          dropLabel={t("drag_drop_csv_to_upload")}
                          browseLabel={t("browse_file")}
                        />
                        <Button
                          type="button"
                          variant="primary_gradient"
                          className="w-full"
                          disabled={!csvFile}
                          onClick={uploadCsv}
                        >
                          {t("upload")}
                        </Button>
                      </div>

                      <div className="relative">
                        <hr className="border-gray-200" />
                        <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-white px-2 text-xs uppercase text-gray-500">
                          {t("or")}
                        </span>
                      </div>
                    </>
                  )}
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label>
                        {t("product_knowledge")}
                        <span className="text-red-500">*</span>
                      </Label>
                      <Autocomplete
                        options={productKnowledgeOptions.map((pk) => ({
                          value: pk.id,
                          label: pk.name,
                        }))}
                        isLoading={isSearchingProductKnowledge}
                        value={mappingForm.productKnowledge?.id ?? ""}
                        onChange={(id) => {
                          const productKnowledge = productKnowledgeOptions.find(
                            (pk) => pk.id === id,
                          );
                          if (productKnowledge) {
                            setMappingForm((prev) => ({
                              ...prev,
                              productKnowledge,
                            }));
                          }
                        }}
                        onSearch={setProductKnowledgeSearch}
                        placeholder={t("product_knowledge_placeholder")}
                        inputPlaceholder={t("search_product_knowledge")}
                        noOptionsMessage={t("no_product_knowledge_found")}
                        showClearButton={false}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>
                        {t("dvdms_group")}
                        <span className="text-red-500">*</span>
                      </Label>
                      <Autocomplete
                        options={groups.map((group) => ({
                          value: String(group.hstnumGroupId),
                          label: group.hststrGroupName,
                        }))}
                        value={groupId ?? ""}
                        onChange={handleGroupChange}
                        placeholder={t("dvdms_group_placeholder")}
                        inputPlaceholder={t("search_dvdms_group")}
                        noOptionsMessage={t("no_dvdms_group_found")}
                        disabled={!instituteId}
                        showClearButton={false}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>
                        {t("dvdms_subgroup")}
                        <span className="text-red-500">*</span>
                      </Label>
                      <Autocomplete
                        options={subgroups.map((subgroup) => ({
                          value: String(subgroup.hstnumSubgroupId),
                          label: subgroup.hststrSubgroupName,
                        }))}
                        value={subgroupId ?? ""}
                        onChange={handleSubgroupChange}
                        placeholder={t("dvdms_subgroup_placeholder")}
                        inputPlaceholder={t("search_dvdms_group")}
                        noOptionsMessage={t("no_dvdms_subgroup_found")}
                        disabled={!groupId}
                        showClearButton={false}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>
                        {t("dvdms_drug")}
                        <span className="text-red-500">*</span>
                      </Label>
                      <Autocomplete
                        options={drugs.map((drug) => ({
                          value: String(drug.hstnum_item_id),
                          label: drug.hststr_item_name,
                        }))}
                        value={mappingForm.dvdmsDrug?.id ?? ""}
                        onChange={handleDrugChange}
                        placeholder={t("dvdms_drug_placeholder")}
                        inputPlaceholder={t("search_dvdms_drug")}
                        noOptionsMessage={t("no_dvdms_drug_found")}
                        disabled={!subgroupId}
                        showClearButton={false}
                      />
                    </div>
                  </div>
                </div>
                <div className="flex justify-end gap-3">
                  <SheetClose asChild>
                    <Button type="button" variant="outline">
                      {t("cancel")}
                    </Button>
                  </SheetClose>
                  <Button
                    type="button"
                    variant="primary"
                    disabled={
                      !mappingForm.productKnowledge ||
                      !mappingForm.dvdmsDrug ||
                      isSaving
                    }
                    onClick={saveMapping}
                  >
                    {isSaving && (
                      <Loader2Icon className="mr-2 size-4 animate-spin" />
                    )}
                    {t("save")}
                  </Button>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>

        {mappingsLoading ? (
          <p className="text-sm text-gray-500">{t("loading")}</p>
        ) : mappings.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-gray-200 bg-white px-6 py-12 text-center text-gray-950 shadow-sm">
            <div className="rounded-full bg-primary/10 p-3 mb-3">
              <FolderOpenIcon className="text-primary size-6" />
            </div>
            <h3 className="text-lg font-semibold mb-1">{t("no_mappings")}</h3>
            <p className="text-sm text-gray-500">
              {t("no_mappings_description")}
            </p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-lg border border-gray-200">
            <div className="grid grid-cols-[1fr_1fr_auto] gap-4 bg-gray-100 px-4 py-2 text-xs font-medium uppercase text-gray-500">
              <span>{t("product_knowledge")}</span>
              <span>{t("dvdms_drug")}</span>
              <span>{t("actions")}</span>
            </div>
            <div className="divide-y divide-gray-200 bg-white">
              {mappings.map((mapping) => (
                <div
                  key={mapping.id}
                  className="grid grid-cols-[1fr_1fr_auto] items-center gap-4 px-4 py-3"
                >
                  <span className="text-sm font-medium text-gray-900">
                    {productKnowledgeById.get(mapping.product_knowledge_id)
                      ?.name ?? mapping.product_knowledge_id}
                  </span>
                  <span className="text-sm text-gray-500">
                    {mapping.eaushadhi_drug_details.name}
                  </span>
                  <div className="flex gap-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => openEditMapping(mapping)}
                      aria-label={t("edit_mapping")}
                    >
                      <PencilIcon className="size-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </Page>
  );
};

export default ProductMappings;
