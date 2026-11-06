"use client";

import { useState } from "react";
import { isOpen, useStore } from "@/lib/store";
import { AREAS, RENTER_STATUS, UNIT_STATUS, shortArea } from "@/lib/constants";
import { daysBetween, fmtDate, money, plural, today } from "@/lib/format";
import type { Renter, Unit } from "@/lib/types";
import { useActions } from "./actions";
import { Chips, Empty, Linkish, Pill, RentAgainPill, ScoreBadge, ScorePill, StatusPill } from "./ui";

/* ---------------- Today ---------------- */
export function Today({ go }: { go: (v: string) => void }) {
  const s = useStore();
  const { data, setDetail } = s;
  const open = data.units.filter(isOpen);
  const looking = data.renters.filter((r) => r.status === "Looking");
  const t = today();
  const soon = looking.filter((r) => r.move_in && daysBetween(t, r.move_in) <= 30).sort((a, b) => a.move_in!.localeCompare(b.move_in!));
  const ending = data.properties.filter((p) => p.agreement_end && daysBetween(t, p.agreement_end) <= 60 && daysBetween(t, p.agreement_end) >= -30);
  const pairs = looking.flatMap((r) => s.matchesForRenter(r).slice(0, 3).map((m) => ({ r, ...m })))
    .filter((p) => p.score >= 60).sort((a, b) => b.score - a.score).slice(0, 8);

  return (
    <>
      <div className="pagehead">
        <div>
          <div className="label">{new Date().toLocaleDateString("en-CA", { weekday: "long", month: "long", day: "numeric" })}</div>
          <h1>Today at the desk</h1>
        </div>
      </div>
      <div className="stats">
        <button className="stat" type="button" onClick={() => go("units")}>
          <div className="label">Units open</div><div className="n num">{open.length}</div>
          <div className="muted">{open.filter((u) => u.status === "Vacant").length} vacant · {open.filter((u) => u.status === "Listed").length} listed</div>
        </button>
        <button className="stat" type="button" onClick={() => go("renters")}>
          <div className="label">Renters looking</div><div className="n num">{looking.length}</div>
          <div className="muted">{data.renters.length} renters on file</div>
        </button>
        <button className="stat" type="button" onClick={() => go("renters")}>
          <div className="label">Want to move in 30 days</div><div className="n num">{soon.length}</div><div className="muted">Follow up first</div>
        </button>
        <button className="stat" type="button" onClick={() => go("owners")}>
          <div className="label">Agreements ending</div><div className="n num">{ending.length}</div><div className="muted">Within 60 days</div>
        </button>
      </div>
      <div className="cols">
        <section className="panel">
          <h2>Best matches right now</h2>
          {pairs.length ? pairs.map((m) => (
            <div className="mrow" key={m.r.id + m.u.id}>
              <ScoreBadge s={m.score} />
              <div style={{ minWidth: 0 }}>
                <Linkish onClick={() => setDetail({ type: "renter", id: m.r.id })}>{m.r.name}</Linkish> <span className="muted">→</span>{" "}
                <Linkish onClick={() => setDetail({ type: "unit", id: m.u.id })}>{s.unitName(m.u)}</Linkish>
                <div className="muted small">{money(m.u.rent)}/mo · budget {money(m.r.budget)}</div>
                <Chips why={m.why} />
              </div>
              <span />
            </div>
          )) : <Empty title="No strong matches yet">Add open units and renters who are looking. Pairs that fit budget, bedrooms and pets show up here.</Empty>}
        </section>
        <section className="panel">
          <h2>Moving soon</h2>
          {soon.length ? soon.map((r) => (
            <div className="mrow" key={r.id}>
              <div className="num small" style={{ width: 62 }}>{fmtDate(r.move_in, false)}</div>
              <div style={{ minWidth: 0 }}>
                <Linkish onClick={() => setDetail({ type: "renter", id: r.id })}>{r.name}</Linkish>
                <div className="muted small">{r.beds ? `${r.beds} bed · ` : ""}{money(r.budget)} · {plural(s.matchesForRenter(r).length, "matching unit")}</div>
              </div>
              <span />
            </div>
          )) : <Empty title="Nobody moving in the next 30 days">Renters with a move-in date within a month are listed here.</Empty>}
          {ending.length > 0 && <>
            <h2 style={{ marginTop: 18 }}>Agreements ending</h2>
            {ending.map((p) => (
              <div className="mrow" key={p.id}>
                <div className="num small" style={{ width: 62 }}>{fmtDate(p.agreement_end, false)}</div>
                <div style={{ minWidth: 0 }}>
                  <Linkish onClick={() => setDetail({ type: "owner", id: p.owner_id })}>{p.address}</Linkish>
                  <div className="muted small">{data.owners.find((o) => o.id === p.owner_id)?.name}</div>
                </div>
                <span />
              </div>
            ))}
          </>}
        </section>
      </div>
    </>
  );
}

