// Server-only email sending, shared by the request emails and the admin "Send test email" check.
// Settings (Vercel → Environment Variables): SMTP_USER, SMTP_PASSWORD (required);
// SMTP_HOST, SMTP_PORT (default smtp.gmail.com, 465); MAIL_FROM_NAME; APP_URL.
import nodemailer from "nodemailer";
import { HttpError } from "./admin";

export const smtpHost = () => process.env.SMTP_HOST || "smtp.gmail.com";
export const smtpPort = () => Number(process.env.SMTP_PORT || 465);
/** The app password with any spaces removed (Google shows it as four groups of four). */
export const smtpPassword = () => (process.env.SMTP_PASSWORD || "").replace(/\s+/g, "");

export function mailer() {
  const user = (process.env.SMTP_USER || "").trim();
  const pass = smtpPassword();
  if (!user || !pass) throw new HttpError(503, "Email isn't set up: add SMTP_USER and SMTP_PASSWORD in Vercel, then redeploy.");
  const port = smtpPort();
  const transport = nodemailer.createTransport({
    host: smtpHost(), port, secure: port === 465, auth: { user, pass },
    connectionTimeout: 15000, greetingTimeout: 15000, socketTimeout: 20000,
  });
  return { transport, from: `"${process.env.MAIL_FROM_NAME || "Kueppers Property Services"}" <${user}>` };
}

export function appUrl(req: Request) {
  const fromEnv = process.env.APP_URL || (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "");
  return (fromEnv || new URL(req.url).origin).replace(/\/$/, "");
}

export { explainMailError, maskEmail } from "./mailText";
