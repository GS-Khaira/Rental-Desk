"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useStore } from "@/lib/store";
import { adminApi, type UserInput } from "@/lib/adminApi";
import { ROLE_INFO, ROLES, initials } from "@/lib/roles";
import type { AdminUser, Role } from "@/lib/types";
import { when } from "./Requests";
import { ConfirmButton, Empty, KV } from "./ui";

/* ---------------- shared bits ---------------- */
const RolePill = ({ role }: { role: Role }) => <span className={`pill role-${role}`}>{ROLE_INFO[role].label}</span>;

function Avatar({ u }: { u: Pick<AdminUser, "full_name" | "email" | "role"> }) {
  return <span className={`avatar role-${u.role}`} aria-hidden="true">{initials(u.full_name, u.email)}</span>;
}

function RolePicker({ value, onChange, disabled }: { value: Role; onChange: (r: Role) => void; disabled?: boolean }) {
  return (
    <div className="rolepick" role="radiogroup" aria-label="Role">
      {ROLES.map((r) => (
        <label key={r} className={`rolecard ${value === r ? "on" : ""} ${disabled ? "disabled" : ""}`}>
          <input type="radio" name="role" value={r} checked={value === r} disabled={disabled} onChange={() => onChange(r)} />
          <b>{ROLE_INFO[r].label}</b>
          <span className="muted small">{ROLE_INFO[r].summary}</span>
        </label>
      ))}
    </div>
  );
}

/** Renters an admin can link a tenant login to, with their current unit. */
function useRenterOptions(users: AdminUser[], currentUserId?: string) {
  const s = useStore();
  return useMemo(() => {
    const linked = new Map(users.filter((u) => u.renter_id && u.id !== currentUserId).map((u) => [u.renter_id!, u]));
    return [...s.allData.renters].sort((a, b) => a.name.localeCompare(b.name)).map((r) => {
      const t = s.allData.tenancies.find((x) => x.renter_id === r.id && !x.move_out);
      const unit = t && s.allData.units.find((u) => u.id === t.unit_id);
      const prop = unit && s.allData.properties.find((p) => p.id === unit.property_id);
      const where = prop ? `${prop.address}${unit?.label ? " · " + unit.label : ""}` : "no current rental";
      const taken = linked.get(r.id);
      return { id: r.id, label: `${r.name} — ${where}${taken ? " (already has a login)" : ""}`, disabled: Boolean(taken), current: Boolean(t), renter: r };
    });
  }, [s.allData, users, currentUserId]);
}

function TempPassword({ name, email, password, onDone }: { name: string; email: string; password: string; onDone?: () => void }) {
  const { toast } = useStore();
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const message =
    `Hi ${name.split(" ")[0]}, you now have access to Kueppers Property Services.\n\n` +
    `Sign in at: ${origin}\nEmail: ${email}\nTemporary password: ${password}\n\n` +
    `You'll be asked to choose your own password when you first sign in.`;
  const copy = async (text: string, what: string) => {
    try { await navigator.clipboard.writeText(text); toast(`${what} copied`); } catch { toast("Couldn't copy. Select the text and copy it instead."); }
  };
  return (
    <div className="temppw">
      <div className="label">Temporary password</div>
      <div className="row between" style={{ flexWrap: "nowrap" }}>
        <code className="pw">{password}</code>
        <button className="btn small" type="button" onClick={() => copy(password, "Password")}>Copy</button>
      </div>
      <p className="small muted" style={{ margin: "4px 0 0" }}>
        This is the only time it&apos;s shown. Send it to {name.split(" ")[0]} privately, for example by text. They&apos;ll choose their own password when they first sign in.
      </p>
      <textarea readOnly className="msg" value={message} aria-label="Message to send" onFocus={(e) => e.currentTarget.select()} />
      <div className="row" style={{ justifyContent: "flex-end" }}>
        <button className="btn small" type="button" onClick={() => copy(message, "Message")}>Copy message</button>
        {onDone && <button className="btn small primary" type="button" onClick={onDone}>Done</button>}
      </div>
    </div>
  );
}

