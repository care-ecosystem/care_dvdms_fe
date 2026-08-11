import { HttpMethod, PaginatedResponse } from "@/apis/types";
import { request } from "@/apis/query";
import { Organization } from "@/types/organization";
import { ProductKnowledge } from "@/types/productKnowledge";

export const apis = {
  organizations: {
    list: (params: { org_type: string; limit?: number }) =>
      request<PaginatedResponse<Organization>>(
        "/api/v1/organization/",
        HttpMethod.GET,
        params,
      ),
  },
  productKnowledge: {
    list: (params: { facility: string; name?: string; limit?: number }) =>
      request<PaginatedResponse<ProductKnowledge>>(
        "/api/v1/product_knowledge/",
        HttpMethod.GET,
        { include_instance: "true", ...params },
      ),
  },
};
