// Server-only helpers for the admin user-management routes.
// Uses SUPABASE_SECRET_KEY, which bypasses Row Level Security. It must only ever
// be read here, on the server — never in browser code, and never prefixed NEXT_PUBLIC_.
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { AdminUser, Profile, Role } from "@/lib/types";

export class HttpError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

export function adminClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secret = process.env.SUPABASE_SECRET_KEY;
  if (!url || !secret) {
    throw new HttpError(500, "User management isn't set up yet: add SUPABASE_SECRET_KEY to the hosting environment variables, then redeploy.");
  }
  return createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } });
}

/** Checks the caller's sign-in token and that they are an active admin. */
export async function requireAdmin(req: Request): Promise<{ sb: SupabaseClient; adminId: string }> {
  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) throw new HttpError(401, "Sign in again.");
  const sb = adminClient();
  const { data, error } = await sb.auth.getUser(token);
  if (error || !data.user) throw new HttpError(401, "Your sign-in has expired. Sign in again.");
  const { data: me } = await sb.from("profiles").select("role, active").eq("id", data.user.id).maybeSingle();
  if (!me || me.role !== "admin" || !me.active) throw new HttpError(403, "Only admins can manage users.");
  return { sb, adminId: data.user.id };
}

/** Wraps a route handler so thrown errors become JSON responses with a plain message. */
export function handle(fn: () => Promise<Response>): Promise<Response> {
  return fn().catch((e: unknown) => {
    if (e instanceof HttpError) return Response.json({ error: e.message }, { status: e.status });
    // Supabase errors are plain objects with a message, not Error instances.
    const msg = typeof e === "object" && e && "message" in e ? String((e as { message: unknown }).message) : String(e);
    if (msg.includes("at least one active admin")) return Response.json({ error: "The app needs at least one active admin. Make someone else an admin first." }, { status: 409 });
    if (msg.includes("profiles_one_login_per_renter")) return Response.json({ error: "That renter already has a tenant login." }, { status: 409 });
    console.error("admin route error:", e);
    return Response.json({ error: "Something went wrong. Try again." }, { status: 500 });
  });
}

const ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789"; // no look-alikes (0/o, 1/l/i)
/** A readable temporary password, e.g. "k7qm-x3ta-p9wr". */
export function tempPassword(): string {
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  const chars = Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join("");
  return `${chars.slice(0, 4)}-${chars.slice(4, 8)}-${chars.slice(8, 12)}`;
}

export const ROLE_VALUES: Role[] = ["admin", "manager", "tenant"];

export function cleanText(v: unknown, max = 200): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim().slice(0, max);
  return t || null;
}

export function validEmail(v: unknown): string {
  const e = typeof v === "string" ? v.trim().toLowerCase() : "";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) throw new HttpError(400, "Enter a valid email address.");
  return e;
}

export function validRole(v: unknown): Role {
  if (!ROLE_VALUES.includes(v as Role)) throw new HttpError(400, "Choose a role.");
  return v as Role;
}

/** A tenant must be linked to a renter record; anyone else must not be. */
export async function validRenter(sb: SupabaseClient, role: Role, renterId: unknown): Promise<string | null> {
  if (role !== "tenant") return null;
  if (typeof renterId !== "string" || !renterId) throw new HttpError(400, "Choose which renter this tenant is.");
  const { data } = await sb.from("renters").select("id").eq("id", renterId).maybeSingle();
  if (!data) throw new HttpError(400, "That renter no longer exists.");
  return renterId;
}

export async function listUsers(sb: SupabaseClient): Promise<AdminUser[]> {
  const { data: profiles, error } = await sb.from("profiles").select("*").order("created_at");
  if (error) throw error;
  const signIns = new Map<string, string | null>();
  for (let page = 1; ; page++) {
    const { data, error: e } = await sb.auth.admin.listUsers({ page, perPage: 1000 });
    if (e) throw e;
    data.users.forEach((u) => signIns.set(u.id, u.last_sign_in_at ?? null));
    if (data.users.length < 1000) break;
  }
  return (profiles as Profile[]).map((p) => ({ ...p, last_sign_in_at: signIns.get(p.id) ?? null }));
}