/* ---------------- add a user ---------------- */
function AddUser({ users, onClose, onCreated }: { users: AdminUser[]; onClose: () => void; onCreated: () => void }) {
  const s = useStore();
  const draft = s.userDraft;
  const [role, setRole] = useState<Role>(draft?.role ?? "manager");
  const [fullName, setFullName] = useState(draft?.full_name ?? "");
  const [email, setEmail] = useState(draft?.email ?? "");
  const [phone, setPhone] = useState(draft?.phone ?? "");
  const [renterId, setRenterId] = useState(draft?.renter_id ?? "");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<{ password: string } | null>(null);
  const renters = useRenterOptions(users);

  const pickRenter = (id: string) => {
    setRenterId(id);
    const r = renters.find((x) => x.id === id)?.renter;
    if (r) { if (!fullName) setFullName(r.name); if (!email && r.email) setEmail(r.email); if (!phone && r.phone) setPhone(r.phone); }
  };

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!fullName.trim()) return setErr("Enter the person's name.");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return setErr("Enter a valid email address. They'll use it to sign in.");
    if (role === "tenant" && !renterId) return setErr("Choose which renter this tenant is, so they see the right home.");
    setBusy(true); setErr(null);
    try {
      const res = await adminApi.create({ full_name: fullName.trim(), email: email.trim(), phone: phone.trim() || null, role, renter_id: role === "tenant" ? renterId : null });
      setDone({ password: res.tempPassword });
      onCreated();
    } catch (e2) {
      setErr((e2 as Error).message);
    } finally { setBusy(false); }
  }

  return (
    <>
      <div className="scrim" onClick={done ? undefined : onClose} />
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="adduser-title">
        <div className="box wide">
          <div className="row between">
            <h2 id="adduser-title">{done ? "Account created" : "Add a user"}</h2>
            {!done && <button className="btn small" type="button" onClick={onClose}>Cancel</button>}
          </div>
          {done ? (
            <div className="stack" style={{ marginTop: 12 }}>
              <p style={{ margin: 0 }}><b>{fullName}</b> can now sign in as <RolePill role={role} />.</p>
              <TempPassword name={fullName} email={email.trim()} password={done.password} onDone={onClose} />
            </div>
          ) : (
            <form className="f" onSubmit={submit} noValidate>
              <div className="fld"><span>What should they be able to do?</span><RolePicker value={role} onChange={setRole} /></div>
              {role === "tenant" && (
                <label className="fld" htmlFor="nu-renter">
                  <span>Which renter is this?</span>
                  <select id="nu-renter" value={renterId} onChange={(e) => pickRenter(e.target.value)}>
                    <option value="" disabled>Choose a renter…</option>
                    {renters.map((o) => <option key={o.id} value={o.id} disabled={o.disabled}>{o.label}</option>)}
                  </select>
                  {renterId && !renters.find((o) => o.id === renterId)?.current
                    ? <span className="err">This renter has no current rental, so their portal will be empty. Record their move-in first, or create the login now and they&apos;ll see their home once it&apos;s recorded.</span>
                    : <span className="hint">They&apos;ll see the unit this renter currently rents.</span>}
                </label>
              )}
              <label className="fld" htmlFor="nu-name"><span>Full name</span><input id="nu-name" value={fullName} onChange={(e) => setFullName(e.target.value)} autoComplete="off" /></label>
              <div className="two">
                <label className="fld" htmlFor="nu-email"><span>Email (they sign in with this)</span><input id="nu-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="off" /></label>
                <label className="fld" htmlFor="nu-phone"><span>Phone <span className="muted" style={{ fontWeight: 400 }}>(optional)</span></span><input id="nu-phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} /></label>
              </div>
              {role === "manager" && <p className="hint" style={{ margin: 0 }}>Tenants see a manager&apos;s name, phone and email as their contact.</p>}
              {err && <div className="err">{err}</div>}
              <div className="row" style={{ justifyContent: "flex-end" }}>
                <button className="btn primary" type="submit" disabled={busy}>{busy ? "Creating…" : "Create account"}</button>
              </div>
            </form>
          )}
        </div>
      </div>
    </>
  );
}

