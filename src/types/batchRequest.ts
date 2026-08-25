import { HttpMethod } from "@/apis/types";

export type BatchRequestItem = {
  url: string;
  method: HttpMethod;
  body?: Record<string, unknown>;
  reference_id: string;
};

export type BatchRequestPayload = {
  requests: BatchRequestItem[];
};

export type BatchResponseItem = {
  reference_id: string;
  data: unknown;
  status_code: number;
};

export type BatchResponse = {
  results: BatchResponseItem[];
};
