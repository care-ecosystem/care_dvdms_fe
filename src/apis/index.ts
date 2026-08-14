import { HttpMethod, PaginatedResponse } from "@/apis/types";
import { request } from "@/apis/query";
import { Organization } from "@/types/organization";
import { Facility } from "@/types/facility";
import { LocationRead } from "@/types/location";
import {
  DvdmsInstitute,
  DvdmsInstitutePayload,
  DvdmsLookupStore,
} from "@/types/dvdms_config";

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
  institutes: {
    get: (facilityId: string) =>
      request<DvdmsInstitute>(
        `/api/care_dvdms/facility/${facilityId}/institute/`,
        HttpMethod.GET,
      ).catch((error: { status?: number }) => {
        if (error?.status === 404) return null;
        throw error;
      }),
    create: (facilityId: string, payload: DvdmsInstitutePayload) =>
      request<DvdmsInstitute>(
        `/api/care_dvdms/facility/${facilityId}/institute/`,
        HttpMethod.POST,
        payload,
      ),
    update: (facilityId: string, payload: Partial<DvdmsInstitutePayload>) =>
      request<DvdmsInstitute>(
        `/api/care_dvdms/facility/${facilityId}/institute/`,
        HttpMethod.PATCH,
        payload,
      ),
    lookupStores: (instituteId: string) =>
      request<DvdmsLookupStore[]>(
        `/api/care_dvdms/institute/${instituteId}/lookup/stores/`,
        HttpMethod.GET,
      ),
  },
  locations: {
    list: (
      facilityId: string,
      params: {
        status?: string;
        mine?: boolean;
        parent?: string;
        mode?: string;
        name?: string;
      } = {},
    ) =>
      request<PaginatedResponse<LocationRead>>(
        `/api/v1/facility/${facilityId}/location/`,
        HttpMethod.GET,
        { ordering: "sort_index", ...params },
      ),
  },
};
