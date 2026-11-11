"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "./supabase";
import { DEFAULT_SETTINGS, match, normalizeSettings, type MatchResult, type MatchSettings } from "./match";
import { isStaffRole } from "./roles";
import {
  TABLES, type Data, type Profile, type Property, type Renter, type Role, type TableName, type Tables,
  type Tenancy, type TenantRequest, type Unit,
} from "./types";

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

/** Turn "" into null and drop bookkeeping columns before writing. user_id is kept only when set (admins reassigning). */
function clean(row: Record<string, unknown>) {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) {
    if (k === "created_at" || k === "updated_at") continue;
    if (k === "user_id" && !v) continue;
    out[k] = v === "" ? null : v;
  }
  return out;
}

export interface UserDraft { role: Role; full_name?: string; email?: string; phone?: string; renter_id?: string }

export type Detail = { type: "unit" | "renter" | "owner" | "request" | "user"; id: string } | null;

/**
 * How far the signed-in account is set up:
 * - loading: checking
 * - ready:   has a profile with a role
 * - legacy:  the roles database update (migration 0003) hasn't been run — behave as before, as an admin
 * - missing: roles exist, but this account has no profile (made outside the app)
 * - off:     an admin switched this account's access off
 */
export type AccountState = "loading" | "ready" | "legacy" | "missing" | "off";

interface Store {
  session: Session | null;
  authReady: boolean;
  account: AccountState;
  profile: Profile | null;
  role: Role | null;
  isAdmin: boolean;
  isStaff: boolean;
  /** False until migration 0003 has been run. */
  rolesReady: boolean;
  reloadProfile: () => Promise<void>;

  /** Records in view: everything the account may see, narrowed by an admin's "Viewing" choice. */
  data: Data;
  /** Everything the account may see, ignoring the "Viewing" choice (e.g. for linking tenants). */
  allData: Data;
  /** Admins: whose records are shown ("all" or a user id). */
  scope: string;
  setScope: (s: string) => void;
  /** Admins: every profile, for names and "Managed by" choices. */
  profiles: Profile[];
  staffProfiles: Profile[];
  personName: (userId: string | null | undefined) => string;
  reloadProfiles: () => Promise<void>;
  /** Admins: a user to start adding (e.g. "Give portal access" on a renter). */
  userDraft: UserDraft | null;
  setUserDraft: (d: UserDraft | null) => void;

  requests: TenantRequest[];
  reloadRequests: () => Promise<void>;

  loading: boolean;
  loadError: string | null;
  reload: () => Promise<void>;
  save: <T extends TableName>(table: T, row: Partial<Tables[T]>) => Promise<Tables[T]>;
  remove: (table: TableName, id: string) => Promise<void>;
  detail: Detail;
  setDetail: (d: Detail) => void;
  toast: (msg: string) => void;
  toastMsg: string | null;
  settings: MatchSettings;
  /** False when the match_settings table hasn't been created yet (migration 0002 not run). */
  settingsSavable: boolean;
  /** False until migration 0004 adds the renters' "income verified" columns. */
  incomeReady: boolean;
  saveSettings: (s: MatchSettings) => Promise<void>;
  // lookups
  propOf: (u?: Unit | null) => Property | undefined;
  unitName: (u?: Unit | null) => string;
  matchUR: (u: Unit, r: Renter, s?: MatchSettings) => MatchResult;
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
  const [account, setAccount] = useState<AccountState>("loading");
  const [profile, setProfile] = useState<Profile | null>(null);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [scope, setScope] = useState("all");
  const [allData, setAllData] = useState<Data>(empty);
  const [requests, setRequests] = useState<TenantRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [detail, setDetail] = useState<Detail>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [settings, setSettings] = useState<MatchSettings>(DEFAULT_SETTINGS);
  const [settingsSavable, setSettingsSavable] = useState(true);
  const [incomeReady, setIncomeReady] = useState(false);
  const [userDraft, setUserDraft] = useState<UserDraft | null>(null);

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

  const userId = session?.user.id;

  /* ---------- who is signed in ---------- */
  const reloadProfile = useCallback(async () => {
    if (!userId) return;
    const { data, error } = await supabase().from("profiles").select("*").eq("id", userId).maybeSingle();
    if (error) {
      // 42P01 / PGRST205: the profiles table doesn't exist yet → migration 0003 not run.
      const missingTable = error.code === "42P01" || error.code === "PGRST205" || /profiles/.test(error.message ?? "");
      if (missingTable) { setProfile(null); setAccount("legacy"); }
      else setLoadError("Couldn't check your account. Check your connection, then reload.");
      return;
    }
    setProfile((data as Profile) ?? null);
    setAccount(!data ? "missing" : data.active ? "ready" : "off");
  }, [userId]);

  useEffect(() => {
    if (!userId) { setAccount("loading"); setProfile(null); return; }
    setAccount("loading");
    reloadProfile();
  }, [userId, reloadProfile]);

  const role: Role | null = account === "legacy" ? "admin" : account === "ready" ? profile?.role ?? null : null;
  const isAdmin = role === "admin";
  const isStaff = isStaffRole(role);
  const rolesReady = account === "ready";

