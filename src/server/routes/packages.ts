import { Hono } from "hono";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "../../db";
import { bookPackages, bookPackageItems, packageItems, books } from "../../db/schema";
import { recalcPackagePrice } from "../services/book-price";
import {
  accessErrorResponse,
  assertLocationAllowed,
  requireScopedActor,
  requireScopedLogisticsActor,
  resolveLogisticsActor,
} from "../services/access-scope";
import { assemblePackageBundles, disassemblePackageBundles, deletePackageWithAutoUnbundle } from "../services/package-assembly";
import { getStockPotentials } from "../services/package-stock";
import { isCentralRole } from "../../lib/staff-roles";

export const packagesRouter = new Hono();

const createPackageSchema = z.object({
  code: z.string().min(1, "Package code is required"),
  name: z.string().min(1, "Package name is required"),
  gradeLevel: z.string().min(1, "Grade level is required"),
  curriculumType: z.enum(["international", "national"]).default("international"),
  academicYear: z.string().min(1, "Academic year is required"),
  price: z.number().int().min(0).default(0),
  description: z.string().optional(),
  items: z.array(
    z.object({
      bookId: z.string().min(1, "Book ID is required"),
      quantity: z.number().int().min(1).default(1),
    })
  ).min(1, "Package must have at least one book component"),
});

const bundleActionSchema = z.object({
  schoolId: z.string().min(1, "School ID is required"),
  quantity: z.number().int().min(1, "Quantity must be at least 1"),
});

const unbundleActionSchema = z.object({
  schoolId: z.string().min(1, "School ID is required"),
  quantity: z.number().int().min(1, "Quantity must be at least 1"),
  reason: z.string().min(1, "Reason is required"),
});

import { runIdempotentSeed } from "../seed";

// GET all packages with BOM components
packagesRouter.get("/", async (c) => {
  try {
    const { actor } = await requireScopedActor(db, c);
    let allPackages = await db.select().from(bookPackages);
    // Seed demo otomatis hanya untuk admin pusat; peran lain melihat daftar jujur (kosong).
    if (allPackages.length === 0 && isCentralRole(actor.role)) {
      await runIdempotentSeed();
      allPackages = await db.select().from(bookPackages);
    }

    const results = await Promise.all(
      allPackages.map(async (pkg: typeof bookPackages.$inferSelect) => {
        const items = await db
          .select({
            id: bookPackageItems.id,
            bookId: books.id,
            title: books.title,
            isbn: books.isbn,
            author: books.author,
            category: books.category,
            quantity: bookPackageItems.quantity,
          })
          .from(bookPackageItems)
          .innerJoin(books, eq(bookPackageItems.bookId, books.id))
          .where(eq(bookPackageItems.packageId, pkg.id));

        return {
          ...pkg,
          items,
          totalItemsCount: items.reduce((sum: number, item: { quantity: number }) => sum + item.quantity, 0),
        };
      })
    );

    return c.json({ success: true, data: results });
  } catch (err) {
    return accessErrorResponse(c, err);
  }
});

// GET ready physical bundles (for transfer pickers)
packagesRouter.get("/items/ready", async (c) => {
  try {
    const { scope, locations } = await requireScopedActor(db, c, c.req.query("schoolId"));
    // Partisi sekolah di WHERE SQL + LIMIT (§11 anti Pindai Penuh).
    const conditions = [eq(packageItems.status, "in_stock")];
    if (scope.length < locations.length) {
      conditions.push(inArray(packageItems.currentSchoolId, scope));
    }
    const rows = await db
    .select({
      id: packageItems.id,
      barcode: packageItems.barcode,
      status: packageItems.status,
      currentSchoolId: packageItems.currentSchoolId,
      packageId: bookPackages.id,
      packageCode: bookPackages.code,
      packageName: bookPackages.name,
      packagePrice: bookPackages.price,
    })
    .from(packageItems)
    .innerJoin(bookPackages, eq(packageItems.packageId, bookPackages.id))
    .where(and(...conditions))
    .limit(50);

  return c.json({ success: true, data: rows });
  } catch (err) {
    return accessErrorResponse(c, err);
  }
});

// GET potensi stok SEMUA paket untuk satu sekolah dalam 3 query batch.
// Satu-satunya pemilik agregasi potensi; endpoint per-paket di bawah mendelegasikan ke sini.
packagesRouter.get("/stock", async (c) => {
  try {
    const { actor, locations } = await requireScopedActor(db, c);
    const schoolId = c.req.query("schoolId");
    if (!schoolId) {
      return c.json({ success: false, message: "schoolId wajib diisi" }, 400);
    }
    assertLocationAllowed(actor, schoolId, locations);

    const potentials = await getStockPotentials(db, schoolId);
    const map: Record<string, (typeof potentials)[number]> = {};
    for (const p of potentials) map[p.packageId] = p;
    return c.json({ success: true, data: map });
  } catch (err) {
    return accessErrorResponse(c, err);
  }
});
packagesRouter.get("/:id/stock/:schoolId", async (c) => {
  try {
    const { actor, locations } = await requireScopedActor(db, c);
    const packageId = c.req.param("id");
    const schoolId = c.req.param("schoolId");
    assertLocationAllowed(actor, schoolId, locations);

  const [pkg] = await db.select().from(bookPackages).where(eq(bookPackages.id, packageId));
  if (!pkg) {
    return c.json({ success: false, message: "Package not found" }, 404);
  }

  const [potential] = await getStockPotentials(db, schoolId, packageId);
  return c.json({
    success: true,
    data: potential ?? {
      packageId,
      schoolId,
      readyBundleCount: 0,
      maxPossibleBundles: 0,
      looseStockBreakdown: [],
    },
  });
  } catch (err) {
    return accessErrorResponse(c, err);
  }
});

