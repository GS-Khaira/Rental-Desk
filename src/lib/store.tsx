"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "./supabase";
import { match, type MatchResult } from "./match";
import { TABLES, type Data, type Property, type Renter, type TableName, type Tables, type Tenancy, type Unit } from "./types";

const empty = (): Data => ({ owners: [], properties: [], units: [], renters: [], tenancies: [], maintenance: [] });

async function fetchAll<T extends TableName>(table: T): Promise<Tables[T][]> {
  const out: Tables[T][] = [];
  const page = 1000;
  for (let from = 0; ; from += page) {
    const { data, error } = await supabase().from(table).select("*").order("created_at").range(from, from + page - 1);
    if (error) throw error;
    out.push(...((data ?? []) as Tables[T][]));
    if (!data || data.length < page) return out;
  }
}

/** Turn "" into null and drop bookkeeping columns before writing. */
function clean(row: Record<string, unknown>) {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) {
    if (k === "user_id" || k === "created_at" || k === "updated_at") continue;
    out[k] = v === "" ? null : v;
  }
  return out;
}

export type Detail = { type: "unit" | "renter" | "owner"; id: string } | null;

interface Store {
  session: Session | null;
  authReady: boolean;
  data: Data;
  loading: boolean;
  loadError: string | null;
  reload: () => Promise<void>;
  save: <T extends TableName>(table: T, row: Partial<Tables[T]>) => Promise<Tables[T]>;
  remove: (table: TableName, id: string) => Promise<void>;
  detail: Detail;
  setDetail: (d: Detail) => void;
  toast: (msg: string) => void;
  toastMsg: string | null;
  // lookups
  propOf: (u?: Unit | null) => Property | undefined;
  unitName: (u?: Unit | null) => string;
  matchUR: (u: Unit, r: Renter) => MatchResult;
  matchesForRenter: (r: Renter) => (MatchResult & { u: Unit })[];
  matchesForUnit: (u: Unit) => (MatchResult & { r: Renter })[];
  tenanciesOfRenter: (id: string) => Tenancy[];
  tenanciesOfUnit: (id: string) => Tenancy[];
  activeTenancy: (unitId: string) => Tenancy | undefined;
}

const Ctx = createContext<Store | null>(null);
export const useStore = () => {
  const s = useContext(Ctx);
  if (!s) throw new Error("useStore outside StoreProvider");
  return s;
};
export const isOpen = (u: Unit) => u.status === "Vacant" || u.status === "Listed";

export function StoreProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [data, setData] = useState<Data>(empty);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [detail, setDetail] = useState<Detail>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const toast = useCallback((msg: string) => {
    setToastMsg(msg);
    window.setTimeout(() => setToastMsg((m) => (m === msg ? null : m)), 2600);
  }, []);

  useEffect(() => {
    const sb = supabase();
    sb.auth.getSession().then(({ data }) => { setSession(data.session); setAuthReady(true); });
    const { data: sub } = sb.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const results = await Promise.all(TABLES.map((t) => fetchAll(t)));
      const next = empty();
      TABLES.forEach((t, i) => { (next[t] as unknown[]) = results[i]; });
      setData(next);
      setLoadError(null);
    } catch {
      setLoadError("Couldn't load your records. Check your connection, then reload.");
    } finally {
      setLoading(false);
    }
  }, []);

  const userId = session?.user.id;
  useEffect(() => {
    if (!userId) { setData(empty()); return; }
    reload();
    const onFocus = () => reload();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [userId, reload]);

  const save = useCallback(async <T extends TableName>(table: T, row: Partial<Tables[T]>) => {
    const body = clean(row as Record<string, unknown>);
    const q = body.id
      ? supabase().from(table).update(body).eq("id", body.id as string).select().single()
      : supabase().from(table).insert(body).select().single();
    const { data: saved, error } = await q;
    if (error || !saved) {
      toast(error?.code === "23505" ? "That unit already has a current tenant." : "Couldn't save. Check your connection and try again.");
      throw error ?? new Error("save failed");
    }
    setData((d) => {
      const list = d[table] as Tables[T][];
      const i = list.findIndex((x) => x.id === saved.id);
      const nextList = i >= 0 ? list.map((x) => (x.id === saved.id ? saved : x)) : [...list, saved];
      return { ...d, [table]: nextList };
    });
    return saved as Tables[T];
  }, [toast]);

  const remove = useCallback(async (table: TableName, id: string) => {
    const { error } = await supabase().from(table).delete().eq("id", id);
    if (error) {
      toast(error.code === "23503" ? "Delete its properties first." : "Couldn't delete. Try again.");
      throw error;
    }
    await reload(); // cascades (e.g. units → maintenance) change other tables
  }, [reload, toast]);

  const lookups = useMemo(() => {
    const propById = new Map(data.properties.map((p) => [p.id, p]));
    const propOf = (u?: Unit | null) => (u ? propById.get(u.property_id) : undefined);
    const unitName = (u?: Unit | null) => {
      if (!u) return "Removed unit";
      const p = propOf(u);
      return (p ? p.address : "Unknown property") + (u.label ? " · " + u.label : "");
    };
    const matchUR = (u: Unit, r: Renter) => match({ ...u, area: propOf(u)?.area ?? null }, r);
    const matchesForRenter = (r: Renter) =>
      data.units.filter(isOpen).map((u) => ({ u, ...matchUR(u, r) })).filter((m) => !m.blocked).sort((a, b) => b.score - a.score);
    const matchesForUnit = (u: Unit) =>
      data.renters.filter((r) => r.status === "Looking").map((r) => ({ r, ...matchUR(u, r) })).filter((m) => !m.blocked).sort((a, b) => b.score - a.score);
    const byMoveInDesc = (a: Tenancy, b: Tenancy) => (b.move_in || "").localeCompare(a.move_in || "");
    const tenanciesOfRenter = (id: string) => data.tenancies.filter((t) => t.renter_id === id).sort(byMoveInDesc);
    const tenanciesOfUnit = (id: string) => data.tenancies.filter((t) => t.unit_id === id).sort(byMoveInDesc);
    const activeTenancy = (unitId: string) => data.tenancies.find((t) => t.unit_id === unitId && !t.move_out);
    return { propOf, unitName, matchUR, matchesForRenter, matchesForUnit, tenanciesOfRenter, tenanciesOfUnit, activeTenancy };
  }, [data]);

  const value: Store = {
    session, authReady, data, loading, loadError, reload, save, remove,
    detail, setDetail, toast, toastMsg, ...lookups,
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
