import { Hono } from "hono";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";
import { eq } from "drizzle-orm";
import { db } from "../../db";
import { suppliers } from "../../db/schema";
import {
  createPurchaseOrder,
  deletePurchaseOrder,
  getPoReceiptHistory,
  listPOsWithItems,
  recordPoReceipt,
  resolveWarehouseTarget,
  sendPo,
} from "../services/purchase-order";
import type { EmailRuntimeEnv } from "../services/email/types";
import {
  accessErrorResponse,
  assertLocationAllowed,
  loadScopedPo,
  requireScopedLogisticsActor,
  resolveLogisticsActor,
} from "../services/access-scope";
import { idSchema } from "../lib/validators";
export const procurementRouter = new Hono();

const createSupplierSchema = z.object({
  code: z.string().min(1, "Kode supplier wajib diisi"),
  name: z.string().min(1, "Nama supplier wajib diisi"),
  contactPerson: z.string().optional(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  address: z.string().optional(),
});

const createPOSchema = z.object({
  supplierId: z.string().min(1, "Supplier wajib dipilih"),
  targetSchoolId: idSchema.optional(),
  orderDate: z.string().min(1, "Tanggal order wajib diisi"),
  expectedArrivalDate: z.string().optional(),
  notes: z.string().optional(),
  items: z.array(
    z.object({
      bookId: z.string().min(1, "Buku wajib dipilih"),
      quantityOrdered: z.number().int().min(1, "Jumlah minimal 1"),
      unitPrice: z.number().int().min(0).optional(),
      discountPercent: z.number().min(0, "Diskon tidak boleh negatif").max(100, "Diskon maksimal 100 persen").default(0),
    })
  ).min(1, "Minimal 1 buku dalam PO"),
});

const receivePOSchema = z.object({
  deliveryNoteNumber: z.string().min(1, "Nomor Surat Jalan supplier wajib diisi"),
  receivedDate: z.string().optional(),
  notes: z.string().optional(),
  receivedItems: z.array(
    z.object({
      poItemId: idSchema,
      quantityToReceive: z.number().int().min(1),
      condition: z.enum(["good", "damaged"]).default("good"),
    })
  ).min(1, "Item yang diterima wajib ada"),
});

// 1. GET & POST Suppliers
procurementRouter.get("/suppliers", async (c) => {
  try {
    await resolveLogisticsActor(c);
    const allSuppliers = await db.select().from(suppliers);
    return c.json({ success: true, data: allSuppliers });
  } catch (err) {
    return accessErrorResponse(c, err);
  }
});

procurementRouter.post("/suppliers", zValidator("json", createSupplierSchema), async (c) => {
  try {
    await resolveLogisticsActor(c);
    const body = c.req.valid("json");
  const now = new Date().toISOString();
  const id = crypto.randomUUID();

  const [existing] = await db.select().from(suppliers).where(eq(suppliers.code, body.code));
  if (existing) {
    return c.json({ success: false, message: "Kode supplier sudah terdaftar" }, 400);
  }

  await db.insert(suppliers).values({
    id,
    code: body.code,
    name: body.name,
    contactPerson: body.contactPerson || null,
    email: body.email || null,
    phone: body.phone || null,
    address: body.address || null,
    createdAt: now,
    updatedAt: now,
  });

  const [created] = await db.select().from(suppliers).where(eq(suppliers.id, id));
  return c.json({ success: true, data: created }, 201);
  } catch (err) {
    return accessErrorResponse(c, err);
  }
});

// 2. GET Purchase Orders
procurementRouter.get("/purchase-orders", async (c) => {
  try {
    const { scope } = await requireScopedLogisticsActor(db, c);
    const data = await listPOsWithItems(db, scope);
    return c.json({ success: true, data });
  } catch (err) {
    return accessErrorResponse(c, err);
  }
});

// 3. POST Create Purchase Order (thin caller di atas seam modul PO)
procurementRouter.post("/purchase-orders", zValidator("json", createPOSchema), async (c) => {
  try {
    const { actor, locations } = await requireScopedLogisticsActor(db, c);
    const body = c.req.valid("json");
    const target = await resolveWarehouseTarget(db, body.targetSchoolId);
    if (!target.ok) {
      return c.json({ success: false, message: target.message }, 400);
    }
    assertLocationAllowed(actor, target.warehouseId, locations);
    const result = await createPurchaseOrder(db, body);
    if (!result.ok) {
      return c.json({ success: false, message: result.message }, result.status);
    }
    return c.json({
      success: true,
      message: "Purchase Order berhasil diterbitkan",
      data: result.data,
    }, 201);
  } catch (err) {
    return accessErrorResponse(c, err);
  }
});

// 4. POST Receive Goods from PO with Delivery Note (Surat Jalan)
procurementRouter.post("/purchase-orders/:id/receive", zValidator("json", receivePOSchema), async (c) => {
  try {
    const { actor, locations } = await requireScopedLogisticsActor(db, c);
    const poId = c.req.param("id");
    const body = c.req.valid("json");

    const scoped = await loadScopedPo(db, actor, locations, poId);
    if (!scoped.ok) {
      return c.json({ success: false, message: scoped.message }, scoped.status);
    }

    const { deliveryNoteNumber } = body;
    const result = await recordPoReceipt(db, poId, body);
    if (!result.ok) {
      return c.json({ success: false, message: result.message }, result.status);
    }

    return c.json({
      success: true,
      message: `Surat Jalan ${deliveryNoteNumber} tercatat: berhasil menerima ${result.data.totalReceivedThisBatch} eksemplar buku`,
      data: result.data,
    });
  } catch (err) {
    return accessErrorResponse(c, err);
  }
});

// 4b. GET Delivery Receipts History for PO
procurementRouter.get("/purchase-orders/:id/receipts", async (c) => {
  try {
    const { actor, locations } = await requireScopedLogisticsActor(db, c);
    const poId = c.req.param("id");

    const scoped = await loadScopedPo(db, actor, locations, poId);
    if (!scoped.ok) {
      return c.json({ success: false, message: scoped.message }, scoped.status);
    }

    const history = await getPoReceiptHistory(db, poId);
    return c.json({ success: true, data: history });
  } catch (err) {
    return accessErrorResponse(c, err);
  }
});

// 5. POST Send Purchase Order to supplier email (with delivery trail)
procurementRouter.post("/purchase-orders/:id/send", async (c) => {
  try {
    const { actor, locations } = await requireScopedLogisticsActor(db, c);
    const scoped = await loadScopedPo(db, actor, locations, c.req.param("id"));
    if (!scoped.ok) {
      return c.json({ success: false, message: scoped.message }, scoped.status);
    }
    const po = scoped.po;

    const result = await sendPo(
      db,
      c.req.param("id"),
      c.env as unknown as EmailRuntimeEnv | undefined
    );
    if (!result.ok) {
      return c.json(
        { success: false, message: result.message, data: { status: po.status } },
        result.status
      );
    }

    if (result.simulated) {
      return c.json({
        success: true,
        simulated: true,
        message: result.message,
        data: result.data,
      });
    }

    return c.json({
      success: true,
      message: result.message,
      data: result.data,
    });
  } catch (err) {
    return accessErrorResponse(c, err);
  }
});

// 6. DELETE Purchase Order (khusus PO yang belum pernah menerima barang)
procurementRouter.delete("/purchase-orders/:id", async (c) => {
  try {
    const { actor, locations } = await requireScopedLogisticsActor(db, c);
    const poId = c.req.param("id");

    const scoped = await loadScopedPo(db, actor, locations, poId);
    if (!scoped.ok) {
      return c.json({ success: false, message: scoped.message }, scoped.status);
    }

    const result = await deletePurchaseOrder(db, poId);
    if (!result.ok) {
      return c.json({ success: false, message: result.message }, result.status);
    }

    return c.json({ success: true, message: `Purchase Order "${result.data.poNumber}" berhasil dihapus` });
  } catch (err) {
    return accessErrorResponse(c, err);
  }
});
