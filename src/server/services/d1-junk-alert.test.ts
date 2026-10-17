import { describe, expect, it } from "bun:test";
import { eq, inArray } from "drizzle-orm";
import { db } from "../../db";
import { schools, systemSettings, users } from "../../db/schema";
import type { EmailSendOptions, EmailSendResult } from "./email/types";
import { JUNK_ALERT_SIGNATURE_KEY, alertJunkSchools, scanJunkSchools } from "./d1-junk-alert";
import { findJunkSchools } from "./d1-junk-scan";

const stamp = Date.now();
const junkIds = [`school-test-${stamp}-a`, `school-test-${stamp}-b`];
const adminEmail = `admin-junk-${stamp}@example.com`;
const nowIso = () => new Date().toISOString();

const sentMail: EmailSendOptions[] = [];
const okMail = async (options: EmailSendOptions): Promise<EmailSendResult> => {
  sentMail.push(options);
  return { success: true, provider: "simulated", simulated: true };
};

const seedJunk = async (): Promise<void> => {
  await db.insert(schools).values(
    junkIds.map((id, index) => ({
      id,
      name: `Sekolah ${id}`,
      code: `JUNK-${stamp}-${index}`,
      type: "branch" as const,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    }))
  );
  await db.insert(users).values({
    id: `user-junk-${stamp}`,
    name: "Admin Junk",
    email: adminEmail,
    role: "central_admin",
    createdAt: new Date(),
    updatedAt: new Date(),
  });
};

const cleanup = async (): Promise<void> => {
  const junk = (await scanJunkSchools(db)).map((row) => String(row.id));
  if (junk.length > 0) await db.delete(schools).where(inArray(schools.id, junk));
  await db.delete(users).where(eq(users.email, adminEmail));
  await db.delete(systemSettings).where(eq(systemSettings.key, JUNK_ALERT_SIGNATURE_KEY));
};

describe("findJunkSchools (keputusan murni)", () => {
  it("hanya menandai id/nama berpola uji, bukan nama sekolah asli", () => {
    const rows = [
      { id: "school-alw-1", name: "SMA Al Wildan" },
      { id: "school-test-1", name: "SMA Al Wildan" },
      { id: "school-alw-2", name: "Empty test school" },
    ];
    expect(findJunkSchools(rows).map((row) => row.id)).toEqual(["school-test-1", "school-alw-2"]);
  });
});

describe("alertJunkSchools (alarm cron production)", () => {
  it("mengalarmkan sampah ke central_admin, anti-spam saat tak berubah, dan bersih saat dibersihkan", async () => {
    await seedJunk();
    try {
      const found = (await scanJunkSchools(db)).map((row) => String(row.id));
      expect(found).toContain(junkIds[0]);
      expect(found).toContain(junkIds[1]);

      sentMail.length = 0;
      const first = await alertJunkSchools(db, { mail: okMail });
      expect(first.junkCount).toBeGreaterThanOrEqual(2);
      expect(first.sent).toBeGreaterThan(0);
      expect(sentMail).toHaveLength(first.sent);
      expect(sentMail.some((mail) => mail.to === adminEmail)).toBe(true);
      expect(sentMail[0]?.subject ?? "").toContain(`${first.junkCount} sekolah pola-uji`);

      // Sampah belum dibersihkan -> sidik sama -> tidak ada email kedua (anti alarm-fatigue).
      sentMail.length = 0;
      const second = await alertJunkSchools(db, { mail: okMail });
      expect(second.skipped).toBe("sampah sama dengan alarm terakhir");
      expect(sentMail).toHaveLength(0);

      // Dibersihkan -> sidik dihapus, sehingga sampah baru kelak tetap dialarmkan.
      const remaining = (await scanJunkSchools(db)).map((row) => String(row.id));
      await db.delete(schools).where(inArray(schools.id, remaining));
      sentMail.length = 0;
      const clean = await alertJunkSchools(db, { mail: okMail });
      expect(clean.skipped).toBe("production bersih");
      expect(clean.junkCount).toBe(0);
      expect(sentMail).toHaveLength(0);
      const [signatureRow] = await db
        .select()
        .from(systemSettings)
        .where(eq(systemSettings.key, JUNK_ALERT_SIGNATURE_KEY));
      expect(signatureRow).toBeUndefined();
    } finally {
      await cleanup();
    }
  });
});
