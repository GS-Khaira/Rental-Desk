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
import { RequestsView } from "./Requests";
import { TenantPortal } from "./TenantPortal";
import { UsersView } from "./UsersView";
import { ROLE_INFO } from "@/lib/roles";
import { MainMenu, type MenuPage } from "./MainMenu";
import { PropertyExport } from "./PropertyExport";
import { rentersCsv, unitsCsv } from "@/lib/exports";
import { downloadText } from "@/lib/download";

/** Company logo. The image is black on transparent; dark mode turns it white (see .brandlogo in globals.css). */
function Brand({ size = "header", onHome }: { size?: "header" | "large"; onHome?: () => void }) {
  return (
    <a href="#home" className={`brand brand-${size}`} aria-label="Kueppers Property Services, home"
      onClick={onHome ? (e) => { e.preventDefault(); onHome(); } : undefined}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="brandlogo" src="/brand/kueppers-logo.png" alt="Kueppers Property Services" width={1770} height={383} />
    </a>
  );
}

const VIEWS = ["home", "units", "renters", "owners", "requests", "matching", "users"] as const;
type View = (typeof VIEWS)[number];
const TAB_LABEL: Record<View, string> = {
  home: "Today", units: "Units", renters: "Renters", owners: "Owners", requests: "Requests", matching: "Matching", users: "Users",
};
/** Tabs each staff role gets. Tenants don't use tabs: they get the tenant portal. */
const viewsFor = (isAdmin: boolean): View[] => VIEWS.filter((v) => v !== "users" || isAdmin);
const VIEW_HINT: Record<View, string> = {
  home: "Matches, move-ins and what needs attention",
  units: "Vacant, listed and rented units",
  renters: "People looking, placed and past",
  owners: "Landlords and their properties",
  requests: "Questions and repairs from tenants",
  matching: "Find matches and set the scoring rules",
  users: "Who can use the app, and their roles",
};

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

const Loading = () => <main className="wrap"><div className="empty" style={{ marginTop: 40 }}><b>Loading…</b></div></main>;

/** Decides what the signed-in person sees, based on their account and role. */
function Gate() {
  const s = useStore();
  if (!s.authReady) return <Loading />;
  if (!s.session) return <Login />;
  if (s.account === "loading") return s.loadError ? <Notice title="Can't reach the app right now" body={s.loadError} /> : <Loading />;
  if (s.account === "off") return <Notice title="Your access is switched off" body="Please contact Kueppers Property Services if you think this is a mistake." />;
  if (s.account === "missing") return <Notice title="Your account isn't set up yet" body="An admin needs to give your account a role. Please contact Kueppers Property Services." />;
  if (s.profile?.must_change_password) return <SetOwnPassword />;
  if (s.role === "tenant") return <><TenantPortal header={<SimpleHeader />} /><Toast /></>;
  return <Desk />;
}

const Toast = () => { const { toastMsg } = useStore(); return toastMsg ? <div className="toast" role="status">{toastMsg}</div> : null; };

function SimpleHeader() {
  const s = useStore();
  return (
    <header className="top">
      <div className="wrap topin">
        <Brand />
        <div className="row">
          <span className="muted small ellipsis" style={{ maxWidth: 200 }}>{s.profile?.full_name || s.session?.user.email}</span>
          <button className="btn small" type="button" onClick={() => supabase().auth.signOut()}>Sign out</button>
        </div>
      </div>
    </header>
  );
}

function Notice({ title, body }: { title: string; body: string }) {
  return (
    <main className="wrap center">
      <div className="panel login">
        <Brand size="large" />
        <h1 style={{ marginTop: 12 }}>{title}</h1>
        <p className="muted" style={{ margin: 0 }}>{body}</p>
        <button className="btn" type="button" onClick={() => supabase().auth.signOut()} style={{ justifyContent: "center" }}>Sign out</button>
      </div>
    </main>
  );
}

/** First sign-in with a temporary password: choose your own before going further. */
function SetOwnPassword() {
  const s = useStore();
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (pw.length < 8) return setErr("Use at least 8 characters.");
    if (pw !== pw2) return setErr("The two passwords don't match.");
    setBusy(true); setErr(null);
    const { error } = await supabase().auth.updateUser({ password: pw });
    if (error) { setBusy(false); setErr(/different|same/i.test(error.message) ? "Choose a password different from the temporary one." : error.message); return; }
    await supabase().rpc("clear_password_flag");
    await s.reloadProfile();
    s.toast("Password saved");
  }
  return (
    <main className="wrap center">
      <form className="panel login" onSubmit={submit} noValidate>
        <Brand size="large" />
        <h1 style={{ marginTop: 12 }}>Choose your password</h1>
        <p className="muted" style={{ margin: 0 }}>You signed in with a temporary password. Pick your own to continue.</p>
        <label className="fld"><span>New password</span><input id="own-pw" type="password" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} /></label>
        <label className="fld"><span>Type it again</span><input id="own-pw2" type="password" autoComplete="new-password" value={pw2} onChange={(e) => setPw2(e.target.value)} /></label>
        {err && <div className="err">{err}</div>}
        <button className="btn primary" type="submit" disabled={busy} style={{ justifyContent: "center" }}>{busy ? "Saving…" : "Save and continue"}</button>
        <button className="linkish small" type="button" onClick={() => supabase().auth.signOut()}>Sign out</button>
      </form>
      <Toast />
    </main>
  );
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

