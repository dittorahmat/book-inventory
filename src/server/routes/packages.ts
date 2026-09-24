import { Hono } from "hono";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";
import { eq, and } from "drizzle-orm";
import { db } from "../../db";
import { bookPackages, bookPackageItems, packageItems, books, bookItems } from "../../db/schema";

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
  let allPackages = await db.select().from(bookPackages);
  if (allPackages.length === 0) {
    await runIdempotentSeed();
    allPackages = await db.select().from(bookPackages);
  }
  
  const results = await Promise.all(
    allPackages.map(async (pkg: any) => {
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
        totalItemsCount: items.reduce((sum: number, item: any) => sum + item.quantity, 0),
      };
    })
  );

  return c.json({ success: true, data: results });
});

// GET package inventory summary per school (bundle ready count & potential assembly count)
packagesRouter.get("/:id/stock/:schoolId", async (c) => {
  const packageId = c.req.param("id");
  const schoolId = c.req.param("schoolId");

  const [pkg] = await db.select().from(bookPackages).where(eq(bookPackages.id, packageId));
  if (!pkg) {
    return c.json({ success: false, message: "Package not found" }, 404);
  }

  // Count physically pre-assembled packages in this school
  const readyPackages = await db
    .select()
    .from(packageItems)
    .where(
      and(
        eq(packageItems.packageId, packageId),
        eq(packageItems.currentSchoolId, schoolId),
        eq(packageItems.status, "in_stock")
      )
    );

  // Get BOM
  const bom = await db
    .select({
      bookId: bookPackageItems.bookId,
      quantityNeeded: bookPackageItems.quantity,
      title: books.title,
      isbn: books.isbn,
    })
    .from(bookPackageItems)
    .innerJoin(books, eq(bookPackageItems.bookId, books.id))
    .where(eq(bookPackageItems.packageId, packageId));

  // Check loose stock availability for each BOM component in this school
  let maxPossibleBundles = Infinity;
  const looseStockBreakdown = await Promise.all(
    bom.map(async (item: any) => {
      const looseItems = await db
        .select()
        .from(bookItems)
        .where(
          and(
            eq(bookItems.bookId, item.bookId),
            eq(bookItems.currentSchoolId, schoolId),
            eq(bookItems.status, "in_stock"),
            eq(bookItems.condition, "new")
          )
        );

      const availableCount = looseItems.length;
      const canMake = Math.floor(availableCount / item.quantityNeeded);
      if (canMake < maxPossibleBundles) {
        maxPossibleBundles = canMake;
      }

      return {
        bookId: item.bookId,
        title: item.title,
        isbn: item.isbn,
        quantityNeeded: item.quantityNeeded,
        availableLooseStock: availableCount,
        maxBundlesFromComponent: canMake,
      };
    })
  );

  return c.json({
    success: true,
    data: {
      packageId,
      schoolId,
      readyBundleCount: readyPackages.length,
      maxPossibleBundles: maxPossibleBundles === Infinity ? 0 : maxPossibleBundles,
      looseStockBreakdown,
    },
  });
});

// POST Create new Package with BOM components
packagesRouter.post("/", zValidator("json", createPackageSchema), async (c) => {
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
    price: body.price,
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

  const [created] = await db.select().from(bookPackages).where(eq(bookPackages.id, packageId));
  return c.json({ success: true, data: created }, 201);
});

