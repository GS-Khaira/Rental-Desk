// Spreadsheet (CSV) exports. Pure functions: they build text from records, so they can be
// unit tested (tests/exports.test.ts) and reused by any screen.
import type { Data, Maintenance, Owner, Property, Renter, Tenancy, Unit } from "./types";

export type Row = Record<string, unknown>;

/** One CSV cell: quoted when needed, and protected against spreadsheet formulas (=, +, -, @). */
function cell(v: unknown): string {
  let s = Array.isArray(v) ? v.join("; ") : v === null || v === undefined ? "" : typeof v === "boolean" ? (v ? "Yes" : "No") : String(v);
  if (/^[=+\-@\t\r]/.test(s) && !/^-?\d+(\.\d+)?$/.test(s)) s = "'" + s; // a leading ' stops Excel running it as a formula
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Rows to CSV. Columns come from `columns` (in order) or from the first row. Starts with a BOM so Excel reads accents. */
export function toCsv(rows: Row[], columns?: string[]): string {
  const cols = columns ?? (rows[0] ? Object.keys(rows[0]).filter((c) => c !== "user_id") : []);
  const lines = [cols.map(cell).join(","), ...rows.map((r) => cols.map((c) => cell(r[c])).join(","))];
  return "﻿" + lines.join("\r\n");
}

/** "Apt 2" before "Apt 10", "Unit B" before "Unit C". */
export const byUnitLabel = (a: Unit, b: Unit) =>
  (a.label ?? "").localeCompare(b.label ?? "", "en-CA", { numeric: true, sensitivity: "base" });

/** A safe file name piece, e.g. "240 Grafton St" → "240-grafton-st". */
export const slug = (s: string) => s.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) || "property";

const current = (tenancies: Tenancy[], unitId: string) => tenancies.find((t) => t.unit_id === unitId && !t.move_out);

/* ---------------- one property ---------------- */
export type PropertyExportKind = "units" | "history" | "maintenance";

export const PROPERTY_EXPORTS: { kind: PropertyExportKind; label: string; hint: string }[] = [
  { kind: "units", label: "Units and current tenants", hint: "One row per unit: rent, status, size, and who lives there now." },
  { kind: "history", label: "Tenancy history", hint: "One row per tenancy, past and current, with payment and condition notes." },
  { kind: "maintenance", label: "Maintenance log", hint: "One row per repair or service, with vendor and cost." },
];

export function propertyExport(kind: PropertyExportKind, property: Property, data: Data): { filename: string; csv: string; rows: number } {
  const owner: Owner | undefined = data.owners.find((o) => o.id === property.owner_id);
  const units = data.units.filter((u) => u.property_id === property.id).sort(byUnitLabel);
  const unitIds = new Set(units.map((u) => u.id));
  const renter = (id: string | null | undefined): Renter | undefined => data.renters.find((r) => r.id === id);
  const unitLabel = (id: string | null) => units.find((u) => u.id === id)?.label ?? "";
  const base = { Property: property.address, Area: property.area, Owner: owner?.name ?? "" };
  let rows: Row[];

  if (kind === "units") {
    rows = units.map((u) => {
      const t = current(data.tenancies, u.id);
      const r = renter(t?.renter_id);
      return {
        ...base, Unit: u.label ?? "", Status: u.status, "Rent (CAD)": u.rent, Bedrooms: u.beds, Bathrooms: u.baths ?? "",
        "Pets allowed": u.pets, Parking: u.parking, "Utilities included": u.utilities ?? "", "Available from": u.available_date ?? "",
        "Current tenant": r?.name ?? "", "Tenant phone": r?.phone ?? "", "Tenant email": r?.email ?? "",
        "Moved in": t?.move_in ?? "", "Tenant rent (CAD)": t?.rent ?? "", "Deposit (CAD)": t?.deposit ?? "",
        Notes: u.notes ?? "",
      };
    });
  } else if (kind === "history") {
    rows = data.tenancies
      .filter((t) => t.unit_id && unitIds.has(t.unit_id))
      .sort((a, b) => byUnitLabel(units.find((u) => u.id === a.unit_id)!, units.find((u) => u.id === b.unit_id)!) || (b.move_in ?? "").localeCompare(a.move_in ?? ""))
      .map((t) => {
        const r = renter(t.renter_id);
        return {
          ...base, Unit: unitLabel(t.unit_id), Tenant: r?.name ?? "Removed renter", "Tenant phone": r?.phone ?? "",
          "Moved in": t.move_in, "Moved out": t.move_out ?? "Current", "Rent (CAD)": t.rent ?? "", "Deposit (CAD)": t.deposit ?? "",
          "Would rent again": t.would_rent_again ?? "", "Payment notes": t.payment_notes ?? "", Notes: t.notes ?? "",
        };
      });
  } else {
    rows = data.maintenance
      .filter((m: Maintenance) => unitIds.has(m.unit_id))
      .sort((a, b) => b.date.localeCompare(a.date))
      .map((m) => ({ ...base, Unit: unitLabel(m.unit_id), Date: m.date, "Work done": m.description, Vendor: m.vendor ?? "", "Cost (CAD)": m.cost ?? "" }));
  }

  const name = { units: "units", history: "tenancy-history", maintenance: "maintenance" }[kind];
  const columns = rows[0] ? Object.keys(rows[0]) : Object.keys(base).concat("Unit");
  return { filename: `${slug(property.address)}-${name}`, csv: toCsv(rows, columns), rows: rows.length };
}

/* ---------------- whole lists ---------------- */
export function rentersCsv(data: Data): string {
  return toCsv(data.renters.map((r) => ({
    Name: r.name, Phone: r.phone ?? "", Email: r.email ?? "", Status: r.status, "Budget (CAD)": r.budget, Bedrooms: r.beds ?? "",
    "Move-in": r.move_in ?? "", Areas: r.areas, Pets: r.pets, Parking: r.parking, Source: r.source ?? "",
    Consent: r.consent, "Consent date": r.consent_date ?? "", "Income verified": r.income_verified ?? false, Notes: r.notes ?? "",
  })));
}

export function unitsCsv(data: Data): string {
  const prop = new Map(data.properties.map((p) => [p.id, p]));
  return toCsv(data.units
    .map((u) => ({ u, p: prop.get(u.property_id) }))
    .sort((a, b) => (a.p?.address ?? "").localeCompare(b.p?.address ?? "") || byUnitLabel(a.u, b.u))
    .map(({ u, p }) => ({
      Property: p?.address ?? "", Area: p?.area ?? "", Unit: u.label ?? "", Status: u.status, "Rent (CAD)": u.rent, Bedrooms: u.beds,
      Bathrooms: u.baths ?? "", "Pets allowed": u.pets, Parking: u.parking, "Utilities included": u.utilities ?? "",
      "Available from": u.available_date ?? "", Notes: u.notes ?? "",
    })));
}
