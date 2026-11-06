"use client";

import { useMemo, useState } from "react";
import { isOpen, useStore } from "@/lib/store";
import { CRITERIA, DEFAULT_SETTINGS, LIMITS, normalizeSettings, sameSettings, type Criterion, type MatchSettings } from "@/lib/match";
import { plural } from "@/lib/format";
import { ConfirmButton } from "./ui";

const INFO: Record<Criterion, { name: string; what: string; must: string }> = {
  budget:  { name: "Budget",       what: "Rent is within the renter's budget.",           must: "Rule out units over budget by more than the stretch allowed below." },
  beds:    { name: "Bedrooms",     what: "The unit has enough bedrooms.",                 must: "Rule out units with too few bedrooms." },
  area:    { name: "Area",         what: "The unit is in one of the renter's areas.",     must: "Rule out units outside the renter's preferred areas." },
  pets:    { name: "Pets",         what: "Pets are allowed when the renter has pets.",    must: "Rule out no-pet units for renters with pets." },
  parking: { name: "Parking",      what: "Parking is included when the renter needs it.", must: "Rule out units without parking for renters who need it." },
  moveIn:  { name: "Move-in date", what: "The unit is free by the renter's move-in date.", must: "Rule out units that are free too late." },
};

function NumberField({ id, label, hint, value, range, suffix, onChange }: {
  id: string; label: string; hint: string; value: number; range: readonly [number, number]; suffix?: string; onChange: (n: number) => void;
}) {
  return (
    <label className="fld" htmlFor={id}>
      <span>{label}</span>
      <div className="row" style={{ flexWrap: "nowrap" }}>
        <input id={id} type="number" inputMode="numeric" min={range[0]} max={range[1]} value={value} style={{ maxWidth: 110 }}
          onChange={(e) => onChange(e.target.value === "" ? range[0] : Number(e.target.value))} />
        {suffix && <span className="muted">{suffix}</span>}
      </div>
      <span className="hint">{hint}</span>
    </label>
  );
}

