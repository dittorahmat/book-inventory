import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { eq } from "drizzle-orm";
import { procurementRouter } from "./procurement";
import { poWorkflowRouter } from "./po-workflow";
import { mockActor, restoreActor } from "./test-actor";
import { createPurchaseOrder } from "../services/po-workflow";
import { calcPoHeader } from "../../lib/book-pricing";
import { db } from "../../db";
import { books, bookItems, purchaseOrders, purchaseOrderItems, suppliers } from "../../db/schema";

beforeEach(() => mockActor("central_admin", null));
afterEach(() => {
  restoreActor();
});

/** Bawa PO dari draft ke signed_uploaded: tandai dicetak lalu upload bukti TTD. */
async function advanceToSignedUploaded(poId: string) {
  const printRes = await poWorkflowRouter.request(`/purchase-orders/${poId}/print`, {
    method: "POST",
  });
  expect(printRes.status).toBe(200);

  const form = new FormData();
  form.append(
    "signedDoc",
    new File([new Uint8Array([1, 2, 3, 4])], "bukti-ttd.pdf", { type: "application/pdf" })
  );
  const uploadRes = await poWorkflowRouter.request(`/purchase-orders/${poId}/signed-doc`, {
    method: "POST",
    body: form,
  });
  expect(uploadRes.status).toBe(200);
  return uploadRes.json();
}

