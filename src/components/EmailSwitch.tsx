"use client";

import { useState } from "react";
import { useStore } from "@/lib/store";
import { setMyRequestEmails } from "@/lib/notify";

/** "Email me about requests" on/off. Hidden until the email database update (0007) has been run. */
export function EmailSwitch({ label }: { label: string }) {
  const s = useStore();
  const [busy, setBusy] = useState(false);
  const on = s.profile?.notify_email;
  if (on === undefined) return null;
  return (
    <label className="emailswitch small" title="You can change this any time">
      <input type="checkbox" id="email-switch" checked={on} disabled={busy}
        onChange={async (e) => {
          setBusy(true);
          const ok = await setMyRequestEmails(e.target.checked);
          await s.reloadProfile();
          setBusy(false);
          s.toast(ok ? (e.target.checked ? "Request emails on" : "Request emails off") : "Couldn't save. Try again.");
        }} />
      <span>{label}</span>
    </label>
  );
}
