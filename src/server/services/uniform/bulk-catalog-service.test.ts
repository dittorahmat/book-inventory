import { describe, expect, it } from "bun:test";
import { db } from "../../../db";
import {
  previewBulkUniformCatalog,
  commitBulkUniformCatalog,
} from "./bulk-catalog-service";
import type { UniformCatalogRowInput } from "../../../lib/uniform-catalog-parser";

describe("bulk-catalog-service", () => {
  it("previews new and existing variants and packages correctly", async () => {
    const rows: UniformCatalogRowInput[] = [
      ["TK/ IKHWAN", "CELANA ABU", 180000],
      [null, "BAJU OLAHRAGA", 350000],
    ];

    const preview = await previewBulkUniformCatalog(db, {
      rows,
      academicYear: "2026/2027",
      autoBundlePackages: true,
    });

    expect(preview.variants.length).toBe(2);
    expect(preview.packages.length).toBe(1);
    expect(preview.packages[0].code).toBe("PKG-UNIF-TK-IKH-2026");
    expect(preview.packages[0].items.length).toBe(1);
  });

  it("commits variants, sizes, and default packages idempotently (upsert)", async () => {
    const rows: UniformCatalogRowInput[] = [
      ["TK/ IKHWAN", "CELANA ABU", 180000],
      [null, "BAJU OLAHRAGA", 350000],
    ];

    // 1st commit
    const res1 = await commitBulkUniformCatalog(db, {
      rows,
      academicYear: "2026/2027",
      autoBundlePackages: true,
    });

    expect(res1.insertedVariants).toBeGreaterThanOrEqual(0);
    expect(res1.packagesCreatedOrUpdated).toBe(1);

    // 2nd commit with price update on CELANA ABU
    const rowsUpdate: UniformCatalogRowInput[] = [
      ["TK/ IKHWAN", "CELANA ABU", 195000],
      [null, "BAJU OLAHRAGA", 350000],
    ];

    const res2 = await commitBulkUniformCatalog(db, {
      rows: rowsUpdate,
      academicYear: "2026/2027",
      autoBundlePackages: true,
    });

    expect(res2.updatedVariants).toBeGreaterThanOrEqual(1);

    // Verify DB variant price
    const variantInDb = await db.query.uniformVariants.findFirst({
      where: (t, { eq }) => eq(t.code, "UNI-TK-IKH-CELANA_ABU"),
    });
    expect(variantInDb?.price).toBe(195000);
  });
});