/* ---------------- one user ---------------- */
function UserSheet({ u, users, onClose, onChanged }: { u: AdminUser; users: AdminUser[]; onClose: () => void; onChanged: () => Promise<void> }) {
  const s = useStore();
  const self = u.id === s.session?.user.id;
  const [form, setForm] = useState<UserInput>({ full_name: u.full_name ?? "", phone: u.phone ?? "", role: u.role, renter_id: u.renter_id });
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [newPw, setNewPw] = useState<string | null>(null);
  const renters = useRenterOptions(users, u.id);
  const dirty = form.full_name !== (u.full_name ?? "") || (form.phone ?? "") !== (u.phone ?? "") || form.role !== u.role || (form.role === "tenant" && form.renter_id !== u.renter_id);
  const linked = u.renter_id ? s.allData.renters.find((r) => r.id === u.renter_id) : undefined;

  async function run(fn: () => Promise<unknown>, okMsg: string) {
    setBusy(true); setErr(null);
    try { await fn(); s.toast(okMsg); await onChanged(); } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  }

  return (
    <>
      <div className="scrim" onClick={onClose} />
      <aside className="sheet" role="dialog" aria-modal="true" aria-label={`User ${u.full_name ?? u.email}`}>
        <div className="head">
          <div className="row" style={{ flexWrap: "nowrap", minWidth: 0 }}>
            <Avatar u={u} />
            <div style={{ minWidth: 0 }}>
              <h2>{u.full_name || u.email}{self && <span className="muted" style={{ fontWeight: 500 }}> (you)</span>}</h2>
              <div className="mono muted small">{u.email}</div>
            </div>
          </div>
          <button className="btn small" type="button" onClick={onClose}>Close</button>
        </div>
        <div className="row" style={{ marginBottom: 12 }}>
          <RolePill role={u.role} />
          {!u.active ? <span className="pill p-no">Access off</span> : u.must_change_password ? <span className="pill p-warn">Hasn&apos;t set own password yet</span> : <span className="pill p-ok">Active</span>}
        </div>
        {err && <div className="banner info" style={{ marginBottom: 12 }}><span>{err}</span></div>}
        {newPw && <div className="sec"><TempPassword name={u.full_name || "there"} email={u.email ?? ""} password={newPw} onDone={() => setNewPw(null)} /></div>}

        <form className="sec f" style={{ marginTop: 0 }} onSubmit={(e) => { e.preventDefault(); run(() => adminApi.update(u.id, { ...form, renter_id: form.role === "tenant" ? form.renter_id : null }), "Saved"); }}>
          <h3>Details and role</h3>
          <label className="fld" htmlFor="eu-name"><span>Full name</span><input id="eu-name" value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} /></label>
          <label className="fld" htmlFor="eu-phone"><span>Phone</span><input id="eu-phone" type="tel" value={form.phone ?? ""} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></label>
          <div className="fld"><span>Role</span>
            <RolePicker value={form.role} onChange={(role) => setForm({ ...form, role })} disabled={self} />
            {self && <span className="hint">You can&apos;t change your own role. Another admin can.</span>}
          </div>
          {form.role === "tenant" && (
            <label className="fld" htmlFor="eu-renter"><span>Renter</span>
              <select id="eu-renter" value={form.renter_id ?? ""} onChange={(e) => setForm({ ...form, renter_id: e.target.value || null })}>
                <option value="" disabled>Choose a renter…</option>
                {renters.map((o) => <option key={o.id} value={o.id} disabled={o.disabled}>{o.label}</option>)}
              </select>
            </label>
          )}
          <div className="row" style={{ justifyContent: "flex-end" }}>
            <button className="btn primary small" type="submit" disabled={!dirty || busy}>Save changes</button>
          </div>
        </form>

        <div className="sec">
          <h3>Sign-in</h3>
          <KV rows={[
            ["Last signed in", u.last_sign_in_at ? when(u.last_sign_in_at) : "Never"],
            ["Added", u.created_at ? when(u.created_at) : null],
            ["Linked renter", u.role === "tenant" ? (linked ? linked.name : "None") : null],
          ]} />
          <div className="row" style={{ marginTop: 10 }}>
            <button className="btn small" type="button" disabled={busy} onClick={() => run(async () => setNewPw((await adminApi.resetPassword(u.id)).tempPassword), "New temporary password made")}>
              Make a new temporary password
            </button>
          </div>
          <p className="hint" style={{ margin: "6px 0 0" }}>Use this if they forget their password. Their old password stops working.</p>
        </div>

        <div className="sec">
          <h3>Access</h3>
          {u.active ? (
            <>
              <p className="muted small" style={{ margin: "4px 0 10px" }}>Switching access off signs them out and stops them signing in. Their records and history stay.</p>
              {self ? <span className="hint">You can&apos;t switch off your own access.</span>
                : <ConfirmButton label="Switch off access" onConfirm={() => run(() => adminApi.deactivate(u.id), "Access switched off")} />}
            </>
          ) : (
            <>
              <p className="muted small" style={{ margin: "4px 0 10px" }}>They can&apos;t sign in. Switch access back on to let them in again with their current password.</p>
              <button className="btn small primary" type="button" disabled={busy} onClick={() => run(() => adminApi.reactivate(u.id), "Access switched on")}>Switch access on</button>
            </>
          )}
        </div>
      </aside>
    </>
  );
}

