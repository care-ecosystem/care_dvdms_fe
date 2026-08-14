import {
  Bed,
  Building,
  Building2,
  Car,
  Eye,
  Home,
  LucideIcon,
  Map,
} from "lucide-react";

export type LocationForm =
  | "si"
  | "bu"
  | "wi"
  | "wa"
  | "lvl"
  | "co"
  | "ro"
  | "bd"
  | "ve"
  | "ho"
  | "ca"
  | "rd"
  | "area"
  | "jdn"
  | "vi";

export interface LocationRead {
  id: string;
  name: string;
  form: LocationForm;
  has_children?: boolean;
  parent?: LocationRead | null;
}

export const LocationTypeIcons = {
  bd: Bed,
  wa: Home,
  lvl: Building2,
  bu: Building,
  si: Map,
  wi: Building2,
  co: Building2,
  ro: Home,
  ve: Car,
  ho: Home,
  ca: Car,
  rd: Car,
  area: Map,
  jdn: Map,
  vi: Eye,
} as const satisfies Record<LocationForm, LucideIcon>;
