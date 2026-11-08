"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useStore } from "@/lib/store";
import { REQUEST_CATEGORIES } from "@/lib/roles";
import { fmtDate, money } from "@/lib/format";
import type { RentPayment, TenantHome, TenantRequest } from "@/lib/types";
import { TenantPayments } from "./Payments";
import { useOpenForm } from "./FormModal";
import { RequestStatusPill, RequestThread, when } from "./Requests";
import { Empty, KV } from "./ui";

/** What a tenant sees: their current home, their manager, and their requests. Nothing else. */
export function TenantPortal({ header }: { header: React.ReactNode }) {
  const s = useStore();
  const openForm = useOpenForm();
  const [home, setHome] = useState<TenantHome | null | undefined>(undefined);
  const [requests, setRequests] = useState<TenantRequest[]>([]);
  const [payments, setPayments] = useState<RentPayment[] | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const [tick, setTick] = useState(0);
  const load = useCallback(() => setTick((t) => t + 1), []);
  useEffect(() => {
    let live = true;
    Promise.all([
      supabase().rpc("tenant_home"),
      supabase().from("tenant_requests").select("*").order("last_message_at", { ascending: false }),
      supabase().from("rent_payments").select("*").order("period", { ascending: false }).order("created_at", { ascending: false }),
    ]).then(([h, r, pay]) => {
      if (!live) return;
      if (h.error || r.error) { setErr("Couldn't load your details. Check your connection, then reload."); return; }
      setErr(null);
      setHome((h.data as TenantHome) ?? null);
      setRequests((r.data ?? []) as TenantRequest[]);
      // null = rent payments not switched on yet (migration 0005 not run): hide that section
      setPayments(pay.error ? null : ((pay.data ?? []) as RentPayment[]));
    });
    return () => { live = false; };
  }, [tick]);
  useEffect(() => {
    window.addEventListener("focus", load);
    return () => window.removeEventListener("focus", load);
  }, [load]);

  const hasHome = Boolean(home?.tenancy && home.property);
  const first = (home?.name || s.profile?.full_name || "").split(" ")[0];
  const mgr = home?.manager;

  const newRequest = () => openForm({
    title: "Ask for help",
    intro: "Your property manager will reply here. For emergencies like a fire, flood or gas smell, call 911 first.",
    saveLabel: "Send request",
    fields: [
      { k: "category", label: "What is it about?", type: "select", opts: [...REQUEST_CATEGORIES], req: true, def: "Maintenance" },
      { k: "subject", label: "Short summary", req: true, ph: "e.g. Kitchen tap is dripping" },
      { k: "message", label: "Details", type: "textarea", req: true, ph: "What's happening, where, and since when. Times you're home help too." },
    ],
    onSubmit: async (v) => {
      const { data, error } = await supabase().rpc("create_tenant_request", {
        p_category: v.category, p_subject: v.subject, p_message: v.message,
      });
      if (error) { s.toast(error.message || "Couldn't send. Try again."); throw error; }
      s.toast("Request sent");
      load();
      setOpenId(data as string);
    },
  });

  return (
    <>
      {header}
      <main className="wrap portal">
        {err && <div className="banner info"><span>{err}</span><button className="btn small" type="button" onClick={load}>Try again</button></div>}
        <div className="pagehead">
          <div><div className="label">Tenant portal</div><h1>{first ? `Hi ${first}` : "Welcome"}</h1></div>
          {hasHome && <button className="btn primary" type="button" onClick={newRequest}>Ask for help</button>}
        </div>

        {home === undefined ? (
          <div className="empty"><b>Loading your home…</b></div>
        ) : !hasHome ? (
          <Empty title="No current rental is linked to your account">
            If you&apos;ve just moved in, it may not be set up yet. Please contact Kueppers Property Services.
          </Empty>
        ) : (
          <div className="cols">
            <section className="panel">
              <div className="label">Your home</div>
              <h2 style={{ marginTop: 4 }}>{home!.property!.address}{home!.unit?.label ? ` · ${home!.unit.label}` : ""}</h2>
              <div className="muted">{[home!.property!.area, home!.property!.postal].filter(Boolean).join(" · ")}</div>
              <div style={{ marginTop: 14 }}>
                <KV rows={[
                  ["Moved in", fmtDate(home!.tenancy!.move_in)],
                  ["Rent", home!.tenancy!.rent ? `${money(home!.tenancy!.rent)} / month` : null],
                  ["Bedrooms", home!.unit?.beds],
                  ["Bathrooms", home!.unit?.baths],
                  ["Included", home!.unit?.utilities],
                  ["Parking", home!.unit ? (home!.unit.parking ? "Included" : "Not included") : null],
                  ["Pets", home!.unit ? (home!.unit.pets ? "Allowed" : "Not allowed") : null],
                ]} />
              </div>
            </section>
            <section className="panel">
              <div className="label">Your property manager</div>
              <h2 style={{ marginTop: 4 }}>{mgr?.name || "Kueppers Property Services"}</h2>
              <div className="stack" style={{ marginTop: 12 }}>
                {mgr?.phone && <a className="btn" href={`tel:${mgr.phone.replace(/[^\d+]/g, "")}`}>Call <span className="mono">{mgr.phone}</span></a>}
                {mgr?.email && <a className="btn" href={`mailto:${mgr.email}`}>Email <span className="mono">{mgr.email}</span></a>}
                <button className="btn primary" type="button" onClick={newRequest}>Send a request in the app</button>
              </div>
            </section>
          </div>
        )}

        {hasHome && payments && <TenantPayments payments={payments} rent={home?.tenancy?.rent ?? null} onChanged={load} />}

        {hasHome && (
          <section className="panel" style={{ marginTop: 20 }}>
            <h2>Your requests</h2>
            {requests.length ? (
              <div className="rows" style={{ marginTop: 10 }}>
                {requests.map((r) => (
                  <div key={r.id} className="reqitem">
                    <button type="button" className="rowcard" aria-expanded={openId === r.id} onClick={() => setOpenId(openId === r.id ? null : r.id)}>
                      <RequestStatusPill s={r.status} />
                      <div style={{ minWidth: 0 }}><div className="t">{r.subject}</div><div className="muted small">{r.category}</div></div>
                      <span className="muted small nowrap">{when(r.last_message_at)}</span>
                    </button>
                    {openId === r.id && (
                      <div className="sec" style={{ marginTop: 8 }}>
                        <RequestThread request={r} staff={false} nameOf={() => mgr?.name || "Property manager"} onChanged={load} />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="muted" style={{ marginBottom: 0 }}>No requests yet. Use <b>Ask for help</b> for repairs, rent questions or anything about your lease.</p>
            )}
          </section>
        )}
      </main>
    </>
  );
}