export function MatchSettingsView() {
  const s = useStore();
  const [draft, setDraft] = useState<MatchSettings>(s.settings);
  const [busy, setBusy] = useState(false);
  // When saved settings change (save, reset, reload), start the draft from them again.
  const [basis, setBasis] = useState(s.settings);
  if (basis !== s.settings) { setBasis(s.settings); setDraft(s.settings); }

  const clean = normalizeSettings(draft);
  const dirty = !sameSettings(clean, s.settings);
  const isDefault = sameSettings(s.settings, DEFAULT_SETTINGS);
  const total = CRITERIA.reduce((n, c) => n + (clean.weights[c] > 0 || clean.required[c] ? clean.weights[c] : 0), 0);

  const setWeight = (c: Criterion, n: number) => setDraft((d) => ({ ...d, weights: { ...d.weights, [c]: n } }));
  const setRequired = (c: Criterion, b: boolean) => setDraft((d) => ({ ...d, required: { ...d.required, [c]: b } }));
  const setNum = (k: "budgetStretchPct" | "moveInGraceDays" | "topCount" | "minScore", n: number) => setDraft((d) => ({ ...d, [k]: n }));

  // Live preview: how many renter–unit pairs the draft would show, compared with the saved settings.
  const cleanKey = JSON.stringify(clean);
  const preview = useMemo(() => {
    const open = s.data.units.filter(isOpen);
    const looking = s.data.renters.filter((r) => r.status === "Looking");
    const count = (st: MatchSettings) => {
      let all = 0, strong = 0, unitsWithMatch = 0;
      for (const u of open) {
        let any = false;
        for (const r of looking) {
          const m = s.matchUR(u, r, st);
          if (m.blocked || m.score < st.minScore) continue;
          all++; any = true; if (m.score >= 80) strong++;
        }
        if (any) unitsWithMatch++;
      }
      return { all, strong, unitsWithMatch, open: open.length };
    };
    return { now: count(s.settings), next: count(normalizeSettings(JSON.parse(cleanKey))) };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s.data, s.settings, cleanKey]);

  async function save(next: MatchSettings, msg: string) {
    setBusy(true);
    try { await s.saveSettings(next); s.toast(msg); } catch { /* toast shown */ } finally { setBusy(false); }
  }

  return (
    <>
      <div className="pagehead">
        <div>
          <div className="label">{isDefault ? "Using the default rules" : "Using your own rules"}</div>
          <h1>Matching settings</h1>
        </div>
      </div>

      {!s.settingsSavable && (
        <div className="banner info">
          <span>Saving these settings needs one database update. In Supabase, open the SQL Editor and run{" "}
            <code>supabase/migrations/0002_match_settings.sql</code> from your GitHub repository. Until then the default rules are used.</span>
        </div>
      )}

      <div className="cols">
        <section className="panel">
          <h2>What counts, and how much</h2>
          <p className="muted small" style={{ marginTop: 4 }}>
            Points set how much each check adds to the score. Scores are always shown out of 100.
            Tick <b>Must match</b> to hide units that fail that check instead of just lowering their score.
          </p>
          <div className="crit">
            {CRITERIA.map((c) => {
              const share = total ? Math.round((clean.weights[c] / total) * 100) : 0;
              const changed = clean.weights[c] !== DEFAULT_SETTINGS.weights[c] || clean.required[c] !== DEFAULT_SETTINGS.required[c];
              return (
                <div className="critrow" key={c}>
                  <div style={{ minWidth: 0 }}>
                    <div className="row" style={{ gap: 6 }}><b>{INFO[c].name}</b>{changed && <span className="pill p-listed">Changed</span>}</div>
                    <div className="muted small">{INFO[c].what}</div>
                  </div>
                  <div className="critctl">
                    <input type="range" aria-label={`${INFO[c].name} points`} min={0} max={50} step={1}
                      value={Math.min(50, clean.weights[c])} onChange={(e) => setWeight(c, Number(e.target.value))} />
                    <input type="number" id={`w-${c}`} aria-label={`${INFO[c].name} points`} min={0} max={100} value={draft.weights[c]}
                      onChange={(e) => setWeight(c, e.target.value === "" ? 0 : Number(e.target.value))} />
                    <span className="muted small num" style={{ width: 40 }}>{share}%</span>
                  </div>
                  <label className="check small" title={INFO[c].must}>
                    <input type="checkbox" id={`req-${c}`} checked={clean.required[c]} onChange={(e) => setRequired(c, e.target.checked)} />
                    <span><b>Must match</b> <span className="muted">· {INFO[c].must}</span></span>
                  </label>
                </div>
              );
            })}
          </div>
          {total === 0 && <div className="err" style={{ marginTop: 8 }}>Every check is at 0 points, so every unit that isn&apos;t ruled out scores 100.</div>}
        </section>

        <div className="stack">
          <section className="panel stack">
            <h2>Allowances</h2>
            <NumberField id="stretch" label="Budget stretch" suffix="% over budget" range={LIMITS.budgetStretchPct} value={draft.budgetStretchPct}
              hint="Units up to this much over budget still show, with fewer points." onChange={(n) => setNum("budgetStretchPct", n)} />
            <NumberField id="grace" label="Move-in grace period" suffix="days" range={LIMITS.moveInGraceDays} value={draft.moveInGraceDays}
              hint="A unit free this many days after the renter's move-in date still counts as on time." onChange={(n) => setNum("moveInGraceDays", n)} />
          </section>
          <section className="panel stack">
            <h2>What to show</h2>
            <NumberField id="topcount" label="Renters listed on each unit card" range={LIMITS.topCount} value={draft.topCount}
              hint="The Units page lists this many top renters per open unit." onChange={(n) => setNum("topCount", n)} />
            <NumberField id="minscore" label="Lowest score to show" suffix="out of 100" range={LIMITS.minScore} value={draft.minScore}
              hint="Matches scoring below this are hidden everywhere. 0 shows all." onChange={(n) => setNum("minScore", n)} />
          </section>
          <section className="panel">
            <h2>Effect on your records</h2>
            <dl className="kv" style={{ marginTop: 8 }}>
              <dt>Matches shown</dt><dd className="num">{preview.next.all}{dirty && <span className="muted"> (now {preview.now.all})</span>}</dd>
              <dt>Strong (80+)</dt><dd className="num">{preview.next.strong}{dirty && <span className="muted"> (now {preview.now.strong})</span>}</dd>
              <dt>Open units with a match</dt><dd className="num">{preview.next.unitsWithMatch} of {plural(preview.next.open, "unit")}{dirty && <span className="muted"> (now {preview.now.unitsWithMatch})</span>}</dd>
            </dl>
          </section>
        </div>
      </div>

      <div className="savebar">
        <span className="muted small">{dirty ? "You have unsaved changes." : "All changes saved."}</span>
        <div className="row">
          {!isDefault && <ConfirmButton label="Reset to defaults" onConfirm={() => save(DEFAULT_SETTINGS, "Default rules restored")} />}
          {dirty && <button className="btn small" type="button" onClick={() => setDraft(s.settings)}>Discard changes</button>}
          <button className="btn small primary" type="button" disabled={!dirty || busy || !s.settingsSavable} onClick={() => save(clean, "Matching settings saved")}>
            {busy ? "Saving…" : "Save changes"}
          </button>
        </div>
      </div>
    </>
  );
}
