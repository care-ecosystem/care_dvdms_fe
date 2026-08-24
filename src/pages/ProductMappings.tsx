import { FC, useState } from "react";
import { navigate } from "raviger";
import { useTranslation } from "react-i18next";
import {
  ArrowLeftIcon,
  FolderOpenIcon,
  PencilIcon,
  PlusIcon,
  Trash2Icon,
  UploadIcon,
} from "lucide-react";

import { I18N_NAMESPACE } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import Page from "@/components/ui/page";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import FileDropzone from "@/components/FileDropzone";
import DvdmsDrugCombobox, { DvdmsDrug } from "@/components/DvdmsDrugCombobox";
import ProductKnowledgeCombobox from "@/components/ProductKnowledgeCombobox";
import { DvdmsProductMapping } from "@/types/dvdms_config";
import { ProductKnowledge } from "@/types/productKnowledge";

type ProductMappingsProps = {
  facilityId: string;
};

type MappingForm = {
  productKnowledge: ProductKnowledge | null;
  dvdmsDrug: DvdmsDrug | null;
};

const EMPTY_MAPPING: MappingForm = {
  productKnowledge: null,
  dvdmsDrug: null,
};

const ProductMappings: FC<ProductMappingsProps> = ({ facilityId }) => {
  const { t } = useTranslation(I18N_NAMESPACE);

  // TODO: local state until the mapping list/create/update/delete API exists
  const [mappings, setMappings] = useState<DvdmsProductMapping[]>([]);

  const [uploadOpen, setUploadOpen] = useState(false);
  const [csvFile, setCsvFile] = useState<File | null>(null);

  const [mappingOpen, setMappingOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [mappingForm, setMappingForm] = useState<MappingForm>(EMPTY_MAPPING);

  const goBackToDvdmsConfig = () => {
    navigate(`/facility/${facilityId}/settings/general/dvdms`);
  };

  const openAddMapping = () => {
    setEditingId(null);
    setMappingForm(EMPTY_MAPPING);
    setMappingOpen(true);
  };

  const openEditMapping = (mapping: DvdmsProductMapping) => {
    setEditingId(mapping.id);
    setMappingForm({
      productKnowledge: {
        id: mapping.product_knowledge_id,
        slug: mapping.product_knowledge_id,
        name: mapping.product_knowledge_name,
      },
      dvdmsDrug: {
        id: mapping.dvdms_drug_id,
        name: mapping.dvdms_drug_name,
      },
    });
    setMappingOpen(true);
  };

  const saveMapping = () => {
    if (!mappingForm.productKnowledge || !mappingForm.dvdmsDrug) {
      return;
    }
    const mapping = {
      product_knowledge_id: mappingForm.productKnowledge.id,
      product_knowledge_name: mappingForm.productKnowledge.name,
      dvdms_drug_id: mappingForm.dvdmsDrug.id,
      dvdms_drug_name: mappingForm.dvdmsDrug.name,
    };
    if (editingId) {
      setMappings((prev) =>
        prev.map((m) => (m.id === editingId ? { ...m, ...mapping } : m)),
      );
    } else {
      setMappings((prev) => [...prev, { id: crypto.randomUUID(), ...mapping }]);
    }
    setMappingOpen(false);
  };

  const deleteMapping = (id: string) => {
    setMappings((prev) => prev.filter((m) => m.id !== id));
  };

  const uploadCsv = () => {
    // TODO: send csvFile to the bulk mapping upload API once available
    setCsvFile(null);
    setUploadOpen(false);
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
            <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
              <DialogTrigger asChild>
                <Button type="button" variant="outline">
                  <UploadIcon className="mr-2 size-4" />
                  {t("upload_mapping_csv")}
                </Button>
              </DialogTrigger>
              <DialogContent
                closeLabel={t("close")}
                className="max-w-md w-[95%] rounded-md"
              >
                <DialogHeader>
                  <DialogTitle>{t("upload_mapping_csv")}</DialogTitle>
                  <DialogDescription>
                    {t("upload_mapping_csv_subtitle")}
                  </DialogDescription>
                </DialogHeader>
                <FileDropzone
                  accept=".csv"
                  selectedFile={csvFile}
                  onFileChange={setCsvFile}
                  dropLabel={t("drag_drop_csv_to_upload")}
                  browseLabel={t("browse_file")}
                />
                <DialogFooter>
                  <DialogClose asChild>
                    <Button type="button" variant="outline">
                      {t("cancel")}
                    </Button>
                  </DialogClose>
                  <Button
                    type="button"
                    variant="primary"
                    disabled={!csvFile}
                    onClick={uploadCsv}
                  >
                    {t("upload")}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            <Dialog open={mappingOpen} onOpenChange={setMappingOpen}>
              <DialogTrigger asChild>
                <Button type="button" variant="primary" onClick={openAddMapping}>
                  <PlusIcon className="mr-2 size-4" />
                  {t("add_mapping_manually")}
                </Button>
              </DialogTrigger>
              <DialogContent
                closeLabel={t("close")}
                className="max-w-md w-[95%] rounded-md"
              >
                <DialogHeader>
                  <DialogTitle>
                    {editingId ? t("edit_mapping") : t("add_mapping")}
                  </DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>{t("product_knowledge")}</Label>
                    <ProductKnowledgeCombobox
                      facilityId={facilityId}
                      value={mappingForm.productKnowledge}
                      onChange={(productKnowledge) =>
                        setMappingForm((prev) => ({
                          ...prev,
                          productKnowledge,
                        }))
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>{t("dvdms_drug")}</Label>
                    <DvdmsDrugCombobox
                      value={mappingForm.dvdmsDrug}
                      onChange={(dvdmsDrug) =>
                        setMappingForm((prev) => ({ ...prev, dvdmsDrug }))
                      }
                    />
                  </div>
                </div>
                <DialogFooter>
                  <DialogClose asChild>
                    <Button type="button" variant="outline">
                      {t("cancel")}
                    </Button>
                  </DialogClose>
                  <Button
                    type="button"
                    variant="primary"
                    disabled={
                      !mappingForm.productKnowledge || !mappingForm.dvdmsDrug
                    }
                    onClick={saveMapping}
                  >
                    {t("save")}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {mappings.length === 0 ? (
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
                    {mapping.product_knowledge_name}
                  </span>
                  <span className="text-sm text-gray-500">
                    {mapping.dvdms_drug_name}
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
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => deleteMapping(mapping.id)}
                      aria-label={t("delete_mapping")}
                    >
                      <Trash2Icon className="size-4" />
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
