import { Hono } from "hono";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";
import { eq, desc, inArray } from "drizzle-orm";
import { db } from "../../db";
import { suppliers, purchaseOrders, purchaseOrderItems, books, schools } from "../../db/schema";
import { sendPo, withSendReadiness, deletePurchaseOrder } from "../services/po-lifecycle";
import { resolveWarehouseTarget, createPurchaseOrder } from "../services/po-workflow";
import { recordPoReceipt, getPoReceiptHistory } from "../services/po-receipt";
import type { EmailRuntimeEnv } from "../services/email/types";
import {
  accessErrorResponse,
  assertLocationAllowed,
  requireScopedLogisticsActor,
  resolveLogisticsActor,
} from "../services/access-scope";
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
  targetSchoolId: z.string().min(1).optional(),
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
      poItemId: z.string().min(1),
      quantityToReceive: z.number().int().min(1),
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
    const { locations, scope: scopeList } = await requireScopedLogisticsActor(db, c);
    const scope = new Set(scopeList);
    const scopedOnly = scope.size < locations.length;
    const pos = await db
    .select({
      id: purchaseOrders.id,
      poNumber: purchaseOrders.poNumber,
      supplierId: purchaseOrders.supplierId,
      supplierName: suppliers.name,
      supplierEmail: suppliers.email,
      targetSchoolId: purchaseOrders.targetSchoolId,
      schoolName: schools.name,
      status: purchaseOrders.status,
      orderDate: purchaseOrders.orderDate,
      expectedArrivalDate: purchaseOrders.expectedArrivalDate,
      subtotalGross: purchaseOrders.subtotalGross,
      discountTotal: purchaseOrders.discountTotal,
      totalAmount: purchaseOrders.totalAmount,
      notes: purchaseOrders.notes,
      printedAt: purchaseOrders.printedAt,
      signedDocUrl: purchaseOrders.signedDocUrl,
      signedDocName: purchaseOrders.signedDocName,
      signedDocType: purchaseOrders.signedDocType,
      signedDocUploadedAt: purchaseOrders.signedDocUploadedAt,
      sentAt: purchaseOrders.sentAt,
      sentTo: purchaseOrders.sentTo,
      createdAt: purchaseOrders.createdAt,
    })
    .from(purchaseOrders)
    .innerJoin(suppliers, eq(purchaseOrders.supplierId, suppliers.id))
    .innerJoin(schools, eq(purchaseOrders.targetSchoolId, schools.id))
    .orderBy(desc(purchaseOrders.createdAt));

  // Attach items — satu query batch untuk semua PO (bukan N+1 per PO).
  const poIds = pos.map((po: any) => po.id as string);
  const allItems = poIds.length > 0
    ? await db
      .select({
        purchaseOrderId: purchaseOrderItems.purchaseOrderId,
        id: purchaseOrderItems.id,
        bookId: purchaseOrderItems.bookId,
        title: books.title,
        isbn: books.isbn,
        quantityOrdered: purchaseOrderItems.quantityOrdered,
        quantityReceived: purchaseOrderItems.quantityReceived,
        unitPrice: purchaseOrderItems.unitPrice,
        discountPercent: purchaseOrderItems.discountPercent,
      })
      .from(purchaseOrderItems)
      .innerJoin(books, eq(purchaseOrderItems.bookId, books.id))
      .where(inArray(purchaseOrderItems.purchaseOrderId, poIds))
    : [];
  const itemsByPo = new Map<string, typeof allItems>();
  for (const it of allItems) {
    const list = itemsByPo.get(it.purchaseOrderId) ?? [];
    list.push(it);
    itemsByPo.set(it.purchaseOrderId, list);
  }
  const withItems = pos.map((po: any) => ({
    ...po,
    items: itemsByPo.get(po.id) ?? [],
  }));
  // Kelayakan kirim diturunkan sekali di modul (satu panggilan), bukan per baris di route.
  const results = withSendReadiness(withItems);

  const visible = scopedOnly ? results.filter((po: any) => scope.has(po.targetSchoolId)) : results;
  return c.json({ success: true, data: visible });
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

    const [po] = await db.select().from(purchaseOrders).where(eq(purchaseOrders.id, poId));
    if (!po) {
      return c.json({ success: false, message: "Purchase Order tidak ditemukan" }, 404);
    }
    assertLocationAllowed(actor, po.targetSchoolId, locations);

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

    const [po] = await db.select().from(purchaseOrders).where(eq(purchaseOrders.id, poId));
    if (!po) {
      return c.json({ success: false, message: "Purchase Order tidak ditemukan" }, 404);
    }
    assertLocationAllowed(actor, po.targetSchoolId, locations);

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
    const [po] = await db.select().from(purchaseOrders).where(eq(purchaseOrders.id, c.req.param("id")));
    if (!po) {
      return c.json({ success: false, message: "Purchase Order tidak ditemukan" }, 404);
    }
    assertLocationAllowed(actor, po.targetSchoolId, locations);

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

    const [po] = await db.select().from(purchaseOrders).where(eq(purchaseOrders.id, poId));
    if (!po) {
      return c.json({ success: false, message: "Purchase Order tidak ditemukan" }, 404);
    }
    assertLocationAllowed(actor, po.targetSchoolId, locations);

    const result = await deletePurchaseOrder(db, poId);
    if (!result.ok) {
      return c.json({ success: false, message: result.message }, result.status);
    }

    return c.json({ success: true, message: `Purchase Order "${result.data.poNumber}" berhasil dihapus` });
  } catch (err) {
    return accessErrorResponse(c, err);
  }
});
