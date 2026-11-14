// Builds the request notification emails. Pure: no imports, so it's unit tested directly
// (tests/requestEmail.test.ts). The route in src/app/api/notify decides who gets one.

export type EmailEvent =
  | { kind: "new_request" }      // a tenant opened a request → their manager
  | { kind: "tenant_reply" }     // a tenant wrote on an existing request → their manager
  | { kind: "staff_reply" }      // the manager (or an admin) replied → the tenant
  | { kind: "status"; status: string }; // the request moved to In progress / Resolved → the tenant

export interface EmailInput {
  event: EmailEvent;
  subject: string;           // the request's short summary
  category: string;
  tenantName: string;
  place: string;             // "18 Water St · Unit A", or "" if unknown
  message: string | null;    // the new message's text (null for status changes)
  link: string;              // where the button goes
  recipientName: string;
}

export interface Email { subject: string; text: string; html: string }

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
const clip = (s: string, n = 600) => (s.length > n ? s.slice(0, n).trimEnd() + "…" : s);
const firstName = (s: string) => s.trim().split(/\s+/)[0] || "there";

export function buildRequestEmail(i: EmailInput): Email {
  const where = i.place ? ` (${i.place})` : "";
  const msg = i.message ? clip(i.message.trim()) : null;
  let subject: string;
  let intro: string;
  let button: string;

  switch (i.event.kind) {
    case "new_request":
      subject = `New request: ${i.subject}${where}`;
      intro = `${i.tenantName} sent a new ${i.category.toLowerCase()} request${i.place ? ` about ${i.place}` : ""}.`;
      button = "Open the request";
      break;
    case "tenant_reply":
      subject = `${i.tenantName} replied: ${i.subject}`;
      intro = `${i.tenantName} added a message to their request "${i.subject}"${i.place ? ` (${i.place})` : ""}.`;
      button = "Reply in the app";
      break;
    case "staff_reply":
      subject = `Reply to your request: ${i.subject}`;
      intro = `Your property manager replied to your request "${i.subject}".`;
      button = "See the reply";
      break;
    case "status": {
      const s = i.event.status;
      subject = s === "Resolved" ? `Your request is resolved: ${i.subject}` : `Your request is ${s.toLowerCase()}: ${i.subject}`;
      intro = s === "Resolved"
        ? `Your property manager marked your request "${i.subject}" as resolved. If something still isn't right, reply in the app and it will reopen.`
        : `Your property manager is working on your request "${i.subject}".`;
      button = "Open your portal";
      break;
    }
  }

  const footer = "You're getting this because of a request in the Kueppers Property Services rental desk. You can turn these emails off in the app.";
  const text = [
    `Hi ${firstName(i.recipientName)},`, "", intro,
    ...(msg ? ["", `"${msg}"`] : []),
    "", `${button}: ${i.link}`, "", "Kueppers Property Services", "", footer,
  ].join("\n");

  const html = `<!doctype html><html><body style="margin:0;background:#f3f6f7;font-family:Arial,Helvetica,sans-serif;color:#13242f">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f3f6f7;padding:24px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border:1px solid #d3dde1;border-radius:12px">
<tr><td style="background:#0e6772;color:#ffffff;padding:14px 22px;border-radius:12px 12px 0 0;font-weight:bold;font-size:15px">Kueppers Property Services</td></tr>
<tr><td style="padding:22px">
<p style="margin:0 0 12px;font-size:15px">Hi ${esc(firstName(i.recipientName))},</p>
<p style="margin:0 0 14px;font-size:15px;line-height:1.5">${esc(intro)}</p>
${msg ? `<div style="margin:0 0 16px;padding:12px 14px;background:#f3f6f7;border-left:3px solid #0e6772;border-radius:4px;font-size:14px;line-height:1.5;white-space:pre-wrap">${esc(msg)}</div>` : ""}
<a href="${esc(i.link)}" style="display:inline-block;background:#0e6772;color:#ffffff;text-decoration:none;padding:11px 18px;border-radius:8px;font-weight:bold;font-size:14px">${esc(button)}</a>
</td></tr>
<tr><td style="padding:14px 22px;border-top:1px solid #d3dde1;color:#5a6d77;font-size:12px;line-height:1.4">${esc(footer)}</td></tr>
</table></td></tr></table></body></html>`;

  return { subject, text, html };
}
