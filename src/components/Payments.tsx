"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useStore } from "@/lib/store";
import { fmtDate, money, plural, today } from "@/lib/format";
import {
  MAX_PROOF_MB, PAYMENT_BUCKET, PAYMENT_METHODS, PROOF_TYPES, STATUS_TEXT, amountCheck, defaultMonth, isHeic, isPdf,
  monthChoices, monthLabel, proofUrl,
} from "@/lib/payments";
import type { PaymentMethod, PaymentStatus, RentPayment } from "@/lib/types";
import { when } from "./Requests";
import { Empty, KV, Linkish } from "./ui";

/* ---------------- shared ---------------- */
export const PaymentStatusPill = ({ s, side }: { s: PaymentStatus; side: "tenant" | "staff" }) =>
  <span className={`pill p-${STATUS_TEXT[s].tone}`}>{STATUS_TEXT[s][side]}</span>;

function AmountCheck({ p }: { p: Pick<RentPayment, "amount" | "expected"> }) {
  const c = amountCheck(p);
  if (c.kind === "unknown") return null;
  if (c.kind === "match") return <span className="pill p-ok">Matches rent</span>;
  return <span className="pill p-warn">{money(Math.abs(c.diff))} {c.kind === "short" ? "short" : "over"}</span>;
}

/** Shows the uploaded screenshot through a private, short-lived link. PDFs and iPhone HEIC photos open in a new tab. */
export function ProofViewer({ path, name, compact }: { path: string; name: string | null; compact?: boolean }) {
  const [url, setUrl] = useState<string | null | undefined>(undefined);
  useEffect(() => {
    let live = true;
    proofUrl(path).then((u) => { if (live) setUrl(u); });
    return () => { live = false; };
  }, [path]);
  if (url === undefined) return <div className="proof loading">Loading screenshot…</div>;
  if (url === null) return <div className="proof missing">The screenshot couldn&apos;t be loaded. Check your connection, then reopen this.</div>;
  if (isPdf(name) || isHeic(name)) {
    return (
      <div className="proof file">
        <b>{name}</b>
        <a className="btn small" href={url} target="_blank" rel="noreferrer">Open {isPdf(name) ? "PDF" : "photo"}</a>
      </div>
    );
  }
  return (
    <a className={`proof ${compact ? "compact" : ""}`} href={url} target="_blank" rel="noreferrer" title="Open full size">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={url} alt={`Payment screenshot${name ? `: ${name}` : ""}`} />
      <span className="proofhint">Tap to open full size</span>
    </a>
  );
}