describe("Supplier Procurement & Purchase Order API", () => {
  it("registers supplier, creates purchase order, and receives inbound loose books", async () => {
    const now = new Date().toISOString();

    const bookId = `b-po-${Date.now()}`;
    await db.insert(books).values({
      id: bookId,
      isbn: `ISBN-PO-${Date.now()}`,
      title: "English Checkpoint 1",
      author: "Cambridge",
      publisher: "CUP",
      createdAt: now,
      updatedAt: now,
    });

    // 1. Create Supplier
    const supRes = await procurementRouter.request("/suppliers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        code: `SUP-ERL-${Date.now()}`,
        name: "Penerbit Erlangga",
        contactPerson: "Bpk. Suryono",
        email: "sales@erlangga.co.id",
        phone: "+62218765432",
      }),
    });
    expect(supRes.status).toBe(201);
    const supJson = await supRes.json();
    const supplierId = supJson.data.id;

    // 2. Create Purchase Order for 50 books
    const poRes = await procurementRouter.request("/purchase-orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        supplierId,
        orderDate: "2026-09-24",
        notes: "Pengadaan awal tahun ajaran baru",
        items: [
          {
            bookId,
            quantityOrdered: 50,
            unitPrice: 85000,
          },
        ],
      }),
    });
    expect(poRes.status).toBe(201);
    const poJson = await poRes.json();
    const poId = poJson.data.id;
    expect(poJson.data.status).toBe("draft");

    // 3. Query PO to get the purchaseOrderItem id
    const listRes = await procurementRouter.request("/purchase-orders", { method: "GET" });
    const listJson = await listRes.json();
    const createdPO = listJson.data.find((p: any) => p.id === poId);
    expect(createdPO).toBeDefined();
    const poItemId = createdPO.items[0].id;

    // 4. Inbound receiving (Partial 20 units) with Surat Jalan
    const recRes = await procurementRouter.request(`/purchase-orders/${poId}/receive`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        deliveryNoteNumber: "SJ-PARTIAL-1",
        receivedItems: [
          {
            poItemId,
            quantityToReceive: 20,
          },
        ],
      }),
    });
    expect(recRes.status).toBe(200);
    const recJson = await recRes.json();
    expect(recJson.data.status).toBe("partially_received");
    expect(recJson.data.totalReceivedThisBatch).toBe(20);

    // 5. Inbound receiving remainder (30 units) with Surat Jalan 2 -> status should become received
    const recFinalRes = await procurementRouter.request(`/purchase-orders/${poId}/receive`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        deliveryNoteNumber: "SJ-PARTIAL-2",
        receivedItems: [
          {
            poItemId,
            quantityToReceive: 30,
          },
        ],
      }),
    });
    expect(recFinalRes.status).toBe(200);
    const recFinalJson = await recFinalRes.json();
    expect(recFinalJson.data.status).toBe("received");

    // 6. Verifikasi histori Surat Jalan
    const receiptsRes = await procurementRouter.request(`/purchase-orders/${poId}/receipts`, { method: "GET" });
    expect(receiptsRes.status).toBe(200);
    const receiptsJson = await receiptsRes.json();
    expect(receiptsJson.data.length).toBe(2);
    expect(receiptsJson.data.some((r: any) => r.deliveryNoteNumber === "SJ-PARTIAL-1")).toBe(true);
    expect(receiptsJson.data.some((r: any) => r.deliveryNoteNumber === "SJ-PARTIAL-2")).toBe(true);
  });

  it("receives 30 units in one batch without 500 and rejects over-receive with 400 (§10 D1 regression)", async () => {
    const stamp = Date.now();
    const now = new Date().toISOString();
    const bookId = `b-bulk-${stamp}`;
    let poId = "";
    let supplierId = "";

    try {
      await db.insert(books).values({
        id: bookId,
        isbn: `ISBN-BULK-${stamp}`,
        title: "Buku Bulk 30 Test",
        author: "QA",
        publisher: "QA",
        createdAt: now,
        updatedAt: now,
      });

      const supRes = await procurementRouter.request("/suppliers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: `SUP-BULK-${stamp}`, name: "Supplier Bulk Test" }),
      });
      expect(supRes.status).toBe(201);
      supplierId = (await supRes.json()).data.id;

      const poRes = await procurementRouter.request("/purchase-orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          supplierId,
          orderDate: "2026-10-08",
          items: [{ bookId, quantityOrdered: 30, unitPrice: 300000 }],
        }),
      });
      expect(poRes.status).toBe(201);
      poId = (await poRes.json()).data.id;

      const listJson = await (await procurementRouter.request("/purchase-orders", { method: "GET" })).json();
      const poItemId = listJson.data.find((p: any) => p.id === poId).items[0].id;

      // 30 eks sekaligus: satu panggilan, wajib 200 + 30 barcode tercipta.
      const bulkRes = await procurementRouter.request(`/purchase-orders/${poId}/receive`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          deliveryNoteNumber: "SJ-BULK-01",
          receivedItems: [{ poItemId, quantityToReceive: 30 }],
        }),
      });
      expect(bulkRes.status).toBe(200);
      const bulkJson = await bulkRes.json();
      expect(bulkJson.data.status).toBe("received");
      expect(bulkJson.data.totalReceivedThisBatch).toBe(30);

      const created = await db.select().from(bookItems).where(eq(bookItems.bookId, bookId));
      expect(created.length).toBe(30);
      expect(new Set(created.map((b: any) => b.barcode)).size).toBe(30);

      // Over-receive setelah lunas: 400, bukan 500.
      const overRes = await procurementRouter.request(`/purchase-orders/${poId}/receive`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          deliveryNoteNumber: "SJ-BULK-OVER",
          receivedItems: [{ poItemId, quantityToReceive: 1 }],
        }),
      });
      expect(overRes.status).toBe(400);
      expect((await overRes.json()).message).toMatch(/melebihi sisa/);

      // poItemId asing: 400, bukan 500.
      const foreignRes = await procurementRouter.request(`/purchase-orders/${poId}/receive`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ receivedItems: [{ poItemId: `po-item-asing-${stamp}`, quantityToReceive: 1 }] }),
      });
      expect(foreignRes.status).toBe(400);
    } finally {
      if (poId) {
        await db.delete(purchaseOrderItems).where(eq(purchaseOrderItems.purchaseOrderId, poId));
        await db.delete(purchaseOrders).where(eq(purchaseOrders.id, poId));
      }
      await db.delete(bookItems).where(eq(bookItems.bookId, bookId));
      await db.delete(books).where(eq(books.id, bookId));
      if (supplierId) await db.delete(suppliers).where(eq(suppliers.id, supplierId));
    }
  });

  it("sends PO to supplier email with trail, rejects missing email, resend updates trail", async () => {
    const stamp = Date.now();
    const now = new Date().toISOString();
    const realFetch = globalThis.fetch;

    try {
      // Supplier dengan email valid + buku
      const bookId = `b-send-${stamp}`;
      await db.insert(books).values({
        id: bookId,
        isbn: `ISBN-SEND-${stamp}`,
        title: "Buku Kirim Test",
        author: "Test",
        publisher: "Test",
        createdAt: now,
        updatedAt: now,
      }).onConflictDoNothing();

      const supRes = await procurementRouter.request("/suppliers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: `SUP-SEND-${stamp}`,
          name: "Supplier Kirim Test",
          email: "pengadaan@supplier-test.co.id",
        }),
      });
      expect(supRes.status).toBe(201);
      const supplierId = (await supRes.json()).data.id;

      const poRes = await procurementRouter.request("/purchase-orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          supplierId,
          orderDate: "2026-09-28",
          notes: "PO uji kirim email",
          items: [{ bookId, quantityOrdered: 10, unitPrice: 50000 }],
        }),
      });
      expect(poRes.status).toBe(201);
      const poId = (await poRes.json()).data.id;

      // Alur baru: draft -> printed -> signed_uploaded sebelum boleh kirim
      await advanceToSignedUploaded(poId);

      // 1. Kirim sukses (Brevo di-stub 201, kredensial via c.env)
      globalThis.fetch = (async () =>
        new Response(JSON.stringify({ messageId: "<po-send-1>" }), { status: 201 })) as any;

      const sendRes = await procurementRouter.request(
        `/purchase-orders/${poId}/send`,
        { method: "POST" },
        { BREVO_API_KEY: "xkeysib-test-kirim" }
      );
      expect(sendRes.status).toBe(200);
      const sendJson = await sendRes.json();
      expect(sendJson.success).toBe(true);
      expect(sendJson.data.kind).toBe("sent");
      expect(sendJson.data.provider).toBe("brevo");
      expect(sendJson.data.sentTo).toBe("pengadaan@supplier-test.co.id");
      expect(sendJson.data.sentAt).toBeTruthy();

      const listRes = await procurementRouter.request("/purchase-orders", { method: "GET" });
      const sentPo = (await listRes.json()).data.find((p: any) => p.id === poId);
      expect(sentPo.status).toBe("sent");
      expect(sentPo.sentTo).toBe("pengadaan@supplier-test.co.id");
      expect(sentPo.sentAt).toBeTruthy();

      // 2. Kirim ulang memperbarui jejak
      globalThis.fetch = (async () =>
        new Response(JSON.stringify({ messageId: "<po-send-2>" }), { status: 201 })) as any;
      const resendRes = await procurementRouter.request(
        `/purchase-orders/${poId}/send`,
        { method: "POST" },
        { BREVO_API_KEY: "xkeysib-test-kirim" }
      );
      expect(resendRes.status).toBe(200);
      const resendJson = await resendRes.json();
      expect(resendJson.data.kind).toBe("sent");
      expect(resendJson.data.messageId).toBe("<po-send-2>");

      // 3. Supplier tanpa email -> 400, status PO tidak berubah
      const noMailSupRes = await procurementRouter.request("/suppliers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: `SUP-NOMAIL-${stamp}`, name: "Tanpa Email" }),
      });
      const noMailSupId = (await noMailSupRes.json()).data.id;
      const poNoMailRes = await procurementRouter.request("/purchase-orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          supplierId: noMailSupId,
          orderDate: "2026-09-28",
          items: [{ bookId, quantityOrdered: 5, unitPrice: 10000 }],
        }),
      });
      const poNoMailId = (await poNoMailRes.json()).data.id;
      await advanceToSignedUploaded(poNoMailId);

      const failRes = await procurementRouter.request(`/purchase-orders/${poNoMailId}/send`, {
        method: "POST",
      });
      expect(failRes.status).toBe(400);
      const failJson = await failRes.json();
      expect(failJson.message).toMatch(/Email supplier/);

      const listRes2 = await procurementRouter.request("/purchase-orders", { method: "GET" });
      const untouched = (await listRes2.json()).data.find((p: any) => p.id === poNoMailId);
      expect(untouched.status).toBe("signed_uploaded");

      // 4. PO tidak ada -> 404
      const missingRes = await procurementRouter.request(
        `/purchase-orders/po-tidak-ada-${stamp}/send`,
        { method: "POST" }
      );
      expect(missingRes.status).toBe(404);

      // 5. Receiving setelah PO terkirim: status receiving berjalan,
      //    jejak sentAt/sentTo tidak hilang
      const listForReceive = await procurementRouter.request("/purchase-orders", {
        method: "GET",
      });
      const sentPoDetail = (await listForReceive.json()).data.find(
        (p: any) => p.id === poId
      );
      const sentItemId = sentPoDetail.items[0].id;

      const recvPartial = await procurementRouter.request(
        `/purchase-orders/${poId}/receive`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            deliveryNoteNumber: "SJ-EMAIL-TEST-1",
            receivedItems: [{ poItemId: sentItemId, quantityToReceive: 4 }],
          }),
        }
      );
      expect(recvPartial.status).toBe(200);
      expect((await recvPartial.json()).data.status).toBe("partially_received");

      const recvFull = await procurementRouter.request(
        `/purchase-orders/${poId}/receive`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            deliveryNoteNumber: "SJ-EMAIL-TEST-2",
            receivedItems: [{ poItemId: sentItemId, quantityToReceive: 6 }],
          }),
        }
      );
      expect(recvFull.status).toBe(200);
      expect((await recvFull.json()).data.status).toBe("received");

      const listAfter = await procurementRouter.request("/purchase-orders", {
        method: "GET",
      });
      const donePo = (await listAfter.json()).data.find((p: any) => p.id === poId);
      expect(donePo.status).toBe("received");
      expect(donePo.sentTo).toBe("pengadaan@supplier-test.co.id");
      expect(donePo.sentAt).toBeTruthy();
    } finally {
      globalThis.fetch = realFetch;
    }
  });

  it("send gate milik server: draft tanpa bukti TTD ditolak + daftar membawa canSend", async () => {
    const stamp = Date.now();
    const now = new Date().toISOString();
    const bookId = `b-gate-${stamp}`;
    await db.insert(books).values({
      id: bookId,
      isbn: `ISBN-GATE-${stamp}`,
      title: "Buku Gate Test",
      author: "Test",
      publisher: "Test",
      createdAt: now,
      updatedAt: now,
    }).onConflictDoNothing();

    const supRes = await procurementRouter.request("/suppliers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: `SUP-GATE-${stamp}`, name: "Supplier Gate", email: "gate@supplier.co.id" }),
    });
    const supplierId = (await supRes.json()).data.id;

    const poRes = await procurementRouter.request("/purchase-orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        supplierId,
        orderDate: "2026-09-28",
        items: [{ bookId, quantityOrdered: 3, unitPrice: 20000 }],
      }),
    });
    const poId = (await poRes.json()).data.id;

    // Draft alur baru tanpa bukti: kirim ditolak gerbang server.
    const blocked = await procurementRouter.request(`/purchase-orders/${poId}/send`, { method: "POST" });
    expect(blocked.status).toBe(400);
    expect((await blocked.json()).message).toMatch(/tanda tangan/i);

    // Daftar PO menurunkan gate dari server untuk klien.
    const list = await procurementRouter.request("/purchase-orders", { method: "GET" });
    const row = (await list.json()).data.find((p: any) => p.id === poId);
    expect(row.canSend).toBe(false);
    expect(row.sendBlockedReason).toMatch(/tanda tangan/i);

    // Test DELETE PO (draft tanpa penerimaan berhasil)
    const delRes = await procurementRouter.request(`/purchase-orders/${poId}`, { method: "DELETE" });
    expect(delRes.status).toBe(200);

    const [poCheck] = await db.select().from(purchaseOrders).where(eq(purchaseOrders.id, poId));
    expect(poCheck).toBeUndefined();
  });

  it("blocks deleting a purchase order that has received goods", async () => {    const stamp = Date.now();
    const now = new Date().toISOString();
    const bookId = `b-rec-${stamp}`;
    await db.insert(books).values({
      id: bookId,
      isbn: `ISBN-REC-${stamp}`,
      title: "Buku Rec Block",
      author: "Test",
      publisher: "Test",
      createdAt: now,
      updatedAt: now,
    });

    const supRes = await procurementRouter.request("/suppliers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: `SUP-REC-${stamp}`, name: "Supplier Rec", email: "rec@supplier.co.id" }),
    });
    const supplierId = (await supRes.json()).data.id;

    const poRes = await procurementRouter.request("/purchase-orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        supplierId,
        orderDate: "2026-09-28",
        items: [{ bookId, quantityOrdered: 5, unitPrice: 10000 }],
      }),
    });
    const poJson = await poRes.json();
    const poId = poJson.data.id;

    // Simulate goods received
    await db.update(purchaseOrderItems).set({ quantityReceived: 3 }).where(eq(purchaseOrderItems.purchaseOrderId, poId));
    await db.update(purchaseOrders).set({ status: "partially_received" }).where(eq(purchaseOrders.id, poId));

    // Attempt delete -> must be blocked
    const delRes = await procurementRouter.request(`/purchase-orders/${poId}`, { method: "DELETE" });
    const delJson = await delRes.json();
    expect(delRes.status).toBe(400);
    expect(delJson.success).toBe(false);
    expect(delJson.message).toContain("sudah diterima");

    // Clean up
    await db.delete(purchaseOrderItems).where(eq(purchaseOrderItems.purchaseOrderId, poId));
    await db.delete(purchaseOrders).where(eq(purchaseOrders.id, poId));
    await db.delete(suppliers).where(eq(suppliers.id, supplierId));
    await db.delete(books).where(eq(books.id, bookId));
  });

  it("records two receipts via lifecycle seam and lists history in one batched read", async () => {
    const stamp = Date.now();
    const now = new Date().toISOString();
    const bookId = `b-hist-${stamp}`;
    let poId = "";
    let supplierId = "";
    try {
      await db.insert(books).values({
        id: bookId,
        isbn: `ISBN-HIST-${stamp}`,
        title: "Buku Hist",
        author: "Test",
        publisher: "Test",
        createdAt: now,
        updatedAt: now,
      });
      supplierId = (
        await (
          await procurementRouter.request("/suppliers", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ code: `SUP-HIST-${stamp}`, name: "Supplier Hist" }),
          })
        ).json()
      ).data.id;
      poId = (
        await (
          await procurementRouter.request("/purchase-orders", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              supplierId,
              orderDate: "2026-10-09",
              items: [{ bookId, quantityOrdered: 4, unitPrice: 10000 }],
            }),
          })
        ).json()
      ).data.id;

      const listJson = await (await procurementRouter.request("/purchase-orders", { method: "GET" })).json();
      const poItemId = listJson.data.find((p: any) => p.id === poId).items[0].id;

      for (const [n, qty] of [[1, 2], [2, 2]] as Array<[number, number]>) {
        const res = await procurementRouter.request(`/purchase-orders/${poId}/receive`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            deliveryNoteNumber: `SJ-HIST-0${n}-${stamp}`,
            receivedItems: [{ poItemId, quantityToReceive: qty }],
          }),
        });
        expect(res.status).toBe(200);
      }

      const histRes = await procurementRouter.request(`/purchase-orders/${poId}/receipts`, { method: "GET" });
      expect(histRes.status).toBe(200);
      const history = (await histRes.json()).data;
      expect(history.length).toBe(2);
      expect(history.every((r: any) => r.items.length === 1 && r.items[0].quantityReceived === 2)).toBe(true);
    } finally {
      if (poId) {
        const { purchaseOrderReceipts } = await import("../../db/schema");
        const receipts = await db
          .select({ id: purchaseOrderReceipts.id })
          .from(purchaseOrderReceipts)
          .where(eq(purchaseOrderReceipts.purchaseOrderId, poId));
        for (const r of receipts) {
          const { purchaseOrderReceiptItems } = await import("../../db/schema");
          await db.delete(purchaseOrderReceiptItems).where(eq(purchaseOrderReceiptItems.receiptId, r.id));
        }
        await db.delete(purchaseOrderReceipts).where(eq(purchaseOrderReceipts.purchaseOrderId, poId));
        await db.delete(purchaseOrderItems).where(eq(purchaseOrderItems.purchaseOrderId, poId));
        await db.delete(purchaseOrders).where(eq(purchaseOrders.id, poId));
      }
      await db.delete(bookItems).where(eq(bookItems.bookId, bookId));
      await db.delete(books).where(eq(books.id, bookId));
      if (supplierId) await db.delete(suppliers).where(eq(suppliers.id, supplierId));
    }
  });

  it("creates PO via deep module with injectable deterministic IDs/numbers (T4 seam)", async () => {
    const stamp = Date.now();
    const now = new Date().toISOString();
    const bookId = `b-t4mod-${stamp}`;
    const supplierCode = `SUP-T4MOD-${stamp}`;
    let supplierId = "";
    const createdPoIds: string[] = [];
    try {
      await db.insert(books).values({
        id: bookId,
        isbn: `ISBN-T4MOD-${stamp}`,
        title: "Buku T4 Modul",
        author: "QA",
        publisher: "QA",
        createdAt: now,
        updatedAt: now,
      });
      const supRes = await procurementRouter.request("/suppliers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: supplierCode, name: "Supplier T4 Modul" }),
      });
      expect(supRes.status).toBe(201);
      supplierId = (await supRes.json()).data.id;

      const fixedNow = "2026-10-08T00:00:00.000Z";
      let seq = 0;
      const result = await createPurchaseOrder(
        db,
        {
          supplierId,
          orderDate: "2026-10-08",
          notes: "PO modul deterministik",
          items: [{ bookId, quantityOrdered: 2, discountPercent: 10 }],
        },
        {
          now: () => fixedNow,
          generateId: () => `po-t4-det-${stamp}`,
          generatePoNumber: () => `PO-T4DET-${stamp}`,
          generateItemId: () => `po-item-t4-det-${stamp}-${(seq += 1)}`,
        }
      );
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.data.id).toBe(`po-t4-det-${stamp}`);
      expect(result.data.poNumber).toBe(`PO-T4DET-${stamp}`);
      expect(result.data.items[0].id).toBe(`po-item-t4-det-${stamp}-1`);
      createdPoIds.push(result.data.id);

      const expected = calcPoHeader(result.data.items.map((i) => ({
        quantityOrdered: i.quantityOrdered,
        unitPrice: i.unitPrice,
        discountPercent: i.discountPercent,
      })));
      expect(result.data.subtotalGross).toBe(expected.subtotalGross);
      expect(result.data.discountTotal).toBe(expected.discountTotal);
      expect(result.data.totalAmount).toBe(expected.totalAmount);
    } finally {
      for (const poId of createdPoIds) {
        await db.delete(purchaseOrderItems).where(eq(purchaseOrderItems.purchaseOrderId, poId));
        await db.delete(purchaseOrders).where(eq(purchaseOrders.id, poId));
      }
      await db.delete(books).where(eq(books.id, bookId));
      if (supplierId) await db.delete(suppliers).where(eq(suppliers.id, supplierId));
    }
  });

  it("creates 30-line PO in one call without 500 via chunked batch (§10 D1 regression)", async () => {
    const stamp = Date.now();
    const now = new Date().toISOString();
    const bookIds = Array.from({ length: 30 }, (_, i) => `b-t4blk-${stamp}-${i}`);
    let supplierId = "";
    let poId = "";
    try {
      for (const [i, id] of bookIds.entries()) {
        await db.insert(books).values({
          id,
          isbn: `ISBN-T4BLK-${stamp}-${i}`,
          title: `Buku T4 Bulk ${i}`,
          author: "QA",
          publisher: "QA",
          createdAt: now,
          updatedAt: now,
        });
      }
      const supRes = await procurementRouter.request("/suppliers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: `SUP-T4BLK-${stamp}`, name: "Supplier T4 Bulk" }),
      });
      expect(supRes.status).toBe(201);
      supplierId = (await supRes.json()).data.id;

      const poRes = await procurementRouter.request("/purchase-orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          supplierId,
          orderDate: "2026-10-08",
          notes: "PO 30 baris T4",
          items: bookIds.map((bookId) => ({ bookId, quantityOrdered: 1, unitPrice: 10000 })),
        }),
      });
      expect(poRes.status).toBe(201);
      const poJson = await poRes.json();
      poId = poJson.data.id;
      expect(poJson.data.status).toBe("draft");

      const listJson = await (await procurementRouter.request("/purchase-orders", { method: "GET" })).json();
      const created = listJson.data.find((p: { id: string }) => p.id === poId);
      expect(created).toBeDefined();
      expect(created.items.length).toBe(30);
      expect(new Set(created.items.map((i: { id: string }) => i.id)).size).toBe(30);

      const expected = calcPoHeader(created.items.map((i: { quantityOrdered: number; unitPrice: number; discountPercent: number }) => ({
        quantityOrdered: i.quantityOrdered,
        unitPrice: i.unitPrice,
        discountPercent: i.discountPercent,
      })));
      expect(created.subtotalGross).toBe(expected.subtotalGross);
      expect(created.discountTotal).toBe(expected.discountTotal);
      expect(created.totalAmount).toBe(expected.totalAmount);

      const stored = await db.select().from(purchaseOrderItems).where(eq(purchaseOrderItems.purchaseOrderId, poId));
      expect(stored.length).toBe(30);
    } finally {
      if (poId) {
        await db.delete(purchaseOrderItems).where(eq(purchaseOrderItems.purchaseOrderId, poId));
        await db.delete(purchaseOrders).where(eq(purchaseOrders.id, poId));
      }
      for (const id of bookIds) {
        await db.delete(books).where(eq(books.id, id));
      }
      if (supplierId) await db.delete(suppliers).where(eq(suppliers.id, supplierId));
    }
  });
});

