import { FC, useEffect, useMemo, useRef, useState } from "react";
import { navigate } from "raviger";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  ArrowLeftIcon,
  DownloadIcon,
  FolderOpenIcon,
  Loader2Icon,
  PencilIcon,
  PlusIcon,
} from "lucide-react";

import { apis } from "@/apis";
import { I18N_NAMESPACE } from "@/lib/constants";
import { downloadProductMappingTemplate } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import Pagination from "@/components/Pagination";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import FileDropzone from "@/components/FileDropzone";
import { DvdmsProductMapping } from "@/types/dvdms_config";
import { ProductKnowledge } from "@/types/productKnowledge";
import { validateCSV } from "@/utils/csvValidation";
import type { FormattedError, ProductMappingCsvRow } from "@/utils/csvValidation";

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

const MAPPINGS_PAGE_SIZE = 10;

const ProductMappings: FC<ProductMappingsProps> = ({ facilityId }) => {
  const { t } = useTranslation(I18N_NAMESPACE);
  const queryClient = useQueryClient();

  const { data: institute } = useQuery({
    queryKey: ["dvdms_institute", facilityId],
    queryFn: () => apis.institutes.get(facilityId),
  });
  const instituteId = institute?.id;

  const [mappingsPage, setMappingsPage] = useState(1);

  const { data: mappingsData, isLoading: mappingsLoading } = useQuery({
    queryKey: ["dvdms_product_mappings", instituteId, mappingsPage],
    queryFn: () =>
      apis.productMappings.list(instituteId!, {
        limit: MAPPINGS_PAGE_SIZE,
        offset: (mappingsPage - 1) * MAPPINGS_PAGE_SIZE,
      }),
    enabled: !!instituteId,
  });
  const mappings = mappingsData?.results ?? [];
  const mappingsCount = mappingsData?.count ?? 0;

  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvErrors, setCsvErrors] = useState<FormattedError[]>([]);
  const [csvRows, setCsvRows] = useState<ProductMappingCsvRow[]>([]);
  const [csvDuplicateCount, setCsvDuplicateCount] = useState(0);
  const [isUploadingCsv, setIsUploadingCsv] = useState(false);

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
      enabled: mappingOpen,
    });

  const productKnowledgeOptions = useMemo(() => {
    const list = productKnowledgeSearchData?.results ?? [];
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
      clearMappingForm();
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
      clearMappingForm();
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

  const resetCsvState = () => {
    setCsvFile(null);
    setCsvErrors([]);
    setCsvRows([]);
    setCsvDuplicateCount(0);
  };

  const clearMappingForm = () => {
    setEditingId(null);
    setMappingForm(EMPTY_MAPPING);
    setGroupId(undefined);
    setSubgroupId(undefined);
  };

  const openAddMapping = () => {
    clearMappingForm();
    resetCsvState();
    setMappingOpen(true);
  };

  const openEditMapping = (mapping: DvdmsProductMapping) => {
    setEditingId(mapping.id);
    setMappingForm({
      productKnowledge: mapping.product_knowledge,
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

  const fileReaderRef = useRef<FileReader | null>(null);
  const selectionIdRef = useRef(0);

  const handleFileSelected = (file: File | null) => {
    fileReaderRef.current?.abort();
    const selectionId = ++selectionIdRef.current;

    setCsvFile(file);
    setCsvErrors([]);
    setCsvRows([]);
    setCsvDuplicateCount(0);
    if (!file) return;

    const reader = new FileReader();
    fileReaderRef.current = reader;
    reader.onload = (e) => {
      if (selectionId !== selectionIdRef.current) return;

      const csvText = (e.target?.result as string) ?? "";
      const validation = validateCSV(csvText);

      if (!validation.valid) {
        const errors: FormattedError[] = [];
        if (validation.errors.parseError) {
          errors.push({ type: "parse_error", data: validation.errors.parseError });
        }
        if (validation.errors.missingHeaders?.length) {
          errors.push({
            type: "missing_headers",
            data: validation.errors.missingHeaders,
          });
        }
        if (validation.errors.emptyRows?.length) {
          errors.push({
            type: "empty_rows",
            data: validation.errors.emptyRows.join(", "),
          });
        }
        setCsvErrors(errors);
        setCsvFile(null);
        return;
      }

      setCsvRows(validation.rows ?? []);
      setCsvDuplicateCount(validation.duplicateRows?.length ?? 0);
    };
    reader.readAsText(file);
  };

  const handleInvalidCsvFile = () => {
    toast.error(t("csv_invalid_file"));
  };

  const uploadCsv = async () => {
    if (!instituteId || csvRows.length === 0 || isUploadingCsv) return;

    setIsUploadingCsv(true);
    let successCount = 0;
    const failedRows: string[] = [];
    const productKnowledgeBySlug = new Map<string, ProductKnowledge | null>();

    for (const row of csvRows) {
      const slug = row.pkSlug.toLowerCase();
      if (!productKnowledgeBySlug.has(slug)) {
        productKnowledgeBySlug.set(
          slug,
          await apis.productKnowledge.get(slug).catch(() => null),
        );
      }
      const productKnowledge = productKnowledgeBySlug.get(slug);
      if (!productKnowledge) {
        failedRows.push(row.pkSlug);
        continue;
      }
      try {
        await apis.productMappings.create(instituteId, {
          eaushadhi_drug_details: { id: row.drugId, name: row.drugName },
          product_knowledge_id: productKnowledge.id,
        });
        successCount += 1;
      } catch {
        failedRows.push(row.pkSlug);
      }
    }

    setIsUploadingCsv(false);
    invalidateMappings();
    resetCsvState();

    if (failedRows.length === 0) {
      toast.success(t("csv_upload_success", { count: successCount }));
    } else {
      toast.error(
        t("csv_upload_partial_failure", {
          success: successCount,
          failed: failedRows.length,
        }),
      );
    }
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
            <Sheet
              open={mappingOpen}
              onOpenChange={(open) => {
                setMappingOpen(open);
                if (!open) resetCsvState();
              }}
            >
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
                          onFileChange={handleFileSelected}
                          dropLabel={t("drag_drop_csv_to_upload")}
                          browseLabel={t("browse_file")}
                          onInvalidFile={handleInvalidCsvFile}
                        />
                        {csvErrors.length > 0 && (
                          <div className="space-y-1 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
                            {csvErrors.map((error, idx) => (
                              <p key={idx}>
                                {error.type === "missing_headers" &&
                                  `${t("csv_missing_headers")}: ${
                                    Array.isArray(error.data)
                                      ? error.data.join(", ")
                                      : error.data
                                  }`}
                                {error.type === "empty_rows" &&
                                  `${t("csv_empty_values")}: ${error.data}`}
                                {error.type === "parse_error" &&
                                  `${t("csv_parse_error")}: ${error.data}`}
                              </p>
                            ))}
                          </div>
                        )}
                        {csvFile && csvErrors.length === 0 && csvRows.length > 0 && (
                          <p className="text-sm text-gray-500">
                            {t("csv_ready_to_upload", { count: csvRows.length })}
                            {csvDuplicateCount > 0 &&
                              ` ${t("csv_duplicates_skipped", { count: csvDuplicateCount })}`}
                          </p>
                        )}
                        <div className="flex justify-end gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            onClick={downloadProductMappingTemplate}
                          >
                            <DownloadIcon className="mr-2 size-4" />
                            {t("download_template")}
                          </Button>
                          <Button
                            type="button"
                            variant="primary_gradient"
                            disabled={
                              !csvFile ||
                              csvErrors.length > 0 ||
                              csvRows.length === 0 ||
                              isUploadingCsv
                            }
                            onClick={uploadCsv}
                          >
                            {isUploadingCsv && (
                              <Loader2Icon className="mr-2 size-4 animate-spin" />
                            )}
                            {t("upload")}
                          </Button>
                        </div>
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
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("product_knowledge")}</TableHead>
                  <TableHead>{t("category")}</TableHead>
                  <TableHead>{t("dvdms_drug")}</TableHead>
                  <TableHead>{t("actions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {mappings.map((mapping) => (
                  <TableRow key={mapping.id}>
                    <TableCell>
                      <div className="flex flex-col whitespace-normal">
                        <span>{mapping.product_knowledge?.name ?? "—"}</span>
                        {mapping.product_knowledge?.slug && (
                          <span className="text-xs text-gray-500">
                            {mapping.product_knowledge.slug}
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>{mapping.product_knowledge?.category ?? "—"}</TableCell>
                    <TableCell>
                      <div className="flex flex-col whitespace-normal">
                        <span>{mapping.eaushadhi_drug_details.name}</span>
                        <span className="text-xs text-gray-500">
                          {t("dvdms_drug_id")}: {mapping.eaushadhi_drug_details.id}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="font-semibold"
                        onClick={() => openEditMapping(mapping)}
                      >
                        <PencilIcon className="size-4" />
                        {t("edit")}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <div className="mt-4 flex justify-center">
              <Pagination
                totalCount={mappingsCount}
                page={mappingsPage}
                perPage={MAPPINGS_PAGE_SIZE}
                onPageChange={setMappingsPage}
              />
            </div>
          </>
        )}
      </div>
    </Page>
  );
};

export default ProductMappings;
