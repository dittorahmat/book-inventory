import { Hono } from "hono";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";
import { eq, inArray, and } from "drizzle-orm";
import { db } from "../../db";
import { transferShipments, transferShipmentItems, bookItems, schools, books } from "../../db/schema";

export const shipmentsRouter = new Hono();

const createShipmentSchema = z.object({
  fromSchoolId: z.string().min(1, "Origin school ID required"),
  toSchoolId: z.string().min(1, "Destination school ID required"),
  bookItemIds: z.array(z.string().min(1)).min(1, "At least one book item required"),
  notes: z.string().optional(),
  reason: z.string().optional(),
});

const receiveShipmentSchema = z.object({
  itemReceipts: z.array(
    z.object({
      bookItemId: z.string().min(1, "Book item ID required"),
      condition: z.enum(["good", "damaged", "missing"]),
      notes: z.string().optional(),
    })
  ),
});

// List shipments (with filter for from/to school)
shipmentsRouter.get("/", async (c) => {
  const schoolId = c.req.query("schoolId");

  const query = db.select({
    id: transferShipments.id,
    shipmentNumber: transferShipments.shipmentNumber,
    status: transferShipments.status,
    fromSchoolId: transferShipments.fromSchoolId,
    toSchoolId: transferShipments.toSchoolId,
    dispatchedAt: transferShipments.dispatchedAt,
    receivedAt: transferShipments.receivedAt,
    notes: transferShipments.notes,
    reason: transferShipments.reason,
    createdAt: transferShipments.createdAt,
  })
  .from(transferShipments);

  const all = await query;
  const filtered = schoolId
    ? all.filter((s: any) => s.fromSchoolId === schoolId || s.toSchoolId === schoolId)
    : all;

  return c.json({ success: true, data: filtered });
});

// Get shipment detail with items
shipmentsRouter.get("/:id", async (c) => {
  const id = c.req.param("id");
  const [shipment] = await db.select().from(transferShipments).where(eq(transferShipments.id, id));
  if (!shipment) {
    return c.json({ success: false, message: "Shipment not found" }, 404);
  }

  const items = await db
    .select({
      id: transferShipmentItems.id,
      bookItemId: transferShipmentItems.bookItemId,
      receivedCondition: transferShipmentItems.receivedCondition,
      barcode: bookItems.barcode,
      condition: bookItems.condition,
      bookTitle: books.title,
    })
    .from(transferShipmentItems)
    .leftJoin(bookItems, eq(transferShipmentItems.bookItemId, bookItems.id))
    .leftJoin(books, eq(bookItems.bookId, books.id))
    .where(eq(transferShipmentItems.shipmentId, id));

  const [fromSchool] = await db.select().from(schools).where(eq(schools.id, shipment.fromSchoolId));
  const [toSchool] = await db.select().from(schools).where(eq(schools.id, shipment.toSchoolId));

  return c.json({
    success: true,
    data: {
      ...shipment,
      fromSchool,
      toSchool,
      items,
    },
  });
});

// Create shipment draft
shipmentsRouter.post("/", zValidator("json", createShipmentSchema), async (c) => {
  const body = c.req.valid("json");
  const now = new Date().toISOString();
  const shipmentId = crypto.randomUUID();
  const shipmentNumber = `TRF-${Date.now().toString().slice(-6)}`;

  // Verify all book items belong to fromSchool and are in_stock
  const selectedItems = await db
    .select()
    .from(bookItems)
    .where(inArray(bookItems.id, body.bookItemIds));

  if (selectedItems.length !== body.bookItemIds.length) {
    return c.json({ success: false, message: "Some book items do not exist" }, 400);
  }

  const invalid = selectedItems.find(
    (item: any) => item.currentSchoolId !== body.fromSchoolId || item.status !== "in_stock"
  );
  if (invalid) {
    return c.json(
      { success: false, message: `Item ${invalid.barcode} is not in stock at origin school` },
      400
    );
  }

  const [newShipment] = await db
    .insert(transferShipments)
    .values({
      id: shipmentId,
      shipmentNumber,
      fromSchoolId: body.fromSchoolId,
      toSchoolId: body.toSchoolId,
      status: "draft",
      notes: body.notes,
      reason: body.reason,
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  for (const bookItemId of body.bookItemIds) {
    await db.insert(transferShipmentItems).values({
      id: crypto.randomUUID(),
      shipmentId,
      bookItemId,
      createdAt: now,
    });
  }

  return c.json({ success: true, data: newShipment }, 201);
});

// Dispatch shipment (Pusat sends to Branch)
shipmentsRouter.post("/:id/dispatch", async (c) => {
  const id = c.req.param("id");
  const [shipment] = await db.select().from(transferShipments).where(eq(transferShipments.id, id));

  if (!shipment) {
    return c.json({ success: false, message: "Shipment not found" }, 404);
  }
  if (shipment.status !== "draft" && shipment.status !== "pending_dispatch") {
    return c.json({ success: false, message: "Shipment cannot be dispatched from current state" }, 400);
  }

  const now = new Date().toISOString();
  const items = await db
    .select()
    .from(transferShipmentItems)
    .where(eq(transferShipmentItems.shipmentId, id));

  const itemIds = items.map((i: any) => i.bookItemId);

  // Update book items to in_transit
  await db
    .update(bookItems)
    .set({ status: "in_transit", updatedAt: now })
    .where(inArray(bookItems.id, itemIds));

  // Update shipment status to in_transit
  const [updated] = await db
    .update(transferShipments)
    .set({ status: "in_transit", dispatchedAt: now, updatedAt: now })
    .where(eq(transferShipments.id, id))
    .returning();

  return c.json({ success: true, data: updated });
});

// Receive shipment (Branch receives from Pusat)
shipmentsRouter.post("/:id/receive", zValidator("json", receiveShipmentSchema), async (c) => {
  const id = c.req.param("id");
  const body = c.req.valid("json");
  const [shipment] = await db.select().from(transferShipments).where(eq(transferShipments.id, id));

  if (!shipment) {
    return c.json({ success: false, message: "Shipment not found" }, 404);
  }
  if (shipment.status !== "in_transit") {
    return c.json({ success: false, message: "Only in_transit shipments can be received" }, 400);
  }

  const now = new Date().toISOString();
  let hasDiscrepancy = false;

  for (const receipt of body.itemReceipts) {
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
});
