import { describe, expect, it } from "bun:test";
import { eq } from "drizzle-orm";
import { db } from "../db";
import { bookSuppliers, suppliers } from "../db/schema";
import { seedMasterSuppliers } from "./seed-suppliers";

describe("seedMasterSuppliers", () => {
  it("populates 11 official suppliers and establishes book_suppliers linkages idempotently", async () => {
    const result = await seedMasterSuppliers(db);
    expect(result.suppliersCount).toBeGreaterThanOrEqual(11);
    expect(result.linksCount).toBeGreaterThanOrEqual(10);

    // Verifikasi supplier kunci ada
    const cnl = await db.select().from(suppliers).where(eq(suppliers.code, "SUP-CNL"));
    expect(cnl.length).toBe(1);
    expect(cnl[0].name).toContain("Chandra Naya Laksana");
    expect(cnl[0].contactPerson).toBe("Fil Rahman");
    expect(cnl[0].phone).toBe("0896 0274 4493");

    const pelangi = await db.select().from(suppliers).where(eq(suppliers.code, "SUP-PELANGI"));
    expect(pelangi.length).toBe(1);
    expect(pelangi[0].name).toContain("PT Penerbitan Pelangi");
    expect(pelangi[0].address).toContain("BCA");

    // Verifikasi relasi buku ke supplier
    const links = await db
      .select()
      .from(bookSuppliers)
      .where(eq(bookSuppliers.supplierId, "sup-cnl"));
    expect(links.length).toBeGreaterThan(0);

    // Idempotensi: jalankan sekali lagi tidak boleh throw / error
    const repeat = await seedMasterSuppliers(db);
    expect(repeat.suppliersCount).toBe(result.suppliersCount);
  });
});
