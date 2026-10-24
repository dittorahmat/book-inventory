import { and, eq } from "drizzle-orm";
import {
  uniformExchanges,
  uniformOrders,
  uniformPoItems,
  uniformPos,
  uniformRefunds,
  uniformRejects,
  uniformStock,
  students,
} from "../../db/schema";
import type { SeedContext } from "./context";

export async function seedDemoUniform({ db: targetDb, now }: SeedContext) {
  await targetDb
    .update(uniformOrders)
    .set({
      paymentStatus: "partial",
      paidAmount: 100000,
      shippingCost: 15000,
      shippingResi: "JNE-SRG-0001",
      invoiceSentAt: now,
      updatedAt: now,
    })
    .where(eq(uniformOrders.id, "ord-demo-uso-01"));

  await targetDb
    .update(uniformOrders)
    .set({
      paymentStatus: "paid",
      paidAmount: 230000,
      shippingCost: 25000,
      shippingResi: "JNE-SRG-0002",
      invoiceSentAt: now,
      shipmentStatus: "sudah_dikirim",
      shippedAt: now,
      updatedAt: now,
    })
    .where(eq(uniformOrders.id, "ord-demo-uso-02"));
  await targetDb
    .update(students)
    .set({ hasTakenUniform: true, updatedAt: now })
    .where(eq(students.id, "std-farhan-3"));

  await targetDb
    .update(uniformOrders)
    .set({
      paymentStatus: "unpaid",
      paidAmount: 0,
      shippingCost: 18000,
      shippingResi: "JNE-SRG-0003",
      invoiceSentAt: now,
      updatedAt: now,
    })
    .where(eq(uniformOrders.id, "ord-demo-uso-03"));

  await targetDb
    .update(uniformOrders)
    .set({ paymentStatus: "unpaid", paidAmount: 0, updatedAt: now })
    .where(eq(uniformOrders.id, "ord-demo-uso-04"));

  // PO seragam yang masih bisa diterima bertahap.
  await targetDb
    .insert(uniformPos)
    .values({
      id: "upo-demo-02",
      poNumber: "UPO-DEMO-2026-02",
      supplierId: "sup-demo-konveksi",
      status: "partially_received",
      orderDate: now.slice(0, 10),
      totalAmount: 4600000,
      notes: "Pengadaan seragam SD lanjutan (diterima sebagian).",
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: uniformPos.id,
      set: { status: "partially_received", updatedAt: now },
    });
  const poLines = [
    { id: "upoi-demo-02-1", variantId: "uv-demo-kain-sd-m", size: "—", qty: 20, received: 5, price: 120000 },
    { id: "upoi-demo-02-2", variantId: "uv-demo-ol-sd-m", size: "M", qty: 20, received: 0, price: 110000 },
  ];
  for (const line of poLines) {
    await targetDb
      .insert(uniformPoItems)
      .values({
        id: line.id,
        poId: "upo-demo-02",
        variantId: line.variantId,
        size: line.size,
        quantityOrdered: line.qty,
        quantityReceived: line.received,
        unitPrice: line.price,
        createdAt: now,
      })
      .onConflictDoUpdate({
        target: uniformPoItems.id,
        set: { quantityReceived: line.received },
      });
  }

  await targetDb
    .insert(uniformRejects)
    .values({
      id: "ur-demo-01",
      variantId: "uv-demo-ol-sd-f",
      size: "M",
      quantity: 2,
      reason: "Jahitan lepas pada lengan olahraga.",
      createdAt: now,
    })
    .onConflictDoNothing();

  // Satu tukar ukuran selesai + satu refund selesai, agar antrean tidak kosong.
  await targetDb
    .insert(uniformExchanges)
    .values({
      id: "ex-demo-02",
      orderId: "ord-demo-uso-02",
      studentId: "std-farhan-3",
      oldVariantId: "uv-demo-ol-sd-m",
      oldSize: "M",
      newVariantId: "uv-demo-ol-sd-m",
      newSize: "L",
      reason: "Ukuran M kekecilan, minta L.",
      status: "completed",
      handledByUserId: "usr-admin-seragam",
      resolvedAt: now,
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: uniformExchanges.id,
      set: { status: "completed", resolvedAt: now, updatedAt: now },
    });
  await targetDb
    .update(uniformStock)
    .set({ quantity: 16, updatedAt: now })
    .where(and(eq(uniformStock.variantId, "uv-demo-ol-sd-m"), eq(uniformStock.size, "M")));
  await targetDb
    .update(uniformStock)
    .set({ quantity: 14, updatedAt: now })
    .where(and(eq(uniformStock.variantId, "uv-demo-ol-sd-m"), eq(uniformStock.size, "L")));

  await targetDb
    .insert(uniformRefunds)
    .values({
      id: "rf-demo-02",
      refundNumber: "RFD-U-DEMO-02",
      orderId: "ord-demo-uso-03",
      studentId: "std-farhan-3",
      amount: 50000,
      reason: "Potongan kain tidak rapi.",
      status: "refunded",
      handledByUserId: "usr-admin-seragam",
      resolvedAt: now,
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: uniformRefunds.id,
      set: { status: "refunded", resolvedAt: now, updatedAt: now },
    });
}
