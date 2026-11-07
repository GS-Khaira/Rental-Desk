// Browser-side calls to the admin routes in src/app/api/admin. Each call sends the
// signed-in admin's token; the server checks it before doing anything.
import { supabase } from "./supabase";
import type { AdminUser, Role } from "./types";

async function call<T>(path: string, method: string, body?: unknown): Promise<T> {
  const { data } = await supabase().auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("Sign in again.");
  let res: Response;
  try {
    res = await fetch(path, {
      method,
      headers: { Authorization: `Bearer ${token}`, ...(body ? { "Content-Type": "application/json" } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new Error("Couldn't reach the app's server. Check your connection.");
  }
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error ?? "Something went wrong. Try again.");
  return json as T;
}

export interface UserInput { full_name: string; email?: string; phone: string | null; role: Role; renter_id: string | null }

export const adminApi = {
  list: () => call<{ users: AdminUser[] }>("/api/admin/users", "GET").then((r) => r.users),
  create: (u: UserInput & { email: string }) => call<{ id: string; tempPassword: string }>("/api/admin/users", "POST", u),
  update: (id: string, u: UserInput) => call<{ ok: true }>(`/api/admin/users/${id}`, "PATCH", { action: "update", ...u }),
  resetPassword: (id: string) => call<{ tempPassword: string }>(`/api/admin/users/${id}`, "PATCH", { action: "reset_password" }),
  deactivate: (id: string) => call<{ ok: true }>(`/api/admin/users/${id}`, "PATCH", { action: "deactivate" }),
  reactivate: (id: string) => call<{ ok: true }>(`/api/admin/users/${id}`, "PATCH", { action: "reactivate" }),
};
