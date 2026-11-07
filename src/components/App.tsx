"use client";

import { useEffect, useState } from "react";
import { StoreProvider, useStore } from "@/lib/store";
import { supabase, supabaseConfigured } from "@/lib/supabase";
import { today } from "@/lib/format";
import { FormProvider } from "./FormModal";
import { useActions } from "./actions";
import { DetailSheet } from "./Sheets";
import { Owners, Renters, Today, Units } from "./Views";
import { MatchSettingsView } from "./MatchSettingsView";

/** Company logo. The image is black on transparent; dark mode turns it white (see .brandlogo in globals.css). */
function Brand({ size = "header" }: { size?: "header" | "large" }) {
  return (
    <a href="#home" className={`brand brand-${size}`} aria-label="Kueppers Property Services, home">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="brandlogo" src="/brand/kueppers-logo.png" alt="Kueppers Property Services" width={1770} height={383} />
    </a>
  );
}

const VIEWS = ["home", "units", "renters", "owners", "matching"] as const;
type View = (typeof VIEWS)[number];
const TAB_LABEL: Record<View, string> = { home: "Today", units: "Units", renters: "Renters", owners: "Owners", matching: "Matching" };

export default function App() {
  if (!supabaseConfigured) return <NotConfigured />;
  return (
    <StoreProvider>
      <FormProvider>
        <Gate />
      </FormProvider>
    </StoreProvider>
  );
}

function NotConfigured() {
  return (
    <main className="wrap center">
      <div className="panel" style={{ maxWidth: 520 }}>
        <h1>Almost ready</h1>
        <p>The app isn&apos;t connected to its database yet. Add <code>NEXT_PUBLIC_SUPABASE_URL</code> and{" "}
          <code>NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY</code> to the environment, then restart.</p>
      </div>
    </main>
  );
}

function Gate() {
  const { session, authReady } = useStore();
  if (!authReady) return <main className="wrap"><div className="empty" style={{ marginTop: 40 }}><b>Loading…</b></div></main>;
  return session ? <Desk /> : <Login />;
}

function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  async function signIn(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setErr(null);
    const { error } = await supabase().auth.signInWithPassword({ email: email.trim(), password });
    setBusy(false);
    if (error) setErr(error.message === "Invalid login credentials" ? "That email and password don't match. Try again." : error.message);
  }
  async function reset() {
    if (!email.trim()) { setErr("Type your email first, then tap “Forgot password”."); return; }
    const { error } = await supabase().auth.resetPasswordForEmail(email.trim(), { redirectTo: window.location.origin });
    if (error) setErr(error.message); else setSent(true);
  }

  return (
    <main className="wrap center">
      <form className="panel login" onSubmit={signIn} noValidate>
        <Brand size="large" />
        <h1 style={{ marginTop: 18 }}>Sign in</h1>
        <label className="fld"><span>Email</span><input id="login-email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} /></label>
        <label className="fld"><span>Password</span><input id="login-password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} /></label>
        {err && <div className="err">{err}</div>}
        {sent && <div className="hint">Check your email for a link to set a new password.</div>}
        <button className="btn primary" type="submit" disabled={busy} style={{ justifyContent: "center" }}>{busy ? "Signing in…" : "Sign in"}</button>
        <button className="linkish small" type="button" onClick={reset}>Forgot password</button>
      </form>
    </main>
  );
}

function PasswordReset() {
  const s = useStore();
  const [show, setShow] = useState(false);
  const [pw, setPw] = useState("");
  useEffect(() => {
    const { data } = supabase().auth.onAuthStateChange((e) => { if (e === "PASSWORD_RECOVERY") setShow(true); });
    return () => data.subscription.unsubscribe();
  }, []);
  if (!show) return null;
  return (
    <div className="modal">
      <form className="box f" onSubmit={async (e) => {
        e.preventDefault();
        if (pw.length < 8) { s.toast("Use at least 8 characters."); return; }
        const { error } = await supabase().auth.updateUser({ password: pw });
        if (error) s.toast(error.message); else { s.toast("Password updated"); setShow(false); }
      }}>
        <h2>Set a new password</h2>
        <label className="fld"><span>New password</span><input id="new-password" type="password" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} /></label>
        <button className="btn primary" type="submit">Save password</button>
      </form>
    </div>
  );
}

