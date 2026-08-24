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

export interface DvdmsLookupGroup {
  gnumHospitalCode: number;
  hstnumGroupId: number;
  hststrGroupName: string;
  gstrRemarks: string;
  gdtEffectiveFrm: string;
  gdtEntryDate: string;
  gnumSeatid: number;
  gnumIsvalid: number;
  sstnumItemCatNo: number;
}

export interface DvdmsLookupSubgroup {
  gnumHospitalCode: number;
  hstnumSubgroupId: number;
  hstnumGroupId: number;
  hststrSubgroupName: string;
  gdtEffectiveFrm: string;
  gstrRemarks: string;
  gdtEntryDate: string;
  gnumSeatid: number;
  gnumIsvalid: number;
}

export interface DvdmsLookupDrug {
  hstnum_item_id: number;
  gnum_hospital_code: number;
  hstnum_group_id: number;
  hstnum_subgroup_id: number;
  sstnum_item_cat_no: string;
  hststr_item_name: string;
  hstnum_batchno_req: number;
  hstnum_expirydate_req: number;
  gnum_inventory_unitid: number;
  gdt_effective_frm: string;
  gnum_lstmod_seatid: number;
  gdt_entry_date: string;
  gnum_seatid: number;
  gnum_isvalid: number;
  hststr_cpa_code: string;
  hstnum_itembrand_id: number;
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
export interface DvdmsInstituteUser {
  id: string;
  username: string;
  first_name: string;
  last_name: string;
}

export interface DvdmsInstituteSupplierOrg {
  id: string;
  name: string;
  org_type: string;
}

export interface DvdmsInstituteSupplier {
  id: string;
  institute_id: string;
  supplier_id: string;
  eaushadhi_warehouse_id: string;
  eaushadhi_warehouse_name: string;
  is_default: boolean;
  supplier: DvdmsInstituteSupplierOrg;
  created_by: DvdmsInstituteUser | null;
  updated_by: DvdmsInstituteUser | null;
  created_date: string;
  modified_date: string;
}

export interface DvdmsInstituteStoreRef {
  id: string;
  name: string;
  form: string;
}

export interface DvdmsInstituteStore {
  id: string;
  store: DvdmsInstituteStoreRef;
  eaushadhi_store_id: string;
  eaushadhi_store_name: string;
  is_default: boolean;
  institute_id?: string;
  created_by?: DvdmsInstituteUser | null;
  updated_by?: DvdmsInstituteUser | null;
  created_date: string;
  modified_date?: string;
}

export interface DvdmsInstituteStorePayload {
  store: string;
  eaushadhi_store_id: string;
  eaushadhi_store_name: string;
  is_default: boolean;
}

export interface DvdmsProductMappingDrugDetails {
  id: string;
  name: string;
  brand_id: string;
  group_id: string;
  sub_group_id: string;
  unit_id: string;
  drug_category: string;
}

export interface DvdmsProductMapping {
  id: string;
  institute_id: string;
  eaushadhi_drug_details: DvdmsProductMappingDrugDetails;
  product_knowledge_id: string;
  mapping_type: string | null;
  usage_count: number | null;
  last_used_date: string | null;
}

export type DvdmsProductMappingCreatePayload = {
  eaushadhi_drug_details: {
    id: string;
    name: string;
    brand_id?: string;
    group_id?: string;
    sub_group_id?: string;
    unit_id?: string;
    drug_category?: string;
  };
  product_knowledge_id: string;
};

export type DvdmsProductMappingUpdatePayload =
  Partial<DvdmsProductMappingCreatePayload>;
