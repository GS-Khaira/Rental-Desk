"use client";

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { AREAS, shortArea } from "@/lib/constants";

export type Opt = string | [value: string, label: string];
export interface Field {
  k: string;
  label: string;
  type?: "text" | "tel" | "email" | "number" | "date" | "select" | "textarea" | "check" | "areas";
  opts?: Opt[];
  req?: boolean;
  half?: boolean;
  more?: boolean;
  ph?: string;
  hint?: string;
  def?: unknown;
  step?: string;
  pattern?: string;
}
export type Values = Record<string, unknown>;
export interface FormRequest {
  title: string;
  intro?: string;
  fields: Field[];
  initial?: Values;
  saveLabel?: string;
  onSubmit: (v: Values) => Promise<void>;
}

const Ctx = createContext<(r: FormRequest) => void>(() => {});
export const useOpenForm = () => useContext(Ctx);

export function FormProvider({ children }: { children: ReactNode }) {
  const [req, setReq] = useState<FormRequest | null>(null);
  return (
    <Ctx.Provider value={setReq}>
      {children}
      {req && <FormModal key={req.title + JSON.stringify(req.initial ?? {})} req={req} close={() => setReq(null)} />}
    </Ctx.Provider>
  );
}

function initialValues(fields: Field[], initial: Values = {}) {
  const v: Values = {};
  for (const f of fields) {
    const given = initial[f.k];
    const fallback = f.def ?? (f.type === "check" ? false : f.type === "areas" ? [] : "");
    v[f.k] = given === null || given === undefined ? fallback : given;
  }
  return v;
}

function FormModal({ req, close }: { req: FormRequest; close: () => void }) {
  const [v, setV] = useState<Values>(() => initialValues(req.fields, req.initial));
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const set = (k: string, val: unknown) => setV((p) => ({ ...p, [k]: val }));

  useEffect(() => {
    formRef.current?.querySelector<HTMLElement>("input,select,textarea")?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") close(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [close]);

  const main = req.fields.filter((f) => !f.more);
  const more = req.fields.filter((f) => f.more);
  const editing = Boolean(req.initial && (req.initial as { id?: string }).id);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const missing = req.fields.filter((f) => f.req && (v[f.k] === "" || v[f.k] === null || v[f.k] === undefined)).map((f) => f.label);
    if (missing.length) { setErr("Fill in: " + missing.join(", ") + "."); return; }
    const bad = Array.from(formRef.current?.querySelectorAll("input") ?? []).filter((i) => !i.checkValidity()).map((i) => i.dataset.label);
    if (bad.length) { setErr("Check the format of: " + bad.join(", ") + "."); return; }
    const out: Values = {};
    for (const f of req.fields) {
      const val = v[f.k];
      out[f.k] = f.type === "number" ? (val === "" ? null : Number(val)) : typeof val === "string" ? val.trim() : val;
    }
    setBusy(true);
    try { await req.onSubmit(out); close(); }
    catch { setBusy(false); }
  }

  return (
    <>
      <div className="scrim" onClick={close} />
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="ftitle" onClick={(e) => { if (e.target === e.currentTarget) close(); }}>
        <div className="box">
          <div className="row between"><h2 id="ftitle">{req.title}</h2><button className="btn small" type="button" onClick={close}>Cancel</button></div>
          {req.intro && <p className="muted" style={{ margin: "6px 0 0" }}>{req.intro}</p>}
          <form className="f" ref={formRef} noValidate onSubmit={submit}>
            <Group fields={main} v={v} set={set} />
            {more.length > 0 && (
              <details className="more" open={editing}>
                <summary>More details</summary>
                <div><Group fields={more} v={v} set={set} /></div>
              </details>
            )}
            {err && <div className="err">{err}</div>}
            <div className="row" style={{ justifyContent: "flex-end" }}>
              <button className="btn primary" type="submit" disabled={busy}>{busy ? "Saving…" : req.saveLabel ?? "Save"}</button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}

function Group({ fields, v, set }: { fields: Field[]; v: Values; set: (k: string, val: unknown) => void }) {
  const out: ReactNode[] = [];
  let buf: Field[] = [];
  const flush = () => {
    if (buf.length) out.push(<div className="two" key={"g" + out.length}>{buf.map((f) => <FieldInput key={f.k} f={f} v={v} set={set} />)}</div>);
    buf = [];
  };
  for (const f of fields) {
    if (f.half) { buf.push(f); if (buf.length === 2) flush(); }
    else { flush(); out.push(<FieldInput key={f.k} f={f} v={v} set={set} />); }
  }
  flush();
  return <>{out}</>;
}

function FieldInput({ f, v, set }: { f: Field; v: Values; set: (k: string, val: unknown) => void }) {
  const id = "f-" + f.k;
  const val = v[f.k];
  if (f.type === "check")
    return (
      <label className="check">
        <input type="checkbox" id={id} checked={Boolean(val)} onChange={(e) => set(f.k, e.target.checked)} />
        <span>{f.label}{f.hint && <span className="hint" style={{ display: "block" }}>{f.hint}</span>}</span>
      </label>
    );
  if (f.type === "areas") {
    const sel = (val as string[]) ?? [];
    return (
      <div className="fld"><span>{f.label}</span>
        <div className="areas">
          {AREAS.map((a, i) => (
            <label key={a}>
              <input type="checkbox" id={`${id}-${i}`} checked={sel.includes(a)}
                onChange={(e) => set(f.k, e.target.checked ? [...sel, a] : sel.filter((x) => x !== a))} />
              {shortArea(a)}
            </label>
          ))}
        </div>
        <span className="hint">Leave all unticked for “any area”.</span>
      </div>
    );
  }
  let input: ReactNode;
  const str = val === null || val === undefined ? "" : String(val);
  if (f.type === "select") {
    const opts = (f.opts ?? []).map((o) => (Array.isArray(o) ? o : [o, o]));
    input = (
      <select id={id} value={str} onChange={(e) => set(f.k, e.target.value)}>
        {!f.req && <option value="">—</option>}
        {f.req && !str && <option value="" disabled>Choose…</option>}
        {opts.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
      </select>
    );
  } else if (f.type === "textarea") {
    input = <textarea id={id} value={str} placeholder={f.ph} onChange={(e) => set(f.k, e.target.value)} />;
  } else {
    input = (
      <input id={id} data-label={f.label} type={f.type ?? "text"} value={str} placeholder={f.ph} pattern={f.pattern}
        {...(f.type === "number" ? { step: f.step ?? "1", min: 0, inputMode: "decimal" as const } : {})}
        onChange={(e) => set(f.k, e.target.value)} />
    );
  }
  return (
    <label className="fld" htmlFor={id}>
      <span>{f.label}{!f.req && <span className="muted" style={{ fontWeight: 400 }}> (optional)</span>}</span>
      {input}
      {f.hint && <span className="hint">{f.hint}</span>}
    </label>
  );
}
