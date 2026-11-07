// Admin only: list users, and add a new user with a temporary password.
import { cleanText, handle, HttpError, listUsers, requireAdmin, tempPassword, validEmail, validRenter, validRole } from "@/lib/server/admin";

export async function GET(req: Request) {
  return handle(async () => {
    const { sb } = await requireAdmin(req);
    return Response.json({ users: await listUsers(sb) });
  });
}

export async function POST(req: Request) {
  return handle(async () => {
    const { sb } = await requireAdmin(req);
    const body = await req.json().catch(() => ({}));
    const email = validEmail(body.email);
    const role = validRole(body.role);
    const full_name = cleanText(body.full_name);
    if (!full_name) throw new HttpError(400, "Enter the person's name.");
    const phone = cleanText(body.phone, 40);
    const renter_id = await validRenter(sb, role, body.renter_id);
    const password = tempPassword();

    const { data, error } = await sb.auth.admin.createUser({
      email, password, email_confirm: true,
      app_metadata: { role }, user_metadata: { full_name },
    });
    if (error || !data.user) {
      if (error && /already|exists|registered/i.test(error.message)) throw new HttpError(409, "That email already has an account.");
      throw new HttpError(400, error?.message ?? "Couldn't create the account.");
    }

    const { error: pe } = await sb.from("profiles").upsert({
      id: data.user.id, email, full_name, phone, role, renter_id, active: true, must_change_password: true,
    });
    if (pe) {
      await sb.auth.admin.deleteUser(data.user.id); // don't leave a half-made account behind
      throw pe;
    }
    return Response.json({ id: data.user.id, tempPassword: password }, { status: 201 });
  });
}
