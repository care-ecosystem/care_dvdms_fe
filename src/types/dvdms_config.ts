export interface DvdmsSupplierMapping {
  supplier_id: string;
  supplier_code: string;
  is_default: boolean;
}

export interface DvdmsFacilityConfigMeta {
  disable_auto_sync: boolean;
  allow_manual_entry: boolean;
}

export interface DvdmsFacilityConfig {
  eaushadhi_institute_id: string;
  eaushadhi_user_ref_id: string;
  eaushadhi_institute_name: string;
  schema_version: string;
  meta: DvdmsFacilityConfigMeta;
  suppliers: DvdmsSupplierMapping[];
}

export interface DvdmsInstitute {
  id: string;
  facility_id: string;
  eaushadhi_institute_id: string;
  eaushadhi_user_ref_id: string;
  eaushadhi_institute_name: string;
  schema_version: string;
}

export type DvdmsInstitutePayload = Pick<
  DvdmsInstitute,
  | "eaushadhi_institute_id"
  | "eaushadhi_user_ref_id"
  | "eaushadhi_institute_name"
  | "schema_version"
>;
