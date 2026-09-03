import {
  BatchRequestBody,
  BatchResponse,
  HttpMethod,
  PaginatedResponse,
} from "@/apis/types";
import { request } from "@/apis/query";
import { MAX_REQUESTS_PER_BATCH } from "@/lib/constants";
import { chunk } from "@/lib/utils";
import { Organization } from "@/types/organization";
import { Facility } from "@/types/facility";
import { LocationRead } from "@/types/location";
import {
  DeliveryOrderCreatePayload,
  DeliveryOrderRetrieve,
} from "@/types/deliveryOrder";
import { ProductKnowledge, ResourceCategory } from "@/types/productKnowledge";
import {
  ChargeItemDefinition,
  ChargeItemDefinitionCreatePayload,
  Product,
  ProductCreatePayload,
} from "@/types/inventory";
import {
  DvdmsInstitute,
  DvdmsInstitutePayload,
  DvdmsLookupDrug,
  DvdmsLookupGroup,
  DvdmsLookupStore,
  DvdmsLookupSubgroup,
  DvdmsProductMapping,
  DvdmsProductMappingCreatePayload,
  DvdmsProductMappingUpdatePayload,
  DvdmsStoreMapping,
  DvdmsStoreMappingPayload,
  DvdmsStoreMappingUpdatePayload,
  DvdmsSupplierOrgMapping,
  DvdmsSupplierOrgMappingPayload,
  DvdmsSupplierOrgMappingUpdatePayload,
  DvdmsInstituteStore,
} from "@/types/dvdms_config";
import {
  RecordDelivery,
  RecordDeliveryDetail,
  RecordDeliveryItem,
  RecordDeliveryItemPayload,
  RecordDeliveryItemUpdatePayload,
  RecordDeliveryPayload,
  RecordDeliveryUpdatePayload,
  RecordInward,
  RecordInwardDetail,
  RecordInwardPayload,
  RecordOrder,
  RecordOrderOutward,
  RecordOrderPayload,
  RecordOrderUpdatePayload,
} from "@/types/recordOrder";
import {
  RecordItemOrder,
  RecordItemOrderPayload,
} from "@/types/recordOrderItem";
import { RecordOrderProductMapping } from "@/types/productMapping";
import { RequestOrder } from "@/types/requestOrder";
import {
  SUPPLY_DELIVERY_ITEM_TYPE,
  SupplyDeliveryCreatePayload,
  SupplyDeliveryRetrieve,
  SupplyDeliveryUpsertPayload,
} from "@/types/supplyDelivery";
import { SupplyRequest } from "@/types/supplyRequest";
import { TagConfig } from "@/types/tagConfig";
import {
  SuperBatchRequestPayload,
  SuperBatchResponse,
} from "@/types/superBatch";
import {
  BatchRequestPayload,
  BatchResponse as BatchRequestsResponse,
} from "@/types/batchRequest";

export const BATCH_REQUEST_PATH = "/api/v1/batch_requests/";

