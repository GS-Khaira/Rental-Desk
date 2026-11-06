"use client";

import { useOpenForm, type Field, type Values } from "./FormModal";
import { useStore } from "@/lib/store";
import { AREAS, CONTACT_PREFS, FEE_TYPES, PROP_TYPES, RENT_AGAIN, RENTER_STATUS, SOURCES, UNIT_STATUS } from "@/lib/constants";
import { today } from "@/lib/format";
import type { Maintenance, Owner, Property, Renter, Tenancy, Unit } from "@/lib/types";

const ownerFields = (): Field[] => [
  { k: "name", label: "Name", req: true },
  { k: "phone", label: "Phone", type: "tel" },
  { k: "email", label: "Email", type: "email", more: true },
  { k: "contact_pref", label: "Prefers", type: "select", opts: CONTACT_PREFS, more: true },
  { k: "address", label: "Mailing address", more: true },
  { k: "notes", label: "Notes", type: "textarea", more: true },
];

const renterFields = (): Field[] => [
  { k: "name", label: "Name", req: true },
  { k: "phone", label: "Phone", type: "tel", half: true },
  { k: "budget", label: "Budget / month (CAD)", type: "number", req: true, half: true },
  { k: "beds", label: "Bedrooms needed", type: "number", half: true },
  { k: "move_in", label: "Move-in date", type: "date", half: true },
  { k: "consent", label: "They agreed to me storing their details and contacting them about rentals", type: "check" },
  { k: "areas", label: "Preferred areas", type: "areas", more: true },
  { k: "pets", label: "Has pets", type: "check", more: true },
  { k: "parking", label: "Needs parking", type: "check", more: true },
  { k: "email", label: "Email", type: "email", more: true },
  { k: "source", label: "Where they came from", type: "select", opts: SOURCES, more: true },
  { k: "status", label: "Status", type: "select", opts: [...RENTER_STATUS], req: true, def: "Looking", more: true },
  { k: "notes", label: "Notes", type: "textarea", more: true,
    hint: "Stick to rental facts. Don't record age, family status, disability, religion, or source of income." },
];

const maintenanceFields = (): Field[] => [
  { k: "date", label: "Date", type: "date", req: true, def: today() },
  { k: "description", label: "What was done", req: true, ph: "Furnace serviced" },
  { k: "vendor", label: "Vendor", half: true },
  { k: "cost", label: "Cost (CAD)", type: "number", half: true },
];

const tenancyFields = (): Field[] => [
  { k: "move_in", label: "Move-in", type: "date", req: true, half: true },
  { k: "move_out", label: "Move-out", type: "date", half: true },
  { k: "rent", label: "Rent / month", type: "number", half: true },
  { k: "deposit", label: "Deposit", type: "number", half: true },
  { k: "would_rent_again", label: "Would rent to again?", type: "select", opts: RENT_AGAIN },
  { k: "payment_notes", label: "Payment notes", type: "textarea", ph: "Always on time" },
  { k: "notes", label: "Notes", type: "textarea" },
];

