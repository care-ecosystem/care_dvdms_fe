import { FC, ReactNode, useEffect, useMemo, useRef, useState } from "react";
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
  UploadIcon,
} from "lucide-react";

import { apis } from "@/apis";
import { BatchError, extractErrorMessage, performBatchRequest } from "@/apis/query";
import { BatchRequestBody, BatchResult, HttpMethod } from "@/apis/types";
import { I18N_NAMESPACE } from "@/lib/constants";
import {
  chunk as chunkArray,
  downloadAllProductMappings,
  downloadProductMappingTemplate,
  downloadProductMappingUploadReport,
  formatDate,
  getProductKnowledgeSlugValue,
  getProgressPercent,
  hasExplicitSlugScope,
  toFacilityScopedSlug,
  toInstanceScopedSlug,
} from "@/lib/utils";
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
import { ProductKnowledge, ResourceCategory } from "@/types/productKnowledge";
import { validateCSV } from "@/utils/csvValidation";
import type {
  DuplicateProductMappingCsvRow,
  DuplicateReasonCode,
  FormattedError,
  ProductMappingCsvRow,
} from "@/utils/csvValidation";
import type { ProductMappingReportRow } from "@/lib/utils";

type ProductMappingsProps = {
  facilityId: string;
};

const DUPLICATE_REASON_MESSAGE_KEYS: Record<DuplicateReasonCode, string> = {
  DUPLICATE_ROW: "csv_duplicate_row",
  DUPLICATE_DRUG_ID: "csv_duplicate_drug_id",
};

const PRODUCT_MAPPING_BATCH_SIZE = 10;

async function resolveProductKnowledgeSlugsBatch(
  slugs: string[],
  slugToUrl: (slug: string) => string,
  onProgress?: (done: number) => void,
): Promise<Map<string, ProductKnowledge>> {
  const resolved = new Map<string, ProductKnowledge>();

  for (const chunk of chunkArray(slugs, PRODUCT_MAPPING_BATCH_SIZE)) {
    const payload: BatchRequestBody = {
      requests: chunk.map((slug, idx) => ({
        reference_id: `pk_${idx}`,
        url: `/api/v1/product_knowledge/${slugToUrl(slug)}/`,
        method: HttpMethod.GET,
      })),
    };

    const results = await performBatchRequest(payload).catch((error: unknown) =>
      error instanceof BatchError ? error.results : ([] as BatchResult[]),
    );

    chunk.forEach((slug, idx) => {
      const result = results.find((r) => r.reference_id === `pk_${idx}`);
      if (result && result.status_code <= 299) {
        resolved.set(slug, result.data as ProductKnowledge);
      }
    });
    onProgress?.(chunk.length);
  }

  return resolved;
}

async function findExistingMappingDrugIdsBatch(
  instituteId: string,
  drugIds: string[],
  onProgress?: (done: number) => void,
): Promise<Set<string>> {
  const existing = new Set<string>();

  for (const chunk of chunkArray(drugIds, PRODUCT_MAPPING_BATCH_SIZE)) {
    const payload: BatchRequestBody = {
      requests: chunk.map((drugId, idx) => ({
        reference_id: `check_${idx}`,
        url: `/api/care_dvdms/institute/${instituteId}/product-mappings/?eaushadhi_drug_id=${encodeURIComponent(drugId)}&limit=1`,
        method: HttpMethod.GET,
      })),
    };

    const results = await performBatchRequest(payload).catch((error: unknown) =>
      error instanceof BatchError ? error.results : ([] as BatchResult[]),
    );

    chunk.forEach((drugId, idx) => {
      const result = results.find((r) => r.reference_id === `check_${idx}`);
      const data = result?.data as { count?: number } | undefined;
      if (result && result.status_code <= 299 && (data?.count ?? 0) > 0) {
        existing.add(drugId);
      }
    });
    onProgress?.(chunk.length);
  }

  return existing;
}

const CsvStatusCard: FC<{
  title: string;
  children: ReactNode;
  action?: ReactNode;
}> = ({ title, children, action }) => (
  <div className="space-y-2 rounded-md border border-gray-200 bg-gray-100 p-3 text-sm">
    <p className="font-semibold text-gray-900">{title}</p>
    <div className="space-y-0.5 text-gray-700">{children}</div>
    {action}
  </div>
);