/* ---------------- the page ---------------- */
export function UsersView() {
  const s = useStore();
  const [users, setUsers] = useState<AdminUser[] | null>(null);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [roleFilter, setRoleFilter] = useState<Role | "">("");
  const [status, setStatus] = useState<"active" | "off" | "">("active");
  const [q, setQ] = useState("");
  const [adding, setAdding] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);

  const [tick, setTick] = useState(0);
  const load = useCallback(() => setTick((t) => t + 1), []);
  useEffect(() => {
    if (!s.rolesReady) return;
    let live = true;
    adminApi.list().then(
      (u) => { if (live) { setUsers(u); setLoadErr(null); } },
      (e: Error) => { if (live) setLoadErr(e.message); },
    );
    return () => { live = false; };
  }, [s.rolesReady, tick]);
  // "Give portal access" on a renter opens this page with the form already started.
  const showAdd = adding || Boolean(s.userDraft);
  const closeAdd = () => { setAdding(false); s.setUserDraft(null); };
  const changed = async () => { load(); await s.reloadProfiles(); };

  if (!s.rolesReady) {
    return (
      <>
        <div className="pagehead"><div><h1>Users &amp; access</h1></div></div>
        <Empty title="One database update needed">
          Run <code>supabase/migrations/0003_roles_and_requests.sql</code> in the Supabase SQL Editor, then reload this page.
        </Empty>
      </>
    );
  }

  const all = users ?? [];
  const count = (r: Role) => all.filter((u) => u.role === r && u.active).length;
  let list = all;
  if (roleFilter) list = list.filter((u) => u.role === roleFilter);
  if (status) list = list.filter((u) => (status === "active" ? u.active : !u.active));
  if (q) { const t = q.toLowerCase(); list = list.filter((u) => [u.full_name, u.email, u.phone].join(" ").toLowerCase().includes(t)); }
  list = [...list].sort((a, b) => ROLES.indexOf(a.role) - ROLES.indexOf(b.role) || (a.full_name ?? a.email ?? "").localeCompare(b.full_name ?? b.email ?? ""));
  const open = all.find((u) => u.id === openId);
  const renterName = (id: string | null) => (id ? s.allData.renters.find((r) => r.id === id)?.name : undefined);

  return (
    <>
      <div className="pagehead">
        <div><div className="label">{all.filter((u) => u.active).length} people with access</div><h1>Users &amp; access</h1></div>
        <button className="btn primary" type="button" onClick={() => setAdding(true)} disabled={Boolean(loadErr)}>+ Add user</button>
      </div>

      {loadErr && (
        <div className="banner info"><span>{loadErr.includes("SUPABASE_SECRET_KEY")
          ? <>User management needs one more setting: add <code>SUPABASE_SECRET_KEY</code> in Vercel → Settings → Environment Variables, then redeploy.</>
          : loadErr}</span><button className="btn small" type="button" onClick={load}>Try again</button></div>
      )}

      <div className="rolesum">
        {ROLES.map((r) => (
          <button key={r} type="button" className={`stat ${roleFilter === r ? "on" : ""}`} aria-pressed={roleFilter === r} onClick={() => setRoleFilter(roleFilter === r ? "" : r)}>
            <div className="label">{ROLE_INFO[r].plural}</div>
            <div className="n num">{users ? count(r) : "–"}</div>
            <div className="muted small">{ROLE_INFO[r].summary}</div>
          </button>
        ))}
      </div>

      <details className="panel access">
        <summary>What each role can see and do</summary>
        <div className="accessgrid">
          {ROLES.map((r) => (
            <div key={r}>
              <RolePill role={r} />
              <ul>{ROLE_INFO[r].can.map((c) => <li key={c}>{c}</li>)}{ROLE_INFO[r].cannot.map((c) => <li key={c} className="no">Can&apos;t {c.charAt(0).toLowerCase() + c.slice(1)}</li>)}</ul>
            </div>
          ))}
        </div>
      </details>

      <div className="filters">
        <input type="search" placeholder="Search name, email, phone" aria-label="Search users" value={q} onChange={(e) => setQ(e.target.value)} />
        <select aria-label="Role" value={roleFilter} onChange={(e) => setRoleFilter(e.target.value as Role | "")}>
          <option value="">All roles</option>{ROLES.map((r) => <option key={r} value={r}>{ROLE_INFO[r].plural}</option>)}
        </select>
        <select aria-label="Access" value={status} onChange={(e) => setStatus(e.target.value as typeof status)}>
          <option value="active">Access on</option><option value="off">Access off</option><option value="">Everyone</option>
        </select>
      </div>

      {users === null && !loadErr ? <div className="empty"><b>Loading users…</b></div> : list.length ? (
        <div className="rows">
          {list.map((u) => (
            <button key={u.id} type="button" className={`rowcard user ${u.active ? "" : "inactive"}`} onClick={() => setOpenId(u.id)}>
              <Avatar u={u} />
              <div style={{ minWidth: 0 }}>
                <div className="t">{u.full_name || u.email}{u.id === s.session?.user.id && <span className="muted" style={{ fontWeight: 500 }}> (you)</span>}</div>
                <div className="muted small mono ellipsis">{u.email}</div>
                {u.role === "tenant" && <div className="muted small">{renterName(u.renter_id) ? `Renter: ${renterName(u.renter_id)}` : "No renter linked"}</div>}
              </div>
              <div className="userside">
                <RolePill role={u.role} />
                {!u.active ? <span className="pill p-no">Access off</span> : u.must_change_password ? <span className="pill p-warn">Temp password</span> : null}
                <span className="muted small nowrap">{u.last_sign_in_at ? `Seen ${when(u.last_sign_in_at)}` : "Never signed in"}</span>
              </div>
            </button>
          ))}
        </div>
      ) : users ? <Empty title="No users match">Change the filters above.</Empty> : null}

      {showAdd && <AddUser users={all} onClose={closeAdd} onCreated={changed} />}
      {open && <UserSheet key={open.id + open.role + open.active} u={open} users={all} onClose={() => setOpenId(null)} onChanged={changed} />}
    </>
  );
}