export function useActions() {
  const openForm = useOpenForm();
  const s = useStore();
  const { data, save, toast } = s;

  const ownerOpts = () => [...data.owners].sort((a, b) => a.name.localeCompare(b.name)).map((o) => [o.id, o.name] as [string, string]);
  const propOpts = () => [...data.properties].sort((a, b) => a.address.localeCompare(b.address)).map((p) => {
    const o = data.owners.find((x) => x.id === p.owner_id);
    return [p.id, p.address + (o ? ` (${o.name})` : "")] as [string, string];
  });

  const owner = (rec?: Partial<Owner>) =>
    openForm({ title: rec?.id ? "Edit owner" : "New owner", fields: ownerFields(), initial: rec,
      onSubmit: async (v) => { await save("owners", { ...rec, ...v } as Partial<Owner>); toast(rec?.id ? "Saved" : "Owner added"); } });

  const property = (rec?: Partial<Property>) => {
    if (!data.owners.length) { toast("Add an owner first."); return owner(); }
    openForm({ title: rec?.id ? "Edit property" : "New property", initial: rec,
      fields: [
        { k: "owner_id", label: "Owner", type: "select", opts: ownerOpts(), req: true },
        { k: "address", label: "Street address", req: true, ph: "e.g. 42 Water St" },
        { k: "area", label: "Area", type: "select", opts: AREAS, req: true },
        { k: "postal", label: "Postal code", ph: "C1A 1A1", pattern: "[Cc]\\d[A-Za-z] ?\\d[A-Za-z]\\d", more: true },
        { k: "type", label: "Type", type: "select", opts: PROP_TYPES, more: true },
        { k: "agreement_start", label: "Agreement starts", type: "date", half: true, more: true },
        { k: "agreement_end", label: "Agreement ends", type: "date", half: true, more: true },
        { k: "fee_type", label: "Your fee", type: "select", opts: FEE_TYPES, half: true, more: true },
        { k: "fee_value", label: "Fee amount", type: "number", step: "0.01", half: true, more: true },
        { k: "notes", label: "Notes", type: "textarea", more: true },
      ],
      onSubmit: async (v) => {
        const postal = typeof v.postal === "string" && v.postal ? v.postal.toUpperCase().replace(/^(\w{3})\s?(\w{3})$/, "$1 $2") : null;
        await save("properties", { ...rec, ...v, postal } as Partial<Property>);
        toast(rec?.id ? "Saved" : "Property added");
      } });
  };

  const unit = (rec?: Partial<Unit>) => {
    if (!data.properties.length) { toast("Add a property first."); return property(); }
    openForm({ title: rec?.id ? "Edit unit" : "New unit", initial: rec,
      fields: [
        { k: "property_id", label: "Property", type: "select", opts: propOpts(), req: true },
        { k: "label", label: "Unit name", ph: "Unit A, Upstairs, Whole house" },
        { k: "rent", label: "Rent / month (CAD)", type: "number", req: true, half: true },
        { k: "beds", label: "Bedrooms", type: "number", req: true, half: true },
        { k: "status", label: "Status", type: "select", opts: [...UNIT_STATUS], req: true, def: "Vacant" },
        { k: "baths", label: "Bathrooms", type: "number", step: "0.5", half: true, more: true },
        { k: "available_date", label: "Available from", type: "date", half: true, more: true },
        { k: "pets", label: "Pets allowed", type: "check", more: true },
        { k: "parking", label: "Parking included", type: "check", more: true },
        { k: "utilities", label: "Utilities included", ph: "Heat, water", more: true },
        { k: "notes", label: "Notes", type: "textarea", more: true },
      ],
      onSubmit: async (v) => { await save("units", { ...rec, ...v } as Partial<Unit>); toast(rec?.id ? "Saved" : "Unit added"); } });
  };

  const renter = (rec?: Partial<Renter>) =>
    openForm({ title: rec?.id ? "Edit renter" : "New renter", fields: renterFields(), initial: rec,
      onSubmit: async (v: Values) => {
        const consent = Boolean(v.consent);
        const consent_date = consent ? (rec?.consent ? rec.consent_date : today()) : null;
        await save("renters", { ...rec, ...v, consent, consent_date } as Partial<Renter>);
        toast(rec?.id ? "Saved" : "Renter added");
      } });

  const maintenance = (unitId: string, rec?: Partial<Maintenance>) =>
    openForm({ title: rec?.id ? "Edit maintenance entry" : "New maintenance entry", fields: maintenanceFields(), initial: rec,
      onSubmit: async (v) => { await save("maintenance", { ...rec, ...v, unit_id: unitId } as Partial<Maintenance>); toast("Logged"); } });

  const tenancy = (rec: Tenancy) =>
    openForm({ title: "Edit tenancy record", fields: tenancyFields(), initial: rec as unknown as Values,
      onSubmit: async (v) => { await save("tenancies", { ...rec, ...v } as Partial<Tenancy>); toast("Saved"); } });

  const moveIn = (u: Unit, renterId?: string) => {
    const ranked = data.renters.filter((r) => r.status === "Looking")
      .map((r) => ({ r, ...s.matchUR(u, r) }))
      .sort((a, b) => Number(a.blocked) - Number(b.blocked) || b.score - a.score);
    if (!ranked.length) { toast("No renters are marked Looking. Add one first."); return; }
    openForm({ title: "Record move-in", intro: s.unitName(u), saveLabel: "Record move-in",
      initial: { renter_id: renterId ?? ranked[0].r.id, rent: u.rent },
      fields: [
        { k: "renter_id", label: "Renter", type: "select", req: true,
          opts: ranked.map((m) => [m.r.id, m.r.name + (m.blocked ? " (doesn't fit)" : ` (match ${m.score})`)] as [string, string]) },
        { k: "move_in", label: "Move-in date", type: "date", req: true, def: today(), half: true },
        { k: "rent", label: "Rent / month", type: "number", half: true },
        { k: "deposit", label: "Deposit", type: "number", half: true },
        { k: "notes", label: "Notes", type: "textarea" },
      ],
      onSubmit: async (v) => {
        await save("tenancies", { ...v, unit_id: u.id, unit_snapshot: s.unitName(u) } as Partial<Tenancy>);
        await save("units", { ...u, status: "Rented" });
        const r = data.renters.find((x) => x.id === v.renter_id);
        if (r) await save("renters", { ...r, status: "Placed" });
        toast("Move-in recorded");
      } });
  };

  const moveOut = (t: Tenancy) => {
    const u = data.units.find((x) => x.id === t.unit_id);
    const r = data.renters.find((x) => x.id === t.renter_id);
    openForm({ title: "Record move-out", intro: `${r?.name ?? "Tenant"} · ${s.unitName(u)}`, saveLabel: "Record move-out",
      initial: t as unknown as Values,
      fields: [
        { k: "move_out", label: "Move-out date", type: "date", req: true, def: today() },
        { k: "would_rent_again", label: "Would you rent to them again?", type: "select", opts: RENT_AGAIN, req: true },
        { k: "payment_notes", label: "Payment notes", type: "textarea", ph: "Paid on time all 18 months" },
        { k: "notes", label: "Condition and other notes", type: "textarea", ph: "Left unit clean; full deposit returned" },
      ],
      onSubmit: async (v) => {
        await save("tenancies", { ...t, ...v } as Partial<Tenancy>);
        if (u) await save("units", { ...u, status: "Vacant", available_date: today() });
        if (r) await save("renters", { ...r, status: "Inactive" });
        toast("Move-out recorded");
      } });
  };

  return { owner, property, unit, renter, maintenance, tenancy, moveIn, moveOut };
}
