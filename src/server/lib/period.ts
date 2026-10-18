/** Batas rentang periode `YYYY-MM` sebagai string ISO: [awal bulan, awal bulan berikutnya). */
export const PERIOD_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

export const periodBounds = (period: string): { start: string; end: string } => {
  const [y, m] = period.split("-").map(Number);
  const next = m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, "0")}`;
  return { start: `${period}-01`, end: `${next}-01` };
};