// POST Assembly / Bundling (Kitting)
packagesRouter.post("/:id/bundle", zValidator("json", bundleActionSchema), async (c) => {
  const packageId = c.req.param("id");
  const { schoolId, quantity } = c.req.valid("json");
  const now = new Date().toISOString();

  const [pkg] = await db.select().from(bookPackages).where(eq(bookPackages.id, packageId));
  if (!pkg) {
    return c.json({ success: false, message: "Package not found" }, 404);
  }

  const bom = await db
    .select({
      bookId: bookPackageItems.bookId,
      quantity: bookPackageItems.quantity,
      title: books.title,
    })
    .from(bookPackageItems)
    .innerJoin(books, eq(bookPackageItems.bookId, books.id))
    .where(eq(bookPackageItems.packageId, packageId));

  if (bom.length === 0) {
    return c.json({ success: false, message: "Package has no BOM components" }, 400);
  }

  // Verify stock sufficiency for all components
  for (const item of bom) {
    const requiredTotal = item.quantity * quantity;
    const loose = await db
      .select()
      .from(bookItems)
      .where(
        and(
          eq(bookItems.bookId, item.bookId),
          eq(bookItems.currentSchoolId, schoolId),
          eq(bookItems.status, "in_stock"),
          eq(bookItems.condition, "new")
        )
      );

    if (loose.length < requiredTotal) {
      return c.json(
        {
          success: false,
          message: `Insufficient stock for "${item.title}". Required: ${requiredTotal}, Available: ${loose.length}`,
        },
        400
      );
    }
  }

  // Deduct loose stock items & create pre-packed package items
  for (const item of bom) {
    const requiredTotal = item.quantity * quantity;
    const looseToConsume = await db
      .select({ id: bookItems.id })
      .from(bookItems)
      .where(
        and(
          eq(bookItems.bookId, item.bookId),
          eq(bookItems.currentSchoolId, schoolId),
          eq(bookItems.status, "in_stock"),
          eq(bookItems.condition, "new")
        )
      )
      .limit(requiredTotal);

    for (const l of looseToConsume) {
      // Mark as disposed/bundled into package
      await db
        .update(bookItems)
        .set({ status: "disposed", notes: `Bundled into ${pkg.name}`, updatedAt: now })
        .where(eq(bookItems.id, l.id));
    }
  }

  // Create new physical package items
  const createdPackageItems = [];
  for (let i = 0; i < quantity; i++) {
    const itemBarcode = `PKG-${pkg.code}-${Date.now().toString().slice(-6)}-${(i + 1).toString().padStart(3, "0")}`;
    const pItemId = crypto.randomUUID();
    await db.insert(packageItems).values({
      id: pItemId,
      packageId,
      currentSchoolId: schoolId,
      barcode: itemBarcode,
      status: "in_stock",
      notes: "Assembled via kitting operation",
      createdAt: now,
      updatedAt: now,
    });
    createdPackageItems.push({ id: pItemId, barcode: itemBarcode });
  }

  return c.json({
    success: true,
    message: `Successfully assembled ${quantity} bundle(s) of ${pkg.name}`,
    data: {
      packageId,
      quantityAssembled: quantity,
      assembledItems: createdPackageItems,
    },
  });
});

// POST Disassembly / Unbundling (De-kitting)
packagesRouter.post("/:id/unbundle", zValidator("json", unbundleActionSchema), async (c) => {
  const packageId = c.req.param("id");
  const { schoolId, quantity, reason } = c.req.valid("json");
  const now = new Date().toISOString();

  const [pkg] = await db.select().from(bookPackages).where(eq(bookPackages.id, packageId));
  if (!pkg) {
    return c.json({ success: false, message: "Package not found" }, 404);
  }

  // Check available bundled items
  const availableBundles = await db
    .select()
    .from(packageItems)
    .where(
      and(
        eq(packageItems.packageId, packageId),
        eq(packageItems.currentSchoolId, schoolId),
        eq(packageItems.status, "in_stock")
      )
    )
    .limit(quantity);

  if (availableBundles.length < quantity) {
    return c.json(
      {
        success: false,
        message: `Not enough assembled packages to unbundle. Requested: ${quantity}, Available: ${availableBundles.length}`,
      },
      400
    );
  }

  const bom = await db
    .select({
      bookId: bookPackageItems.bookId,
      quantity: bookPackageItems.quantity,
    })
    .from(bookPackageItems)
    .where(eq(bookPackageItems.packageId, packageId));

  // Delete the unbundled package items
  for (const b of availableBundles) {
    await db.delete(packageItems).where(eq(packageItems.id, b.id));
  }

  // Restore loose stock books
  let totalRestoredLoose = 0;
  for (const item of bom) {
    const returnCount = item.quantity * quantity;
    for (let j = 0; j < returnCount; j++) {
      const barcode = `RET-UNB-${Date.now().toString().slice(-6)}-${Math.floor(Math.random() * 1000)}`;
      await db.insert(bookItems).values({
        id: crypto.randomUUID(),
        bookId: item.bookId,
        currentSchoolId: schoolId,
        barcode,
        condition: "new",
        status: "in_stock",
        notes: `Restored from unbundled package ${pkg.name}. Reason: ${reason}`,
        createdAt: now,
        updatedAt: now,
      });
      totalRestoredLoose++;
    }
  }

  return c.json({
    success: true,
    message: `Successfully unbundled ${quantity} packages. Restored ${totalRestoredLoose} loose books to inventory.`,
    data: {
      packageId,
      unbundledCount: quantity,
      restoredLooseCount: totalRestoredLoose,
    },
  });
});
