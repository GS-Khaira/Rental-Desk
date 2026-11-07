"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useStore } from "@/lib/store";
import { REQUEST_STATUSES } from "@/lib/roles";
import type { RequestMessage, RequestStatus, TenantRequest } from "@/lib/types";
import { Empty, Linkish } from "./ui";

const STATUS_TONE: Record<RequestStatus, string> = { Open: "vacant", "In progress": "warn", Resolved: "off" };
export const RequestStatusPill = ({ s }: { s: RequestStatus }) => <span className={`pill p-${STATUS_TONE[s]}`}>{s}</span>;

export const when = (iso: string) => {
  const d = new Date(iso);
  const days = Math.floor((Date.now() - d.getTime()) / 864e5);
  const time = d.toLocaleTimeString("en-CA", { hour: "numeric", minute: "2-digit" });
  if (days < 1 && new Date().getDate() === d.getDate()) return `Today, ${time}`;
  if (days < 2) return `Yesterday, ${time}`;
  return d.toLocaleDateString("en-CA", { month: "short", day: "numeric", year: days > 300 ? "numeric" : undefined });
};

/**
 * One request's conversation. Used by staff (with status controls) and by tenants.
 * `nameOf` turns an author id into the label shown above their message.
 */
export function RequestThread({ request, nameOf, staff, onChanged }: {
  request: TenantRequest;
  nameOf: (authorId: string) => string;
  staff: boolean;
  onChanged?: () => void;
}) {
  const [messages, setMessages] = useState<RequestMessage[] | null>(null);
  const [reply, setReply] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const me = useStore().session?.user.id;

  const [tick, setTick] = useState(0);
  const load = useCallback(() => setTick((t) => t + 1), []);
  useEffect(() => {
    let live = true;
    supabase().from("request_messages").select("*").eq("request_id", request.id).order("created_at").then(({ data, error }) => {
      if (!live) return;
      if (error) setErr("Couldn't load the messages. Check your connection.");
      else setMessages((data ?? []) as RequestMessage[]);
    });
    return () => { live = false; };
  }, [request.id, tick, request.last_message_at]);
  useEffect(() => { endRef.current?.scrollIntoView({ block: "nearest" }); }, [messages]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!reply.trim()) return;
    setBusy(true); setErr(null);
    const { error } = await supabase().from("request_messages").insert({ request_id: request.id, body: reply.trim() });
    setBusy(false);
    if (error) { setErr("Couldn't send. Check your connection and try again."); return; }
    setReply("");
    load();
    onChanged?.();
  }

  async function setStatus(status: RequestStatus) {
    const { error } = await supabase().from("tenant_requests").update({ status }).eq("id", request.id);
    if (error) setErr("Couldn't change the status. Try again.");
    else onChanged?.();
  }

  return (
    <div className="stack">
      {staff && (
        <div className="seg" role="group" aria-label="Request status">
          {REQUEST_STATUSES.map((s) => (
            <button key={s} type="button" className={request.status === s ? "on" : ""} aria-pressed={request.status === s} onClick={() => setStatus(s)}>{s}</button>
          ))}
        </div>
      )}
      <div className="thread" aria-live="polite">
        {messages === null && !err && <div className="muted small">Loading messages…</div>}
        {messages?.map((m) => (
          <div key={m.id} className={`bubble ${m.author_id === me ? "mine" : ""}`}>
            <div className="who">{m.author_id === me ? "You" : nameOf(m.author_id)} · <span className="muted">{when(m.created_at)}</span></div>
            <div className="body">{m.body}</div>
          </div>
        ))}
        <div ref={endRef} />
      </div>
      <form className="reply" onSubmit={send}>
        <label className="fld" htmlFor={`reply-${request.id}`}>
          <span>{staff ? "Reply to the tenant" : "Add a message"}</span>
          <textarea id={`reply-${request.id}`} value={reply} onChange={(e) => setReply(e.target.value)}
            placeholder={staff ? "e.g. A plumber will come Tuesday between 9 and 12." : "Anything to add?"} />
        </label>
        {err && <div className="err">{err}</div>}
        <div className="row" style={{ justifyContent: "flex-end" }}>
          <button className="btn primary small" type="submit" disabled={busy || !reply.trim()}>{busy ? "Sending…" : "Send"}</button>
        </div>
      </form>
    </div>
  );
}