describe("Supplier PO visibility lock (#45)", () => {
  it("menolak daftar maupun baca PO supplier untuk peran sekolah dengan 403 berpesan jelas", async () => {
    for (const role of ["school_admin", "branch_admin"] as const) {
      mockActor(role, "school-alw-1");
      for (const path of ["/suppliers", "/purchase-orders", "/purchase-orders/po-ghost-45/receipts"] as const) {
        const res = await procurementRouter.request(path, { method: "GET" });
        expect(res.status).toBe(403);
        const json = await res.json();
        expect(json.success).toBe(false);
        expect(json.message).toMatch(/gudang|pusat|pengadaan/i);
      }
    }
  });

  it("tetap membuka daftar supplier dan PO untuk gudang dan pusat", async () => {
    mockActor("warehouse_admin", "school-warehouse");
    expect((await procurementRouter.request("/suppliers", { method: "GET" })).status).toBe(200);
    expect((await procurementRouter.request("/purchase-orders", { method: "GET" })).status).toBe(200);

    mockActor("central_admin", null);
    expect((await procurementRouter.request("/suppliers", { method: "GET" })).status).toBe(200);
    expect((await procurementRouter.request("/purchase-orders", { method: "GET" })).status).toBe(200);
  });
});

describe("Supplier master RBAC (#43)", () => {
  const stamp = Date.now().toString().slice(-6);

  function supplierPayload(code: string) {
    return {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code, name: `Supplier RBAC ${code}` }),
    } as const;
  }

  it("mewajibkan login untuk daftar supplier dan peran logistik untuk tambah supplier", async () => {
    mockActor(null, null);
    expect((await procurementRouter.request("/suppliers", { method: "GET" })).status).toBe(401);
    expect((await procurementRouter.request("/suppliers", supplierPayload(`SUP-RBAC-${stamp}`))).status).toBe(401);

    mockActor("school_admin", "school-alw-1");
    expect((await procurementRouter.request("/suppliers", supplierPayload(`SUP-RBAC-${stamp}`))).status).toBe(403);
  });

  it("menolak daftar oleh peran sekolah (#45) dan mengizinkan tambah oleh gudang", async () => {
    mockActor("school_admin", "school-alw-1");
    expect((await procurementRouter.request("/suppliers", { method: "GET" })).status).toBe(403);

    mockActor("warehouse_admin", "school-warehouse");
    const res = await procurementRouter.request("/suppliers", supplierPayload(`SUP-RBACW-${stamp}`));
    expect(res.status).toBe(201);
    const id = ((await res.json()) as any).data.id;
    await db.delete(suppliers).where(eq(suppliers.id, id));
  });
});

