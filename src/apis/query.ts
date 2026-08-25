import { apis } from "@/apis/index";
import { BatchRequestBody, BatchResponse, BatchResult, HttpMethod, RequestOptions } from "@/apis/types";

const CARE_ACCESS_TOKEN_KEY = "care_access_token";

export function extractErrorMessage(data: unknown): string | null {
  if (!data || typeof data !== "object") {
    return null;
  }

  const obj = data as Record<string, unknown>;

  if (typeof obj.detail === "string") {
    return obj.detail;
  }

  if (typeof obj.error === "string") {
    return obj.error;
  }

  if (Array.isArray(obj.errors) && obj.errors.length > 0) {
    const firstError = obj.errors[0] as Record<string, unknown>;

    if (
      firstError.ctx &&
      typeof firstError.ctx === "object" &&
      typeof (firstError.ctx as Record<string, unknown>).error === "string"
    ) {
      return (firstError.ctx as Record<string, unknown>).error as string;
    }

    if (typeof firstError.msg === "string") {
      return firstError.msg;
    }

    if (firstError.msg && typeof firstError.msg === "object") {
      const value = Object.values(firstError.msg)[0];
      if (typeof value === "string") {
        return value;
      }
    }

    if (typeof firstError.error === "string") {
      return firstError.error;
    }
  }

  return null;
}

export const request = async <T>(
  endpoint: string,
  method: HttpMethod = HttpMethod.GET,
  data: Record<string, unknown> = {},
  options: RequestOptions = {},
): Promise<T> => {
  const CARE_BASE_URL = window.CARE_API_URL;
  const { formdata, external, headers, auth: isAuth } = options;

  let url = external ? endpoint : CARE_BASE_URL + endpoint;
  let payload: string | null = formdata
    ? (data as unknown as string)
    : JSON.stringify(data);

  if (method === HttpMethod.GET) {
    const params = Object.keys(data)
      .filter((k) => data[k] !== null && data[k] !== undefined)
      .map(
        (k) =>
          `${encodeURIComponent(k)}=${encodeURIComponent(String(data[k]))}`,
      )
      .join("&");
    if (params) url += `?${params}`;
    payload = null;
  }

  const token = localStorage.getItem(CARE_ACCESS_TOKEN_KEY);
  const auth = isAuth === false || !token ? "" : `Bearer ${token}`;

  const response = await fetch(url, {
    method,
    headers: external
      ? { ...headers }
      : {
          Accept: "application/json",
          "Content-Type": "application/json",
          Authorization: auth,
          ...headers,
        },
    body: payload,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw {
      status: response.status,
      data: error,
      message: extractErrorMessage(error) || "An error occurred",
    };
  }

  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
};

export class BatchError extends Error {
  results: BatchResult[];
  failed: BatchResult[];
  status?: number;
  errorMessages: string[];

  constructor(
    message: string,
    info: { results: BatchResult[]; failed: BatchResult[]; status?: number },
  ) {
    super(message);
    this.name = "BatchError";
    this.results = info.results;
    this.failed = info.failed;
    this.status = info.status;
    this.errorMessages = this.failed
      .map((result) => extractErrorMessage(result.data))
      .filter((msg): msg is string => msg !== null);
  }
}

function extractResultsFromError(err: unknown): BatchResult[] {
  const e = err as {
    data?: { results?: BatchResult[] };
    error?: { results?: BatchResult[] };
    results?: BatchResult[];
  };
  const results = e?.data?.results ?? e?.error?.results ?? e?.results;
  return Array.isArray(results) ? results : [];
}

export async function performBatchRequest(
  payload: BatchRequestBody,
): Promise<BatchResult[]> {
  let response: BatchResponse;
  try {
    response = await apis.batchRequest(payload);
  } catch (err) {
    const results = extractResultsFromError(err);
    if (results.length) {
      throw new BatchError("Batch rolled back", {
        results,
        failed: results.filter((r) => r.status_code > 299),
        status: (err as { status?: number })?.status,
      });
    }
    throw err;
  }

  const results = response.results ?? [];
  const failed = results.filter((r) => r.status_code > 299);
  if (failed.length) {
    throw new BatchError("Batch rolled back", { results, failed });
  }
  return results;
}
