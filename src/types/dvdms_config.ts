export interface DvdmsSupplierMapping {
  supplier_code: string;
}

export interface DvdmsFacilityConfigMeta {
  disable_auto_sync: boolean;
  allow_manual_entry: boolean;
}

export interface DvdmsFacilityConfig {
  institute_code: string;
  store_code: string;
  store_name: string;
  meta: DvdmsFacilityConfigMeta;
  suppliers: DvdmsSupplierMapping[];
}