type DvdmsDrugValue = {
  id: string;
  name: string;
  group_id: string;
  sub_group_id: string;
};

type MappingForm = {
  category: ResourceCategory | null;
  productKnowledge: ProductKnowledge | null;
  dvdmsDrug: DvdmsDrugValue | null;
};

const EMPTY_MAPPING: MappingForm = {
  category: null,
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
        mapping_type: "default_mapping",
      }),
    enabled: !!instituteId,
  });
  const mappings = mappingsData?.results ?? [];
  const mappingsCount = mappingsData?.count ?? 0;

  const [isDownloadingMappings, setIsDownloadingMappings] = useState(false);

  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvErrors, setCsvErrors] = useState<FormattedError[]>([]);
  const [csvRows, setCsvRows] = useState<ProductMappingCsvRow[]>([]);
  const [csvDuplicateRows, setCsvDuplicateRows] = useState<
    DuplicateProductMappingCsvRow[]
  >([]);
  const [csvReport, setCsvReport] = useState<ProductMappingReportRow[]>([]);
  const [isUploadingCsv, setIsUploadingCsv] = useState(false);
  const [isValidatingCsv, setIsValidatingCsv] = useState(false);
  const [validationProgress, setValidationProgress] = useState({ done: 0, total: 0 });
  const [uploadProgress, setUploadProgress] = useState({ done: 0, total: 0 });

  const [uploadOpen, setUploadOpen] = useState(false);
  const [mappingOpen, setMappingOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [mappingForm, setMappingForm] = useState<MappingForm>(EMPTY_MAPPING);

  const [groupId, setGroupId] = useState<string | undefined>(undefined);
  const [subgroupId, setSubgroupId] = useState<string | undefined>(undefined);

  const { data: categoriesData } = useQuery({
    queryKey: ["dvdms_resource_categories", facilityId],
    queryFn: () =>
      apis.resourceCategories.list(facilityId, {
        resource_type: "product_knowledge",
      }),
    enabled: mappingOpen,
  });
  const categories = categoriesData?.results ?? [];

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
        mappingForm.category?.slug,
        debouncedProductKnowledgeSearch,
      ],
      queryFn: () =>
        apis.productKnowledge.list({
          facility: facilityId,
          name: debouncedProductKnowledgeSearch || undefined,
          category: mappingForm.category?.slug,
          limit: 10,
        }),
      enabled: mappingOpen && !!mappingForm.category,
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
        hstnum_subgroup_id: subgroupId,
      }),
    enabled: !!instituteId && !!groupId,
  });

  const handleCategoryChange = (id: string) => {
    const category = categories.find((c) => c.id === id) ?? null;
    setMappingForm((prev) => ({ ...prev, category, productKnowledge: null }));
    setProductKnowledgeSearch("");
  };

  const handleGroupChange = (id: string) => {
    setGroupId(id);
    setSubgroupId(undefined);
    setMappingForm((prev) => ({ ...prev, dvdmsDrug: null }));
  };

  const handleSubgroupChange = (id: string) => {
    setSubgroupId(id || undefined);
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
        mapping_type: "default_mapping",
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

  const handleDownloadAllMappings = async () => {
    if (!instituteId || isDownloadingMappings) return;

    setIsDownloadingMappings(true);
    try {
      const allMappings: DvdmsProductMapping[] = [];
      let offset = 0;
      const pageSize = 50;

      for (;;) {
        const page = await apis.productMappings.list(instituteId, {
          limit: pageSize,
          offset,
          mapping_type: "default_mapping",
        });
        allMappings.push(...page.results);
        if (page.results.length !== pageSize || allMappings.length >= page.count) {
          break;
        }
        offset += pageSize;
      }

      downloadAllProductMappings(
        allMappings.map((mapping) => ({
          drugId: mapping.eaushadhi_drug_details.id,
          drugName: mapping.eaushadhi_drug_details.name,
          productKnowledgeName: mapping.product_knowledge?.name ?? "",
          productKnowledgeSlug: mapping.product_knowledge
            ? getProductKnowledgeSlugValue(mapping.product_knowledge)
            : "",
        })),
      );
    } catch (error) {
      toast.error(getErrorMessage(error) || t("download_all_mappings_error"));
    } finally {
      setIsDownloadingMappings(false);
    }
  };

  const resetCsvState = () => {
    setCsvFile(null);
    setCsvErrors([]);
    setCsvRows([]);
    setCsvDuplicateRows([]);
    setCsvReport([]);
    setValidationProgress({ done: 0, total: 0 });
    setUploadProgress({ done: 0, total: 0 });
  };

  const clearMappingForm = () => {
    setEditingId(null);
    setMappingForm(EMPTY_MAPPING);
    setGroupId(undefined);
    setSubgroupId(undefined);
  };

  const openAddMapping = () => {
    clearMappingForm();
    setMappingOpen(true);
  };

  const openUpload = () => {
    resetCsvState();
    setUploadOpen(true);
  };

  const openEditMapping = (mapping: DvdmsProductMapping) => {
    setEditingId(mapping.id);
    setMappingForm({
      category: mapping.product_knowledge?.category ?? null,
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
    setCsvDuplicateRows([]);
    setCsvReport([]);
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
      setCsvDuplicateRows(validation.duplicateRows ?? []);
    };
    reader.readAsText(file);
  };

  const handleInvalidCsvFile = () => {
    toast.error(t("csv_invalid_file"));
  };

  const uploadCsv = async () => {
    if (!instituteId || csvRows.length === 0 || isUploadingCsv) return;

    setIsValidatingCsv(true);
    let successCount = 0;
    const report: ProductMappingReportRow[] = [];

    const uniqueSlugs = Array.from(
      new Set(csvRows.map((row) => row.pkSlug.toLowerCase())),
    );
    const unscopedSlugs = uniqueSlugs.filter((slug) => !hasExplicitSlugScope(slug));
    const scopedSlugs = uniqueSlugs.filter(hasExplicitSlugScope);

    setValidationProgress({ done: 0, total: uniqueSlugs.length });
    const onValidationProgress = (done: number) =>
      setValidationProgress((prev) => ({ ...prev, done: prev.done + done }));

    const productKnowledgeBySlug = new Map<string, ProductKnowledge>([
      ...(await resolveProductKnowledgeSlugsBatch(
        scopedSlugs,
        (slug) => slug,
        onValidationProgress,
      )),
      ...(await resolveProductKnowledgeSlugsBatch(
        unscopedSlugs,
        (slug) => toFacilityScopedSlug(facilityId, slug),
        onValidationProgress,
      )),
    ]);

    const stillMissingSlugs = unscopedSlugs.filter(
      (slug) => !productKnowledgeBySlug.has(slug),
    );
    if (stillMissingSlugs.length > 0) {
      setValidationProgress((prev) => ({
        ...prev,
        total: prev.total + stillMissingSlugs.length,
      }));
      const instanceScoped = await resolveProductKnowledgeSlugsBatch(
        stillMissingSlugs,
        toInstanceScopedSlug,
        onValidationProgress,
      );
      instanceScoped.forEach((pk, slug) => productKnowledgeBySlug.set(slug, pk));
    }

    const activeRows: { row: ProductMappingCsvRow; productKnowledge: ProductKnowledge }[] = [];
    for (const row of csvRows) {
      const productKnowledge = productKnowledgeBySlug.get(row.pkSlug.toLowerCase());
      if (!productKnowledge) {
        report.push({
          drugId: row.drugId,
          drugName: row.drugName,
          pkName: row.pkName,
          pkSlug: row.pkSlug,
          status: "FAILED",
          message: t("csv_product_knowledge_not_found"),
        });
        continue;
      }
      if (productKnowledge.status && productKnowledge.status !== "active") {
        report.push({
          drugId: row.drugId,
          drugName: row.drugName,
          pkName: row.pkName,
          pkSlug: row.pkSlug,
          status: "SKIPPED",
          message: t("csv_skipped_inactive_product_knowledge", {
            status: productKnowledge.status,
          }),
        });
        continue;
      }
      activeRows.push({ row, productKnowledge });
    }

    const uniqueActiveDrugIds = Array.from(
      new Set(activeRows.map(({ row }) => row.drugId)),
    );
    setValidationProgress((prev) => ({
      ...prev,
      total: prev.total + uniqueActiveDrugIds.length,
    }));
    const existingDrugIds = await findExistingMappingDrugIdsBatch(
      instituteId,
      uniqueActiveDrugIds,
      onValidationProgress,
    );

    setIsValidatingCsv(false);

    const resolvedRows: { row: ProductMappingCsvRow; productKnowledge: ProductKnowledge }[] =
      [];
    for (const entry of activeRows) {
      if (existingDrugIds.has(entry.row.drugId)) {
        report.push({
          drugId: entry.row.drugId,
          drugName: entry.row.drugName,
          pkName: entry.row.pkName,
          pkSlug: entry.row.pkSlug,
          status: "SKIPPED",
          message: t("csv_skipped_existing_mapping"),
        });
        continue;
      }
      resolvedRows.push(entry);
    }

    setIsUploadingCsv(true);
    setUploadProgress({ done: 0, total: resolvedRows.length });

    for (const chunk of chunkArray(resolvedRows, PRODUCT_MAPPING_BATCH_SIZE)) {
      const payload: BatchRequestBody = {
        requests: chunk.map(({ row, productKnowledge }, idx) => ({
          reference_id: `create_${idx}`,
          url: `/api/care_dvdms/institute/${instituteId}/product-mappings/`,
          method: HttpMethod.POST,
          body: {
            eaushadhi_drug_details: { id: row.drugId, name: row.drugName },
            product_knowledge_id: productKnowledge.id,
            mapping_type: "default_mapping",
          },
        })),
      };

      try {
        await performBatchRequest(payload);
        chunk.forEach(({ row }) => {
          successCount += 1;
          report.push({
            drugId: row.drugId,
            drugName: row.drugName,
            pkName: row.pkName,
            pkSlug: row.pkSlug,
            status: "SUCCESS",
          });
        });
      } catch (error) {
        if (!(error instanceof BatchError)) {
          const message = getErrorMessage(error) || t("csv_row_upload_error");
          chunk.forEach(({ row }) => {
            report.push({
              drugId: row.drugId,
              drugName: row.drugName,
              pkName: row.pkName,
              pkSlug: row.pkSlug,
              status: "FAILED",
              message,
            });
          });
          continue;
        }

        const resultByRef = new Map(error.results.map((r) => [r.reference_id, r]));

        chunk.forEach(({ row }, idx) => {
          const result = resultByRef.get(`create_${idx}`);
          if (result && result.status_code <= 299) {
            report.push({
              drugId: row.drugId,
              drugName: row.drugName,
              pkName: row.pkName,
              pkSlug: row.pkSlug,
              status: "SKIPPED",
              message: t("csv_skipped_batch_rollback"),
            });
            return;
          }
          if (result && result.status_code === 409) {
            report.push({
              drugId: row.drugId,
              drugName: row.drugName,
              pkName: row.pkName,
              pkSlug: row.pkSlug,
              status: "SKIPPED",
              message: t("csv_skipped_existing_mapping"),
            });
            return;
          }
          report.push({
            drugId: row.drugId,
            drugName: row.drugName,
            pkName: row.pkName,
            pkSlug: row.pkSlug,
            status: "FAILED",
            message:
              (result && extractErrorMessage(result.data)) ||
              t("csv_row_upload_error"),
          });
        });
      } finally {
        setUploadProgress((prev) => ({ ...prev, done: prev.done + chunk.length }));
      }
    }

    for (const row of csvDuplicateRows) {
      report.push({
        drugId: row.drugId,
        drugName: row.drugName,
        pkName: row.pkName,
        pkSlug: row.pkSlug,
        status: "SKIPPED",
        message: t(DUPLICATE_REASON_MESSAGE_KEYS[row.reasonCode]),
      });
    }

    const failedCount = report.filter((row) => row.status === "FAILED").length;

    setIsUploadingCsv(false);
    invalidateMappings();
    setCsvReport(report);

    if (failedCount === 0) {
      resetCsvState();
      toast.success(t("csv_upload_success", { count: successCount }));
    } else {
      toast.error(
        t("csv_upload_partial_failure", {
          success: successCount,
          failed: failedCount,
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

          <div className="flex flex-wrap justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={!instituteId || isDownloadingMappings || mappingsCount === 0}
              onClick={handleDownloadAllMappings}
            >
              {isDownloadingMappings ? (
                <Loader2Icon className="mr-2 size-4 animate-spin" />
              ) : (
                <DownloadIcon className="mr-2 size-4" />
              )}
              {isDownloadingMappings
                ? t("downloading_mappings")
                : t("download_all_mappings")}
            </Button>

            <Sheet
              open={uploadOpen}
              onOpenChange={(open) => {
                setUploadOpen(open);
                if (!open) resetCsvState();
              }}
            >
              <SheetTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  disabled={!instituteId}
                  onClick={openUpload}
                >
                  <UploadIcon className="mr-2 size-4" />
                  {t("upload_mapping_csv")}
                </Button>
              </SheetTrigger>
              <SheetContent
                closeLabel={t("close")}
                showCloseButton={false}
                className="flex w-full flex-col sm:max-w-2xl overflow-y-auto"
              >
                <SheetHeader>
                  <SheetTitle>{t("upload_mapping_csv")}</SheetTitle>
                </SheetHeader>
                <div className="px-1 space-y-3">
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
                  {isValidatingCsv && (
                    <div className="flex flex-col gap-1.5 rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-600">
                      <div className="flex items-center gap-2">
                        <Loader2Icon className="size-4 shrink-0 animate-spin" />
                        <span>
                          {t("csv_validating_rows", {
                            percent: getProgressPercent(validationProgress),
                          })}
                        </span>
                      </div>
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-200">
                        <div
                          className="h-full rounded-full bg-primary-500 transition-[width]"
                          style={{
                            width: `${getProgressPercent(validationProgress)}%`,
                          }}
                        />
                      </div>
                    </div>
                  )}
                  {isUploadingCsv && (
                    <div className="flex flex-col gap-1.5 rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-600">
                      <div className="flex items-center gap-2">
                        <Loader2Icon className="size-4 shrink-0 animate-spin" />
                        <span>
                          {t("csv_uploading_progress", {
                            percent: getProgressPercent(uploadProgress),
                          })}
                        </span>
                      </div>
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-200">
                        <div
                          className="h-full rounded-full bg-primary-500 transition-[width]"
                          style={{
                            width: `${getProgressPercent(uploadProgress)}%`,
                          }}
                        />
                      </div>
                    </div>
                  )}
                  {csvErrors.length > 0 && (
                    <CsvStatusCard title={t("csv_validation_issues")}>
                      {csvErrors.map((error, idx) => (
                        <p key={idx} className="text-red-600">
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
                    </CsvStatusCard>
                  )}
                  {csvFile &&
                    csvErrors.length === 0 &&
                    csvRows.length > 0 &&
                    csvReport.length === 0 &&
                    !isValidatingCsv &&
                    !isUploadingCsv && (
                      <CsvStatusCard title={t("csv_ready_title")}>
                        <p>
                          {t("csv_ready_to_upload", { count: csvRows.length })}
                        </p>
                        {csvDuplicateRows.length > 0 && (
                          <p>
                            {t("csv_duplicates_skipped", {
                              count: csvDuplicateRows.length,
                            })}
                          </p>
                        )}
                      </CsvStatusCard>
                    )}
                  {csvReport.length > 0 &&
                    (() => {
                      const successCount = csvReport.filter(
                        (row) => row.status === "SUCCESS",
                      ).length;
                      const skippedCount = csvReport.filter(
                        (row) => row.status === "SKIPPED",
                      ).length;
                      const failedCount = csvReport.filter(
                        (row) => row.status === "FAILED",
                      ).length;

                      return (
                        <CsvStatusCard
                          title={t("csv_upload_status_title")}
                          action={
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="bg-white"
                              onClick={() =>
                                downloadProductMappingUploadReport(csvReport)
                              }
                            >
                              <DownloadIcon className="mr-2 size-4" />
                              {t("download_report")}
                            </Button>
                          }
                        >
                          <ul className="list-disc space-y-0.5 pl-4">
                            {successCount > 0 && (
                              <li className="text-primary-700">
                                {t("csv_report_summary_success", {
                                  count: successCount,
                                })}
                              </li>
                            )}
                            {skippedCount > 0 && (
                              <li className="text-gray-900">
                                {t("csv_report_summary_skipped", {
                                  count: skippedCount,
                                })}
                              </li>
                            )}
                            {failedCount > 0 && (
                              <li className="text-red-600">
                                {t("csv_report_summary_failed", {
                                  count: failedCount,
                                })}
                              </li>
                            )}
                          </ul>
                        </CsvStatusCard>
                      );
                    })()}
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
                      variant="primary"
                      disabled={
                        !csvFile ||
                        csvErrors.length > 0 ||
                        csvRows.length === 0 ||
                        isValidatingCsv ||
                        isUploadingCsv
                      }
                      onClick={uploadCsv}
                    >
                      {(isValidatingCsv || isUploadingCsv) && (
                        <Loader2Icon className="mr-2 size-4 animate-spin" />
                      )}
                      {t("upload")}
                    </Button>
                  </div>
                </div>
              </SheetContent>
            </Sheet>

            <Sheet open={mappingOpen} onOpenChange={setMappingOpen}>
              <SheetTrigger asChild>
                <Button
                  type="button"
                  variant="primary"
                  disabled={!instituteId}
                  onClick={openAddMapping}
                >
                  <PlusIcon className="size-4" />
                  {t("add_mapping_manually")}
                </Button>
              </SheetTrigger>
              <SheetContent
                closeLabel={t("close")}
                showCloseButton={false}
                className="flex w-full flex-col sm:max-w-2xl overflow-y-auto"
              >
                <SheetHeader>
                  <SheetTitle>
                    {editingId ? t("edit_mapping") : t("add_mapping_manually")}
                  </SheetTitle>
                </SheetHeader>
                <div className="px-1 space-y-4">
                  <div className="space-y-2">
                    <Label>
                      {t("category")}
                      <span className="text-red-500">*</span>
                    </Label>
                    <Autocomplete
                      options={categories.map((category) => ({
                        value: category.id,
                        label: category.title,
                      }))}
                      value={mappingForm.category?.id ?? ""}
                      onChange={handleCategoryChange}
                      placeholder={t("category_placeholder")}
                      inputPlaceholder={t("search_category")}
                      noOptionsMessage={t("no_categories_found")}
                      showClearButton={false}
                    />
                  </div>
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
                      disabled={!mappingForm.category && !editingId}
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
                    <Label>{t("dvdms_subgroup")}</Label>
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
                      showClearButton
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
                      disabled={!groupId}
                      showClearButton={false}
                    />
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
                  <TableHead>{t("created_by")}</TableHead>
                  <TableHead>{t("created_date")}</TableHead>
                  <TableHead>{t("actions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {mappings.map((mapping) => (
                  <TableRow key={mapping.id}>
                    <TableCell>
                      <div className="flex min-w-60 flex-col whitespace-normal">
                        <span>{mapping.product_knowledge?.name ?? "—"}</span>
                        {mapping.product_knowledge && (
                          <span className="text-xs text-gray-500">
                            {t("slug")}:{" "}
                            {getProductKnowledgeSlugValue(mapping.product_knowledge)}
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {mapping.product_knowledge?.category?.title ?? "—"}
                    </TableCell>
                    <TableCell>
                      <div className="flex min-w-80 flex-col whitespace-normal">
                        <span>{mapping.eaushadhi_drug_details.name}</span>
                        <span className="text-xs text-gray-500">
                          {t("dvdms_drug_id")}: {mapping.eaushadhi_drug_details.id}
                          {"\u00A0\u00A0"}({t("group_id")}:{" "}
                          {mapping.eaushadhi_drug_details.group_id})
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {mapping.created_by
                        ? `${mapping.created_by.first_name} ${mapping.created_by.last_name}`.trim() ||
                          mapping.created_by.username
                        : "—"}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {formatDate(mapping.created_date)}
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
