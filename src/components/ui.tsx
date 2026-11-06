"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { scoreTone, type Reason } from "@/lib/match";

const STATUS_CLASS: Record<string, string> = {
  Vacant: "p-vacant", Listed: "p-listed", Rented: "p-rented", "Not available": "p-off",
  Looking: "p-looking", Placed: "p-placed", Inactive: "p-off",
};

export const Pill = ({ children, tone }: { children: ReactNode; tone: string }) => (
  <span className={`pill p-${tone}`}>{children}</span>
);
export const StatusPill = ({ s }: { s: string }) => <span className={`pill ${STATUS_CLASS[s] ?? "p-off"}`}>{s}</span>;
export const ScorePill = ({ s }: { s: number }) => <span className={`pill num p-${scoreTone(s)}`}>{s}</span>;
export const ScoreBadge = ({ s }: { s: number }) => (
  <div className={`score ${s >= 80 ? "hi" : s >= 60 ? "mid" : ""}`} title="Match score out of 100">{s}</div>
);
export const Chips = ({ why }: { why: Reason[] }) => (
  <div className="chips">{why.map(([k, t], i) => <span key={i} className={`pill p-${k}`}>{t}</span>)}</div>
);
export const RentAgainPill = ({ v }: { v: string | null }) =>
  v ? <Pill tone={v === "Yes" ? "ok" : v === "Maybe" ? "warn" : "no"}>Rent again: {v}</Pill> : null;

export const Empty = ({ title, children }: { title: string; children?: ReactNode }) => (
  <div className="empty"><b>{title}</b>{children}</div>
);

export const Linkish = ({ onClick, children, className = "" }: { onClick: () => void; children: ReactNode; className?: string }) => (
  <button type="button" className={`linkish ${className}`} onClick={(e) => { e.stopPropagation(); onClick(); }}>{children}</button>
);

/** Two-tap delete: first tap arms it, second tap within 4 seconds runs it. */
export function ConfirmButton({ label, onConfirm, small = true }: { label: string; onConfirm: () => Promise<void>; small?: boolean }) {
  const [armed, setArmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  return (
    <button
      type="button"
      disabled={busy}
      className={`btn danger ${small ? "small" : ""} ${armed ? "armed" : ""}`}
      onClick={async () => {
        if (!armed) {
          setArmed(true);
          timer.current = window.setTimeout(() => setArmed(false), 4000);
          return;
        }
        window.clearTimeout(timer.current);
        setBusy(true);
        try { await onConfirm(); } catch { /* toast already shown */ } finally { setBusy(false); setArmed(false); }
      }}
    >
      {armed ? "Tap again to confirm" : label}
    </button>
  );
}

export const KV = ({ rows }: { rows: [string, ReactNode][] }) => (
  <dl className="kv">
    {rows.filter(([, v]) => v !== null && v !== undefined && v !== "").map(([k, v]) => (
      <div key={k} style={{ display: "contents" }}><dt>{k}</dt><dd>{v}</dd></div>
    ))}
  </dl>
);
