// Rent payment helpers shared by the tenant portal and the staff Payments page.
import { supabase } from "./supabase";
import type { PaymentMethod, PaymentStatus, RentPayment } from "./types";

export const PAYMENT_BUCKET = "payment-proofs";
export const PAYMENT_METHODS: PaymentMethod[] = ["e-Transfer", "Bank transfer", "Cheque", "Cash", "Other"];
export const MAX_PROOF_MB = 10;
export const PROOF_TYPES = "image/jpeg,image/png,image/webp,image/heic,image/heif,application/pdf";

/** What each status means, in the words each side sees. */
export const STATUS_TEXT: Record<PaymentStatus, { tenant: string; staff: string; tone: string }> = {
  Pending: { tenant: "Waiting for review", staff: "To review", tone: "warn" },
  Approved: { tenant: "Approved", staff: "Approved", tone: "ok" },
  "Sent back": { tenant: "Needs attention", staff: "Sent back", tone: "no" },
};

/** "2026-11-01" → "November 2026" */
export const monthLabel = (period: string) =>
  new Date(period.slice(0, 7) + "-15T12:00:00").toLocaleDateString("en-CA", { month: "long", year: "numeric" });

const firstOf = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;

/** Months a tenant can pay for: two back, this month, next month. Default: this month (or next, late in the month). */
export function monthChoices(now = new Date()): { value: string; label: string }[] {
  return [-2, -1, 0, 1].map((k) => {
    const v = firstOf(new Date(now.getFullYear(), now.getMonth() + k, 1));
    return { value: v, label: monthLabel(v) };
  });
}
export const defaultMonth = (now = new Date()) =>
  firstOf(new Date(now.getFullYear(), now.getMonth() + (now.getDate() >= 25 ? 1 : 0), 1));

/** Compare the paid amount with the rent: "matches", "short" or "over". */
export function amountCheck(p: Pick<RentPayment, "amount" | "expected">): { kind: "match" | "short" | "over" | "unknown"; diff: number } {
  if (p.expected === null || p.expected === undefined) return { kind: "unknown", diff: 0 };
  const diff = Math.round((Number(p.amount) - Number(p.expected)) * 100) / 100;
  return { kind: diff === 0 ? "match" : diff < 0 ? "short" : "over", diff };
}

/** A short-lived private link to view the screenshot. */
export async function proofUrl(path: string): Promise<string | null> {
  const { data, error } = await supabase().storage.from(PAYMENT_BUCKET).createSignedUrl(path, 600);
  return error ? null : data.signedUrl;
}

export const isPdf = (name: string | null | undefined) => /\.pdf$/i.test(name ?? "");
export const isHeic = (name: string | null | undefined) => /\.(heic|heif)$/i.test(name ?? "");