/** Admins: choose whose records every screen shows. */
function ScopeBar() {
  const s = useStore();
  const label = (id: string) => (id === s.session?.user.id ? "You" : s.personName(id));
  return (
    <div className="scopebar">
      <div className="wrap row" style={{ paddingBlock: 6 }}>
        <span className={`pill role-admin`}>{ROLE_INFO.admin.label}</span>
        <label className="row small" htmlFor="scope" style={{ gap: 6 }}>
          <span className="muted">Viewing</span>
          <select id="scope" value={s.scope} onChange={(e) => { s.setScope(e.target.value); s.setDetail(null); }}>
            <option value="all">Everyone&apos;s records</option>
            {s.staffProfiles.map((p) => <option key={p.id} value={p.id}>{label(p.id)}{p.role === "admin" ? " (admin)" : ""}</option>)}
          </select>
        </label>
      </div>
    </div>
  );
}

function Desk() {
  const s = useStore();
  const a = useActions();
  const [view, setView] = useState<View>("home");
  const [adding, setAdding] = useState(false);
  const [exportingProperty, setExportingProperty] = useState(false);
  const views = viewsFor(s.isAdmin);
  const openRequests = s.requests.filter((r) => r.status === "Open" && (!s.isAdmin || s.scope === "all" || r.user_id === s.scope)).length;

  useEffect(() => {
    const read = () => {
      const h = window.location.hash.slice(1) as View;
      setView(viewsFor(s.isAdmin).includes(h) ? h : "home");
      s.setDetail(null);
      window.scrollTo(0, 0);
    };
    read();
    window.addEventListener("hashchange", read);
    return () => window.removeEventListener("hashchange", read);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s.isAdmin]);
  const go = (v: string) => { window.location.hash = v; };
  /** Logo: back to Today from anywhere, even if Today is already showing. */
  const goHome = () => {
    s.setDetail(null);
    if (window.location.hash === "#home" || view === "home") { setView("home"); window.scrollTo({ top: 0, behavior: "smooth" }); }
    window.location.hash = "home";
  };
  const pages: MenuPage[] = views.map((v) => ({
    id: v, label: TAB_LABEL[v], hint: VIEW_HINT[v], badge: v === "requests" && openRequests > 0 ? openRequests : undefined,
  }));
  const exports = [
    { label: "One property…", hint: "Pick a building: its units, tenants, history or maintenance",
      run: () => setExportingProperty(true) },
    { label: "All renters", hint: "Spreadsheet (CSV) of every renter",
      run: () => downloadText(`renters-${today()}.csv`, rentersCsv(s.data), "text/csv;charset=utf-8") },
    { label: "All units", hint: "Spreadsheet (CSV) of every unit, by property",
      run: () => downloadText(`units-${today()}.csv`, unitsCsv(s.data), "text/csv;charset=utf-8") },
    { label: "Full backup", hint: "Every record as one file (JSON) to keep safe",
      run: () => downloadText(`kueppers-backup-${today()}.json`, JSON.stringify(s.data, null, 2), "application/json") },
  ];

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
          <Brand onHome={goHome} />
          <div className="row headactions">
            <button className="btn primary addbar" type="button" onClick={() => setAdding(true)}>+ Add</button>
            <MainMenu pages={pages} current={view} exports={exports} onSignOut={() => supabase().auth.signOut()}
              user={{ name: s.profile?.full_name ?? "", email: s.session?.user.email ?? "", role: s.role }} />
          </div>
        </div>
        {s.isAdmin && s.rolesReady && <ScopeBar />}
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
            {view === "requests" && <RequestsView />}
            {view === "matching" && <MatchSettingsView />}
            {view === "users" && s.isAdmin && <UsersView />}
          </>
        )}
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
      {exportingProperty && <PropertyExport onClose={() => setExportingProperty(false)} />}
      <DetailSheet />
      <PasswordReset />
      {s.toastMsg && <div className="toast" role="status">{s.toastMsg}</div>}
    </>
  );
}
