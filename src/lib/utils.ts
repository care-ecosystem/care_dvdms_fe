import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function formatQuantity(quantity: string | number): string {
  const value = Number(quantity);
  return Number.isFinite(value) ? value.toFixed(2) : String(quantity);
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
  ];

  const rows = [
    headers.map((h) => `"${h}"`).join(","),
    ...sampleData.map((row) => row.map((cell) => `"${cell}"`).join(",")),
  ];
  downloadCsv("product_mapping_template.csv", rows.join("\n"));
}
