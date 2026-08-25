export type RequestOptions = {
  formdata?: boolean;
  external?: boolean;
  headers?: Record<string, string>;
  auth?: boolean;
};

export enum HttpMethod {
  GET = "GET",
  POST = "POST",
  PUT = "PUT",
  PATCH = "PATCH",
  DELETE = "DELETE",
}

export interface PaginatedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

export interface BatchSubRequest {
  reference_id: string;
  url: string;
  method: HttpMethod;
  body?: Record<string, unknown>;
}

export interface BatchRequestBody {
  requests: BatchSubRequest[];
}

export interface BatchResult<T = unknown> {
  reference_id: string;
  data: T;
  status_code: number;
}

export interface BatchResponse<T = unknown> {
  results: BatchResult<T>[];
}
