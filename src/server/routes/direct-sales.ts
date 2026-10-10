import { Hono } from "hono";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";
import { eq } from "drizzle-orm";
import { db } from "../../db";
import {
  studentBookOrders,
  studentOrderItems,
  orderPayments,
  bookItems,
  books,
  schools,
} from "../../db/schema";
import {
  accessErrorResponse,
  resolveLogisticsActor,
} from "../services/access-scope";
import { effectiveSellPrice } from "../../lib/book-pricing";

export const directSalesRouter = new Hono();

const directSaleSchema = z.object({
  schoolId: z.string().min(1, "Lokasi gudang wajib dipilih"),
  buyerName: z.string().min(1, "Nama pembeli / orang tua wajib diisi"),
  buyerPhone: z.string().min(6, "Nomor telepon / WA wajib diisi"),
  studentNis: z.string().optional(),
  paymentMethod: z.enum(["cash", "transfer"]).default("cash"),
  referenceNumber: z.string().optional(),
  notes: z.string().optional(),
  items: z.array(
    z.object({
      bookId: z.string().min(1, "Buku wajib dipilih"),
      quantity: z.number().int().min(1, "Kuantitas minimal 1"),
    })
  ).min(1, "Minimal 1 buku dipilih"),
});

// POST direct sale to parent from Central Warehouse
directSalesRouter.post("/", zValidator("json", directSaleSchema), async (c) => {
  try {
    await resolveLogisticsActor(c);
    const body = c.req.valid("json");

    // Validasi lokasi wajib warehouse (Gudang Pusat)
    const [loc] = await db.select().from(schools).where(eq(schools.id, body.schoolId));
    if (!loc || loc.type !== "warehouse") {
      return c.json(
        { success: false, message: "Penjualan satuan langsung ke ortu hanya dapat dilakukan di Gudang Pusat (HQ)." },
        403
      );
    }

    const now = new Date().toISOString();
    const orderId = crypto.randomUUID();
    const orderNumber = `DIR-${Date.now().toString().slice(-6)}-${Math.floor(Math.random() * 900 + 100)}`;

    // Ambil info buku dan hitung total
    let totalAmount = 0;
    const saleLines: Array<{ bookId: string; title: string; quantity: number; unitPrice: number }> = [];

    for (const item of body.items) {
      const [book] = await db.select().from(books).where(eq(books.id, item.bookId));
      if (!book) {
        return c.json({ success: false, message: `Buku dengan ID ${item.bookId} tidak ditemukan` }, 404);
      }
      const unitPrice = effectiveSellPrice(book);
      totalAmount += unitPrice * item.quantity;
      saleLines.push({
        bookId: item.bookId,
        title: book.title,
        quantity: item.quantity,
        unitPrice,
      });

      // Periksa ketersediaan stok satuan loose di gudang
      const availableItems = await db
        .select()
        .from(bookItems)
        .where(eq(bookItems.bookId, item.bookId))
        .limit(item.quantity);

      type BookItemRow = (typeof availableItems)[number];
      const inStockLoose = availableItems.filter(
        (bi: BookItemRow) => bi.currentSchoolId === body.schoolId && bi.status === "in_stock"
      );

      if (inStockLoose.length < item.quantity) {
        return c.json(
          {
            success: false,
            message: `Stok satuan tidak mencukupi untuk "${book.title}". Tersedia: ${inStockLoose.length}, diminta: ${item.quantity}`,
          },
          400
        );
      }
    }

    // Buat pesanan
    await db.insert(studentBookOrders).values({
      id: orderId,
      orderNumber,
      schoolId: body.schoolId,
      studentId: null, // Penjualan langsung direct walk-in
      packageId: null,
      totalAmount,
      paidAmount: totalAmount,
      paymentStatus: "paid",
      fulfillmentStatus: "picked_up",
      handoverDate: now,
      handoverRecipient: body.buyerName,
      notes: `Direct Sale: ${body.buyerName} (${body.buyerPhone})${body.notes ? " - " + body.notes : ""}`,
      orderType: "regular",
      createdAt: now,
      updatedAt: now,
    });

    // Masukkan detail item & alokasikan stok satuan fisik menjadi 'sold'
    for (const line of saleLines) {
      await db.insert(studentOrderItems).values({
        id: crypto.randomUUID(),
        orderId,
        bookId: line.bookId,
        quantity: line.quantity,
        unitPrice: line.unitPrice,
        createdAt: now,
      });

      const itemsToDeduct = await db
        .select()
        .from(bookItems)
        .where(eq(bookItems.bookId, line.bookId))
        .limit(line.quantity * 2);

      type ItemToDeductRow = (typeof itemsToDeduct)[number];
      const validItems = itemsToDeduct
        .filter((bi: ItemToDeductRow) => bi.currentSchoolId === body.schoolId && bi.status === "in_stock")
        .slice(0, line.quantity);

      for (const bi of validItems) {
        await db
          .update(bookItems)
          .set({ status: "sold", updatedAt: now })
          .where(eq(bookItems.id, bi.id));
      }
    }

    // Catat pembayaran lunas
    await db.insert(orderPayments).values({
      id: crypto.randomUUID(),
      orderId,
      transferAmount: totalAmount,
      bookAllocationAmount: totalAmount,
      bankName: body.paymentMethod === "cash" ? "KAS TUNAI" : "TRANSFER DIRECT",
      referenceNumber: body.referenceNumber || `RECEIPT-${Date.now().toString().slice(-6)}`,
      paymentDate: now,
      verificationStatus: "verified",
      createdAt: now,
    });

    return c.json(
      {
        success: true,
        message: `Penjualan langsung ${orderNumber} berhasil diproses. Stok fisik telah dikurangkan.`,
        data: {
          id: orderId,
          orderNumber,
          totalAmount,
          buyerName: body.buyerName,
        },
      },
      201
    );
  } catch (err) {
    return accessErrorResponse(c, err);
  }
});
