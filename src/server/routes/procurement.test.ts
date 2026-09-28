import { describe, expect, it } from "bun:test";
import { procurementRouter } from "./procurement";
import { db } from "../../db";
import { schools, books } from "../../db/schema";

describe("Supplier Procurement & Purchase Order API", () => {
  it("registers supplier, creates purchase order, and receives inbound loose books", async () => {
    const schoolId = "test-po-dest-school";
    const now = new Date().toISOString();

    await db.insert(schools).values({
      id: schoolId,
      name: "Al Wildan Logistics Central",
      code: `ALW-LOG-${Date.now()}`,
      type: "main",
      createdAt: now,
      updatedAt: now,
    }).onConflictDoNothing();

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
        targetSchoolId: schoolId,
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
    expect(poJson.data.status).toBe("ordered");

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

  it("sends PO to supplier email with trail, rejects missing email, resend updates trail", async () => {
    const stamp = Date.now();
    const now = new Date().toISOString();
    const realFetch = globalThis.fetch;

    try {
      // Supplier dengan email valid + sekolah + buku
      const schoolId = `test-send-sch-${stamp}`;
      await db.insert(schools).values({
        id: schoolId,
        name: "Al Wildan Kirim Test",
        code: `ALW-SEND-${stamp}`,
        type: "main",
        createdAt: now,
        updatedAt: now,
      }).onConflictDoNothing();

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
          targetSchoolId: schoolId,
          orderDate: "2026-09-28",
          notes: "PO uji kirim email",
          items: [{ bookId, quantityOrdered: 10, unitPrice: 50000 }],
        }),
      });
      expect(poRes.status).toBe(201);
      const poId = (await poRes.json()).data.id;

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
          targetSchoolId: schoolId,
          orderDate: "2026-09-28",
          items: [{ bookId, quantityOrdered: 5, unitPrice: 10000 }],
        }),
      });
      const poNoMailId = (await poNoMailRes.json()).data.id;

      const failRes = await procurementRouter.request(`/purchase-orders/${poNoMailId}/send`, {
        method: "POST",
      });
      expect(failRes.status).toBe(400);
      const failJson = await failRes.json();
      expect(failJson.message).toMatch(/Email supplier/);

      const listRes2 = await procurementRouter.request("/purchase-orders", { method: "GET" });
      const untouched = (await listRes2.json()).data.find((p: any) => p.id === poNoMailId);
      expect(untouched.status).toBe("ordered");

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
});