// POST Create new Package with BOM components
packagesRouter.post("/", zValidator("json", createPackageSchema), async (c) => {
  try {
    await resolveLogisticsActor(c);
    const body = c.req.valid("json");
  const now = new Date().toISOString();
  const packageId = crypto.randomUUID();

  const [existingCode] = await db.select().from(bookPackages).where(eq(bookPackages.code, body.code));
  if (existingCode) {
    return c.json({ success: false, message: "Package code already exists" }, 400);
  }

  await db.insert(bookPackages).values({
    id: packageId,
    code: body.code,
    name: body.name,
    gradeLevel: body.gradeLevel,
    curriculumType: body.curriculumType,
    academicYear: body.academicYear,
    price: 0,
    description: body.description || null,
    createdAt: now,
    updatedAt: now,
  });

  for (const item of body.items) {
    await db.insert(bookPackageItems).values({
      id: crypto.randomUUID(),
      packageId,
      bookId: item.bookId,
      quantity: item.quantity,
      createdAt: now,
    });
  }

  // Harga paket terkomputasi: SUM(harga jual efektif * kuantitas) — input harga manual diabaikan.
  await recalcPackagePrice(packageId);

  const [created] = await db.select().from(bookPackages).where(eq(bookPackages.id, packageId));
  return c.json({ success: true, data: created }, 201);
  } catch (err) {
    return accessErrorResponse(c, err);
  }
});

// POST Assembly / Bundling (Kitting) - HANYA DI GUDANG PUSAT
packagesRouter.post("/:id/bundle", zValidator("json", bundleActionSchema), async (c) => {
  try {
    const { actor, locations } = await requireScopedLogisticsActor(db, c);
    const packageId = c.req.param("id");
    const { schoolId, quantity } = c.req.valid("json");
    assertLocationAllowed(actor, schoolId, locations);

    const { schools } = await import("../../db/schema");
    const [targetLoc] = await db.select({ type: schools.type }).from(schools).where(eq(schools.id, schoolId));
    if (targetLoc?.type !== "warehouse") {
      return c.json({ success: false, message: "Perakitan paket hanya dapat dilakukan di Gudang Pusat." }, 403);
    }

    const result = await assemblePackageBundles(packageId, schoolId, quantity);
    if (!result.ok) {
      return c.json({ success: false, message: result.message }, result.status);
    }

    const [pkg] = await db.select({ name: bookPackages.name }).from(bookPackages).where(eq(bookPackages.id, packageId));
    return c.json({
      success: true,
      message: `Successfully assembled ${quantity} bundle(s) of ${pkg?.name ?? "package"}`,
      data: result.data,
    });
  } catch (err) {
    return accessErrorResponse(c, err);
  }
});

// POST Disassembly / Unbundling (De-kitting)
packagesRouter.post("/:id/unbundle", zValidator("json", unbundleActionSchema), async (c) => {
  try {
    const { actor, locations } = await requireScopedActor(db, c);
    const packageId = c.req.param("id");
    const { schoolId, quantity, reason } = c.req.valid("json");
    assertLocationAllowed(actor, schoolId, locations);

    const result = await disassemblePackageBundles(packageId, schoolId, quantity, reason);
    if (!result.ok) {
      return c.json({ success: false, message: result.message }, result.status);
    }

    return c.json({
      success: true,
      message: `Successfully unbundled ${quantity} packages. Restored ${result.data.restoredLooseCount} loose books to inventory.`,
      data: result.data,
    });
  } catch (err) {
    return accessErrorResponse(c, err);
  }
});

// DELETE Package with auto-unbundle of ready bundles
packagesRouter.delete("/:id", async (c) => {
  try {
    await resolveLogisticsActor(c);
    const packageId = c.req.param("id");

    const result = await deletePackageWithAutoUnbundle(packageId);
    if (!result.ok) {
      return c.json({ success: false, message: result.message }, result.status);
    }

    return c.json({
      success: true,
      message: `Paket berhasil dihapus. ${result.data.unbundledCount} bundel dibongkar dan ${result.data.restoredLooseCount} buku dikembalikan ke stok satuan.`,
      data: result.data,
    });
  } catch (err) {
    return accessErrorResponse(c, err);
  }
});

