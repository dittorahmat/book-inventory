import { Hono } from "hono";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";
import { eq, desc } from "drizzle-orm";
import { db } from "../../db";
import { suppliers, purchaseOrders, purchaseOrderItems, books, bookItems, schools } from "../../db/schema";

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
  targetSchoolId: z.string().min(1, "Sekolah tujuan wajib dipilih"),
  orderDate: z.string().min(1, "Tanggal order wajib diisi"),
  expectedArrivalDate: z.string().optional(),
  notes: z.string().optional(),
  items: z.array(
    z.object({
      bookId: z.string().min(1, "Buku wajib dipilih"),
      quantityOrdered: z.number().int().min(1, "Jumlah minimal 1"),
      unitPrice: z.number().int().min(0).default(0),
    })
  ).min(1, "Minimal 1 buku dalam PO"),
});

const receivePOSchema = z.object({
  receivedItems: z.array(
    z.object({
      poItemId: z.string().min(1),
      quantityToReceive: z.number().int().min(1),
    })
  ).min(1, "Item yang diterima wajib ada"),
});

// 1. GET & POST Suppliers
procurementRouter.get("/suppliers", async (c) => {
  const allSuppliers = await db.select().from(suppliers);
  return c.json({ success: true, data: allSuppliers });
});

procurementRouter.post("/suppliers", zValidator("json", createSupplierSchema), async (c) => {
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
});

// 2. GET Purchase Orders
procurementRouter.get("/purchase-orders", async (c) => {
  const pos = await db
    .select({
      id: purchaseOrders.id,
      poNumber: purchaseOrders.poNumber,
      supplierId: purchaseOrders.supplierId,
      supplierName: suppliers.name,
      targetSchoolId: purchaseOrders.targetSchoolId,
      schoolName: schools.name,
      status: purchaseOrders.status,
      orderDate: purchaseOrders.orderDate,
      expectedArrivalDate: purchaseOrders.expectedArrivalDate,
      totalAmount: purchaseOrders.totalAmount,
      notes: purchaseOrders.notes,
      createdAt: purchaseOrders.createdAt,
    })
    .from(purchaseOrders)
    .innerJoin(suppliers, eq(purchaseOrders.supplierId, suppliers.id))
    .innerJoin(schools, eq(purchaseOrders.targetSchoolId, schools.id))
    .orderBy(desc(purchaseOrders.createdAt));

  // Attach items
  const results = await Promise.all(
    pos.map(async (po: any) => {
      const items = await db
        .select({
          id: purchaseOrderItems.id,
          bookId: purchaseOrderItems.bookId,
          title: books.title,
          isbn: books.isbn,
          quantityOrdered: purchaseOrderItems.quantityOrdered,
          quantityReceived: purchaseOrderItems.quantityReceived,
          unitPrice: purchaseOrderItems.unitPrice,
        })
        .from(purchaseOrderItems)
        .innerJoin(books, eq(purchaseOrderItems.bookId, books.id))
        .where(eq(purchaseOrderItems.purchaseOrderId, po.id));

      return {
        ...po,
        items,
      };
    })
  );

  return c.json({ success: true, data: results });
});

// 3. POST Create Purchase Order
procurementRouter.post("/purchase-orders", zValidator("json", createPOSchema), async (c) => {
  const body = c.req.valid("json");
  const now = new Date().toISOString();
  const id = crypto.randomUUID();
  const poNumber = `PO-${Date.now().toString().slice(-8)}`;

  const totalAmount = body.items.reduce((sum, item) => sum + item.quantityOrdered * item.unitPrice, 0);

  await db.insert(purchaseOrders).values({
    id,
    poNumber,
    supplierId: body.supplierId,
    targetSchoolId: body.targetSchoolId,
    status: "ordered",
    orderDate: body.orderDate,
    expectedArrivalDate: body.expectedArrivalDate || null,
    totalAmount,
    notes: body.notes || null,
    createdAt: now,
    updatedAt: now,
  });

  for (const item of body.items) {
    await db.insert(purchaseOrderItems).values({
      id: crypto.randomUUID(),
      purchaseOrderId: id,
      bookId: item.bookId,
      quantityOrdered: item.quantityOrdered,
      quantityReceived: 0,
      unitPrice: item.unitPrice,
      createdAt: now,
    });
  }

  const [created] = await db.select().from(purchaseOrders).where(eq(purchaseOrders.id, id));
  return c.json({ success: true, message: "Purchase Order berhasil diterbitkan", data: created }, 201);
});

// 4. POST Receive Goods from PO into Loose Inventory
procurementRouter.post("/purchase-orders/:id/receive", zValidator("json", receivePOSchema), async (c) => {
  const poId = c.req.param("id");
  const { receivedItems } = c.req.valid("json");
  const now = new Date().toISOString();

  const [po] = await db.select().from(purchaseOrders).where(eq(purchaseOrders.id, poId));
  if (!po) {
    return c.json({ success: false, message: "Purchase Order tidak ditemukan" }, 404);
  }

  let totalReceivedThisBatch = 0;

  for (const rec of receivedItems) {
    const [poItem] = await db
      .select()
      .from(purchaseOrderItems)
      .where(eq(purchaseOrderItems.id, rec.poItemId));

    if (!poItem) continue;

    const newReceived = poItem.quantityReceived + rec.quantityToReceive;
    await db
      .update(purchaseOrderItems)
      .set({ quantityReceived: newReceived })
      .where(eq(purchaseOrderItems.id, rec.poItemId));

    // Generate physical loose stock units in book_items
    for (let k = 0; k < rec.quantityToReceive; k++) {
      const barcode = `INB-PO-${Date.now().toString().slice(-6)}-${Math.floor(Math.random() * 1000)}`;
      await db.insert(bookItems).values({
        id: crypto.randomUUID(),
        bookId: poItem.bookId,
        currentSchoolId: po.targetSchoolId,
        barcode,
        condition: "new",
        status: "in_stock",
        notes: `Inbound receiving from ${po.poNumber}`,
        createdAt: now,
        updatedAt: now,
      });
      totalReceivedThisBatch++;
    }
  }

  // Check overall completion
  const allPoItems = await db
    .select()
    .from(purchaseOrderItems)
    .where(eq(purchaseOrderItems.purchaseOrderId, poId));

  const isAllReceived = allPoItems.every((item: any) => item.quantityReceived >= item.quantityOrdered);
  const newStatus = isAllReceived ? "received" : "partially_received";

  await db
    .update(purchaseOrders)
    .set({ status: newStatus, updatedAt: now })
    .where(eq(purchaseOrders.id, poId));

  return c.json({
    success: true,
    message: `Berhasil menerima ${totalReceivedThisBatch} eksamplar buku ke dalam stok satuan`,
    data: {
      poId,
      status: newStatus,
      totalReceivedThisBatch,
    },
  });
});
