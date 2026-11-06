export type UnitStatus = "Vacant" | "Listed" | "Rented" | "Not available";
export type RenterStatus = "Looking" | "Placed" | "Inactive";
export type RentAgain = "Yes" | "Maybe" | "No";

interface Row {
  id: string;
  user_id?: string;
  created_at?: string;
  updated_at?: string;
}

export interface Owner extends Row {
  name: string;
  phone: string | null;
  email: string | null;
  contact_pref: "Phone" | "Text" | "Email" | null;
  address: string | null;
  notes: string | null;
}

export interface Property extends Row {
  owner_id: string;
  address: string;
  area: string;
  postal: string | null;
  type: string | null;
  agreement_start: string | null;
  agreement_end: string | null;
  fee_type: "% of rent" | "Flat monthly" | null;
  fee_value: number | null;
  notes: string | null;
}

export interface Unit extends Row {
  property_id: string;
  label: string | null;
  rent: number;
  beds: number;
  baths: number | null;
  status: UnitStatus;
  pets: boolean;
  parking: boolean;
  utilities: string | null;
  available_date: string | null;
  notes: string | null;
}

export interface Renter extends Row {
  name: string;
  phone: string | null;
  email: string | null;
  budget: number;
  beds: number | null;
  move_in: string | null;
  areas: string[];
  pets: boolean;
  parking: boolean;
  source: string | null;
  status: RenterStatus;
  consent: boolean;
  consent_date: string | null;
  notes: string | null;
}

export interface Tenancy extends Row {
  unit_id: string | null;
  renter_id: string;
  unit_snapshot: string | null;
  move_in: string;
  move_out: string | null;
  rent: number | null;
  deposit: number | null;
  would_rent_again: RentAgain | null;
  payment_notes: string | null;
  notes: string | null;
}

export interface Maintenance extends Row {
  unit_id: string;
  date: string;
  description: string;
  vendor: string | null;
  cost: number | null;
}

export interface Tables {
  owners: Owner;
  properties: Property;
  units: Unit;
  renters: Renter;
  tenancies: Tenancy;
  maintenance: Maintenance;
}
export type TableName = keyof Tables;
export const TABLES: TableName[] = ["owners", "properties", "units", "renters", "tenancies", "maintenance"];

export type Data = { [K in TableName]: Tables[K][] };
