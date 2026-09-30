import { Hono } from "hono";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";
import { eq, inArray, and } from "drizzle-orm";
import { db } from "../../db";
import { transferShipments, transferShipmentItems, bookItems, packageItems } from "../../db/schema";
import { listShipmentsWithCounts, getShipmentDetail } from "../services/shipment-read";
import { createShipment } from "../services/shipment-write";
import {
  accessErrorResponse,
  assertLocationAllowed,
  loadLocationIds,
  resolveLocationScope,
  resolveRequestActor,
} from "../services/access-scope";

export const shipmentsRouter = new Hono();

const shipmentLineSchema = z.discriminatedUnion("itemType", [
  z.object({
    itemType: z.literal("loose"),
    bookId: z.string().min(1, "Book ID required"),
    quantity: z.number().int().min(1, "Kuantitas minimal 1"),
  }),
  z.object({
    itemType: z.literal("package"),
    packageId: z.string().min(1, "Package ID required"),
    quantity: z.number().int().min(1, "Kuantitas minimal 1"),
  }),
]);

const createShipmentSchema = z.object({
  fromSchoolId: z.string().min(1, "Origin school ID required"),
  toSchoolId: z.string().min(1, "Destination school ID required"),
  /** Input kuantitas per judul/paket; fisiknya dialokasikan otomatis FIFO. */
  items: z.array(shipmentLineSchema).default([]),
  bookItemIds: z.array(z.string().min(1)).default([]),
  packageItemIds: z.array(z.string().min(1)).default([]),
  notes: z.string().optional(),
  reason: z.string().optional(),
}).refine(
  (v) => v.items.length > 0 || v.bookItemIds.length > 0 || v.packageItemIds.length > 0,
  { message: "At least one book item or package item required" }
);

const receiptSchema = z.object({
  condition: z.enum(["good", "damaged", "missing"]),
  notes: z.string().optional(),
});

const receiveShipmentSchema = z.object({
  itemReceipts: z.array(
    z.object({
      bookItemId: z.string().min(1, "Book item ID required"),
      condition: z.enum(["good", "damaged", "missing"]),
      notes: z.string().optional(),
    })
  ).default([]),
  packageReceipts: z.array(
    receiptSchema.extend({ packageItemId: z.string().min(1, "Package item ID required") })
  ).default([]),
});

// List shipments (with filter for from/to school)
shipmentsRouter.get("/", async (c) => {
  try {
    const actor = await resolveRequestActor(c);
    const locations = await loadLocationIds(db);
    const requestedSchoolId = c.req.query("schoolId");
    const scope = resolveLocationScope(actor, requestedSchoolId, locations);
    // Scoped actors always see their own location; central may filter or see all.
    const effectiveSchoolId = scope.length === 1 ? scope[0] : requestedSchoolId;
    const data = await listShipmentsWithCounts(db, effectiveSchoolId);
    return c.json({ success: true, data });
  } catch (err) {
    return accessErrorResponse(c, err);
  }
});

// Get shipment detail with items
shipmentsRouter.get("/:id", async (c) => {
  try {
    const actor = await resolveRequestActor(c);
    const id = c.req.param("id");
    const detail = await getShipmentDetail(db, id);
    if (!detail) {
      return c.json({ success: false, message: "Shipment not found" }, 404);
    }
    if (actor && actor.role !== "central_admin" && actor.schoolId !== detail.fromSchoolId && actor.schoolId !== detail.toSchoolId) {
      return c.json({ success: false, message: "Akses ke transfer lokasi lain dilarang" }, 403);
    }
    return c.json({ success: true, data: detail });
  } catch (err) {
    return accessErrorResponse(c, err);
  }
});

// Create shipment draft: input kuantitas per judul/paket, fisiknya dialokasikan FIFO.
shipmentsRouter.post('/', zValidator('json', createShipmentSchema), async (c) => {
  try {
    const actor = await resolveRequestActor(c);
    const locations = await loadLocationIds(db);
    const body = c.req.valid('json');
    assertLocationAllowed(actor, body.fromSchoolId, locations);
    if (!locations.some((l) => l.id === body.toSchoolId)) {
      return c.json({ success: false, message: 'Sekolah/gudang tujuan tidak ditemukan' }, 404);
    }

    const result = await createShipment(db, {
      fromSchoolId: body.fromSchoolId,
      toSchoolId: body.toSchoolId,
      items: body.items,
      bookItemIds: body.bookItemIds,
      packageItemIds: body.packageItemIds,
      notes: body.notes,
      reason: body.reason,
    });

    if (!result.ok) {
      return c.json({ success: false, message: result.message }, result.status);
    }
    return c.json({ success: true, data: result.shipment }, 201);
  } catch (err) {
    return accessErrorResponse(c, err);
  }
});