/* ---------------- Units ---------------- */
function TopRenters({ u }: { u: Unit }) {
  const s = useStore();
  const mx = s.matchesForUnit(u).slice(0, 10);
  return (
    <div className="toplist">
      <div className="label">{mx.length ? `Top ${plural(mx.length, "renter")} by score` : "Top renters"}</div>
      {mx.length ? (
        <ol>
          {mx.map((m, i) => (
            <li key={m.r.id}>
              <span className="rank num">{i + 1}</span>
              <Linkish onClick={() => s.setDetail({ type: "renter", id: m.r.id })}>{m.r.name}</Linkish>
              <ScorePill s={m.score} />
            </li>
          ))}
        </ol>
      ) : <div className="muted small">No renters who are looking fit this unit yet.</div>}
    </div>
  );
}

export function Units() {
  const s = useStore();
  const a = useActions();
  const { data } = s;
  const [f, setF] = useState({ q: "", status: "open", area: "", beds: "" });
  let list = [...data.units];
  if (f.status === "open") list = list.filter(isOpen); else if (f.status) list = list.filter((u) => u.status === f.status);
  if (f.area) list = list.filter((u) => s.propOf(u)?.area === f.area);
  if (f.beds) list = list.filter((u) => u.beds >= Number(f.beds));
  if (f.q) {
    const q = f.q.toLowerCase();
    list = list.filter((u) => {
      const owner = data.owners.find((o) => o.id === s.propOf(u)?.owner_id);
      return [s.unitName(u), owner?.name, u.notes].join(" ").toLowerCase().includes(q);
    });
  }
  list.sort((x, y) => Number(isOpen(y)) - Number(isOpen(x)) || x.rent - y.rent);

  return (
    <>
      <div className="pagehead">
        <div><div className="label">{plural(data.units.length, "unit")} · {plural(data.properties.length, "property", "properties")}</div><h1>Units</h1></div>
        <div className="row"><button className="btn" type="button" onClick={() => a.property()}>+ Property</button><button className="btn primary" type="button" onClick={() => a.unit()}>+ Unit</button></div>
      </div>
      <div className="filters">
        <input type="search" placeholder="Search address, owner, notes" aria-label="Search units" value={f.q} onChange={(e) => setF({ ...f, q: e.target.value })} />
        <select aria-label="Status" value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })}>
          <option value="open">Open (vacant + listed)</option><option value="">All statuses</option>
          {UNIT_STATUS.map((x) => <option key={x}>{x}</option>)}
        </select>
        <select aria-label="Area" value={f.area} onChange={(e) => setF({ ...f, area: e.target.value })}>
          <option value="">All areas</option>{AREAS.map((x) => <option key={x}>{x}</option>)}
        </select>
        <select aria-label="Bedrooms" value={f.beds} onChange={(e) => setF({ ...f, beds: e.target.value })}>
          <option value="">Any beds</option>{[1, 2, 3, 4].map((n) => <option key={n} value={n}>{n}+ bed</option>)}
        </select>
      </div>
      {list.length ? (
        <div className="list">
          {list.map((u) => {
            const p = s.propOf(u);
            const t = s.activeTenancy(u.id);
            const r = t && data.renters.find((x) => x.id === t.renter_id);
            const mc = isOpen(u) ? s.matchesForUnit(u).length : 0;
            const openIt = () => s.setDetail({ type: "unit", id: u.id });
            return (
              <div className="card" key={u.id} role="button" tabIndex={0} onClick={openIt}
                onKeyDown={(e) => { if (e.target === e.currentTarget && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); openIt(); } }}>
                <div className="row between"><StatusPill s={u.status} /><span className="num strong">{money(u.rent)}</span></div>
                <div className="t">{p?.address ?? "No property"}{u.label && <span className="muted" style={{ fontWeight: 500 }}> · {u.label}</span>}</div>
                <div className="sub">{p?.area}</div>
                <div className="facts">
                  <span><b>{u.beds}</b> bed</span><span><b>{u.baths ?? "—"}</b> bath</span>
                  {u.pets && <span>Pets OK</span>}{u.parking && <span>Parking</span>}
                </div>
                <div className="sub">
                  {isOpen(u) ? `${plural(mc, "renter")} match${u.available_date ? ` · free ${fmtDate(u.available_date)}` : ""}` : r ? `Tenant: ${r.name}` : ""}
                </div>
                {isOpen(u) && <TopRenters u={u} />}
              </div>
            );
          })}
        </div>
      ) : (
        <Empty title={data.units.length ? "No units match these filters" : "No units yet"}>
          {data.units.length ? "Change the filters above to see more." : "Add an owner, then a property, then its units. A duplex has two units; a house has one."}
        </Empty>
      )}
    </>
  );
}

/* ---------------- Renters ---------------- */
export function renterHistoryPill(s: ReturnType<typeof useStore>, r: Renter) {
  const ts = s.tenanciesOfRenter(r.id).filter((t) => t.would_rent_again);
  return ts.length ? <RentAgainPill v={ts[0].would_rent_again} /> : null;
}

