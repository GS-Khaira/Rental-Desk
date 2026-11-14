// Ask the app's server to email the other side of a tenant request. Fire-and-forget:
// a failed email never blocks or undoes the message itself.
import { supabase } from "./supabase";

/** Switch your own request emails on or off. */
export async function setMyRequestEmails(on: boolean): Promise<boolean> {
  const { error } = await supabase().rpc("set_my_email_notifications", { p_on: on });
  return !error;
}

export async function notifyRequest(requestId: string, event: "message" | "status"): Promise<void> {
  try {
    const { data } = await supabase().auth.getSession();
    const token = data.session?.access_token;
    if (!token) return;
    const res = await fetch("/api/notify", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ requestId, event }),
    });
    if (!res.ok) console.warn("Request email not sent:", (await res.json().catch(() => ({}))).error ?? res.status);
  } catch (e) {
    console.warn("Request email not sent:", e);
  }
}
