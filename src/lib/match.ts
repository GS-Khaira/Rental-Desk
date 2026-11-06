// Renter ↔ unit matching. Pure functions: no imports, so they can be unit tested directly.
//
// Six criteria, each with a weight (points) and a "must match" switch. The score is the points
// earned divided by the total weight, shown out of 100. With the default settings the weights add
// up to 100, so scores are exactly the points earned.
//
// Default rules: budget 35, bedrooms 25, area 20, pets 10, parking 5, move-in timing 5.
// Ruled out ("blocked") when rent is more than 5% over budget, the unit has too few bedrooms,
// or the renter has pets and the unit doesn't allow them.
// Never uses protected grounds under the PEI Human Rights Act.

export type Reason = ["ok" | "warn" | "no", string];
export interface MatchResult { score: number; blocked: boolean; why: Reason[] }

export interface MatchUnit {
  rent: number;
  beds: number;
  pets: boolean;
  parking: boolean;
  available_date: string | null;
  area: string | null;
}
export interface MatchRenter {
  budget: number;
  beds: number | null;
  areas: string[];
  pets: boolean;
  parking: boolean;
  move_in: string | null;
}

export type Criterion = "budget" | "beds" | "area" | "pets" | "parking" | "moveIn";
export const CRITERIA: Criterion[] = ["budget", "beds", "area", "pets", "parking", "moveIn"];

export interface MatchSettings {
  /** Points for each criterion. 0 turns a criterion off (unless it is a must-match). */
  weights: Record<Criterion, number>;
  /** Must-match: when true, failing this criterion rules the unit out. */
  required: Record<Criterion, boolean>;
  /** How far over budget (percent) still counts as a partial fit. */
  budgetStretchPct: number;
  /** A unit free this many days after the renter's move-in date still counts as on time. */
  moveInGraceDays: number;
  /** How many renters to list on each unit card. */
  topCount: number;
  /** Hide matches scoring below this (0–100). */
  minScore: number;
}

export const DEFAULT_SETTINGS: MatchSettings = {
  weights: { budget: 35, beds: 25, area: 20, pets: 10, parking: 5, moveIn: 5 },
  required: { budget: true, beds: true, area: false, pets: true, parking: false, moveIn: false },
  budgetStretchPct: 5,
  moveInGraceDays: 14,
  topCount: 10,
  minScore: 0,
};

export const LIMITS = {
  weight: [0, 100],
  budgetStretchPct: [0, 50],
  moveInGraceDays: [0, 120],
  topCount: [1, 50],
  minScore: [0, 100],
} as const;

// Share of a criterion's points given when the renter left the field blank, or for a partial fit.
// Chosen so the default weights reproduce the original scores exactly (e.g. 18 of 35 when over budget).
const PARTIAL = { budgetOver: 18 / 35, budgetBlank: 20 / 35, bedsBlank: 15 / 25, areaBlank: 15 / 20 };

const clamp = (n: unknown, [lo, hi]: readonly [number, number], fallback: number) => {
  const x = Number(n);
  return Number.isFinite(x) ? Math.min(hi, Math.max(lo, Math.round(x))) : fallback;
};

/** Fill gaps and clamp values, so settings saved by an older version, or edited by hand, are safe to use. */
export function normalizeSettings(raw: unknown): MatchSettings {
  const r = (raw && typeof raw === "object" ? raw : {}) as Partial<MatchSettings>;
  const d = DEFAULT_SETTINGS;
  const weights = {} as Record<Criterion, number>;
  const required = {} as Record<Criterion, boolean>;
  for (const c of CRITERIA) {
    weights[c] = clamp(r.weights?.[c], LIMITS.weight, d.weights[c]);
    required[c] = typeof r.required?.[c] === "boolean" ? r.required[c] : d.required[c];
  }
  return {
    weights,
    required,
    budgetStretchPct: clamp(r.budgetStretchPct, LIMITS.budgetStretchPct, d.budgetStretchPct),
    moveInGraceDays: clamp(r.moveInGraceDays, LIMITS.moveInGraceDays, d.moveInGraceDays),
    topCount: clamp(r.topCount, LIMITS.topCount, d.topCount),
    minScore: clamp(r.minScore, LIMITS.minScore, d.minScore),
  };
}

export const sameSettings = (a: MatchSettings, b: MatchSettings) => JSON.stringify(a) === JSON.stringify(b);

const money = (n: number) => "$" + Math.round(n).toLocaleString("en-CA");
const days = (a: string, b: string) =>
  Math.round((new Date(b + "T12:00:00").getTime() - new Date(a + "T12:00:00").getTime()) / 864e5);
const shortDate = (d: string) =>
  new Date(d + "T12:00:00").toLocaleDateString("en-CA", { month: "short", day: "numeric", year: "numeric" });

export function match(u: MatchUnit, r: MatchRenter, settings: MatchSettings = DEFAULT_SETTINGS): MatchResult {
  const { weights: w, required: req } = settings;
  const why: Reason[] = [];
  let earned = 0;
  let total = 0;
  let blocked = false;

  // A criterion counts when it has points or is a must-match.
  const on = (c: Criterion) => w[c] > 0 || req[c];
  const add = (c: Criterion, share: number) => { earned += w[c] * share; };
  /** A failed check: rules the unit out if must-match, otherwise a warning. */
  const fail = (c: Criterion, text: string) => {
    if (req[c]) { blocked = true; why.push(["no", text]); } else why.push(["warn", text]);
  };
  for (const c of CRITERIA) if (on(c)) total += w[c];

  if (on("budget")) {
    const rent = Number(u.rent) || 0;
    const budget = Number(r.budget) || 0;
    if (!budget) add("budget", PARTIAL.budgetBlank);
    else if (rent <= budget) { add("budget", 1); why.push(["ok", "Within budget"]); }
    else if (rent <= budget * (1 + settings.budgetStretchPct / 100)) { add("budget", PARTIAL.budgetOver); why.push(["warn", money(rent - budget) + " over budget"]); }
    else fail("budget", money(rent - budget) + " over budget");
  }

  if (on("beds")) {
    if (!r.beds) add("beds", PARTIAL.bedsBlank);
    else if ((Number(u.beds) || 0) >= r.beds) { add("beds", 1); why.push(["ok", `${u.beds} bed`]); }
    else fail("beds", `Needs ${r.beds} bed`);
  }

  if (on("area")) {
    if (!r.areas || !r.areas.length) add("area", PARTIAL.areaBlank);
    else if (u.area && r.areas.includes(u.area)) { add("area", 1); why.push(["ok", u.area.replace("Charlottetown – ", "")]); }
    else fail("area", "Outside preferred areas");
  }

  if (on("pets")) {
    if (!r.pets) add("pets", 1);
    else if (u.pets) { add("pets", 1); why.push(["ok", "Pets OK"]); }
    else fail("pets", "No pets allowed");
  }

  if (on("parking")) {
    if (!r.parking) add("parking", 1);
    else if (u.parking) { add("parking", 1); why.push(["ok", "Parking"]); }
    else fail("parking", "No parking");
  }

  if (on("moveIn")) {
    if (!r.move_in || !u.available_date) add("moveIn", 1);
    else if (days(r.move_in, u.available_date) <= settings.moveInGraceDays) { add("moveIn", 1); why.push(["ok", "Ready in time"]); }
    else fail("moveIn", "Free " + shortDate(u.available_date));
  }

  const score = total > 0 ? Math.round((earned / total) * 100) : 100;
  return { score, blocked, why };
}

export const scoreTone = (s: number) => (s >= 80 ? "ok" : s >= 60 ? "warn" : "off");
