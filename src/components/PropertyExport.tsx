"use client";

import { useMemo, useState } from "react";
import { useStore } from "@/lib/store";
import { PROPERTY_EXPORTS, propertyExport, type PropertyExportKind } from "@/lib/exports";
import { plural, today } from "@/lib/format";
import { downloadText } from "@/lib/download";

/** Pick one property (searchable, for owners with many buildings) and download its data as a spreadsheet. */
export function PropertyExport({ onClose }: { onClose: () => void }) {
  const s = useStore();
  const [q, setQ] = useState("");
  const [picked, setPicked] = useState<string | null>(null);
  const [kind, setKind] = useState<PropertyExportKind>("units");

  const list = useMemo(() => {
    const ownerName = new Map(s.data.owners.map((o) => [o.id, o.name]));
    const counts = new Map<string, { units: number; rented: number }>();
    for (const u of s.data.units) {
      const c = counts.get(u.property_id) ?? { units: 0, rented: 0 };
      c.units++; if (u.status === "Rented") c.rented++;
      counts.set(u.property_id, c);
    }
    const t = q.trim().toLowerCase();
    return s.data.properties
      .map((p) => ({ p, owner: ownerName.get(p.owner_id) ?? "", c: counts.get(p.id) ?? { units: 0, rented: 0 } }))
      .filter((x) => !t || [x.p.address, x.p.area, x.owner, x.p.postal].join(" ").toLowerCase().includes(t))
      // biggest buildings first, then by address
      .sort((a, b) => b.c.units - a.c.units || a.p.address.localeCompare(b.p.address, "en-CA", { numeric: true }));
  }, [s.data, q]);

  const chosen = s.data.properties.find((p) => p.id === picked);

  function download() {
    if (!chosen) return;
    const out = propertyExport(kind, chosen, s.data);
    downloadText(`${out.filename}-${today()}.csv`, out.csv, "text/csv;charset=utf-8");
    s.toast(`Downloaded ${plural(out.rows, "row")} for ${chosen.address}`);
    onClose();
  }

  return (
    <>
      <div className="scrim" onClick={onClose} />
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="pe-title" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
        <div className="box wide">
          <div className="row between"><h2 id="pe-title">Export one property</h2><button className="btn small" type="button" onClick={onClose}>Cancel</button></div>
          <p className="muted small" style={{ margin: "4px 0 12px" }}>Downloads a spreadsheet (CSV) that opens in Excel or Google Sheets.</p>

          <label className="fld" htmlFor="pe-search">
            <span>1. Choose a property</span>
            <input id="pe-search" type="search" placeholder="Search address, owner, area" value={q} onChange={(e) => setQ(e.target.value)} autoFocus />
          </label>
          <div className="pelist" role="listbox" aria-label="Properties">
            {list.length ? list.map(({ p, owner, c }) => (
              <button key={p.id} type="button" role="option" aria-selected={picked === p.id} className={`peitem ${picked === p.id ? "on" : ""}`} onClick={() => setPicked(p.id)}>
                <span style={{ minWidth: 0 }}>
                  <b className="ellipsis" style={{ display: "block" }}>{p.address}</b>
                  <span className="muted small">{[p.area.replace("Charlottetown – ", "Ch'town "), owner].filter(Boolean).join(" · ")}</span>
                </span>
                <span className="muted small nowrap num">{plural(c.units, "unit")}{c.units ? ` · ${c.rented} rented` : ""}</span>
              </button>
            )) : <div className="muted small" style={{ padding: 12 }}>{s.data.properties.length ? "No property matches that search." : "No properties yet."}</div>}
          </div>

          <div className="fld" style={{ marginTop: 14 }}>
            <span>2. What to include</span>
            <div className="pekinds" role="radiogroup" aria-label="What to include">
              {PROPERTY_EXPORTS.map((k) => (
                <label key={k.kind} className={`rolecard ${kind === k.kind ? "on" : ""}`}>
                  <input type="radio" name="pe-kind" value={k.kind} checked={kind === k.kind} onChange={() => setKind(k.kind)} />
                  <b>{k.label}</b>
                  <span className="muted small">{k.hint}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="row between pefoot">
            <span className="muted small">{chosen ? `Selected: ${chosen.address}` : "Pick a property above."}</span>
            <button className="btn primary" type="button" disabled={!chosen} onClick={download}>Download spreadsheet</button>
          </div>
        </div>
      </div>
    </>
  );
}
