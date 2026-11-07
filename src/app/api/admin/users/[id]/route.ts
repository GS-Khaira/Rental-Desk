// Admin only: change one user's details or role, reset their password, or switch their access off/on.
// Users are never deleted here: their records would be deleted with them. Switching access off keeps the history.
import type { NextRequest } from "next/server";
import { cleanText, handle, HttpError, requireAdmin, tempPassword, validRenter, validRole } from "@/lib/server/admin";

const FOREVER = "876000h"; // ~100 years: Supabase's way to block sign-in

export async function PATCH(req: NextRequest, ctx: RouteContext<"/api/admin/users/[id]">) {
  return handle(async () => {
    const { sb, adminId } = await requireAdmin(req);
    const { id } = await ctx.params;
    const body = await req.json().catch(() => ({}));
    const { data: target } = await sb.from("profiles").select("*").eq("id", id).maybeSingle();
    if (!target) throw new HttpError(404, "That user no longer exists.");
    const self = id === adminId;

    switch (body.action) {
      case "update": {
        const role = validRole(body.role);
        if (self && role !== target.role) throw new HttpError(400, "You can't change your own role. Ask another admin.");
        const full_name = cleanText(body.full_name);
        if (!full_name) throw new HttpError(400, "Enter the person's name.");
        const renter_id = await validRenter(sb, role, body.renter_id);
        const { error } = await sb.from("profiles")
          .update({ full_name, phone: cleanText(body.phone, 40), role, renter_id })
          .eq("id", id);
        if (error) throw error;
        await sb.auth.admin.updateUserById(id, { app_metadata: { role }, user_metadata: { full_name } });
        return Response.json({ ok: true });
      }
      case "reset_password": {
        const password = tempPassword();
        const { error } = await sb.auth.admin.updateUserById(id, { password });
        if (error) throw new HttpError(400, error.message);
        await sb.from("profiles").update({ must_change_password: true }).eq("id", id);
        return Response.json({ tempPassword: password });
      }
      case "deactivate": {
        if (self) throw new HttpError(400, "You can't switch off your own access.");
        const { error } = await sb.from("profiles").update({ active: false }).eq("id", id); // last-admin guard runs here
        if (error) throw error;
        await sb.auth.admin.updateUserById(id, { ban_duration: FOREVER });
        return Response.json({ ok: true });
      }
      case "reactivate": {
        const { error } = await sb.from("profiles").update({ active: true }).eq("id", id);
        if (error) throw error;
        await sb.auth.admin.updateUserById(id, { ban_duration: "none" });
        return Response.json({ ok: true });
      }
      default:
        throw new HttpError(400, "Unknown action.");
    }
  });
}
