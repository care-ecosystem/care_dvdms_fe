import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

import { ProductKnowledge } from "@/types/productKnowledge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function getProgressPercent(progress: {
  done: number;
  total: number;
}): number {
  if (progress.total <= 0) return 0;
  return Math.min(100, Math.round((progress.done / progress.total) * 100));
}

export function getProductKnowledgeSlugValue(
  productKnowledge: Pick<ProductKnowledge, "slug" | "slug_config">,
): string {
  return productKnowledge.slug_config?.slug_value ?? productKnowledge.slug;
}

export function hasExplicitSlugScope(slug: string): boolean {
  return slug.startsWith("f-") || slug.startsWith("i-");
}

export function toFacilityScopedSlug(facilityId: string, slug: string): string {
  return `f-${facilityId}-${slug}`;
}

export function toInstanceScopedSlug(slug: string): string {
  return `i-${slug}`;
}

export function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function toQuantity(value: string | number | undefined): number {
  return Math.max(0, Math.round(Number(value) || 0));
}

export function formatQuantity(quantity: string | number): string {
  const value = Number(quantity);
  return Number.isFinite(value) ? value.toFixed(2) : String(quantity);
}

export function parseLookupId(
  value: string | number | null | undefined,
): number | undefined {
  if (value === null || value === undefined || value === "") return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

export function formatLookupId(
  value: string | number | null | undefined,
): string {
  if (value === null || value === undefined) return "—";
  const text = String(value).trim();
  if (!text || text === "null" || text === "undefined") return "—";
  return text;
}

export function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

export function downloadCsv(filename: string, content: string): void {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export function downloadProductMappingTemplate(): void {
  const headers = [
    "DVDMS Drug ID",
    "DVDMS Drug Name",
    "Product Knowledge Name",
    "Product Knowledge Slug",
  ];
  const sampleData = [
    ["6.6.19", "Cefotaxime Injection IP 1gm 1x1Vial", "Cefotaxime 1gm Injection", "cefotaxime-1gm-injection"],
    ["D00045", "Ibuprofen Oral Suspension IP 100mg/5ml 1x60ml bottle", "Ibuprofen 100mg/5ml Suspension", "ibuprofen-suspension"],
    ["D00046", "Aceclofenac Tablet 100 mg 1x1", "Aceclofenac 100mg Tablet", "aceclofenac-100mg"],
    ["10000409", "Fentanyl 100 Mcg/2ml(100 Mcg/2Ml)", "Fentanyl 100mcg/2ml Injection", "fentanyl-100mcg2ml-inject"],
  ];

  const rows = [
    headers.map((h) => `"${h}"`).join(","),
    ...sampleData.map((row) => row.map((cell) => `"${cell}"`).join(",")),
  ];
  downloadCsv("product_mapping_template.csv", rows.join("\n"));
}

export type ProductMappingReportRow = {
  drugId: string;
  drugName: string;
  pkName: string;
  pkSlug: string;
  status: "SUCCESS" | "FAILED" | "SKIPPED";
  message?: string;
};

export function downloadProductMappingUploadReport(
  rows: ProductMappingReportRow[],
): void {
  const headers = [
    "DVDMS Drug ID",
    "DVDMS Drug Name",
    "Product Knowledge Name",
    "Product Knowledge Slug",
    "Status",
    "Reason",
  ];
  const csvRows = [
    headers.map((h) => `"${h}"`).join(","),
    ...rows.map((row) =>
      [
        row.drugId,
        row.drugName,
        row.pkName,
        row.pkSlug,
        row.status,
        row.message ?? "",
      ]
        .map((cell) => `"${cell.replace(/"/g, '""')}"`)
        .join(","),
    ),
  ];
  downloadCsv("product_mapping_upload_report.csv", "\uFEFF" + csvRows.join("\n"));
}

export type ProductMappingExportRow = {
  drugId: string;
  drugName: string;
  productKnowledgeName: string;
  productKnowledgeSlug: string;
};

export function downloadAllProductMappings(
  mappings: ProductMappingExportRow[],
): void {
  const headers = [
    "DVDMS Drug ID",
    "DVDMS Drug Name",
    "Product Knowledge Name",
    "Product Knowledge Slug",
  ];
  const rows = [
    headers.map((h) => `"${h}"`).join(","),
    ...mappings.map((row) =>
      [
        row.drugId,
        row.drugName,
        row.productKnowledgeName,
        row.productKnowledgeSlug,
      ]
        .map((cell) => `"${cell.replace(/"/g, '""')}"`)
        .join(","),
    ),
  ];
  downloadCsv("product_mappings.csv", "\uFEFF" + rows.join("\n"));
}