export const apis = {
  batchRequest: (payload: BatchRequestBody) =>
    request<BatchResponse>(BATCH_REQUEST_PATH, HttpMethod.POST, {
      ...payload,
    }),
  organizations: {
    list: (params: { org_type: string; limit?: number; name?: string }) =>
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
  requestOrders: {
    list: (
      facilityId: string,
      params: {
        destination: string;
        limit?: number;
        offset?: number;
        status?: string;
        priority?: string;
        origin_isnull?: boolean;
        supplier?: string;
      },
    ) =>
      request<PaginatedResponse<RequestOrder>>(
        `/api/v1/facility/${facilityId}/order/request/`,
        HttpMethod.GET,
        params,
      ),
    retrieve: (facilityId: string, requestOrderId: string) =>
      request<RequestOrder>(
        `/api/v1/facility/${facilityId}/order/request/${requestOrderId}/`,
        HttpMethod.GET,
      ),
    setTags: (facilityId: string, requestOrderId: string, tags: string[]) =>
      request<RequestOrder>(
        `/api/v1/facility/${facilityId}/order/request/${requestOrderId}/set_tags/`,
        HttpMethod.POST,
        { tags },
      ),
    removeTags: (facilityId: string, requestOrderId: string, tags: string[]) =>
      request<RequestOrder>(
        `/api/v1/facility/${facilityId}/order/request/${requestOrderId}/remove_tags/`,
        HttpMethod.POST,
        { tags },
      ),
  },
  supplyRequests: {
    path: "/api/v1/supply_request/",
    list: (params: {
      order: string;
      limit?: number;
      offset?: number;
      ordering?: string;
    }) =>
      request<PaginatedResponse<SupplyRequest>>(
        apis.supplyRequests.path,
        HttpMethod.GET,
        params,
      ),
  },
  supplyDeliveries: {
    path: "/api/v1/supply_delivery/",
    create: (payload: SupplyDeliveryCreatePayload) =>
      request<SupplyDeliveryRetrieve>(
        apis.supplyDeliveries.path,
        HttpMethod.POST,
        { supplied_item_type: SUPPLY_DELIVERY_ITEM_TYPE, ...payload },
      ),
    upsert: (datapoints: SupplyDeliveryUpsertPayload[]) =>
      request<SupplyDeliveryRetrieve>(
        `${apis.supplyDeliveries.path}upsert/`,
        HttpMethod.POST,
        { datapoints },
      ),
  },
  recordOrders: {
    list: (
      instituteId: string,
      params: {
        limit?: number;
        offset?: number;
        order?: string;
        status?: string;
        ordering?: string;
      } = {},
    ) =>
      request<PaginatedResponse<RecordOrder>>(
        `/api/care_dvdms/institute/${instituteId}/record_order/`,
        HttpMethod.GET,
        params,
      ),
    create: (instituteId: string, payload: RecordOrderPayload) =>
      request<RecordOrder>(
        `/api/care_dvdms/institute/${instituteId}/record_order/`,
        HttpMethod.POST,
        { ...payload },
      ),
    update: (
      instituteId: string,
      recordOrderId: string,
      payload: RecordOrderUpdatePayload,
    ) =>
      request<RecordOrder>(
        `/api/care_dvdms/institute/${instituteId}/record_order/${recordOrderId}/`,
        HttpMethod.PATCH,
        { ...payload },
      ),
  },
  item: {
    list: (
      instituteId: string,
      recordOrderId: string,
      params: {
        limit?: number;
        offset?: number;
        record_order?: string;
        order?: string;
        ordering?: string;
      } = {},
    ) =>
      request<PaginatedResponse<RecordItemOrder>>(
        `/api/care_dvdms/institute/${instituteId}/record_order/${recordOrderId}/item/`,
        HttpMethod.GET,
        params,
      ),
    create: (
      instituteId: string,
      recordOrderId: string,
      payload: RecordItemOrderPayload,
    ) =>
      request<RecordItemOrder>(
        `/api/care_dvdms/institute/${instituteId}/record_order/${recordOrderId}/item/`,
        HttpMethod.POST,
        { ...payload },
      ),
    update: (
      instituteId: string,
      recordOrderId: string,
      recordOrderItemId: string,
      payload: Partial<RecordItemOrderPayload>,
    ) =>
      request<RecordItemOrder>(
        `/api/care_dvdms/institute/${instituteId}/record_order/${recordOrderId}/item/${recordOrderItemId}/`,
        HttpMethod.PATCH,
        { ...payload },
      ),
  },
  recordOrderOutward: {
    path: (instituteId: string, recordOrderId: string) =>
      `/api/care_dvdms/institute/${instituteId}/record_order/${recordOrderId}/outward/`,
    list: (
      instituteId: string,
      recordOrderId: string,
      params: {
        limit?: number;
        offset?: number;
        ordering?: string;
      } = {},
    ) =>
      request<PaginatedResponse<RecordOrderOutward>>(
        apis.recordOrderOutward.path(instituteId, recordOrderId),
        HttpMethod.GET,
        params,
      ),
    fetchInwards: (instituteId: string, recordOrderId: string) =>
      request<RecordOrderOutward>(
        `/api/care_dvdms/institute/${instituteId}/record_order/${recordOrderId}/outward/fetch-inwards/`,
        HttpMethod.POST,
      ),
  },
  recordInwards: {
    list: (
      instituteId: string,
      params: {
        limit?: number;
        offset?: number;
        ordering?: string;
      } = {},
    ) =>
      request<PaginatedResponse<RecordInward>>(
        `/api/care_dvdms/institute/${instituteId}/record_inwards/`,
        HttpMethod.GET,
        params,
      ),
    retrieve: (instituteId: string, recordInwardId: string) =>
      request<RecordInwardDetail>(
        `/api/care_dvdms/institute/${instituteId}/record_inwards/${recordInwardId}/`,
        HttpMethod.GET,
      ),
    create: (instituteId: string, payload: RecordInwardPayload) =>
      request<RecordInward>(
        `/api/care_dvdms/institute/${instituteId}/record_inwards/`,
        HttpMethod.POST,
        { ...payload },
      ),
    createDelivery: (
      instituteId: string,
      recordInwardId: string,
      payload: RecordDeliveryPayload,
    ) =>
      request<RecordDelivery>(
        `/api/care_dvdms/institute/${instituteId}/record_inwards/${recordInwardId}/delivery/`,
        HttpMethod.POST,
        { ...payload },
      ),
    listDeliveries: (
      instituteId: string,
      recordInwardId: string,
      params: {
        delivery_order?: string;
        facility_id?: string;
        limit?: number;
        offset?: number;
        ordering?: string;
      } = {},
    ) =>
      request<PaginatedResponse<RecordDelivery>>(
        `/api/care_dvdms/institute/${instituteId}/record_inwards/${recordInwardId}/delivery/`,
        HttpMethod.GET,
        params,
      ),
    retrieveDelivery: (
      instituteId: string,
      recordInwardId: string,
      recordDeliveryId: string,
    ) =>
      request<RecordDeliveryDetail>(
        `/api/care_dvdms/institute/${instituteId}/record_inwards/${recordInwardId}/delivery/${recordDeliveryId}/`,
        HttpMethod.GET,
      ),
    updateDelivery: (
      instituteId: string,
      recordInwardId: string,
      recordDeliveryId: string,
      payload: RecordDeliveryUpdatePayload,
    ) =>
      request<RecordDelivery>(
        `/api/care_dvdms/institute/${instituteId}/record_inwards/${recordInwardId}/delivery/${recordDeliveryId}/`,
        HttpMethod.PATCH,
        { ...payload },
      ),
    createDeliveryItem: (
      instituteId: string,
      recordInwardId: string,
      recordDeliveryId: string,
      payload: RecordDeliveryItemPayload,
    ) =>
      request<RecordDeliveryItem>(
        `/api/care_dvdms/institute/${instituteId}/record_inwards/${recordInwardId}/delivery/${recordDeliveryId}/items/`,
        HttpMethod.POST,
        { ...payload },
      ),
    updateDeliveryItem: (
      instituteId: string,
      recordInwardId: string,
      recordDeliveryId: string,
      recordDeliveryItemId: string,
      payload: RecordDeliveryItemUpdatePayload,
    ) =>
      request<RecordDeliveryItem>(
        `/api/care_dvdms/institute/${instituteId}/record_inwards/${recordInwardId}/delivery/${recordDeliveryId}/items/${recordDeliveryItemId}/`,
        HttpMethod.PATCH,
        { ...payload },
      ),
    retryDeliveryAcknowledgement: (
      instituteId: string,
      recordInwardId: string,
      recordDeliveryId: string,
    ) =>
      request<void>(
        `/api/care_dvdms/institute/${instituteId}/record_inwards/${recordInwardId}/delivery/${recordDeliveryId}/retry-acknowledgement/`,
        HttpMethod.POST,
      ),
  },
  recordOrderProductMappings: {
    list: (
      instituteId: string,
      recordOrderId: string,
      params: {
        limit?: number;
        offset?: number;
        ordering?: string;
      } = {},
    ) =>
      request<PaginatedResponse<RecordOrderProductMapping>>(
        `/api/care_dvdms/institute/${instituteId}/record_order/${recordOrderId}/product_mappings/`,
        HttpMethod.GET,
        params,
      ),
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
    lookupGroups: (instituteId: string) =>
      request<DvdmsLookupGroup[]>(
        `/api/care_dvdms/institute/${instituteId}/lookup/groups/`,
        HttpMethod.GET,
      ),
    lookupSubgroups: (instituteId: string, groupId: string) =>
      request<DvdmsLookupSubgroup[]>(
        `/api/care_dvdms/institute/${instituteId}/lookup/subgroups/`,
        HttpMethod.GET,
        { group_id: groupId },
      ),
    lookupDrugs: (
      instituteId: string,
      params: {
        hstnum_group_id: string;
        hstnum_subgroup_id?: string;
        sstnum_item_cat_no?: string;
        hststr_item_name?: string;
      },
    ) =>
      request<DvdmsLookupDrug[]>(
        `/api/care_dvdms/institute/${instituteId}/lookup/drugs/`,
        HttpMethod.GET,
        params,
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
  storeMappings: {
    list: (facilityId: string, instituteId: string) =>
      request<PaginatedResponse<DvdmsStoreMapping>>(
        `/api/care_dvdms/facility/${facilityId}/institute/${instituteId}/stores/`,
        HttpMethod.GET,
      ),
    create: (
      facilityId: string,
      instituteId: string,
      payload: DvdmsStoreMappingPayload,
    ) =>
      request<DvdmsStoreMapping>(
        `/api/care_dvdms/facility/${facilityId}/institute/${instituteId}/stores/`,
        HttpMethod.POST,
        payload,
      ),
    update: (
      facilityId: string,
      instituteId: string,
      mappingId: string,
      payload: DvdmsStoreMappingUpdatePayload,
    ) =>
      request<DvdmsStoreMapping>(
        `/api/care_dvdms/facility/${facilityId}/institute/${instituteId}/stores/${mappingId}/`,
        HttpMethod.PATCH,
        payload,
      ),
  },
  productMappings: {
    path: (instituteId: string) =>
      `/api/care_dvdms/institute/${instituteId}/product-mappings/`,
    list: (
      instituteId: string,
      params?: {
        limit?: number;
        offset?: number;
        mapping_type?: string;
        eaushadhi_drug_id?: string;
        product_knowledge_id?: string;
        ordering?: string;
      },
    ) =>
      request<PaginatedResponse<DvdmsProductMapping>>(
        apis.productMappings.path(instituteId),
        HttpMethod.GET,
        params,
      ),
    create: (instituteId: string, payload: DvdmsProductMappingCreatePayload) =>
      request<DvdmsProductMapping>(
        apis.productMappings.path(instituteId),
        HttpMethod.POST,
        payload,
      ),
    update: (
      instituteId: string,
      mappingId: string,
      payload: DvdmsProductMappingUpdatePayload,
    ) =>
      request<DvdmsProductMapping>(
        `/api/care_dvdms/institute/${instituteId}/product-mappings/${mappingId}/`,
        HttpMethod.PATCH,
        payload,
      ),
  },
  supplierMappings: {
    list: (instituteId: string) =>
      request<PaginatedResponse<DvdmsSupplierOrgMapping>>(
        `/api/care_dvdms/institute/${instituteId}/suppliers/`,
        HttpMethod.GET,
      ),
    create: (instituteId: string, payload: DvdmsSupplierOrgMappingPayload) =>
      request<DvdmsSupplierOrgMapping>(
        `/api/care_dvdms/institute/${instituteId}/suppliers/`,
        HttpMethod.POST,
        payload,
      ),
    update: (
      instituteId: string,
      mappingId: string,
      payload: DvdmsSupplierOrgMappingUpdatePayload,
    ) =>
      request<DvdmsSupplierOrgMapping>(
        `/api/care_dvdms/institute/${instituteId}/suppliers/${mappingId}/`,
        HttpMethod.PATCH,
        payload,
      ),
  },
  dvdmsInstituteStores: {
    list: (
      facilityId: string,
      instituteId: string,
      params: {
        limit?: number;
        offset?: number;
        ordering?: string;
      } = {},
    ) =>
      request<PaginatedResponse<DvdmsInstituteStore>>(
        `/api/care_dvdms/facility/${facilityId}/institute/${instituteId}/stores/`,
        HttpMethod.GET,
        params,
      ),
  },
  productKnowledge: {
    list: (params: {
      facility: string;
      name?: string;
      limit?: number;
      offset?: number;
      category?: string;
      status?: string;
      include_instance?: boolean;
    }) =>
      request<PaginatedResponse<ProductKnowledge>>(
        "/api/v1/product_knowledge/",
        HttpMethod.GET,
        { include_instance: "true", ...params },
      ),
    get: (slug: string) =>
      request<ProductKnowledge>(
        `/api/v1/product_knowledge/${slug}/`,
        HttpMethod.GET,
      ),
  },
  resourceCategories: {
    list: (
      facilityId: string,
      params: {
        resource_type: string;
        parent?: string;
        title?: string;
        limit?: number;
      },
    ) =>
      request<PaginatedResponse<ResourceCategory>>(
        `/api/v1/facility/${facilityId}/resource_category/`,
        HttpMethod.GET,
        params,
      ),
    get: (facilityId: string, slug: string) =>
      request<ResourceCategory>(
        `/api/v1/facility/${facilityId}/resource_category/${slug}/`,
        HttpMethod.GET,
      ),
  },
  products: {
    list: (
      facilityId: string,
      params: {
        product_knowledge?: string;
        status?: string;
        ordering?: string;
        limit?: number;
        offset?: number;
      },
    ) =>
      request<PaginatedResponse<Product>>(
        `/api/v1/facility/${facilityId}/product/`,
        HttpMethod.GET,
        params,
      ),
    create: (facilityId: string, payload: ProductCreatePayload) =>
      request<Product>(
        `/api/v1/facility/${facilityId}/product/`,
        HttpMethod.POST,
        { ...payload },
      ),
  },
  chargeItemDefinitions: {
    create: (facilityId: string, payload: ChargeItemDefinitionCreatePayload) =>
      request<ChargeItemDefinition>(
        `/api/v1/facility/${facilityId}/charge_item_definition/`,
        HttpMethod.POST,
        { ...payload },
      ),
  },
  superBatch: {
    create: (payload: SuperBatchRequestPayload) =>
      request<SuperBatchResponse>(
        "/api/super_batch_request/",
        HttpMethod.POST,
        { ...payload },
      ),
  },
  batchRequests: {
    create: (payload: BatchRequestPayload) =>
      request<BatchRequestsResponse>(
        "/api/v1/batch_requests/",
        HttpMethod.POST,
        { ...payload },
      ),
    createChunked: async (
      payload: BatchRequestPayload,
    ): Promise<BatchRequestsResponse> => {
      const responses = await Promise.all(
        chunk(payload.requests, MAX_REQUESTS_PER_BATCH).map((requests) =>
          apis.batchRequests.create({ requests }),
        ),
      );
      return { results: responses.flatMap((response) => response.results) };
    },
  },
  deliveryOrders: {
    create: (facilityId: string, payload: DeliveryOrderCreatePayload) =>
      request<DeliveryOrderRetrieve>(
        `/api/v1/facility/${facilityId}/order/delivery/`,
        HttpMethod.POST,
        { ...payload },
      ),
  },
  tagConfigs: {
    list: (params: {
      resource: string;
      status?: string;
      display?: string;
      parent_is_null?: boolean;
      parent?: string;
      facility?: string;
    }) =>
      request<PaginatedResponse<TagConfig>>(
        "/api/v1/tag_config/",
        HttpMethod.GET,
        params,
      ),
  },
};
