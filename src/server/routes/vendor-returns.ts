import { Hono } from "hono";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";
import { eq, desc, inArray } from "drizzle-orm";
import { db } from "../../db";
import {
  vendorReturns,
  vendorReturnItems,
  suppliers,
  books,
  bookItems,
} from "../../db/schema";
import {
  accessErrorResponse,
  resolveLogisticsActor,
} from "../services/access-scope";

export const vendorReturnsRouter = new Hono();

const createVendorReturnSchema = z.object({
  supplierId: z.string().min(1, "Supplier wajib dipilih"),
  purchaseOrderId: z.string().optional(),
  reason: z.string().min(3, "Alasan retur minimal 3 karakter"),
  creditNoteAmount: z.number().int().min(0).default(0),
  items: z.array(
    z.object({
      bookId: z.string().min(1, "Buku wajib dipilih"),
      quantity: z.number().int().min(1, "Kuantitas minimal 1"),
      reason: z.string().optional(),
    })
  ).min(1, "Minimal 1 jenis buku yang diretur"),
});

// 1. GET list vendor returns
vendorReturnsRouter.get("/", async (c) => {
  try {
    await resolveLogisticsActor(c);

    const returns = await db
      .select({
        id: vendorReturns.id,
        returnNumber: vendorReturns.returnNumber,
        supplierId: vendorReturns.supplierId,
        supplierName: suppliers.name,
        purchaseOrderId: vendorReturns.purchaseOrderId,
        status: vendorReturns.status,
        reason: vendorReturns.reason,
        creditNoteAmount: vendorReturns.creditNoteAmount,
        createdAt: vendorReturns.createdAt,
        updatedAt: vendorReturns.updatedAt,
      })
      .from(vendorReturns)
      .innerJoin(suppliers, eq(vendorReturns.supplierId, suppliers.id))
      .orderBy(desc(vendorReturns.createdAt));

    const returnIds = returns.map((r: { id: string }) => r.id);
    const allItems = returnIds.length > 0
      ? await db
          .select({
            id: vendorReturnItems.id,
            vendorReturnId: vendorReturnItems.vendorReturnId,
            bookId: vendorReturnItems.bookId,
            bookTitle: books.title,
            isbn: books.isbn,
            quantity: vendorReturnItems.quantity,
            reason: vendorReturnItems.reason,
          })
          .from(vendorReturnItems)
          .innerJoin(books, eq(vendorReturnItems.bookId, books.id))
          .where(inArray(vendorReturnItems.vendorReturnId, returnIds))
      : [];

    type ItemRow = (typeof allItems)[number];
    const itemsByReturn = new Map<string, ItemRow[]>();
    for (const it of allItems) {
      const list = itemsByReturn.get(it.vendorReturnId) || [];
      list.push(it);
      itemsByReturn.set(it.vendorReturnId, list);
    }

    const data = returns.map((r: (typeof returns)[number]) => ({
      ...r,
      items: itemsByReturn.get(r.id) || [],
    }));

    return c.json({ success: true, data });
  } catch (err) {
    return accessErrorResponse(c, err);
  }
});

// 2. POST create vendor return (RTV - Return to Vendor)
vendorReturnsRouter.post("/", zValidator("json", createVendorReturnSchema), async (c) => {
  try {
    await resolveLogisticsActor(c);
    const body = c.req.valid("json");

    const now = new Date().toISOString();
    const returnId = crypto.randomUUID();
    const returnNumber = `RTV-${Date.now().toString().slice(-6)}-${Math.floor(Math.random() * 900 + 100)}`;

    await db.insert(vendorReturns).values({
      id: returnId,
      returnNumber,
      supplierId: body.supplierId,
      purchaseOrderId: body.purchaseOrderId || null,
      status: "completed",
      reason: body.reason,
      creditNoteAmount: body.creditNoteAmount,
      handledByUserId: null,
      createdAt: now,
      updatedAt: now,
    });

    for (const item of body.items) {
      await db.insert(vendorReturnItems).values({
        id: crypto.randomUUID(),
        vendorReturnId: returnId,
        bookId: item.bookId,
        quantity: item.quantity,
        reason: item.reason || null,
        createdAt: now,
      });

      // Tandai atau kurangi stok unit buku cacat/kelebihan menjadi 'damaged' atau 'disposed'
      const itemsToDeduct = await db
        .select()
        .from(bookItems)
        .where(eq(bookItems.bookId, item.bookId))
        .limit(item.quantity * 2);

      type BookItemDeduct = (typeof itemsToDeduct)[number];
      const validItems = itemsToDeduct
        .filter((bi: BookItemDeduct) => bi.status === "in_stock")
        .slice(0, item.quantity);

      for (const bi of validItems) {
        await db
          .update(bookItems)
          .set({
            status: "disposed",
            notes: `Returned to Vendor (RTV #${returnNumber})`,
            updatedAt: now,
          })
          .where(eq(bookItems.id, bi.id));
      }
    }

    return c.json(
      {
        success: true,
        message: `Retur ke supplier ${returnNumber} berhasil diterbitkan. Nota kredit dan pengurangan stok telah dicatat.`,
        data: { id: returnId, returnNumber },
      },
      201
    );
  } catch (err) {
    return accessErrorResponse(c, err);
  }
});
