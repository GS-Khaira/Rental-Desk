"use client";

import { useMemo, useState } from "react";
import { isOpen, useStore } from "@/lib/store";
import { match, type MatchRenter, type MatchSettings, type MatchUnit } from "@/lib/match";
import { AREAS, shortArea } from "@/lib/constants";
import { money, plural } from "@/lib/format";
import { useActions } from "./actions";
import { Chips, ScoreBadge } from "./ui";

type Mode = "units" | "renters";
const PAGE = 20;

const blankRenter = { budget: "", beds: "", areas: [] as string[], pets: false, parking: false, moveIn: "" };
const blankUnit = { rent: "", beds: "", area: "", pets: false, parking: false, available: "" };

/** A compact "any area / these areas" picker. */
function AreaPicker({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  const label = value.length === 0 ? "Any area" : value.length === 1 ? shortArea(value[0]) : `${value.length} areas`;
  return (
    <details className="areapick">
      <summary><span className="ellipsis">{label}</span></summary>
      <div className="areapop">
        <div className="row between" style={{ marginBottom: 6 }}>
          <span className="label">Preferred areas</span>
          {value.length > 0 && <button type="button" className="linkish small" onClick={() => onChange([])}>Any area</button>}
        </div>
        {AREAS.map((a) => (
          <label key={a} className="check small">
            <input type="checkbox" checked={value.includes(a)} onChange={(e) => onChange(e.target.checked ? [...value, a] : value.filter((x) => x !== a))} />
            <span>{shortArea(a)}</span>
          </label>
        ))}
      </div>
    </details>
  );
}

/**
 * "Find a match": type real numbers (budget, bedrooms, areas…) and see matching units,
 * or describe a unit and see matching renters. Uses the scoring rules on this page,
 * including changes not saved yet, so the effect of a rule change shows straight away.
 */
export function QuickMatch({ settings }: { settings: MatchSettings }) {
  const s = useStore();
  const a = useActions();
  const [mode, setMode] = useState<Mode>("units");
  const [rq, setRq] = useState(blankRenter);
  const [uq, setUq] = useState(blankUnit);
  const [showOut, setShowOut] = useState(false);
  const [limit, setLimit] = useState(PAGE);

  const filled = mode === "units"
    ? Boolean(rq.budget || rq.beds || rq.areas.length || rq.pets || rq.parking || rq.moveIn)
    : Boolean(uq.rent || uq.beds || uq.area || uq.pets || uq.parking || uq.available);

  const results = useMemo(() => {
    if (!filled) return null;
    if (mode === "units") {
      const r: MatchRenter = {
        budget: Number(rq.budget) || 0, beds: Number(rq.beds) || null, areas: rq.areas,
        pets: rq.pets, parking: rq.parking, move_in: rq.moveIn || null,
      };
      const all = s.data.units.filter(isOpen).map((u) => {
        const m = match({ ...u, area: s.propOf(u)?.area ?? null }, r, settings);
        return { id: u.id, kind: "unit" as const, title: s.unitName(u), sub: `${money(u.rent)}/mo · ${u.beds} bed · ${s.propOf(u)?.area ?? ""}`, ...m };
      });
      return split(all, settings.minScore);
    }
    const u: MatchUnit = {
      rent: Number(uq.rent) || 0, beds: Number(uq.beds) || 0, area: uq.area || null,
      pets: uq.pets, parking: uq.parking, available_date: uq.available || null,
    };
    const all = s.data.renters.filter((r) => r.status === "Looking").map((r) => {
      const m = match(u, r, settings);
      return { id: r.id, kind: "renter" as const, title: r.name, sub: `Budget ${money(r.budget)}${r.beds ? ` · ${r.beds} bed` : ""}${r.phone ? ` · ${r.phone}` : ""}`, ...m };
    });
    return split(all, settings.minScore);
  }, [mode, rq, uq, filled, settings, s]);

  const clear = () => { setRq(blankRenter); setUq(blankUnit); setLimit(PAGE); setShowOut(false); };
  const shown = results ? (showOut ? [...results.fit, ...results.out] : results.fit) : [];

  return (
    <section className="panel quickmatch">
      <div className="row between">
        <div>
          <h2>Find a match</h2>
          <p className="muted small" style={{ margin: "2px 0 0" }}>Type in real numbers. Results update as you type, using the scoring rules below.</p>
        </div>
        <div className="seg" role="group" aria-label="What to find">
          <button type="button" className={mode === "units" ? "on" : ""} aria-pressed={mode === "units"} onClick={() => { setMode("units"); setLimit(PAGE); }}>Units for a renter</button>
          <button type="button" className={mode === "renters" ? "on" : ""} aria-pressed={mode === "renters"} onClick={() => { setMode("renters"); setLimit(PAGE); }}>Renters for a unit</button>
        </div>
      </div>

      {mode === "units" ? (
        <div className="qmgrid">
          <label className="fld" htmlFor="qm-budget"><span>Budget / month</span>
            <div className="money"><span>$</span><input id="qm-budget" type="number" inputMode="numeric" min="0" step="50" placeholder="1500" value={rq.budget} onChange={(e) => setRq({ ...rq, budget: e.target.value })} /></div></label>
          <label className="fld" htmlFor="qm-beds"><span>Bedrooms</span>
            <input id="qm-beds" type="number" inputMode="numeric" min="0" max="9" placeholder="2" value={rq.beds} onChange={(e) => setRq({ ...rq, beds: e.target.value })} /></label>
          <div className="fld"><span>Areas</span><AreaPicker value={rq.areas} onChange={(areas) => setRq({ ...rq, areas })} /></div>
          <label className="fld" htmlFor="qm-move"><span>Move-in date</span>
            <input id="qm-move" type="date" value={rq.moveIn} onChange={(e) => setRq({ ...rq, moveIn: e.target.value })} /></label>
          <div className="fld"><span>Needs</span>
            <div className="row qmchecks">
              <label className="check small"><input id="qm-pets" type="checkbox" checked={rq.pets} onChange={(e) => setRq({ ...rq, pets: e.target.checked })} /><span>Has pets</span></label>
              <label className="check small"><input id="qm-parking" type="checkbox" checked={rq.parking} onChange={(e) => setRq({ ...rq, parking: e.target.checked })} /><span>Parking</span></label>
            </div></div>
        </div>
      ) : (
        <div className="qmgrid">
          <label className="fld" htmlFor="qm-rent"><span>Rent / month</span>
            <div className="money"><span>$</span><input id="qm-rent" type="number" inputMode="numeric" min="0" step="50" placeholder="1450" value={uq.rent} onChange={(e) => setUq({ ...uq, rent: e.target.value })} /></div></label>
          <label className="fld" htmlFor="qm-ubeds"><span>Bedrooms</span>
            <input id="qm-ubeds" type="number" inputMode="numeric" min="0" max="9" placeholder="2" value={uq.beds} onChange={(e) => setUq({ ...uq, beds: e.target.value })} /></label>
          <label className="fld" htmlFor="qm-area"><span>Area</span>
            <select id="qm-area" value={uq.area} onChange={(e) => setUq({ ...uq, area: e.target.value })}>
              <option value="">Any area</option>{AREAS.map((x) => <option key={x} value={x}>{shortArea(x)}</option>)}
            </select></label>
          <label className="fld" htmlFor="qm-avail"><span>Available from</span>
            <input id="qm-avail" type="date" value={uq.available} onChange={(e) => setUq({ ...uq, available: e.target.value })} /></label>
          <div className="fld"><span>Offers</span>
            <div className="row qmchecks">
              <label className="check small"><input id="qm-upets" type="checkbox" checked={uq.pets} onChange={(e) => setUq({ ...uq, pets: e.target.checked })} /><span>Pets allowed</span></label>
              <label className="check small"><input id="qm-uparking" type="checkbox" checked={uq.parking} onChange={(e) => setUq({ ...uq, parking: e.target.checked })} /><span>Parking</span></label>
            </div></div>
        </div>
      )}

      <div className="row between qmbar">
        <span className="small">
          {results
            ? <><b>{plural(results.fit.length, mode === "units" ? "unit" : "renter")} match</b>{results.out.length > 0 && <span className="muted"> · {results.out.length} ruled out</span>}</>
            : <span className="muted">{mode === "units" ? "Enter a budget or bedrooms to see open units that fit." : "Enter a rent or bedrooms to see renters who are looking."}</span>}
        </span>
        <div className="row">
          {results && results.out.length > 0 && (
            <label className="check small"><input id="qm-showout" type="checkbox" checked={showOut} onChange={(e) => setShowOut(e.target.checked)} /><span>Show ruled out</span></label>
          )}
          {mode === "units" && filled && (
            <button type="button" className="btn small" onClick={() => a.renter({
              budget: Number(rq.budget) || undefined, beds: Number(rq.beds) || null, areas: rq.areas, pets: rq.pets, parking: rq.parking,
              move_in: rq.moveIn || null, status: "Looking",
            })}>Save as new renter</button>
          )}
          {filled && <button type="button" className="btn small" onClick={clear}>Clear</button>}
        </div>
      </div>

      {results && (shown.length ? (
        <div className="qmresults">
          {shown.slice(0, limit).map((m) => (
            <button key={m.id} type="button" className={`mrow qmrow ${m.blocked ? "out" : ""}`} onClick={() => s.setDetail({ type: m.kind, id: m.id })}>
              {m.blocked ? <div className="score">—</div> : <ScoreBadge s={m.score} />}
              <div style={{ minWidth: 0, textAlign: "left" }}>
                <div className="t">{m.title}</div>
                <div className="muted small">{m.sub}</div>
                <Chips why={m.why} />
              </div>
              <span className="muted small">{m.blocked ? "Ruled out" : "Open"}</span>
            </button>
          ))}
          {shown.length > limit && <button type="button" className="btn small" style={{ alignSelf: "center", marginTop: 8 }} onClick={() => setLimit(limit + PAGE)}>Show {Math.min(PAGE, shown.length - limit)} more</button>}
        </div>
      ) : (
        <div className="empty" style={{ marginTop: 10 }}>
          <b>Nothing fits yet</b>
          {results.out.length ? "Tick “Show ruled out” to see why, or loosen the rules below (e.g. a bigger budget stretch)." : mode === "units" ? "There are no vacant or listed units right now." : "No renters are marked Looking right now."}
        </div>
      ))}
    </section>
  );
}

function split<T extends { blocked: boolean; score: number }>(all: T[], minScore: number) {
  const fit = all.filter((m) => !m.blocked && m.score >= minScore).sort((x, y) => y.score - x.score);
  const out = all.filter((m) => m.blocked || m.score < minScore).sort((x, y) => y.score - x.score);
  return { fit, out };
}
