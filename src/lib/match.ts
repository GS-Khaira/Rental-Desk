// Renter ↔ unit matching. Pure functions: no imports, so they can be unit tested directly.
//
// Points (max 100): budget 35, bedrooms 25, area 20, pets 10, parking 5, move-in timing 5.
// A unit is ruled out ("blocked") when rent is more than 5% over budget, it has too few
// bedrooms, or the renter has pets and the unit doesn't allow them.
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

const money = (n: number) => "$" + Math.round(n).toLocaleString("en-CA");
const days = (a: string, b: string) =>
  Math.round((new Date(b + "T12:00:00").getTime() - new Date(a + "T12:00:00").getTime()) / 864e5);
const shortDate = (d: string) =>
  new Date(d + "T12:00:00").toLocaleDateString("en-CA", { month: "short", day: "numeric", year: "numeric" });

export const OVER_BUDGET_ALLOWANCE = 0.05;
export const MOVE_IN_GRACE_DAYS = 14;

export function match(u: MatchUnit, r: MatchRenter): MatchResult {
  const why: Reason[] = [];
  let score = 0;
  let blocked = false;
  const rent = Number(u.rent) || 0;
  const budget = Number(r.budget) || 0;

  if (budget) {
    if (rent <= budget) { score += 35; why.push(["ok", "Within budget"]); }
    else if (rent <= budget * (1 + OVER_BUDGET_ALLOWANCE)) { score += 18; why.push(["warn", money(rent - budget) + " over budget"]); }
    else { blocked = true; why.push(["no", money(rent - budget) + " over budget"]); }
  } else score += 20;

  if (r.beds) {
    if ((Number(u.beds) || 0) >= r.beds) { score += 25; why.push(["ok", `${u.beds} bed`]); }
    else { blocked = true; why.push(["no", `Needs ${r.beds} bed`]); }
  } else score += 15;

  if (r.areas && r.areas.length) {
    if (u.area && r.areas.includes(u.area)) { score += 20; why.push(["ok", u.area.replace("Charlottetown – ", "")]); }
    else why.push(["warn", "Outside preferred areas"]);
  } else score += 15;

  if (r.pets) {
    if (u.pets) { score += 10; why.push(["ok", "Pets OK"]); }
    else { blocked = true; why.push(["no", "No pets allowed"]); }
  } else score += 10;

  if (r.parking) {
    if (u.parking) { score += 5; why.push(["ok", "Parking"]); }
    else why.push(["warn", "No parking"]);
  } else score += 5;

  if (r.move_in && u.available_date) {
    if (days(r.move_in, u.available_date) <= MOVE_IN_GRACE_DAYS) { score += 5; why.push(["ok", "Ready in time"]); }
    else why.push(["warn", "Free " + shortDate(u.available_date)]);
  } else score += 5;

  return { score, blocked, why };
}

export const scoreTone = (s: number) => (s >= 80 ? "ok" : s >= 60 ? "warn" : "off");
