"use client";

import { useState } from "react";
import { adminApi, type EmailCheck } from "@/lib/adminApi";

/** Admins: "Send test email" checks the email settings, sends a test, and explains any problem in plain words. */
export function EmailCheckButton() {
  const [open, setOpen] = useState(false);
  const [checks, setChecks] = useState<EmailCheck[] | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function run() {
    setOpen(true); setChecks(null); setErr(null);
    try { setChecks(await adminApi.emailCheck()); } catch (e) { setErr((e as Error).message); }
  }

  return (
    <>
      <button type="button" className="linkish small" style={{ marginTop: 6 }} onClick={run}>Send test email</button>
      {open && (
        <>
          <div className="scrim" onClick={() => setOpen(false)} />
          <div className="modal" role="dialog" aria-modal="true" aria-labelledby="ec-title" onClick={(e) => { if (e.target === e.currentTarget) setOpen(false); }}>
            <div className="box wide">
              <div className="row between"><h2 id="ec-title">Email check</h2><button className="btn small" type="button" onClick={() => setOpen(false)}>Close</button></div>
              {!checks && !err && <p className="muted">Checking settings and sending a test email… this takes a few seconds.</p>}
              {err && <div className="banner info" style={{ marginTop: 10 }}><span>{err.includes("SUPABASE_SECRET_KEY") ? "The app's server can't reach the database: SUPABASE_SECRET_KEY is missing or wrong in Vercel. Add it, then redeploy." : err}</span></div>}
              {checks && (
                <ul className="checks">
                  {checks.map((c) => (
                    <li key={c.label} className={c.ok === true ? "ok" : c.ok === false ? "bad" : "info"}>
                      <span className="mark" aria-hidden="true">{c.ok === true ? "✓" : c.ok === false ? "✗" : "•"}</span>
                      <div><b>{c.label}</b><span className="sr-only">{c.ok === true ? " (OK)" : c.ok === false ? " (problem)" : ""}</span><div className="small">{c.detail}</div></div>
                    </li>
                  ))}
                </ul>
              )}
              {checks && <div className="row" style={{ justifyContent: "flex-end" }}><button className="btn small" type="button" onClick={run}>Check again</button></div>}
            </div>
          </div>
        </>
      )}
    </>
  );
}
