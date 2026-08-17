import { LocationRead } from "@/types/location";
import { Organization } from "@/types/organization";

export interface DvdmsSupplierMapping {
  eaushadhi_store_id: string;
  eaushadhi_store_name: string;
  eaushadhi_warehouse_id: string;
  eaushadhi_warehouse_name: string;
  location: LocationRead | null;
  supplier_id: string;
  store_mapping_id?: string;
  supplier_mapping_id?: string;
}

export interface DvdmsStoreMapping {
  id: string;
  institute_id: string;
  eaushadhi_store_id: string;
  eaushadhi_store_name: string;
  is_default: boolean;
  store: Pick<LocationRead, "id" | "name" | "form"> | null;
}

export type DvdmsStoreMappingPayload = {
  store: string;
  eaushadhi_store_id: string;
  eaushadhi_store_name: string;
  is_default: boolean;
};

export type DvdmsStoreMappingUpdatePayload = {
  store?: string;
  eaushadhi_store_id?: string;
  eaushadhi_store_name?: string;
  is_default?: boolean;
};

export interface DvdmsSupplierOrgMapping {
  id: string;
  institute_id: string;
  eaushadhi_warehouse_id: string;
  eaushadhi_warehouse_name: string;
  is_default: boolean;
  supplier: Pick<Organization, "id" | "name"> | null;
}

export type DvdmsSupplierOrgMappingPayload = {
  supplier: string;
  eaushadhi_warehouse_id: string;
  eaushadhi_warehouse_name: string;
  is_default: boolean;
};

export type DvdmsSupplierOrgMappingUpdatePayload = {
  supplier?: string;
  eaushadhi_warehouse_id?: string;
  eaushadhi_warehouse_name?: string;
  is_default?: boolean;
};

export interface DvdmsLookupStore {
  hstnumStoreId: number;
  hststrStoreName: string;
  sststrTypeName: string;
  gnumSeatid: number;
  hststrLocation: string;
  sstnumDwhTypeId: number;
  hstnumParentStoreId: number;
  hststrParentStoreName: string;
  parentTypeName: string;
}

export interface DvdmsFacilityConfigMeta {
  allow_updating_quantity_after_received: boolean;
}

export interface DvdmsFacilityConfig {
  eaushadhi_institute_id: string;
  eaushadhi_user_ref_id: string;
  eaushadhi_institute_name: string;
  schema_version: string;
  meta: DvdmsFacilityConfigMeta;
  mapping: DvdmsSupplierMapping;
}

export interface DvdmsInstitute {
  id: string;
  facility_id: string;
  eaushadhi_institute_id: string;
  eaushadhi_user_ref_id: string;
  eaushadhi_institute_name: string;
  schema_version: string;
  meta: DvdmsFacilityConfigMeta | null;
}

export type DvdmsInstitutePayload = Pick<
  DvdmsInstitute,
  | "eaushadhi_institute_id"
  | "eaushadhi_user_ref_id"
  | "eaushadhi_institute_name"
  | "schema_version"
  | "meta"
>;
