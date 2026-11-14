// Plain-words explanations for email problems. Pure: no imports, so it's unit tested (tests/mailText.test.ts).

/** Turns a mail server error into a plain-words explanation of what to fix. */
export function explainMailError(e: unknown, host = "smtp.gmail.com:465"): string {
  const err = (e ?? {}) as { code?: string; command?: string; responseCode?: number; response?: string; message?: string };
  const raw = `${err.response ?? ""} ${err.message ?? ""}`;
  // A failure during the login step (including a server that stops answering mid-login) means the login was refused.
  if (err.code === "EAUTH" || err.responseCode === 535 || err.responseCode === 534 || /^AUTH/i.test(err.command ?? "") ||
      /Username and Password not accepted|BadCredentials|Application-specific password required/i.test(raw)) {
    return "Gmail rejected the login. Check that SMTP_USER is the full Gmail address and SMTP_PASSWORD is the 16-letter app password " +
      "(not the normal Gmail password). 2-Step Verification must be on for that account, and changing the Google password cancels " +
      "app passwords, so make a new one if you did.";
  }
  if (/5\.4\.5|daily|limit exceeded/i.test(raw)) return "Gmail's daily sending limit has been reached. Emails will work again within 24 hours.";
  if (["ESOCKET", "ECONNECTION", "ETIMEDOUT", "EDNS", "ECONNREFUSED"].includes(err.code ?? "")) {
    return `Couldn't connect to the mail server (${host}). Try again in a few minutes; if it keeps failing, check SMTP_HOST and SMTP_PORT.`;
  }
  if (err.code === "EENVELOPE") return `The email address was refused: ${err.response ?? err.message}`;
  return `Sending failed: ${err.response ?? err.message ?? String(e)}`;
}

/** "kueppers.rentaldesk@gmail.com" → "ku•••@gmail.com", so the check can show which account is set without printing it whole. */
export const maskEmail = (s: string) => s.replace(/^(.{2})[^@]*(@.*)$/, "$1•••$2");
