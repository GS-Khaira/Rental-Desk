// Run with: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_SETTINGS, match, normalizeSettings } from "../src/lib/match.ts";

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

/* ---------- custom settings ---------- */
const withSettings = (patch: Partial<typeof DEFAULT_SETTINGS>) => ({ ...DEFAULT_SETTINGS, ...patch });

test("a bigger budget stretch keeps a pricier unit in", () => {
  const s = withSettings({ budgetStretchPct: 10 });
  assert.equal(match({ ...unit, rent: 1650 }, renter, s).blocked, false);
  assert.equal(match({ ...unit, rent: 1651 }, renter, s).blocked, true);
});

test("area as a must-match rules out other areas", () => {
  const s = withSettings({ required: { ...DEFAULT_SETTINGS.required, area: true } });
  assert.equal(match({ ...unit, area: "Summerside" }, renter, s).blocked, true);
});

test("turning bedrooms off as a must-match makes it a warning", () => {
  const s = withSettings({ required: { ...DEFAULT_SETTINGS.required, beds: false } });
  const m = match({ ...unit, beds: 1 }, renter, s);
  assert.equal(m.blocked, false);
  assert.equal(m.score, 75);
});

test("scores are scaled to 100 when weights don't add up to 100", () => {
  const s = withSettings({ weights: { budget: 10, beds: 10, area: 10, pets: 10, parking: 10, moveIn: 10 } });
  assert.equal(match(unit, renter, s).score, 100);
  // outside preferred areas: 50 of 60 points
  assert.equal(match({ ...unit, area: "Summerside" }, renter, s).score, 83);
});

test("a criterion with 0 points and not must-match is ignored", () => {
  const s = withSettings({ weights: { ...DEFAULT_SETTINGS.weights, area: 0 } });
  const m = match({ ...unit, area: "Summerside" }, renter, s);
  assert.equal(m.score, 100);
  assert.equal(m.why.some(([, t]) => t.includes("area")), false);
});

test("move-in grace days are configurable", () => {
  const s = withSettings({ moveInGraceDays: 30 });
  assert.equal(match({ ...unit, available_date: "2026-12-31" }, renter, s).score, 100);
});

test("normalizeSettings fills gaps and clamps bad values", () => {
  const s = normalizeSettings({ weights: { budget: 500 }, topCount: -3, minScore: "abc" });
  assert.equal(s.weights.budget, 100);
  assert.equal(s.weights.beds, 25);
  assert.equal(s.topCount, 1);
  assert.equal(s.minScore, 0);
  assert.deepEqual(normalizeSettings(null), DEFAULT_SETTINGS);
});