function download(filename: string, text: string, type: string) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function toCsv(rows: Record<string, unknown>[]) {
  if (!rows.length) return "";
  const cols = Object.keys(rows[0]).filter((c) => c !== "user_id");
  const cell = (v: unknown) => {
    const s = Array.isArray(v) ? v.join("; ") : v === null || v === undefined ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [cols.join(","), ...rows.map((r) => cols.map((c) => cell(r[c])).join(","))].join("\n");
}

function Desk() {
  const s = useStore();
  const a = useActions();
  const [view, setView] = useState<View>("home");
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    const read = () => {
      const h = window.location.hash.slice(1) as View;
      setView(VIEWS.includes(h) ? h : "home");
      s.setDetail(null);
      window.scrollTo(0, 0);
    };
    read();
    window.addEventListener("hashchange", read);
    return () => window.removeEventListener("hashchange", read);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const go = (v: string) => { window.location.hash = v; };

  const addItems: [string, string, () => void][] = [
    ["Renter", "someone looking for a place", () => a.renter()],
    ["Unit", "a rentable space in a property", () => a.unit()],
    ["Property", "a house or building", () => a.property()],
    ["Owner", "a landlord you manage for", () => a.owner()],
  ];

  return (
    <>
      <header className="top">
        <div className="wrap topin">
          <Brand />
          <nav className="tabs">
            {VIEWS.map((v) => <a key={v} href={"#" + v} aria-current={view === v ? "page" : undefined}>{TAB_LABEL[v]}</a>)}
          </nav>
          <div className="row addbar"><button className="btn primary" type="button" onClick={() => setAdding(true)}>+ Add</button></div>
        </div>
      </header>
      <main className="wrap" id="main">
        {s.loadError && <div className="banner info"><span>{s.loadError}</span><button className="btn small" type="button" onClick={() => s.reload()}>Try again</button></div>}
        {s.loading && !s.data.owners.length && !s.data.renters.length ? (
          <div className="empty"><b>Loading your desk…</b>Owners, units and renters will appear here.</div>
        ) : (
          <>
            {view === "home" && <Today go={go} />}
            {view === "units" && <Units />}
            {view === "renters" && <Renters />}
            {view === "owners" && <Owners />}
            {view === "matching" && <MatchSettingsView />}
          </>
        )}
        <div className="row footer">
          <button className="btn small" type="button" onClick={() => download(`kueppers-backup-${today()}.json`, JSON.stringify(s.data, null, 2), "application/json")}>Back up all records</button>
          <button className="btn small" type="button" onClick={() => download(`renters-${today()}.csv`, toCsv(s.data.renters as unknown as Record<string, unknown>[]), "text/csv")}>Renters to Excel (CSV)</button>
          <button className="btn small" type="button" onClick={() => download(`units-${today()}.csv`, toCsv(s.data.units.map((u) => ({ address: s.unitName(u), area: s.propOf(u)?.area, ...u })) as unknown as Record<string, unknown>[]), "text/csv")}>Units to Excel (CSV)</button>
          <button className="btn small" type="button" onClick={() => supabase().auth.signOut()}>Sign out</button>
        </div>
      </main>
      <button className="btn primary fab" type="button" onClick={() => setAdding(true)}>+ Add</button>

      {adding && (
        <>
          <div className="scrim" onClick={() => setAdding(false)} />
          <div className="modal" onClick={(e) => { if (e.target === e.currentTarget) setAdding(false); }}>
            <div className="box">
              <div className="row between"><h2>Add</h2><button className="btn small" type="button" onClick={() => setAdding(false)}>Cancel</button></div>
              <div className="stack" style={{ marginTop: 14 }}>
                {addItems.map(([label, desc, fn]) => (
                  <button key={label} className="btn" type="button" style={{ justifyContent: "flex-start" }} onClick={() => { setAdding(false); fn(); }}>
                    {label} <span className="muted" style={{ fontWeight: 400 }}>· {desc}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </>
      )}
      <DetailSheet />
      <PasswordReset />
      {s.toastMsg && <div className="toast" role="status">{s.toastMsg}</div>}
    </>
  );
}
