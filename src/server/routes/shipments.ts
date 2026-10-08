import { Hono } from "hono";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";
import { eq } from "drizzle-orm";
import { db } from "../../db";
import { transferShipments } from "../../db/schema";
import { listShipmentsWithCounts, getShipmentDetail } from "../services/shipment-read";
import { createShipment, dispatchShipment, receiveShipment } from "../services/shipment-write";
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
  instant: z.boolean().default(false),
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
      instant: body.instant,
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
    const result = await dispatchShipment(db, id);
    if (!result.ok) {
      return c.json({ success: false, message: result.message }, result.status);
    }
    return c.json({ success: true, data: result.shipment });
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
    const result = await receiveShipment(db, id, body.itemReceipts || [], (body as any).packageReceipts || []);
    if (!result.ok) {
      return c.json({ success: false, message: result.message }, result.status);
    }
    return c.json({ success: true, data: result.shipment });
  } catch (err) {
    return accessErrorResponse(c, err);
  }
});

// DELETE shipment (khusus draft atau batalkan kiriman)
shipmentsRouter.delete("/:id", async (c) => {
  try {
    const actor = await resolveRequestActor(c);
    const id = c.req.param("id");
    const [shipment] = await db.select().from(transferShipments).where(eq(transferShipments.id, id));

    if (!shipment) {
      return c.json({ success: false, message: "Shipment not found" }, 404);
    }
    if (actor && actor.role !== "central_admin" && actor.schoolId !== shipment.fromSchoolId) {
      return c.json({ success: false, message: "Akses hapus transfer lokasi lain dilarang" }, 403);
    }

    // Jika in_transit, kembalikan status item fisik ke in_stock di asal
    const { transferShipmentItems, bookItems, packageItems } = await import("../../db/schema");
    const { inArray } = await import("drizzle-orm");
    const items = await db.select().from(transferShipmentItems).where(eq(transferShipmentItems.shipmentId, id));
    const looseIds = items.filter((i: any) => i.itemType !== "package" && i.bookItemId).map((i: any) => i.bookItemId);
    const bundleIds = items.filter((i: any) => i.itemType === "package" && i.packageItemId).map((i: any) => i.packageItemId);

    if (looseIds.length > 0) {
      await db.update(bookItems).set({ status: "in_stock" }).where(inArray(bookItems.id, looseIds));
    }
    if (bundleIds.length > 0) {
      await db.update(packageItems).set({ status: "in_stock" }).where(inArray(packageItems.id, bundleIds));
    }

    await db.delete(transferShipmentItems).where(eq(transferShipmentItems.shipmentId, id));
    await db.delete(transferShipments).where(eq(transferShipments.id, id));

    return c.json({ success: true, message: "Pengiriman transfer berhasil dihapus" });
  } catch (err) {
    return accessErrorResponse(c, err);
  }
});

