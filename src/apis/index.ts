import { HttpMethod, PaginatedResponse } from "@/apis/types";
import { request } from "@/apis/query";
import { Organization } from "@/types/organization";
import { Facility } from "@/types/facility";

export const apis = {
  organizations: {
    list: (params: { org_type: string; limit?: number }) =>
      request<PaginatedResponse<Organization>>(
        "/api/v1/organization/",
        HttpMethod.GET,
        params,
      ),
  },
  facilities: {
    get: (facilityId: string) =>
      request<Facility>(`/api/v1/facility/${facilityId}/`, HttpMethod.GET),
  },
};
