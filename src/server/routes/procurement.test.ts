import { describe, expect, it } from "bun:test";
import { eq } from "drizzle-orm";
import { procurementRouter } from "./procurement";
import { poWorkflowRouter } from "./po-workflow";
import { db } from "../../db";
import { books, bookItems, purchaseOrders, purchaseOrderItems, suppliers } from "../../db/schema";

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

    // 4. Inbound receiving (Partial 20 units)
    const recRes = await procurementRouter.request(`/purchase-orders/${poId}/receive`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
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

    // 5. Inbound receiving remainder (30 units) -> status should become received
    const recFinalRes = await procurementRouter.request(`/purchase-orders/${poId}/receive`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
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
        body: JSON.stringify({ receivedItems: [{ poItemId, quantityToReceive: 30 }] }),
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
        body: JSON.stringify({ receivedItems: [{ poItemId, quantityToReceive: 1 }] }),
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

  it("blocks deleting a purchase order that has received goods", async () => {
    const stamp = Date.now();
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
});