// Dispatch shipment (Pusat sends to Branch)
shipmentsRouter.post("/:id/dispatch", async (c) => {
  try {
    const actor = await resolveRequestActor(c);
    const id = c.req.param("id");
    const [shipment] = await db.select().from(transferShipments).where(eq(transferShipments.id, id));

    if (!shipment) {
      return c.json({ success: false, message: "Shipment not found" }, 404);
    }
    if (actor && actor.role !== "central_admin" && actor.schoolId !== shipment.fromSchoolId && actor.schoolId !== shipment.toSchoolId) {
      return c.json({ success: false, message: "Akses ke transfer lokasi lain dilarang" }, 403);
    }
  if (shipment.status !== "draft" && shipment.status !== "pending_dispatch") {
    return c.json({ success: false, message: "Shipment cannot be dispatched from current state" }, 400);
  }

  const now = new Date().toISOString();
  const items = await db
    .select()
    .from(transferShipmentItems)
    .where(eq(transferShipmentItems.shipmentId, id));

  const looseIds = items.filter((i: any) => i.itemType !== "package" && i.bookItemId).map((i: any) => i.bookItemId);
  const bundleIds = items.filter((i: any) => i.itemType === "package" && i.packageItemId).map((i: any) => i.packageItemId);

  // Update loose book items to in_transit
  if (looseIds.length > 0) {
    await db
      .update(bookItems)
      .set({ status: "in_transit", updatedAt: now })
      .where(inArray(bookItems.id, looseIds));
  }

  // Lock physical bundles as dispatched (ready stock leaves origin monitoring)
  if (bundleIds.length > 0) {
    await db
      .update(packageItems)
      .set({ status: "dispatched", updatedAt: now })
      .where(inArray(packageItems.id, bundleIds));
  }

  // Update shipment status to in_transit
  const [updated] = await db
    .update(transferShipments)
    .set({ status: "in_transit", dispatchedAt: now, updatedAt: now })
    .where(eq(transferShipments.id, id))
    .returning();

  return c.json({ success: true, data: updated });
  } catch (err) {
    return accessErrorResponse(c, err);
  }
});

// Receive shipment (Branch receives from Pusat)
shipmentsRouter.post("/:id/receive", zValidator("json", receiveShipmentSchema), async (c) => {
  try {
    const actor = await resolveRequestActor(c);
    const id = c.req.param("id");
    const body = c.req.valid("json");
    const [shipment] = await db.select().from(transferShipments).where(eq(transferShipments.id, id));

    if (!shipment) {
      return c.json({ success: false, message: "Shipment not found" }, 404);
    }
    if (actor && actor.role !== "central_admin" && actor.schoolId !== shipment.fromSchoolId && actor.schoolId !== shipment.toSchoolId) {
      return c.json({ success: false, message: "Akses ke transfer lokasi lain dilarang" }, 403);
    }
  if (shipment.status !== "in_transit") {
    return c.json({ success: false, message: "Only in_transit shipments can be received" }, 400);
  }

  const now = new Date().toISOString();
  let hasDiscrepancy = false;
  const looseReceipts = body.itemReceipts || [];
  const bundleReceipts = (body as any).packageReceipts || [];

  for (const receipt of looseReceipts) {
    await db
      .update(transferShipmentItems)
      .set({ receivedCondition: receipt.condition, notes: receipt.notes })
      .where(
        and(
          eq(transferShipmentItems.shipmentId, id),
          eq(transferShipmentItems.bookItemId, receipt.bookItemId)
        )
      );

    if (receipt.condition === "missing") {
      hasDiscrepancy = true;
      await db
        .update(bookItems)
        .set({ status: "lost", updatedAt: now })
        .where(eq(bookItems.id, receipt.bookItemId));
    } else if (receipt.condition === "damaged") {
      hasDiscrepancy = true;
      await db
        .update(bookItems)
        .set({
          currentSchoolId: shipment.toSchoolId,
          status: "in_stock",
          condition: "damaged",
          updatedAt: now,
        })
        .where(eq(bookItems.id, receipt.bookItemId));
    } else {
      await db
        .update(bookItems)
        .set({
          currentSchoolId: shipment.toSchoolId,
          status: "in_stock",
          updatedAt: now,
        })
        .where(eq(bookItems.id, receipt.bookItemId));
    }
  }

  for (const receipt of bundleReceipts) {
    await db
      .update(transferShipmentItems)
      .set({ receivedCondition: receipt.condition, notes: receipt.notes })
      .where(
        and(
          eq(transferShipmentItems.shipmentId, id),
          eq(transferShipmentItems.packageItemId, receipt.packageItemId)
        )
      );

    if (receipt.condition === "missing") {
      hasDiscrepancy = true;
      await db.delete(packageItems).where(eq(packageItems.id, receipt.packageItemId));
    } else if (receipt.condition === "damaged") {
      hasDiscrepancy = true;
      await db
        .update(packageItems)
        .set({
          currentSchoolId: shipment.toSchoolId,
          status: "in_stock",
          notes: receipt.notes ? `Rusak saat transit: ${receipt.notes}` : "Rusak saat transit",
          updatedAt: now,
        })
        .where(eq(packageItems.id, receipt.packageItemId));
    } else {
      await db
        .update(packageItems)
        .set({
          currentSchoolId: shipment.toSchoolId,
          status: "in_stock",
          updatedAt: now,
        })
        .where(eq(packageItems.id, receipt.packageItemId));
    }
  }

  const finalStatus = hasDiscrepancy ? "completed_with_discrepancy" : "completed";

  const [completed] = await db
    .update(transferShipments)
    .set({
      status: finalStatus,
      receivedAt: now,
      updatedAt: now,
    })
    .where(eq(transferShipments.id, id))
    .returning();

  return c.json({ success: true, data: completed });
  } catch (err) {
    return accessErrorResponse(c, err);
  }
});