/* ---------------- staff: Requests tab ---------------- */
export function RequestsView() {
  const s = useStore();
  const [filter, setFilter] = useState<"active" | RequestStatus | "">("active");
  let list = s.requests;
  if (filter === "active") list = list.filter((r) => r.status !== "Resolved");
  else if (filter) list = list.filter((r) => r.status === filter);
  if (s.isAdmin && s.scope !== "all") list = list.filter((r) => r.user_id === s.scope);
  const open = s.requests.filter((r) => r.status === "Open").length;

  return (
    <>
      <div className="pagehead">
        <div><div className="label">{open} open · {s.requests.length} in total</div><h1>Tenant requests</h1></div>
      </div>
      {!s.rolesReady ? (
        <Empty title="Requests aren't switched on yet">Run the database update <code>0003_roles_and_requests.sql</code> in Supabase to let tenants send requests.</Empty>
      ) : (
        <>
          <div className="filters">
            <select aria-label="Show" value={filter} onChange={(e) => setFilter(e.target.value as typeof filter)}>
              <option value="active">Open and in progress</option>
              {REQUEST_STATUSES.map((x) => <option key={x}>{x}</option>)}
              <option value="">All requests</option>
            </select>
          </div>
          {list.length ? (
            <div className="rows">
              {list.map((r) => {
                const renter = s.data.renters.find((x) => x.id === r.renter_id);
                const unit = s.data.units.find((x) => x.id === r.unit_id);
                return (
                  <button key={r.id} type="button" className="rowcard" onClick={() => s.setDetail({ type: "request", id: r.id })}>
                    <RequestStatusPill s={r.status} />
                    <div style={{ minWidth: 0 }}>
                      <div className="t">{r.subject}</div>
                      <div className="muted small">{r.category} · {renter?.name ?? "Tenant"} · {unit ? s.unitName(unit) : "Unit removed"}{s.isAdmin && s.scope === "all" ? ` · ${s.personName(r.user_id)}` : ""}</div>
                    </div>
                    <span className="muted small nowrap">{when(r.last_message_at)}</span>
                  </button>
                );
              })}
            </div>
          ) : (
            <Empty title={s.requests.length ? "Nothing here" : "No requests yet"}>
              {s.requests.length ? "Change the filter to see other requests." : "When a tenant sends a question or a repair request from their portal, it shows up here."}
            </Empty>
          )}
        </>
      )}
    </>
  );
}

export function RequestSheet({ r }: { r: TenantRequest }) {
  const s = useStore();
  const renter = s.data.renters.find((x) => x.id === r.renter_id);
  const unit = s.data.units.find((x) => x.id === r.unit_id);
  const nameOf = (id: string) => (id === r.tenant_id ? renter?.name ?? "Tenant" : s.isAdmin ? s.personName(id) : "Property team");
  return (
    <>
      <div className="head">
        <div style={{ minWidth: 0 }}>
          <div className="row"><RequestStatusPill s={r.status} /><span className="pill p-off">{r.category}</span></div>
          <h2 style={{ marginTop: 6 }}>{r.subject}</h2>
          <div className="muted small">
            From {renter ? <Linkish onClick={() => s.setDetail({ type: "renter", id: renter.id })}>{renter.name}</Linkish> : "a tenant"}
            {unit && <> · <Linkish onClick={() => s.setDetail({ type: "unit", id: unit.id })}>{s.unitName(unit)}</Linkish></>}
            {renter?.phone && <> · <span className="mono">{renter.phone}</span></>}
          </div>
        </div>
        <button className="btn small" type="button" onClick={() => s.setDetail(null)}>Close</button>
      </div>
      <div className="sec"><RequestThread request={r} nameOf={nameOf} staff onChanged={s.reloadRequests} /></div>
    </>
  );
}
