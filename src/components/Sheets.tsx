"use client";

import { useEffect, type ReactNode } from "react";
import { isOpen, useStore } from "@/lib/store";
import { fmtDate, money, plural } from "@/lib/format";
import type { Owner, Renter, Tenancy, Unit } from "@/lib/types";
import { useActions } from "./actions";
import { Chips, ConfirmButton, Empty, KV, Linkish, Pill, RentAgainPill, ScoreBadge, StatusPill } from "./ui";
import { renterHistoryPill } from "./Views";

export function DetailSheet() {
  const s = useStore();
  const { detail, setDetail, data } = s;
  useEffect(() => {
    if (!detail) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape" && !document.querySelector(".modal")) setDetail(null); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [detail, setDetail]);
  if (!detail) return null;

  let body: ReactNode = null;
  if (detail.type === "unit") { const u = data.units.find((x) => x.id === detail.id); if (u) body = <UnitSheet u={u} />; }
  if (detail.type === "renter") { const r = data.renters.find((x) => x.id === detail.id); if (r) body = <RenterSheet r={r} />; }
  if (detail.type === "owner") { const o = data.owners.find((x) => x.id === detail.id); if (o) body = <OwnerSheet o={o} />; }
  if (!body) return null;
  return (
    <>
      <div className="scrim" onClick={() => setDetail(null)} />
      <aside className="sheet" role="dialog" aria-modal="true" key={detail.type + detail.id}>{body}</aside>
    </>
  );
}

const Head = ({ pills, title, sub }: { pills?: ReactNode; title: string; sub?: ReactNode }) => {
  const { setDetail } = useStore();
  return (
    <div className="head">
      <div style={{ minWidth: 0 }}>
        {pills && <div className="row">{pills}</div>}
        <h2 style={{ marginTop: 6 }}>{title}</h2>
        {sub && <div className="muted">{sub}</div>}
      </div>
      <button className="btn small" type="button" onClick={() => setDetail(null)}>Close</button>
    </div>
  );
};

function TenancyLine({ t, show }: { t: Tenancy; show: "renter" | "unit" }) {
  const s = useStore();
  const a = useActions();
  const u = s.data.units.find((x) => x.id === t.unit_id);
  const r = s.data.renters.find((x) => x.id === t.renter_id);
  return (
    <>
      <div className="row between">
        <div>
          {show === "renter"
            ? r ? <Linkish onClick={() => s.setDetail({ type: "renter", id: r.id })}>{r.name}</Linkish> : "Removed renter"
            : u ? <Linkish onClick={() => s.setDetail({ type: "unit", id: u.id })}>{s.unitName(u)}</Linkish> : (t.unit_snapshot ?? "Removed unit")}
        </div>
        <div className="row">{t.would_rent_again ? <RentAgainPill v={t.would_rent_again} /> : !t.move_out ? <Pill tone="listed">Current</Pill> : null}</div>
      </div>
      <div className="muted num small">
        {fmtDate(t.move_in)} → {t.move_out ? fmtDate(t.move_out) : "now"} · {money(t.rent)}/mo{t.deposit ? ` · deposit ${money(t.deposit)}` : ""}
      </div>
      {t.payment_notes && <div className="small"><span className="label">Payments</span> {t.payment_notes}</div>}
      {t.notes && <div className="small"><span className="label">Notes</span> {t.notes}</div>}
      <div className="row" style={{ marginTop: 4 }}><Linkish className="small" onClick={() => a.tenancy(t)}>Edit record</Linkish></div>
    </>
  );
}

function UnitSheet({ u }: { u: Unit }) {
  const s = useStore();
  const a = useActions();
  const p = s.propOf(u);
  const o = s.data.owners.find((x) => x.id === p?.owner_id);
  const act = s.activeTenancy(u.id);
  const hist = s.tenanciesOfUnit(u.id);
  const mx = isOpen(u) ? s.matchesForUnit(u) : [];
  const mt = s.data.maintenance.filter((m) => m.unit_id === u.id).sort((x, y) => y.date.localeCompare(x.date));
  return (
    <>
      <Head pills={<StatusPill s={u.status} />} title={s.unitName(u)} sub={p?.area} />
      <div className="row" style={{ marginBottom: 12 }}>
        <button className="btn small" type="button" onClick={() => a.unit(u)}>Edit unit</button>
        {act
          ? <button className="btn small primary" type="button" onClick={() => a.moveOut(act)}>Record move-out</button>
          : <button className="btn small primary" type="button" onClick={() => a.moveIn(u)}>Record move-in</button>}
        <button className="btn small" type="button" onClick={() => a.maintenance(u.id)}>+ Maintenance</button>
      </div>
      <div className="sec">
        <KV rows={[
          ["Rent", money(u.rent) + "/mo"], ["Bedrooms", u.beds], ["Bathrooms", u.baths],
          ["Pets", u.pets ? "Allowed" : "Not allowed"], ["Parking", u.parking ? "Included" : "None"],
          ["Utilities", u.utilities], ["Available", u.available_date ? fmtDate(u.available_date) : null],
          ["Owner", o ? <Linkish onClick={() => s.setDetail({ type: "owner", id: o.id })}>{o.name}</Linkish> : null],
          ["Notes", u.notes],
        ]} />
      </div>
      {act && <div className="sec"><h3>Current tenant</h3><TenancyLine t={act} show="renter" /></div>}
      {isOpen(u) && (
        <div className="sec">
          <div className="row between"><h3>Renters who fit</h3><span className="muted small">{plural(mx.length, "match", "matches")}</span></div>
          {mx.length ? mx.slice(0, s.settings.topCount).map((m) => (
            <div className="mrow" key={m.r.id}>
              <ScoreBadge s={m.score} />
              <div style={{ minWidth: 0 }}>
                <Linkish onClick={() => s.setDetail({ type: "renter", id: m.r.id })}>{m.r.name}</Linkish> <span className="mono muted small">{m.r.phone}</span>
                <Chips why={m.why} />
              </div>
              <button className="btn small" type="button" onClick={() => a.moveIn(u, m.r.id)}>Move in</button>
            </div>
          )) : <div className="muted">No renters who are looking fit this unit yet.</div>}
        </div>
      )}
      <div className="sec">
        <h3 style={{ marginBottom: 10 }}>Tenancy history</h3>
        {hist.length ? <div className="tl">{hist.map((t) => <div key={t.id} className={`item ${t.move_out ? "ended" : ""}`}><TenancyLine t={t} show="renter" /></div>)}</div>
          : <div className="muted">No tenants recorded for this unit yet.</div>}
      </div>
      <div className="sec">
        <h3 style={{ marginBottom: 10 }}>Maintenance log</h3>
        {mt.length ? mt.map((m) => (
          <div className="mrow" key={m.id}>
            <span className="num small">{fmtDate(m.date)}</span>
            <div style={{ minWidth: 0 }}>{m.description}<div className="muted small">{[m.vendor, m.cost ? money(m.cost) : ""].filter(Boolean).join(" · ")}</div></div>
            <ConfirmButton label="Remove" onConfirm={() => s.remove("maintenance", m.id)} />
          </div>
        )) : <div className="muted">Nothing logged yet.</div>}
      </div>
      <div className="row"><ConfirmButton label="Delete unit" onConfirm={async () => { await s.remove("units", u.id); s.setDetail(null); s.toast("Unit deleted"); }} /></div>
    </>
  );
}

async function copyText(text: string, toast: (m: string) => void) {
  try { await navigator.clipboard.writeText(text); toast("Copied"); }
  catch { toast("Couldn't copy. Your browser blocked it."); }
}

function RenterSheet({ r }: { r: Renter }) {
  const s = useStore();
  const a = useActions();
  const hist = s.tenanciesOfRenter(r.id);
  const mx = r.status === "Looking" ? s.matchesForRenter(r) : [];
  const exportJson = () => JSON.stringify({ renter: r, tenancies: hist.map((t) => ({ ...t, unit: t.unit_snapshot ?? s.unitName(s.data.units.find((u) => u.id === t.unit_id)) })) }, null, 2);
  return (
    <>
      <Head pills={<><StatusPill s={r.status} />{renterHistoryPill(s, r)}</>} title={r.name} sub={<span className="mono">{[r.phone, r.email].filter(Boolean).join(" · ")}</span>} />
      <div className="row" style={{ marginBottom: 12 }}>
        <button className="btn small" type="button" onClick={() => a.renter(r)}>Edit renter</button>
        {r.phone && <button className="btn small" type="button" onClick={() => copyText(r.phone!, s.toast)}>Copy phone</button>}
        {r.phone && <a className="btn small" href={`tel:${r.phone.replace(/[^\d+]/g, "")}`}>Call</a>}
      </div>
      {!r.consent && <div className="banner" style={{ marginBottom: 12 }}><span>No consent recorded. Ask {r.name.split(" ")[0]} if you may store their details and contact them about rentals, then tick the box under Edit.</span></div>}
      <div className="sec">
        <KV rows={[
          ["Budget", money(r.budget) + "/mo"], ["Bedrooms", r.beds], ["Move-in", r.move_in ? fmtDate(r.move_in) : null],
          ["Areas", r.areas.join(", ") || "Any"], ["Pets", r.pets ? "Has pets" : "No pets"], ["Parking", r.parking ? "Needs parking" : "Not needed"],
          ["Source", r.source], ["Consent", r.consent ? `Given ${fmtDate(r.consent_date)}` : "Not recorded"], ["Notes", r.notes],
        ]} />
      </div>
      {r.status === "Looking" && (
        <div className="sec">
          <div className="row between"><h3>Units that fit</h3><span className="muted small">{plural(mx.length, "match", "matches")}</span></div>
          {mx.length ? mx.slice(0, s.settings.topCount).map((m) => (
            <div className="mrow" key={m.u.id}>
              <ScoreBadge s={m.score} />
              <div style={{ minWidth: 0 }}>
                <Linkish onClick={() => s.setDetail({ type: "unit", id: m.u.id })}>{s.unitName(m.u)}</Linkish> <span className="num muted small">{money(m.u.rent)}</span>
                <Chips why={m.why} />
              </div>
              <button className="btn small" type="button" onClick={() => a.moveIn(m.u, r.id)}>Move in</button>
            </div>
          )) : <div className="muted">No open units fit right now. Matching checks budget, bedrooms, pets, area, parking and move-in date.</div>}
        </div>
      )}
      <div className="sec">
        <h3 style={{ marginBottom: 10 }}>Rental history</h3>
        {hist.length ? <div className="tl">{hist.map((t) => <div key={t.id} className={`item ${t.move_out ? "ended" : ""}`}><TenancyLine t={t} show="unit" /></div>)}</div>
          : <div className="muted">No tenancies with you yet.</div>}
      </div>
      <div className="sec">
        <h3>Their data</h3>
        <p className="muted small" style={{ margin: "6px 0 10px" }}>Under PIPEDA a renter can ask what you hold about them, or ask you to delete it. Deleting also removes their rental history.</p>
        <div className="row">
          <button className="btn small" type="button" onClick={() => copyText(exportJson(), s.toast)}>Copy their data</button>
          <ConfirmButton label="Delete renter" onConfirm={async () => { await s.remove("renters", r.id); s.setDetail(null); s.toast("Renter deleted"); }} />
        </div>
      </div>
    </>
  );
}

function OwnerSheet({ o }: { o: Owner }) {
  const s = useStore();
  const a = useActions();
  const ps = s.data.properties.filter((p) => p.owner_id === o.id);
  return (
    <>
      <Head title={o.name} sub={<span className="mono">{[o.phone, o.email].filter(Boolean).join(" · ")}</span>} />
      <div className="row" style={{ marginBottom: 12 }}>
        <button className="btn small" type="button" onClick={() => a.owner(o)}>Edit owner</button>
        <button className="btn small primary" type="button" onClick={() => a.property({ owner_id: o.id })}>+ Property</button>
      </div>
      <div className="sec"><KV rows={[["Prefers", o.contact_pref], ["Mailing address", o.address], ["Notes", o.notes]]} /></div>
      {ps.length ? ps.map((p) => {
        const us = s.data.units.filter((u) => u.property_id === p.id);
        return (
          <div className="sec" key={p.id}>
            <div className="row between">
              <div><h3>{p.address}</h3><div className="muted small">{[p.type, p.area, p.postal].filter(Boolean).join(" · ")}</div></div>
              <button className="btn small" type="button" onClick={() => a.property(p)}>Edit</button>
            </div>
            <KV rows={[
              ["Agreement", p.agreement_start || p.agreement_end ? `${fmtDate(p.agreement_start)} → ${fmtDate(p.agreement_end)}` : null],
              ["Your fee", p.fee_value ? (p.fee_type === "Flat monthly" ? money(p.fee_value) + "/mo" : p.fee_value + "% of rent") : null],
              ["Notes", p.notes],
            ]} />
            <div style={{ marginTop: 10 }}>
              {us.map((u) => (
                <div className="mrow three" key={u.id}>
                  <Linkish onClick={() => s.setDetail({ type: "unit", id: u.id })}>{u.label || "Unit"}</Linkish>
                  <span className="num">{money(u.rent)}</span><StatusPill s={u.status} />
                </div>
              ))}
            </div>
            <div className="row" style={{ marginTop: 8 }}>
              <button className="btn small" type="button" onClick={() => a.unit({ property_id: p.id })}>+ Unit</button>
              <ConfirmButton label="Delete property" onConfirm={async () => { await s.remove("properties", p.id); s.toast("Property deleted"); }} />
            </div>
          </div>
        );
      }) : <Empty title="No properties yet">Add the first property this owner has you manage.</Empty>}
      <div className="row"><ConfirmButton label="Delete owner" onConfirm={async () => { await s.remove("owners", o.id); s.setDetail(null); s.toast("Owner deleted"); }} /></div>
    </>
  );
}
