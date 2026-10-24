import { describe, expect, it } from "bun:test";
import { eq, inArray } from "drizzle-orm";
import { db } from "../../db";
import { books, systemSettings, users } from "../../db/schema";
import { WPR_BOOK_ID } from "../../lib/wpr";
import { seedDemoSettings } from "./demo-settings";
import { seedIdentity } from "./identity";

const now = new Date().toISOString();

describe("seed demo: fondasi pengaturan", () => {
  it("mengisi pengaturan demo, judul publik, dan akun warehouse_admin", async () => {
    await seedIdentity({ db, now });
    await seedDemoSettings({ db, now });

    const settings = await db
      .select()
      .from(systemSettings)
      .where(
        inArray(systemSettings.key, [
          "smtp_port",
          "wa_meta_enabled",
          "uniform_order_prefix",
          "uniform_claim_prefix",
          "satuan_open_from:2026/2027",
          "uniform_satuan_enabled",
        ])
      );
    const byKey = new Map(settings.map((row) => [row.key, row.value]));
    expect(byKey.get("smtp_port")).toBe("587");
    expect(byKey.get("wa_meta_enabled")).toBe("false");
    expect(byKey.get("uniform_order_prefix")).toBe("USO");
    expect(byKey.get("uniform_claim_prefix")).toBe("CLM");
    expect(byKey.get("satuan_open_from:2026/2027")).toBe("2026-07-01");
    expect(byKey.get("uniform_satuan_enabled")).toBe("true");

    const [math] = await db.select().from(books).where(eq(books.id, "b-math-1"));
    expect(math.publicTitle).toBe(math.title);
    const [wpr] = await db.select().from(books).where(eq(books.id, WPR_BOOK_ID));
    expect(wpr.publicTitle).toBe("Weekly Progress Report");

    const [logistik] = await db.select().from(users).where(eq(users.email, "admin.logistik@alwildan.sch.id"));
    expect(logistik.role).toBe("warehouse_admin");
    expect(logistik.schoolId).toBe("school-warehouse");
  });
});
