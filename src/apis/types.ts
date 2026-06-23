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