describe("spec-57 T4 PO receipt atomic write-set", () => {
  async function seedPo10(stamp: number) {
    const now = new Date().toISOString();
    const bookId = `b-t4-${stamp}`;
    await db.insert(books).values({
      id: bookId, isbn: `ISBN-T4-${stamp}`, title: `Buku T4 ${stamp}`,
      author: "QA", publisher: "QA", createdAt: now, updatedAt: now,
    });
    const supRes = await procurementRouter.request("/suppliers", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: `SUP-T4-${stamp}`, name: `Supplier T4 ${stamp}` }),
    });
    expect(supRes.status).toBe(201);
    const supplierId = ((await supRes.json()) as any).data.id;
    const poRes = await procurementRouter.request("/purchase-orders", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ supplierId, orderDate: "2026-10-08", items: [{ bookId, quantityOrdered: 10, unitPrice: 50000 }] }),
    });
    expect(poRes.status).toBe(201);
    const poId = ((await poRes.json()) as any).data.id;
    const listJson = await (await procurementRouter.request("/purchase-orders", { method: "GET" })).json();
    const poItemId = (listJson.data.find((p: any) => p.id === poId).items[0] as any).id;
    return { bookId, supplierId, poId, poItemId };
  }
  async function cleanupPo10(ctx: { bookId: string; supplierId: string; poId: string }) {
    const { purchaseOrderReceipts } = await import("../../db/schema");
    await db.delete(purchaseOrderReceipts).where(eq(purchaseOrderReceipts.purchaseOrderId, ctx.poId));
    await db.delete(bookItems).where(eq(bookItems.bookId, ctx.bookId));
    await db.delete(purchaseOrderItems).where(eq(purchaseOrderItems.purchaseOrderId, ctx.poId));
    await db.delete(purchaseOrders).where(eq(purchaseOrders.id, ctx.poId));
    await db.delete(books).where(eq(books.id, ctx.bookId));
    await db.delete(suppliers).where(eq(suppliers.id, ctx.supplierId));
  }

  it("rejects a duplicate delivery note with 400 and writes nothing new", async () => {
    const stamp = Date.now();
    const ctx = await seedPo10(stamp);
    try {
      const first = await procurementRouter.request(`/purchase-orders/${ctx.poId}/receive`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deliveryNoteNumber: `SJ-T4-DUP-${stamp}`, receivedItems: [{ poItemId: ctx.poItemId, quantityToReceive: 5 }] }),
      });
      expect(first.status).toBe(200);

      const dup = await procurementRouter.request(`/purchase-orders/${ctx.poId}/receive`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deliveryNoteNumber: `SJ-T4-DUP-${stamp}`, receivedItems: [{ poItemId: ctx.poItemId, quantityToReceive: 5 }] }),
      });
      expect(dup.status).toBe(400);
      expect(((await dup.json()) as any).message).toMatch(/Surat Jalan/);

      expect((await db.select().from(bookItems).where(eq(bookItems.bookId, ctx.bookId))).length).toBe(5);
      const history = await (await procurementRouter.request(`/purchase-orders/${ctx.poId}/receipts`, { method: "GET" })).json();
      expect(history.data.length).toBe(1);
    } finally {
      await cleanupPo10(ctx);
    }
  });

  it("rejects an unknown item with 400 leaving no receipt and no stock", async () => {
    const stamp = Date.now();
    const ctx = await seedPo10(stamp);
    try {
      const res = await procurementRouter.request(`/purchase-orders/${ctx.poId}/receive`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deliveryNoteNumber: `SJ-T4-ATOMIC-${stamp}`, receivedItems: [{ poItemId: `po-item-asing-${stamp}`, quantityToReceive: 2 }] }),
      });
      expect(res.status).toBe(400);
      const history = await (await procurementRouter.request(`/purchase-orders/${ctx.poId}/receipts`, { method: "GET" })).json();
      expect(history.data.length).toBe(0);
      expect((await db.select().from(bookItems).where(eq(bookItems.bookId, ctx.bookId))).length).toBe(0);
    } finally {
      await cleanupPo10(ctx);
    }
  });
});
