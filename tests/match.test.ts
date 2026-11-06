// Run with: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { match } from "../src/lib/match.ts";

const unit = { rent: 1450, beds: 2, pets: true, parking: true, available_date: "2026-12-01", area: "Stratford" };
const renter = { budget: 1500, beds: 2, areas: ["Stratford"], pets: true, parking: true, move_in: "2026-12-01" };

test("perfect fit scores 100", () => {
  const m = match(unit, renter);
  assert.equal(m.blocked, false);
  assert.equal(m.score, 100);
});

test("up to 5% over budget is allowed with fewer points", () => {
  const m = match({ ...unit, rent: 1575 }, renter);
  assert.equal(m.blocked, false);
  assert.equal(m.score, 83);
});

test("more than 5% over budget rules the unit out", () => {
  assert.equal(match({ ...unit, rent: 1576 }, renter).blocked, true);
});

test("too few bedrooms rules the unit out", () => {
  assert.equal(match({ ...unit, beds: 1 }, renter).blocked, true);
});

test("pets in a no-pets unit rules it out; no pets is fine anywhere", () => {
  assert.equal(match({ ...unit, pets: false }, renter).blocked, true);
  assert.equal(match({ ...unit, pets: false }, { ...renter, pets: false }).blocked, false);
});

test("outside preferred areas is a warning, not a block", () => {
  const m = match({ ...unit, area: "Summerside" }, renter);
  assert.equal(m.blocked, false);
  assert.equal(m.score, 80);
});

test("move-in grace is 14 days", () => {
  assert.equal(match({ ...unit, available_date: "2026-12-15" }, renter).score, 100);
  assert.equal(match({ ...unit, available_date: "2026-12-16" }, renter).score, 95);
});

test("blank renter fields score partial points", () => {
  const m = match(unit, { budget: 0, beds: null, areas: [], pets: false, parking: false, move_in: null });
  assert.equal(m.score, 20 + 15 + 15 + 10 + 5 + 5);
});
