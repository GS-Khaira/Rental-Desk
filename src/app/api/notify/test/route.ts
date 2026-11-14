// Admin only: "Send test email". Checks the email settings, sends a test email to the
// admin, and inspects the most recent tenant request to show why it was or wasn't emailed.
// Never returns a password or key, only whether each one is set.
import { handle, requireAdmin } from "@/lib/server/admin";
import { appUrl, explainMailError, mailer, maskEmail, smtpHost, smtpPassword, smtpPort } from "@/lib/server/mailer";

interface Check { label: string; ok: boolean | null; detail: string }

export async function POST(req: Request) {
  return handle(async () => {
    const { sb, adminId } = await requireAdmin(req); // also proves SUPABASE_SECRET_KEY works
    const checks: Check[] = [];
    const add = (label: string, ok: boolean | null, detail: string) => checks.push({ label, ok, detail });

    add("Supabase secret key", true, "Set and working.");

    const user = (process.env.SMTP_USER || "").trim();
    const pass = smtpPassword();
    add("SMTP_USER", Boolean(user) && /@/.test(user), user ? `Set to ${maskEmail(user)}.` : "Missing. Add the Gmail address in Vercel, then redeploy.");
    add("SMTP_PASSWORD", pass.length === 16,
      !pass ? "Missing. Add the Gmail app password in Vercel, then redeploy."
        : pass.length === 16 ? "Set (16 letters, as expected for a Gmail app password)."
        : `Set, but it's ${pass.length} characters. Gmail app passwords are 16 letters, so this may be the normal Gmail password.`);
    add("Mail server", null, `${smtpHost()} on port ${smtpPort()}.`);
    add("Link in emails", null, appUrl(req));

    // Send a test email to the admin.
    const { data: me } = await sb.from("profiles").select("email").eq("id", adminId).maybeSingle();
    const { data: authUser } = await sb.auth.admin.getUserById(adminId);
    const to = me?.email || authUser.user?.email;
    if (user && pass && to) {
      try {
        const { transport, from } = mailer();
        await transport.sendMail({
          from, to, subject: "Test email from Kueppers Rental Desk",
          text: "This is a test. If you can read it, request emails can be sent.\n\nKueppers Property Services",
        });
        add("Test email", true, `Sent to ${to}. Check that inbox, and its spam folder.`);
      } catch (e) {
        add("Test email", false, explainMailError(e, `${smtpHost()}:${smtpPort()}`));
      }
    } else {
      add("Test email", false, to ? "Not tried: the email settings above are missing." : "Not tried: your profile has no email address.");
    }

    // Look at the most recent tenant request: who should have been emailed, and what happened.
    const { data: last } = await sb.from("tenant_requests").select("id, subject, user_id, tenant_id, created_at").order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (!last) {
      add("Latest request", null, "No tenant requests yet.");
    } else {
      const { data: mgr } = await sb.from("profiles").select("full_name, email, active, notify_email, role").eq("id", last.user_id).maybeSingle();
      const { data: firstMsg } = await sb.from("request_messages").select("emailed_at, author_id").eq("request_id", last.id).order("created_at").limit(1).maybeSingle();
      const name = mgr?.full_name || mgr?.email || "unknown";
      add("Latest request", null, `"${last.subject}" goes to its manager: ${name}${mgr?.email ? ` (${mgr.email})` : ""}.`);
      if (!mgr?.email) add("Manager's email", false, "That manager's profile has no email address, so they can't be emailed. Add one on the Users page.");
      else if (!mgr.active) add("Manager's access", false, "That manager's access is switched off, so they aren't emailed.");
      else if (mgr.notify_email === false) add("Manager's switch", false, "That manager has \"Email me about tenant requests\" switched off.");
      if (firstMsg && firstMsg.author_id === last.tenant_id) {
        add("Email for that request", firstMsg.emailed_at ? true : false, firstMsg.emailed_at
          ? `Handled at ${new Date(firstMsg.emailed_at).toLocaleString("en-CA", { timeZone: "America/Halifax" })} (Atlantic). If the manager's details above are fine, look in their spam folder.`
          : "Not sent. The app either didn't ask the server to send it, or sending failed. If the test email above worked, send a new request to try again.");
      }
    }
    return Response.json({ checks });
  });
}