export function Renters() {
  const s = useStore();
  const a = useActions();
  const { data } = s;
  const [f, setF] = useState({ q: "", status: "Looking", area: "" });
  let list = [...data.renters];
  if (f.status) list = list.filter((r) => r.status === f.status);
  if (f.area) list = list.filter((r) => r.areas.includes(f.area));
  if (f.q) { const q = f.q.toLowerCase(); list = list.filter((r) => [r.name, r.phone, r.email, r.notes].join(" ").toLowerCase().includes(q)); }
  list.sort((x, y) => (x.move_in || "9999").localeCompare(y.move_in || "9999"));

  return (
    <>
      <div className="pagehead">
        <div><div className="label">{plural(data.renters.length, "renter")} on file</div><h1>Renters</h1></div>
        <button className="btn primary" type="button" onClick={() => a.renter()}>+ Renter</button>
      </div>
      <div className="filters">
        <input type="search" placeholder="Search name, phone, email, notes" aria-label="Search renters" value={f.q} onChange={(e) => setF({ ...f, q: e.target.value })} />
        <select aria-label="Status" value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })}>
          <option value="">All statuses</option>{RENTER_STATUS.map((x) => <option key={x}>{x}</option>)}
        </select>
        <select aria-label="Preferred area" value={f.area} onChange={(e) => setF({ ...f, area: e.target.value })}>
          <option value="">Any preferred area</option>{AREAS.map((x) => <option key={x}>{x}</option>)}
        </select>
      </div>
      {list.length ? (
        <div className="list">
          {list.map((r) => {
            const mc = r.status === "Looking" ? s.matchesForRenter(r).length : null;
            return (
              <button className="card" type="button" key={r.id} onClick={() => s.setDetail({ type: "renter", id: r.id })}>
                <div className="row between"><StatusPill s={r.status} /><span className="num strong">{money(r.budget)}</span></div>
                <div className="t">{r.name}</div>
                <div className="sub mono">{r.phone || r.email || "No contact yet"}</div>
                <div className="facts">
                  {r.beds ? <span><b>{r.beds}</b> bed</span> : null}
                  {r.move_in && <span>Move {fmtDate(r.move_in)}</span>}
                  {r.pets && <span>Has pets</span>}
                </div>
                <div className="sub">{r.areas.length ? r.areas.slice(0, 3).map(shortArea).join(", ") + (r.areas.length > 3 ? ` +${r.areas.length - 3}` : "") : "Any area"}</div>
                <div className="row">
                  {mc !== null && <Pill tone={mc ? "ok" : "off"}>{plural(mc, "matching unit")}</Pill>}
                  {renterHistoryPill(s, r)}
                  {!r.consent && <Pill tone="warn">No consent recorded</Pill>}
                </div>
              </button>
            );
          })}
        </div>
      ) : (
        <Empty title={data.renters.length ? "No renters match these filters" : "No renters yet"}>
          {data.renters.length ? "Try “All statuses” to include placed and inactive renters." : "Add someone right after a call. Name and budget are enough to start."}
        </Empty>
      )}
    </>
  );
}

/* ---------------- Owners ---------------- */
export function Owners() {
  const s = useStore();
  const a = useActions();
  const { data } = s;
  const [q, setQ] = useState("");
  let list = [...data.owners].sort((x, y) => x.name.localeCompare(y.name));
  if (q) list = list.filter((o) => [o.name, o.phone, o.email].join(" ").toLowerCase().includes(q.toLowerCase()));
  return (
    <>
      <div className="pagehead">
        <div><div className="label">{plural(data.owners.length, "owner")}</div><h1>Owners</h1></div>
        <button className="btn primary" type="button" onClick={() => a.owner()}>+ Owner</button>
      </div>
      <div className="filters"><input type="search" placeholder="Search name, phone, email" aria-label="Search owners" value={q} onChange={(e) => setQ(e.target.value)} /></div>
      {list.length ? (
        <div className="list">
          {list.map((o) => {
            const ps = data.properties.filter((p) => p.owner_id === o.id);
            const us = data.units.filter((u) => ps.some((p) => p.id === u.property_id));
            return (
              <button className="card" type="button" key={o.id} onClick={() => s.setDetail({ type: "owner", id: o.id })}>
                <div className="t">{o.name}</div>
                <div className="sub mono">{o.phone || o.email}</div>
                <div className="facts">
                  <span><b>{ps.length}</b> {ps.length === 1 ? "property" : "properties"}</span>
                  <span><b>{us.length}</b> {us.length === 1 ? "unit" : "units"}</span>
                  <span><b>{us.filter(isOpen).length}</b> open</span>
                </div>
              </button>
            );
          })}
        </div>
      ) : <Empty title={data.owners.length ? "No owners match" : "No owners yet"}>{data.owners.length ? "" : "Start here: add the owner, then their properties and units."}</Empty>}
    </>
  );
}
