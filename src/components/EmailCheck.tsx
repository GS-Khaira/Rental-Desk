"use client";

import { useEffect, useState } from "react";
import { adminApi, type EmailCheck } from "@/lib/adminApi";

/**
 * Admins' email check: shows which email settings the server can see, sends a test email,
 * and explains any problem in plain words. Deliberately not in the menu (the owner didn't want
 * it visible); an admin opens it by going to the app's address followed by #email-check.
 */
export function EmailCheckDialog({ onClose }: { onClose: () => void }) {
  const [checks, setChecks] = useState<EmailCheck[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [run, setRun] = useState(0);

  useEffect(() => {
    let live = true;
    adminApi.emailCheck().then(
      (c) => { if (live) { setChecks(c); setErr(null); } },
      (e: Error) => { if (live) setErr(e.message); },
    );
    return () => { live = false; };
  }, [run]);

  return (
    <>
      <div className="scrim" onClick={onClose} />
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="ec-title" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
        <div className="box wide">
          <div className="row between"><h2 id="ec-title">Email check</h2><button className="btn small" type="button" onClick={onClose}>Close</button></div>
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
          {(checks || err) && <div className="row" style={{ justifyContent: "flex-end" }}><button className="btn small" type="button" onClick={() => { setChecks(null); setErr(null); setRun((n) => n + 1); }}>Check again</button></div>}
        </div>
      </div>
    </>
  );
}