/* ---------------- tenant: upload ---------------- */
function extOf(f: File) {
  const m = /\.([a-z0-9]+)$/i.exec(f.name);
  if (m) return m[1].toLowerCase();
  return ({ "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "application/pdf": "pdf" } as Record<string, string>)[f.type] ?? "bin";
}
const OK_EXT = ["jpg", "jpeg", "png", "webp", "heic", "heif", "pdf"];

export function PaymentUpload({ rent, existing, again, onClose, onDone }: {
  rent: number | null;
  existing: RentPayment[];
  again?: RentPayment | null;
  onClose: () => void;
  onDone: () => void;
}) {
  const s = useStore();
  const months = useMemo(() => monthChoices(), []);
  const [period, setPeriod] = useState(again?.period ?? defaultMonth());
  const [amount, setAmount] = useState(String(again?.amount ?? rent ?? ""));
  const [paidOn, setPaidOn] = useState(today());
  const [method, setMethod] = useState<PaymentMethod>(again?.method ?? "e-Transfer");
  const [reference, setReference] = useState("");
  const [note, setNote] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  const dup = existing.find((p) => p.period === period && p.status !== "Sent back" && p.id !== again?.id);
  const amt = Number(amount);
  const diff = rent && amt ? Math.round((amt - rent) * 100) / 100 : 0;

  function pick(f: File | undefined) {
    setErr(null);
    if (!f) return;
    if (!OK_EXT.includes(extOf(f))) return setErr("Use a photo or screenshot (JPG, PNG, HEIC) or a PDF.");
    if (f.size > MAX_PROOF_MB * 1024 * 1024) return setErr(`That file is over ${MAX_PROOF_MB} MB. Try a screenshot instead of a full photo.`);
    if (preview) URL.revokeObjectURL(preview);
    setFile(f);
    setPreview(f.type.startsWith("image/") && !isHeic(f.name) ? URL.createObjectURL(f) : null);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return setErr("Add a screenshot or photo of your payment.");
    if (!amt || amt <= 0) return setErr("Enter the amount you paid.");
    if (!paidOn) return setErr("Enter the date you paid.");
    const uid = s.session?.user.id;
    if (!uid) return setErr("Sign in again.");
    setBusy(true); setErr(null);
    const path = `${uid}/${period.slice(0, 7)}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${extOf(file)}`;
    const up = await supabase().storage.from(PAYMENT_BUCKET).upload(path, file, { contentType: file.type || undefined, upsert: false });
    if (up.error) { setBusy(false); return setErr("The screenshot didn't upload. Check your connection and try again."); }
    const { error } = await supabase().rpc("submit_rent_payment", {
      p_period: period, p_amount: amt, p_paid_on: paidOn, p_method: method,
      p_reference: reference, p_note: note, p_file_path: path, p_file_name: file.name,
    });
    if (error) {
      await supabase().storage.from(PAYMENT_BUCKET).remove([path]); // don't leave an orphan file
      setBusy(false);
      return setErr(error.message || "Couldn't send it. Try again.");
    }
    s.toast("Sent for review");
    onDone();
    onClose();
  }

  return (
    <>
      <div className="scrim" onClick={busy ? undefined : onClose} />
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="pay-title">
        <div className="box wide">
          <div className="row between"><h2 id="pay-title">{again ? "Send payment again" : "Upload rent payment"}</h2>
            <button className="btn small" type="button" onClick={onClose} disabled={busy}>Cancel</button></div>
          <p className="muted small" style={{ margin: "4px 0 0" }}>Send a screenshot of your e-Transfer or bank confirmation. Your property manager approves it once the money arrives.</p>
          {again?.review_note && <div className="banner" style={{ margin: "12px 0 0" }}><span><b>Your manager said:</b> {again.review_note}</span></div>}

          <form className="f" onSubmit={submit} noValidate>
            <div className="fld">
              <span>Which month is this for?</span>
              <div className="chipsel" role="radiogroup" aria-label="Month">
                {months.map((m) => (
                  <label key={m.value} className={period === m.value ? "on" : ""}>
                    <input type="radio" name="period" value={m.value} checked={period === m.value} onChange={() => setPeriod(m.value)} />{m.label}
                  </label>
                ))}
              </div>
              {dup && <span className="err">You already sent proof for {monthLabel(period)} ({STATUS_TEXT[dup.status].tenant.toLowerCase()}). Only send again if this is a second payment.</span>}
            </div>

            <div className="dropzone" onClick={() => inputRef.current?.click()} onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => { e.preventDefault(); pick(e.dataTransfer.files?.[0]); }}>
              <input ref={inputRef} id="pay-file" type="file" accept={PROOF_TYPES} hidden onChange={(e) => pick(e.target.files?.[0])} />
              {file ? (
                <div className="row" style={{ flexWrap: "nowrap", gap: 12 }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {preview ? <img src={preview} alt="" className="thumb" /> : <span className="filebadge">{extOf(file).toUpperCase()}</span>}
                  <div style={{ minWidth: 0 }}><b className="ellipsis" style={{ display: "block" }}>{file.name}</b><span className="muted small">{file.size < 1024 * 1024 ? `${Math.max(1, Math.round(file.size / 1024))} KB` : `${(file.size / 1024 / 1024).toFixed(1)} MB`} · tap to change</span></div>
                </div>
              ) : (
                <div className="stack" style={{ gap: 4, alignItems: "center", textAlign: "center" }}>
                  <svg width="28" height="28" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 16V4m0 0l-4 4m4-4l4 4M5 16v3a1 1 0 001 1h12a1 1 0 001-1v-3" stroke="currentColor" strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>
                  <b>Add screenshot or photo</b>
                  <span className="muted small">JPG, PNG, HEIC or PDF, up to {MAX_PROOF_MB} MB</span>
                </div>
              )}
            </div>

            <div className="two">
              <label className="fld" htmlFor="pay-amount"><span>Amount paid (CAD)</span>
                <input id="pay-amount" type="number" inputMode="decimal" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} />
                {rent ? <span className={diff ? "err" : "hint"}>{diff ? `Your rent is ${money(rent)}. This is ${money(Math.abs(diff))} ${diff < 0 ? "less" : "more"}.` : `Matches your rent of ${money(rent)}.`}</span> : null}
              </label>
              <label className="fld" htmlFor="pay-date"><span>Date you paid</span>
                <input id="pay-date" type="date" max={today()} value={paidOn} onChange={(e) => setPaidOn(e.target.value)} /></label>
            </div>
            <div className="two">
              <label className="fld" htmlFor="pay-method"><span>How you paid</span>
                <select id="pay-method" value={method} onChange={(e) => setMethod(e.target.value as PaymentMethod)}>
                  {PAYMENT_METHODS.map((m) => <option key={m}>{m}</option>)}
                </select></label>
              <label className="fld" htmlFor="pay-ref"><span>Reference number <span className="muted" style={{ fontWeight: 400 }}>(optional)</span></span>
                <input id="pay-ref" value={reference} onChange={(e) => setReference(e.target.value)} placeholder="e.g. CA1a2B3c" /></label>
            </div>
            <label className="fld" htmlFor="pay-note"><span>Note <span className="muted" style={{ fontWeight: 400 }}>(optional)</span></span>
              <textarea id="pay-note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Paid in two parts; this is the second." /></label>
            {err && <div className="err">{err}</div>}
            <div className="row" style={{ justifyContent: "flex-end" }}>
              <button className="btn primary" type="submit" disabled={busy}>{busy ? "Sending…" : "Send for review"}</button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}

/* ---------------- tenant: list ---------------- */
export function TenantPayments({ payments, rent, onChanged }: { payments: RentPayment[]; rent: number | null; onChanged: () => void }) {
  const [uploading, setUploading] = useState<{ again: RentPayment | null } | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const needs = payments.filter((p) => p.status === "Sent back" && !payments.some((q) => q.period === p.period && q.created_at > p.created_at));
  return (
    <section className="panel" style={{ marginTop: 20 }}>
      <div className="row between">
        <h2>Rent payments</h2>
        <button className="btn primary" type="button" onClick={() => setUploading({ again: null })}>Upload rent payment</button>
      </div>
      {needs.map((p) => (
        <div key={p.id} className="banner" style={{ margin: "12px 0 0" }}>
          <span><b>{monthLabel(p.period)} needs attention.</b> {p.review_note}</span>
          <button className="btn small primary" type="button" onClick={() => setUploading({ again: p })}>Send again</button>
        </div>
      ))}
      {payments.length ? (
        <div className="rows" style={{ marginTop: 12 }}>
          {payments.map((p) => (
            <div key={p.id}>
              <button type="button" className="rowcard" aria-expanded={open === p.id} onClick={() => setOpen(open === p.id ? null : p.id)}>
                <PaymentStatusPill s={p.status} side="tenant" />
                <div style={{ minWidth: 0 }}>
                  <div className="t">{monthLabel(p.period)} · <span className="num">{money(p.amount)}</span></div>
                  <div className="muted small">{p.method} · paid {fmtDate(p.paid_on)}{p.reviewed_at && p.status === "Approved" ? ` · approved ${fmtDate(p.reviewed_at.slice(0, 10))}` : ""}</div>
                </div>
                <span className="muted small nowrap">Sent {when(p.created_at)}</span>
              </button>
              {open === p.id && (
                <div className="sec" style={{ marginTop: 8 }}>
                  <ProofViewer path={p.file_path} name={p.file_name} compact />
                  {p.review_note && <p className="small" style={{ margin: "8px 0 0" }}><b>Manager&apos;s note:</b> {p.review_note}</p>}
                  {p.reference && <p className="muted small" style={{ margin: "6px 0 0" }}>Reference: <span className="mono">{p.reference}</span></p>}
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <p className="muted" style={{ marginBottom: 0 }}>When you pay rent, upload a screenshot here so your manager can confirm it.</p>
      )}
      {uploading && <PaymentUpload rent={rent} existing={payments} again={uploading.again} onClose={() => setUploading(null)} onDone={onChanged} />}
    </section>
  );
}

/* ---------------- staff: Payments page ---------------- */
export function PaymentsView() {
  const s = useStore();
  const [filter, setFilter] = useState<PaymentStatus | "">("Pending");
  const [q, setQ] = useState("");
  const inScope = s.payments.filter((p) => !s.isAdmin || s.scope === "all" || p.user_id === s.scope);
  const pending = inScope.filter((p) => p.status === "Pending");
  let list = filter ? inScope.filter((p) => p.status === filter) : inScope;
  const renterName = (id: string | null) => s.data.renters.find((r) => r.id === id)?.name ?? "Tenant";
  const unitOf = (id: string | null) => s.data.units.find((u) => u.id === id);
  if (q) { const t = q.toLowerCase(); list = list.filter((p) => [renterName(p.renter_id), s.unitName(unitOf(p.unit_id)), p.reference, monthLabel(p.period)].join(" ").toLowerCase().includes(t)); }
  // Oldest first while reviewing, newest first otherwise.
  list = [...list].sort((a, b) => (filter === "Pending" ? a.created_at.localeCompare(b.created_at) : b.created_at.localeCompare(a.created_at)));

  if (!s.paymentsReady) {
    return (
      <>
        <div className="pagehead"><div><h1>Rent payments</h1></div></div>
        <Empty title="One database update needed">Run <code>supabase/migrations/0005_rent_payments.sql</code> in the Supabase SQL Editor, then reload. Tenants can then upload proof of payment from their portal.</Empty>
      </>
    );
  }
  return (
    <>
      <div className="pagehead">
        <div><div className="label">{plural(pending.length, "payment")} to review{pending.length ? ` · ${money(pending.reduce((n, p) => n + Number(p.amount), 0))}` : ""}</div><h1>Rent payments</h1></div>
      </div>
      <div className="filters">
        <input type="search" placeholder="Search tenant, unit, month, reference" aria-label="Search payments" value={q} onChange={(e) => setQ(e.target.value)} />
        <select aria-label="Show" value={filter} onChange={(e) => setFilter(e.target.value as PaymentStatus | "")}>
          <option value="Pending">To review</option><option value="Approved">Approved</option><option value="Sent back">Sent back</option><option value="">All payments</option>
        </select>
      </div>
      {list.length ? (
        <div className="rows">
          {list.map((p) => (
            <button key={p.id} type="button" className="rowcard" onClick={() => s.setDetail({ type: "payment", id: p.id })}>
              <PaymentStatusPill s={p.status} side="staff" />
              <div style={{ minWidth: 0 }}>
                <div className="t">{renterName(p.renter_id)} · {monthLabel(p.period)}</div>
                <div className="muted small">{s.unitName(unitOf(p.unit_id))}{s.isAdmin && s.scope === "all" ? ` · ${s.personName(p.user_id)}` : ""}</div>
              </div>
              <div className="userside">
                <span className="num strong">{money(p.amount)}</span>
                <AmountCheck p={p} />
                <span className="muted small nowrap">Sent {when(p.created_at)}</span>
              </div>
            </button>
          ))}
        </div>
      ) : (
        <Empty title={filter === "Pending" ? "Nothing to review" : "No payments here"}>
          {filter === "Pending" ? "When a tenant uploads proof of rent, it appears here for you to approve." : "Change the filter to see other payments."}
        </Empty>
      )}
    </>
  );
}

const SEND_BACK_REASONS = ["Payment hasn't arrived in the account yet", "The amount doesn't match the rent", "The screenshot is hard to read", "This looks like the wrong month"];

export function PaymentSheet({ p }: { p: RentPayment }) {
  const s = useStore();
  const [mode, setMode] = useState<"idle" | "sendback" | "change">(p.status === "Pending" ? "idle" : "change");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const renter = s.data.renters.find((r) => r.id === p.renter_id);
  const unit = s.data.units.find((u) => u.id === p.unit_id);
  const reviewing = p.status === "Pending" || mode !== "change";
  const others = s.payments.filter((x) => x.renter_id === p.renter_id && x.id !== p.id).slice(0, 6);

  async function review(approve: boolean) {
    setBusy(true); setErr(null);
    const { error } = await supabase().rpc("review_rent_payment", { p_id: p.id, p_approve: approve, p_note: note });
    setBusy(false);
    if (error) return setErr(error.message || "Couldn't save. Try again.");
    s.toast(approve ? "Payment approved" : "Sent back to the tenant");
    setMode("change"); setNote("");
    await s.reloadPayments();
  }

  return (
    <>
      <div className="head">
        <div style={{ minWidth: 0 }}>
          <div className="row"><PaymentStatusPill s={p.status} side="staff" /><AmountCheck p={p} /></div>
          <h2 style={{ marginTop: 6 }}>{monthLabel(p.period)} rent · {money(p.amount)}</h2>
          <div className="muted small">
            From {renter ? <Linkish onClick={() => s.setDetail({ type: "renter", id: renter.id })}>{renter.name}</Linkish> : "a tenant"}
            {unit && <> · <Linkish onClick={() => s.setDetail({ type: "unit", id: unit.id })}>{s.unitName(unit)}</Linkish></>}
          </div>
        </div>
        <button className="btn small" type="button" onClick={() => s.setDetail(null)}>Close</button>
      </div>

      <div className="sec"><ProofViewer path={p.file_path} name={p.file_name} /></div>

      <div className="sec">
        <KV rows={[
          ["Amount paid", money(p.amount)],
          ["Rent due", p.expected !== null ? money(p.expected) : null],
          ["Paid on", fmtDate(p.paid_on)],
          ["Method", p.method],
          ["Reference", p.reference ? <span className="mono">{p.reference}</span> : null],
          ["Tenant's note", p.note],
          ["Sent", when(p.created_at)],
          ["Reviewed", p.reviewed_at ? `${p.status} ${when(p.reviewed_at)}${s.isAdmin ? ` by ${s.personName(p.reviewed_by)}` : ""}` : null],
          ["Your note", p.review_note],
        ]} />
      </div>

      <div className="sec review">
        {reviewing ? (
          mode === "sendback" ? (
            <div className="stack">
              <h3>Send back to the tenant</h3>
              <div className="chips">{SEND_BACK_REASONS.map((r) => <button key={r} type="button" className="pill p-off reasonchip" onClick={() => setNote(r)}>{r}</button>)}</div>
              <label className="fld" htmlFor="sb-note"><span>Reason (the tenant sees this)</span>
                <textarea id="sb-note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Tell them what to fix" /></label>
              {err && <div className="err">{err}</div>}
              <div className="row" style={{ justifyContent: "flex-end" }}>
                <button className="btn small" type="button" onClick={() => { setMode(p.status === "Pending" ? "idle" : "change"); setErr(null); }}>Back</button>
                <button className="btn small danger armed" type="button" disabled={busy || !note.trim()} onClick={() => review(false)}>Send back</button>
              </div>
            </div>
          ) : (
            <div className="stack">
              <h3>Has the money arrived?</h3>
              <p className="muted small" style={{ margin: 0 }}>Check your bank account for {money(p.amount)} from {renter?.name ?? "the tenant"}{p.reference ? <> with reference <span className="mono">{p.reference}</span></> : null} before approving.</p>
              {err && <div className="err">{err}</div>}
              <div className="row">
                <button className="btn primary" type="button" disabled={busy} onClick={() => review(true)}>✓ Approve — money received</button>
                <button className="btn" type="button" disabled={busy} onClick={() => setMode("sendback")}>Send back</button>
              </div>
            </div>
          )
        ) : (
          <div className="row between">
            <span className="muted small">{p.status === "Approved" ? "Approved. The tenant can see this." : "Sent back. The tenant has been asked to fix it."}</span>
            <button className="btn small" type="button" onClick={() => setMode("idle")}>Change decision</button>
          </div>
        )}
      </div>

      {others.length > 0 && (
        <div className="sec">
          <h3 style={{ marginBottom: 6 }}>Earlier payments from {renter?.name?.split(" ")[0] ?? "this tenant"}</h3>
          {others.map((x) => (
            <div key={x.id} className="mrow three">
              <Linkish onClick={() => s.setDetail({ type: "payment", id: x.id })}>{monthLabel(x.period)}</Linkish>
              <span className="num">{money(x.amount)}</span>
              <PaymentStatusPill s={x.status} side="staff" />
            </div>
          ))}
        </div>
      )}
    </>
  );
}

/** Renter panel: recent rent payments for staff. */
export function RenterPayments({ renterId }: { renterId: string }) {
  const s = useStore();
  if (!s.paymentsReady) return null;
  const list = s.payments.filter((p) => p.renter_id === renterId).slice(0, 6);
  if (!list.length) return null;
  return (
    <div className="sec">
      <h3 style={{ marginBottom: 6 }}>Rent payments</h3>
      {list.map((x) => (
        <div key={x.id} className="mrow three">
          <Linkish onClick={() => s.setDetail({ type: "payment", id: x.id })}>{monthLabel(x.period)}</Linkish>
          <span className="num">{money(x.amount)}</span>
          <PaymentStatusPill s={x.status} side="staff" />
        </div>
      ))}
    </div>
  );
}
