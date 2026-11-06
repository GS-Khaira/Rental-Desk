export const money = (n: number | null | undefined) =>
  n === null || n === undefined || Number.isNaN(Number(n))
    ? "—"
    : "$" + Number(n).toLocaleString("en-CA", { maximumFractionDigits: 0 });

export const today = () => {
  const d = new Date();
  const p = (x: number) => String(x).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

export const fmtDate = (d: string | null | undefined, withYear = true) =>
  d
    ? new Date(d + "T12:00:00").toLocaleDateString("en-CA", {
        year: withYear ? "numeric" : undefined,
        month: "short",
        day: "numeric",
      })
    : "—";

/** Whole days from a to b (positive when b is later). */
export const daysBetween = (a: string, b: string) =>
  Math.round((new Date(b + "T12:00:00").getTime() - new Date(a + "T12:00:00").getTime()) / 864e5);

export const plural = (n: number, one: string, many = one + "s") => `${n} ${n === 1 ? one : many}`;