  /* ---------- records (staff only) ---------- */
  const reloadRequests = useCallback(async () => {
    const { data, error } = await supabase().from("tenant_requests").select("*").order("last_message_at", { ascending: false });
    if (!error) setRequests((data ?? []) as TenantRequest[]);
  }, []);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const results = await Promise.all(TABLES.map((t) => fetchAll(t)));
      const next = empty();
      TABLES.forEach((t, i) => { (next[t] as unknown[]) = results[i]; });
      setAllData(next);
      setLoadError(null);
      const { data: row, error } = await supabase().from("match_settings").select("settings").maybeSingle();
      if (error) setSettingsSavable(false); // table missing: use defaults, saving disabled
      else { setSettingsSavable(true); setSettings(normalizeSettings(row?.settings ?? null)); }
      // Does the renters table have the "income verified" columns yet (migration 0004)?
      const probe = await supabase().from("renters").select("income_verified").limit(1);
      setIncomeReady(!probe.error);
    } catch {
      setLoadError("Couldn't load your records. Check your connection, then reload.");
    } finally {
      setLoading(false);
    }
  }, []);

  const reloadProfiles = useCallback(async () => {
    const { data, error } = await supabase().from("profiles").select("*").order("full_name");
    if (!error) setProfiles((data ?? []) as Profile[]);
  }, []);

  useEffect(() => {
    if (!userId || !isStaff) { setAllData(empty()); setRequests([]); setProfiles([]); setSettings(DEFAULT_SETTINGS); return; }
    const all = () => {
      reload();
      if (rolesReady) reloadRequests();
      if (rolesReady && isAdmin) reloadProfiles();
    };
    all();
    window.addEventListener("focus", all);
    return () => window.removeEventListener("focus", all);
  }, [userId, isStaff, isAdmin, rolesReady, reload, reloadRequests, reloadProfiles]);

  // An admin's "Viewing" choice narrows every screen at once.
  const data = useMemo<Data>(() => {
    if (!isAdmin || scope === "all") return allData;
    const mine = <T extends { user_id?: string }>(rows: T[]) => rows.filter((r) => r.user_id === scope);
    return {
      owners: mine(allData.owners), properties: mine(allData.properties), units: mine(allData.units),
      renters: mine(allData.renters), tenancies: mine(allData.tenancies), maintenance: mine(allData.maintenance),
    };
  }, [allData, isAdmin, scope]);

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
    setAllData((d) => {
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

  const saveSettings = useCallback(async (next: MatchSettings) => {
    const cleanSettings = normalizeSettings(next);
    const { error } = await supabase().from("match_settings").upsert({ settings: cleanSettings }, { onConflict: "user_id" });
    if (error) {
      toast("Couldn't save the settings. Check your connection and try again.");
      throw error;
    }
    setSettings(cleanSettings);
  }, [toast]);

  const people = useMemo(() => {
    const byId = new Map(profiles.map((p) => [p.id, p]));
    const personName = (id: string | null | undefined) => {
      if (!id) return "—";
      if (id === userId) return "You";
      const p = byId.get(id);
      return p ? p.full_name || p.email || "Unnamed user" : "Another user";
    };
    const staffProfiles = profiles.filter((p) => isStaffRole(p.role) && p.active);
    return { personName, staffProfiles };
  }, [profiles, userId]);

  const lookups = useMemo(() => {
    const propById = new Map(data.properties.map((p) => [p.id, p]));
    const propOf = (u?: Unit | null) => (u ? propById.get(u.property_id) : undefined);
    const unitName = (u?: Unit | null) => {
      if (!u) return "Removed unit";
      const p = propOf(u);
      return (p ? p.address : "Unknown property") + (u.label ? " · " + u.label : "");
    };
    const matchUR = (u: Unit, r: Renter, s: MatchSettings = settings) => match({ ...u, area: propOf(u)?.area ?? null }, r, s);
    const matchesForRenter = (r: Renter) =>
      data.units.filter(isOpen).map((u) => ({ u, ...matchUR(u, r) })).filter((m) => !m.blocked && m.score >= settings.minScore).sort((a, b) => b.score - a.score);
    const matchesForUnit = (u: Unit) =>
      data.renters.filter((r) => r.status === "Looking").map((r) => ({ r, ...matchUR(u, r) })).filter((m) => !m.blocked && m.score >= settings.minScore).sort((a, b) => b.score - a.score);
    const byMoveInDesc = (a: Tenancy, b: Tenancy) => (b.move_in || "").localeCompare(a.move_in || "");
    const tenanciesOfRenter = (id: string) => data.tenancies.filter((t) => t.renter_id === id).sort(byMoveInDesc);
    const tenanciesOfUnit = (id: string) => data.tenancies.filter((t) => t.unit_id === id).sort(byMoveInDesc);
    const activeTenancy = (unitId: string) => data.tenancies.find((t) => t.unit_id === unitId && !t.move_out);
    return { propOf, unitName, matchUR, matchesForRenter, matchesForUnit, tenanciesOfRenter, tenanciesOfUnit, activeTenancy };
  }, [data, settings]);

  const value: Store = {
    session, authReady, account, profile, role, isAdmin, isStaff, rolesReady, reloadProfile,
    data, allData, scope, setScope, profiles, ...people, reloadProfiles, userDraft, setUserDraft,
    requests, reloadRequests,
    loading, loadError, reload, save, remove,
    detail, setDetail, toast, toastMsg, settings, settingsSavable, saveSettings, incomeReady, ...lookups,
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
