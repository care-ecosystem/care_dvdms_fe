import { HttpMethod, PaginatedResponse } from "@/apis/types";
import { request } from "@/apis/query";
import { Organization } from "@/types/organization";

export const apis = {
  organizations: {
    list: (params: { org_type: string; limit?: number }) =>
      request<PaginatedResponse<Organization>>(
        "/api/v1/organization/",
        HttpMethod.GET,
        params,
      ),
  },
};
