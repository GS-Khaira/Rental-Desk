// Sends a request notification email. Called by the app right after someone sends a
// message on a tenant request, or changes a request's status.
//
// The caller must be signed in and part of the request: the tenant who owns it, its
// manager, or an admin. Each message and each status change is emailed at most once
// (request_messages.emailed_at, tenant_requests.status_emailed), so calling this
// again does nothing. Anyone with request emails switched off, or with access
// switched off, gets nothing.
//
// Settings (Vercel → Environment Variables):
//   SMTP_USER, SMTP_PASSWORD   the sending Gmail address and its app password (required)
//   SMTP_HOST, SMTP_PORT       defaults smtp.gmail.com and 465 (change to move to Resend etc.)
//   MAIL_FROM_NAME             default "Kueppers Property Services"
//   APP_URL                    default: the Vercel production address
import nodemailer from "nodemailer";
import { adminClient, handle, HttpError } from "@/lib/server/admin";
import { buildRequestEmail, type EmailEvent } from "@/lib/server/requestEmail";

interface Person { id: string; email: string | null; full_name: string | null; role: string; active: boolean; notify_email?: boolean }

function mailer() {
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASSWORD;
  if (!user || !pass) throw new HttpError(503, "Email isn't set up: add SMTP_USER and SMTP_PASSWORD in Vercel.");
  const port = Number(process.env.SMTP_PORT || 465);
  const transport = nodemailer.createTransport({
    host: process.env.SMTP_HOST || "smtp.gmail.com", port, secure: port === 465, auth: { user, pass: pass.replace(/\s+/g, "") },
  });
  return { transport, from: `"${process.env.MAIL_FROM_NAME || "Kueppers Property Services"}" <${user}>` };
}

function appUrl(req: Request) {
  const fromEnv = process.env.APP_URL || (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "");
  return (fromEnv || new URL(req.url).origin).replace(/\/$/, "");
}

export async function POST(req: Request) {
  return handle(async () => {
    const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
    if (!token) throw new HttpError(401, "Sign in again.");
    const sb = adminClient();
    const { data: who, error: authErr } = await sb.auth.getUser(token);
    if (authErr || !who.user) throw new HttpError(401, "Sign in again.");
    const me = who.user.id;

    const body = await req.json().catch(() => ({}));
    const requestId = typeof body.requestId === "string" ? body.requestId : "";
    const what = body.event === "status" ? "status" : "message";

    const { data: request } = await sb.from("tenant_requests").select("*").eq("id", requestId).maybeSingle();
    if (!request) throw new HttpError(404, "Request not found.");

    const ids = [me, request.tenant_id, request.user_id];
    const { data: people } = await sb.from("profiles").select("id, email, full_name, role, active, notify_email").in("id", ids);
    const byId = new Map((people as Person[] ?? []).map((p) => [p.id, p]));
    const caller = byId.get(me);
    if (!caller?.active) throw new HttpError(403, "Your access is switched off.");
    const callerIsTenant = me === request.tenant_id;
    const callerIsStaff = caller.role === "admin" || (caller.role === "manager" && request.user_id === me);
    if (!callerIsTenant && !callerIsStaff) throw new HttpError(403, "That isn't your request.");

    let event: EmailEvent;
    let recipientId: string;
    let message: string | null = null;
    let markSent: () => PromiseLike<unknown>;

    if (what === "message") {
      // The newest message the caller wrote on this request that hasn't been emailed yet.
      const { data: msg } = await sb.from("request_messages").select("id, body, created_at")
        .eq("request_id", request.id).eq("author_id", me).is("emailed_at", null)
        .order("created_at", { ascending: false }).limit(1).maybeSingle();
      if (!msg) return Response.json({ sent: false, reason: "nothing new" });
      const { count } = await sb.from("request_messages").select("id", { count: "exact", head: true }).eq("request_id", request.id);
      event = callerIsTenant ? { kind: (count ?? 0) <= 1 ? "new_request" : "tenant_reply" } : { kind: "staff_reply" };
      recipientId = callerIsTenant ? request.user_id : request.tenant_id;
      message = msg.body;
      markSent = () => sb.from("request_messages").update({ emailed_at: new Date().toISOString() }).eq("request_id", request.id).eq("author_id", me).is("emailed_at", null);
    } else {
      if (!callerIsStaff) throw new HttpError(403, "Only staff change a request's status.");
      if (!["In progress", "Resolved"].includes(request.status) || request.status_emailed === request.status) {
        return Response.json({ sent: false, reason: "nothing new" });
      }
      event = { kind: "status", status: request.status };
      recipientId = request.tenant_id;
      markSent = () => sb.from("tenant_requests").update({ status_emailed: request.status }).eq("id", request.id);
    }

    const recipient = byId.get(recipientId);
    if (!recipient?.email || !recipient.active || recipient.notify_email === false || recipientId === me) {
      await markSent(); // nothing to send now, and don't send it later either
      return Response.json({ sent: false, reason: "recipient has emails off or no address" });
    }

    // Names for the email: the renter's name and where they live.
    const [{ data: renter }, { data: unit }] = await Promise.all([
      request.renter_id ? sb.from("renters").select("name").eq("id", request.renter_id).maybeSingle() : Promise.resolve({ data: null }),
      request.unit_id ? sb.from("units").select("label, property_id").eq("id", request.unit_id).maybeSingle() : Promise.resolve({ data: null }),
    ]);
    const { data: property } = unit?.property_id
      ? await sb.from("properties").select("address").eq("id", unit.property_id).maybeSingle()
      : { data: null };
    const place = [property?.address, unit?.label].filter(Boolean).join(" · ");
    const tenantName = renter?.name || byId.get(request.tenant_id)?.full_name || "Your tenant";
    const base = appUrl(req);

    const email = buildRequestEmail({
      event, subject: request.subject, category: request.category, tenantName, place, message,
      link: recipient.role === "tenant" ? `${base}/` : `${base}/#requests`,
      recipientName: recipient.full_name || recipient.email,
    });

    const { transport, from } = mailer();
    await transport.sendMail({ from, to: recipient.email, subject: email.subject, text: email.text, html: email.html });
    await markSent();
    return Response.json({ sent: true });
  });
}
