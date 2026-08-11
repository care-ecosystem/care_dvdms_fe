import { FC, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  FolderOpenIcon,
  PencilIcon,
  PlusIcon,
  Trash2Icon,
  UploadIcon,
} from "lucide-react";

import { I18N_NAMESPACE } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import ProductKnowledgeCombobox from "@/components/ProductKnowledgeCombobox";
import { DvdmsProductMapping } from "@/types/dvdms_config";
import { ProductKnowledge } from "@/types/productKnowledge";

type ProductMappingsProps = {
  facilityId: string;
};

type MappingForm = {
  productKnowledge: ProductKnowledge | null;
  eaushadhi_drug_id: string;
};

const EMPTY_MAPPING: MappingForm = {
  productKnowledge: null,
  eaushadhi_drug_id: "",
};

const ProductMappings: FC<ProductMappingsProps> = ({ facilityId }) => {
  const { t } = useTranslation(I18N_NAMESPACE);

  // ponytail: local state until the mapping list/create/update/delete APIs exist
  const [mappings, setMappings] = useState<DvdmsProductMapping[]>([]);

  const [uploadOpen, setUploadOpen] = useState(false);
  const [csvFile, setCsvFile] = useState<File | null>(null);

  const [mappingOpen, setMappingOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [mappingForm, setMappingForm] = useState<MappingForm>(EMPTY_MAPPING);

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
      eaushadhi_drug_id: mapping.eaushadhi_drug_id,
    });
    setMappingOpen(true);
  };

  const saveMapping = () => {
    if (!mappingForm.productKnowledge) {
      return;
    }
    const mapping = {
      product_knowledge_id: mappingForm.productKnowledge.id,
      product_knowledge_name: mappingForm.productKnowledge.name,
      eaushadhi_drug_id: mappingForm.eaushadhi_drug_id,
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

  const actions = (
    <div className="flex flex-wrap gap-2">
      <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
        <DialogTrigger asChild>
          <Button variant="outline">
            <UploadIcon className="mr-2 size-4" />
            {t("upload_mapping_csv")}
          </Button>
        </DialogTrigger>
        <DialogContent closeLabel={t("close")} className="max-w-md w-[95%] rounded-md">
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
              <Button variant="outline">{t("cancel")}</Button>
            </DialogClose>
            <Button variant="primary" disabled={!csvFile} onClick={uploadCsv}>
              {t("upload")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={mappingOpen} onOpenChange={setMappingOpen}>
        <DialogTrigger asChild>
          <Button variant="primary" onClick={openAddMapping}>
            <PlusIcon className="mr-2 size-4" />
            {t("add_mapping_manually")}
          </Button>
        </DialogTrigger>
        <DialogContent closeLabel={t("close")} className="max-w-md w-[95%] rounded-md">
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
                  setMappingForm((prev) => ({ ...prev, productKnowledge }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label>{t("eaushadhi_drug_id")}</Label>
              <Input
                className="h-9"
                placeholder={t("eaushadhi_drug_id_placeholder")}
                value={mappingForm.eaushadhi_drug_id}
                onChange={(e) =>
                  setMappingForm((prev) => ({
                    ...prev,
                    eaushadhi_drug_id: e.target.value,
                  }))
                }
              />
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">{t("cancel")}</Button>
            </DialogClose>
            <Button
              variant="primary"
              disabled={
                !mappingForm.productKnowledge || !mappingForm.eaushadhi_drug_id
              }
              onClick={saveMapping}
            >
              {t("save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );

  return (
    <Page
      title={t("product_mappings")}
      hideTitleOnPage
      className="p-0 care-dvdms-container"
    >
      <div className="container mx-auto p-4">
        <div className="mb-4 flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">
              {t("product_mappings")}
            </h3>
            <p className="text-sm text-gray-500">
              {t("product_mappings_subtitle")}
            </p>
          </div>
          {actions}
        </div>

        {mappings.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-gray-300 py-16 text-center">
            <FolderOpenIcon className="text-primary-600 size-6" />
            <p className="font-medium text-gray-900">{t("no_mappings")}</p>
            <p className="text-sm text-gray-500">
              {t("no_mappings_description")}
            </p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-lg border border-gray-200">
            <div className="grid grid-cols-[1fr_1fr_auto] gap-4 bg-gray-100 px-4 py-2 text-xs font-medium uppercase text-gray-500">
              <span>{t("product_knowledge")}</span>
              <span>{t("eaushadhi_drug_id")}</span>
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
                    {mapping.eaushadhi_drug_id}
                  </span>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => openEditMapping(mapping)}
                      aria-label={t("edit_mapping")}
                    >
                      <PencilIcon className="size-4" />
                    </Button>
                    <Button
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
