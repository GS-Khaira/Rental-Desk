// Run with: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { byUnitLabel, propertyExport, slug, toCsv } from "../src/lib/exports.ts";

const lines = (csv: string) => csv.replace(/^﻿/, "").split("\r\n");

test("CSV quotes commas, quotes and new lines, and starts with a BOM for Excel", () => {
  const csv = toCsv([{ a: 'He said "hi", twice', b: "line1\nline2", c: 5 }]);
  assert.ok(csv.startsWith("﻿"));
  assert.deepEqual(lines(csv), ["a,b,c", '"He said ""hi"", twice","line1\nline2",5']);
});

test("CSV blocks spreadsheet formulas but keeps negative numbers", () => {
  assert.equal(lines(toCsv([{ x: "=HYPERLINK(1)" }]))[1], "'=HYPERLINK(1)");
  assert.equal(lines(toCsv([{ x: -25 }]))[1], "-25");
  assert.equal(lines(toCsv([{ x: true }]))[1], "Yes");
});

test("unit labels sort naturally", () => {
  const u = (label: string) => ({ label }) as never;
  const sorted = ["Apt 10", "Apt 2", "Apt 101", "Apt 1"].map(u).sort(byUnitLabel).map((x: { label: string }) => x.label);
  assert.deepEqual(sorted, ["Apt 1", "Apt 2", "Apt 10", "Apt 101"]);
});

test("file names are safe", () => {
  assert.equal(slug("240 Grafton St, Unit #5"), "240-grafton-st-unit-5");
});

/* a building with many units */
const property = { id: "p1", owner_id: "o1", address: "240 Grafton St", area: "Charlottetown – Downtown" } as never;
const units = Array.from({ length: 300 }, (_, i) => ({
  id: `u${i + 1}`, property_id: "p1", label: `Apt ${i + 1}`, rent: 1000 + i, beds: 1, baths: 1,
  status: i % 2 ? "Rented" : "Vacant", pets: false, parking: true, utilities: null, available_date: null, notes: null,
}));
const data = {
  owners: [{ id: "o1", name: "Harbour Holdings" }],
  properties: [property, { id: "p2", owner_id: "o1", address: "Other", area: "Stratford" }],
  units: [...units.reverse(), { id: "x1", property_id: "p2", label: "Elsewhere", rent: 1, beds: 1, status: "Vacant" }],
  renters: [{ id: "r1", name: "Jordan Lee", phone: "902-555-0100" }],
  tenancies: [
    { id: "t1", unit_id: "u2", renter_id: "r1", move_in: "2026-01-01", move_out: null, rent: 1001, deposit: 500 },
    { id: "t2", unit_id: "u2", renter_id: "r1", move_in: "2024-01-01", move_out: "2025-12-31", rent: 950, would_rent_again: "Yes" },
    { id: "t3", unit_id: "x1", renter_id: "r1", move_in: "2023-01-01", move_out: null },
  ],
  maintenance: [{ id: "m1", unit_id: "u2", date: "2026-03-01", description: "Furnace", vendor: "Island Heating", cost: 180 }, { id: "m2", unit_id: "x1", date: "2026-01-01", description: "Other building" }],
} as never;

test("units export: one row per unit of that property only, in unit order, with the current tenant", () => {
  const out = propertyExport("units", property, data);
  assert.equal(out.rows, 300);
  assert.equal(out.filename, "240-grafton-st-units");
  const l = lines(out.csv);
  assert.ok(l[1].includes("Apt 1,"));
  assert.ok(l[2].includes("Apt 2,") && l[2].includes("Jordan Lee") && l[2].includes("2026-01-01"));
  assert.ok(l[300].includes("Apt 300,"));
  assert.ok(!out.csv.includes("Elsewhere"));
});

test("history and maintenance exports stay within the property", () => {
  const h = propertyExport("history", property, data);
  assert.equal(h.rows, 2);
  assert.ok(lines(h.csv)[1].includes("Current") && lines(h.csv)[2].includes("2025-12-31"));
  const m = propertyExport("maintenance", property, data);
  assert.equal(m.rows, 1);
  assert.ok(m.csv.includes("Furnace") && !m.csv.includes("Other building"));
});

test("an empty export still has a header row", () => {
  const empty = propertyExport("maintenance", { id: "p9", owner_id: "o1", address: "Empty", area: "X" } as never, data);
  assert.equal(empty.rows, 0);
  assert.equal(lines(empty.csv).length, 1);
});
