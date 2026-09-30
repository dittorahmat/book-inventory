import { eq } from "drizzle-orm";
import { db } from "../../db";
import { systemSettings } from "../../db/schema";
import { currentAcademicYear, isWIBOnOrAfter, todayWIB } from "../../lib/wib-time";

/** Kunci pengaturan cut-off order satuan (design D7). */
export const openFromKey = (academicYear: string) => `satuan_open_from:${academicYear}`;
export const overrideKey = (academicYear: string) => `satuan_override:${academicYear}`;

export type SatuanOverride = "open" | "closed";

export interface SatuanStatus {
  academicYear: string;
  open: boolean;
  todayWIB: string;
  openFrom: string | null;
  override: SatuanOverride | null;
  /** Alasan singkat untuk ditampilkan di UI publik. */
  reason: string;
}

async function readSetting(key: string): Promise<string | null> {
  const [row] = await db.select().from(systemSettings).where(eq(systemSettings.key, key));
  return row?.value ?? null;
}

async function writeSetting(key: string, value: string, description: string) {
  const now = new Date().toISOString();
  const [existing] = await db.select().from(systemSettings).where(eq(systemSettings.key, key));
  if (existing) {
    await db
      .update(systemSettings)
      .set({ value, description, updatedAt: now })
      .where(eq(systemSettings.key, key));
  } else {
    await db.insert(systemSettings).values({ key, value, description, updatedAt: now });
  }
}

/**
 * Status openness order satuan untuk satu tahun ajaran.
 * Urutan evaluasi: override manual → tanggal efektif WIB → default tertutup.
 */
export async function getSatuanStatus(
  academicYear: string,
  now: Date = new Date()
): Promise<SatuanStatus> {
  const today = todayWIB(now);
  const openFrom = await readSetting(openFromKey(academicYear));
  const rawOverride = await readSetting(overrideKey(academicYear));
  const override: SatuanOverride | null =
    rawOverride === "open" || rawOverride === "closed" ? rawOverride : null;

  if (override === "open") {
    return {
      academicYear,
      open: true,
      todayWIB: today,
      openFrom,
      override,
      reason: "Order satuan dipaksa buka oleh admin.",
    };
  }
  if (override === "closed") {
    return {
      academicYear,
      open: false,
      todayWIB: today,
      openFrom,
      override,
      reason: "Order satuan dipaksa tutup oleh admin.",
    };
  }
  if (!openFrom) {
    return {
      academicYear,
      open: false,
      todayWIB: today,
      openFrom: null,
      override: null,
      reason: "Order satuan belum dibuka untuk tahun ajaran ini.",
    };
  }
  if (!isWIBOnOrAfter(today, openFrom)) {
    return {
      academicYear,
      open: false,
      todayWIB: today,
      openFrom,
      override: null,
      reason: `Order satuan dibuka mulai ${openFrom}.`,
    };
  }
  return {
    academicYear,
    open: true,
    todayWIB: today,
    openFrom,
    override: null,
    reason: `Order satuan terbuka sejak ${openFrom}.`,
  };
}

/** Simpan tanggal efektif pembuka order satuan (format YYYY-MM-DD). */
export async function setSatuanOpenFrom(
  academicYear: string,
  dateIso: string
): Promise<SatuanStatus> {
  await writeSetting(
    openFromKey(academicYear),
    dateIso,
    `Tanggal buka order satuan tahun ajaran ${academicYear}`
  );
  return getSatuanStatus(academicYear);
}

/** Simpan override manual; null berarti kembali ke aturan tanggal. */
export async function setSatuanOverride(
  academicYear: string,
  override: SatuanOverride | null
): Promise<SatuanStatus> {
  const key = overrideKey(academicYear);
  if (override === null) {
    await db.delete(systemSettings).where(eq(systemSettings.key, key));
  } else {
    await writeSetting(
      key,
      override,
      `Override manual order satuan tahun ajaran ${academicYear}`
    );
  }
  return getSatuanStatus(academicYear);
}

/** Status untuk tahun ajaran berjalan, dipakai form publik tanpa parameter tahun. */
export function getCurrentSatuanStatus(now: Date = new Date()): Promise<SatuanStatus> {
  return getSatuanStatus(currentAcademicYear(now), now);
}
