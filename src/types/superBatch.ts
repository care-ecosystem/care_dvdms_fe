import { HttpMethod } from "@/apis/types";

export type SuperBatchReplacementPath = {
  reference_id: string;
  path: string;
  type?: "body" | "url";
};

export type SuperBatchReplacement = {
  source_path: SuperBatchReplacementPath;
  value_path: SuperBatchReplacementPath;
};

export type SuperBatchRequestItem = {
  url: string;
  method: HttpMethod;
  body?: Record<string, unknown>;
  reference_id: string;
  replacements?: SuperBatchReplacement[];
};

export type SuperBatchRequestPayload = {
  requests: SuperBatchRequestItem[];
};

export type SuperBatchResponseItem = {
  reference_id: string;
  data: unknown;
  status_code: number;
};

export type SuperBatchResponse = {
  results: SuperBatchResponseItem[];
};
