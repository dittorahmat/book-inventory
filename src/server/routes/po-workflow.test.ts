import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { procurementRouter } from "./procurement";
import { poWorkflowRouter } from "./po-workflow";
import { evaluateSendGate, validateSignedDoc } from "../services/po-workflow";
import { auth } from "../auth";
import { db } from "../../db";
import { purchaseOrders, purchaseOrderItems, suppliers, books, schools } from "../../db/schema";
import { eq } from "drizzle-orm";

const realGetSession = auth.api.getSession;
function actAs(role: "central_admin" | "warehouse_admin" | "school_admin" | "branch_admin" | null, schoolId: string | null = null) {
  (auth.api as any).getSession = async () =>
    role ? ({ user: { id: "u-test", role, schoolId } } as any) : null;
}
beforeEach(() => actAs("central_admin", null));
afterEach(() => {
  (auth.api as any).getSession = realGetSession;
});

async function makeSupplier(stamp: number, withEmail = true) {
  const res = await procurementRouter.request("/suppliers", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      code: `SUP-WF-${stamp}`,
      name: `Supplier Workflow ${stamp}`,
      ...(withEmail ? { email: `wf${stamp}@supplier-test.co.id` } : {}),
    }),
  });
  return (await res.json()).data.id as string;
}

async function makeBook(stamp: number) {
  const id = `b-wf-${stamp}`;
  await db
    .insert(books)
    .values({
      id,
      isbn: `ISBN-WF-${stamp}`,
      title: `Buku Workflow ${stamp}`,
      author: "Test",
      publisher: "Test",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })
    .onConflictDoNothing();
  return id;
}

async function createPo(supplierId: string, bookId: string, extra: Record<string, unknown> = {}) {
  const res = await procurementRouter.request("/purchase-orders", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      supplierId,
      orderDate: "2026-09-30",
      items: [{ bookId, quantityOrdered: 10, unitPrice: 50000 }],
      ...extra,
    }),
  });
  const json = await res.json();
  return { status: res.status, json, poId: json.data?.id as string | undefined };
}

function evidenceForm(name = "bukti-ttd.pdf", type = "application/pdf") {
  const form = new FormData();
  form.append("signedDoc", new File([new Uint8Array([9, 9, 9])], name, { type }));
  return form;
}

async function currentStatus(poId: string): Promise<string | undefined> {
  const [row] = await db.select().from(purchaseOrders).where(eq(purchaseOrders.id, poId));
  return row?.status;
}

describe("Alur PO cetak - tanda tangan - upload - kirim", () => {
  it("menandai PO draft sebagai sudah dicetak dan mencatat waktunya", async () => {
    const stamp = Date.now();
    const supplierId = await makeSupplier(stamp);
    const bookId = await makeBook(stamp);
    const { poId } = await createPo(supplierId, bookId);
    expect(poId).toBeTruthy();

    const res = await poWorkflowRouter.request(`/purchase-orders/${poId}/print`, { method: "POST" });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.status).toBe("printed");
    expect(json.data.printedAt).toBeTruthy();
    expect(await currentStatus(poId!)).toBe("printed");
  });

  it("menolak aksi kirim pada PO printed yang belum punya bukti TTD dan status tetap printed", async () => {    const stamp = Date.now();
    const supplierId = await makeSupplier(stamp);
    const bookId = await makeBook(stamp);
    const { poId } = await createPo(supplierId, bookId);

    await poWorkflowRouter.request(`/purchase-orders/${poId}/print`, { method: "POST" });

    const sendRes = await procurementRouter.request(`/purchase-orders/${poId}/send`, { method: "POST" });
    expect(sendRes.status).toBe(400);
    const sendJson = await sendRes.json();
    expect(sendJson.success).toBe(false);
    expect(sendJson.message).toMatch(/bukti tanda tangan/i);
    expect(sendJson.data.status).toBe("printed");
    expect(await currentStatus(poId!)).toBe("printed");
  });

  it("menolak aksi kirim pada PO draft alur baru yang belum punya bukti TTD", async () => {
    const stamp = Date.now();
    const supplierId = await makeSupplier(stamp);
    const bookId = await makeBook(stamp);
    const { poId } = await createPo(supplierId, bookId);

    const sendRes = await procurementRouter.request(`/purchase-orders/${poId}/send`, { method: "POST" });
    expect(sendRes.status).toBe(400);
    const sendJson = await sendRes.json();
    expect(sendJson.success).toBe(false);
    expect(sendJson.message).toMatch(/bukti tanda tangan/i);
    expect(await currentStatus(poId!)).toBe("draft");
  });

  it("upload bukti memindahkan printed ke signed_uploaded lalu kirim berhasil menjadi sent", async () => {
    const stamp = Date.now();
    const realFetch = globalThis.fetch;
    try {
      const supplierId = await makeSupplier(stamp);
      const bookId = await makeBook(stamp);
      const { poId } = await createPo(supplierId, bookId);

      await poWorkflowRouter.request(`/purchase-orders/${poId}/print`, { method: "POST" });

      const uploadRes = await poWorkflowRouter.request(`/purchase-orders/${poId}/signed-doc`, {
        method: "POST",
        body: evidenceForm(),
      });
      expect(uploadRes.status).toBe(200);
      const uploadJson = await uploadRes.json();
      expect(uploadJson.data.status).toBe("signed_uploaded");
      expect(uploadJson.data.signedDocUrl).toBeTruthy();
      expect(await currentStatus(poId!)).toBe("signed_uploaded");

      globalThis.fetch = (async () =>
        new Response(JSON.stringify({ messageId: "<wf-send-1>" }), { status: 201 })) as unknown as typeof fetch;

      const sendRes = await procurementRouter.request(
        `/purchase-orders/${poId}/send`,
        { method: "POST" },
        { BREVO_API_KEY: "xkeysib-test-wf" }
      );
      expect(sendRes.status).toBe(200);
      const sendJson = await sendRes.json();
      expect(sendJson.data.kind).toBe("sent");
      expect(sendJson.data.sentAt).toBeTruthy();
      expect(sendJson.data.sentTo).toBe(`wf${stamp}@supplier-test.co.id`);

      const [row] = await db.select().from(purchaseOrders).where(eq(purchaseOrders.id, poId!));
      expect(row.status).toBe("sent");
      // Bukti tetap tersimpan agar dapat dilihat ulang di detail PO
      expect(row.signedDocUrl).toBeTruthy();
      expect(row.signedDocName).toBe("bukti-ttd.pdf");
    } finally {
      globalThis.fetch = realFetch;
    }
  });

  it("mengizinkan upload ulang/re-upload bukti TTD pada PO yang sudah signed_uploaded sebelum dikirim", async () => {
    const stamp = Date.now();
    const supplierId = await makeSupplier(stamp);
    const bookId = await makeBook(stamp);
    const { poId } = await createPo(supplierId, bookId);

    await poWorkflowRouter.request(`/purchase-orders/${poId}/print`, { method: "POST" });

    // Upload pertama
    const firstRes = await poWorkflowRouter.request(`/purchase-orders/${poId}/signed-doc`, {
      method: "POST",
      body: evidenceForm("ttd-pertama.pdf"),
    });
    expect(firstRes.status).toBe(200);
    expect(await currentStatus(poId!)).toBe("signed_uploaded");

    // Upload kedua (revisi/timpa berkas sebelum dikirim)
    const secondRes = await poWorkflowRouter.request(`/purchase-orders/${poId}/signed-doc`, {
      method: "POST",
      body: evidenceForm("ttd-revisi.pdf"),
    });
    expect(secondRes.status).toBe(200);
    const secondJson = await secondRes.json();
    expect(secondJson.data.signedDocName).toBe("ttd-revisi.pdf");

    const [row] = await db.select().from(purchaseOrders).where(eq(purchaseOrders.id, poId!));
    expect(row.signedDocName).toBe("ttd-revisi.pdf");
    expect(row.status).toBe("signed_uploaded");
  });

  it("menolak upload berkas bukan gambar/PDF, berkas kosong, dan upload di luar status printed", async () => {
    const stamp = Date.now();
    const supplierId = await makeSupplier(stamp);
    const bookId = await makeBook(stamp);

    // Status draft: upload ditolak
    const draftPo = await createPo(supplierId, bookId);
    const earlyUpload = await poWorkflowRouter.request(
      `/purchase-orders/${draftPo.poId}/signed-doc`,
      { method: "POST", body: evidenceForm() }
    );
    expect(earlyUpload.status).toBe(400);
    expect((await earlyUpload.json()).message).toMatch(/berstatus dicetak/i);

    await poWorkflowRouter.request(`/purchase-orders/${draftPo.poId}/print`, { method: "POST" });

    // Format tidak didukung
    const badType = await poWorkflowRouter.request(`/purchase-orders/${draftPo.poId}/signed-doc`, {
      method: "POST",
      body: evidenceForm("bukti.exe", "application/x-msdownload"),
    });
    expect(badType.status).toBe(400);
    expect((await badType.json()).message).toMatch(/JPG, PNG, WebP|harus gambar/i);

    // Berkas kosong
    const emptyForm = new FormData();
    emptyForm.append("signedDoc", new File([], "kosong.pdf", { type: "application/pdf" }));
    const emptyRes = await poWorkflowRouter.request(`/purchase-orders/${draftPo.poId}/signed-doc`, {
      method: "POST",
      body: emptyForm,
    });
    expect(emptyRes.status).toBe(400);
    expect((await emptyRes.json()).message).toMatch(/kosong/i);

    // Tanpa berkas sama sekali
    const noFile = await poWorkflowRouter.request(`/purchase-orders/${draftPo.poId}/signed-doc`, {
      method: "POST",
      body: new FormData(),
    });
    expect(noFile.status).toBe(400);
    expect(await currentStatus(draftPo.poId!)).toBe("printed");
  });

  it("PO lama berstatus sent tetap dapat dikirim ulang tanpa bukti upload", async () => {
    const stamp = Date.now();
    const supplierId = await makeSupplier(stamp);
    const bookId = await makeBook(stamp);
    const { poId } = await createPo(supplierId, bookId);

    // Simulasikan PO lama: sudah terkirim sebelum change ini, tanpa bukti.
    await db
      .update(purchaseOrders)
      .set({ status: "sent", sentAt: new Date().toISOString() })
      .where(eq(purchaseOrders.id, poId!));

    const realFetch = globalThis.fetch;
    try {
      globalThis.fetch = (async () =>
        new Response(JSON.stringify({ messageId: "<wf-legacy>" }), { status: 201 })) as unknown as typeof fetch;
      const res = await procurementRouter.request(
        `/purchase-orders/${poId}/send`,
        { method: "POST" },
        { BREVO_API_KEY: "xkeysib-test-legacy" }
      );
      expect(res.status).toBe(200);
      expect((await res.json()).data.kind).toBe("sent");
    } finally {
      globalThis.fetch = realFetch;
    }
  });
});

describe("Penguncian tujuan PO ke Gudang Logistik", () => {
  it("menolak request PO yang menyebut tujuan sekolah non-gudang", async () => {
    const stamp = Date.now();
    const supplierId = await makeSupplier(stamp);
    const bookId = await makeBook(stamp);
    const schoolId = `sch-non-gudang-${stamp}`;
    await db
      .insert(schools)
      .values({
        id: schoolId,
        name: "Sekolah Non Gudang",
        code: `ALW-NG-${stamp}`,
        type: "branch",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })
      .onConflictDoNothing();

    const res = await procurementRouter.request("/purchase-orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        supplierId,
        targetSchoolId: schoolId,
        orderDate: "2026-09-30",
        items: [{ bookId, quantityOrdered: 5, unitPrice: 10000 }],
      }),
    });
    expect(res.status).toBe(400);
    expect((await res.json()).message).toMatch(/Gudang Logistik/i);
  });

  it("PO baru selalu mengisi tujuan gudang walau request tidak menyebut lokasi", async () => {
    const stamp = Date.now();
    const supplierId = await makeSupplier(stamp);
    const bookId = await makeBook(stamp);
    const { status, poId } = await createPo(supplierId, bookId);
    expect(status).toBe(201);

    const [warehouse] = await db.select().from(schools).where(eq(schools.type, "warehouse")).limit(1);
    const [row] = await db.select().from(purchaseOrders).where(eq(purchaseOrders.id, poId!));
    expect(row.targetSchoolId).toBe(warehouse.id);
    expect(row.status).toBe("draft");
  });
});

describe("Master supplier di tab PO", () => {
  it("menolak kode supplier duplikat saat tambah dan saat ubah", async () => {
    const stamp = Date.now();
    const first = await procurementRouter.request("/suppliers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: `SUP-DUP-${stamp}`, name: "Supplier Pertama" }),
    });
    expect(first.status).toBe(201);
    const firstId = (await first.json()).data.id;

    const duplicate = await procurementRouter.request("/suppliers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: `SUP-DUP-${stamp}`, name: "Supplier Duplikat" }),
    });
    expect(duplicate.status).toBe(400);
    expect((await duplicate.json()).message).toMatch(/sudah terdaftar/i);

    const other = await procurementRouter.request("/suppliers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: `SUP-OTHER-${stamp}`, name: "Supplier Lain" }),
    });
    const otherId = (await other.json()).data.id;

    const clash = await poWorkflowRouter.request(`/suppliers/${otherId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: `SUP-DUP-${stamp}` }),
    });
    expect(clash.status).toBe(400);
    expect((await clash.json()).message).toMatch(/sudah terdaftar/i);

    // Ubah ke kode sendiri + email valid → berhasil
    const ok = await poWorkflowRouter.request(`/suppliers/${firstId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Supplier Pertama (Diperbarui)",
        email: `baru${stamp}@supplier-test.co.id`,
      }),
    });
    expect(ok.status).toBe(200);
    const okJson = await ok.json();
    expect(okJson.data.name).toBe("Supplier Pertama (Diperbarui)");
    expect(okJson.data.email).toBe(`baru${stamp}@supplier-test.co.id`);

    // Email tidak valid ditolak
    const badEmail = await poWorkflowRouter.request(`/suppliers/${firstId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "bukan-email" }),
    });
    expect(badEmail.status).toBe(400);
  });

  it("menampilkan daftar supplier lengkap dengan kontak di tab PO", async () => {
    const res = await procurementRouter.request("/suppliers", { method: "GET" });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(Array.isArray(json.data)).toBe(true);
    expect(json.data.length).toBeGreaterThan(0);
    for (const key of ["code", "name", "contactPerson", "email", "phone"]) {
      expect(Object.keys(json.data[0])).toContain(key);
    }
    const [row] = await db.select().from(suppliers).limit(1);
    expect(row).toBeDefined();
  });
});

describe("T5: PO lifecycle single seam (gate, transition, delivery)", () => {
  let t5Counter = 0;
  const t5Stamp = () => `${Date.now()}-${++t5Counter}`;

  async function seedSupplierAndBook(tag: string) {
    const stamp = t5Stamp();
    const supplierId = `sup-t5-${tag}-${stamp}`;
    const bookId = `b-t5-${tag}-${stamp}`;
    await db.insert(suppliers).values({
      id: supplierId,
      code: `SUP-T5-${tag}-${stamp}`.slice(0, 32),
      name: `Supplier T5 ${tag} ${stamp}`,
      email: `t5-${tag}-${stamp}@supplier-test.co.id`.replace(/[^a-zA-Z0-9@.-]/g, ""),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    await db.insert(books).values({
      id: bookId,
      isbn: `ISBN-T5-${tag}-${stamp}`.slice(0, 32),
      title: `Buku T5 ${tag} ${stamp}`,
      author: "Test",
      publisher: "Test",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    return { supplierId, bookId };
  }

  async function cleanupPo(poId: string | undefined, supplierId: string, bookId: string) {
    if (poId) {
      await db.delete(purchaseOrderItems).where(eq(purchaseOrderItems.purchaseOrderId, poId));
      await db.delete(purchaseOrders).where(eq(purchaseOrders.id, poId));
    }
    await db.delete(books).where(eq(books.id, bookId));
    await db.delete(suppliers).where(eq(suppliers.id, supplierId));
  }

  it("runs print → upload → send through one module with injected adapters and custom slug id", async () => {
    const { createPurchaseOrder, markPrinted, uploadSignedDoc, sendPo } = await import(
      "../services/po-lifecycle"
    );
    const { InMemoryPoMailSender } = await import("../services/po-mail");
    const { MemoryStorageService } = await import("../../services/storage");

    const tag = "seam";
    const { supplierId, bookId } = await seedSupplierAndBook(tag);
    // Custom seeded string id (slug, bukan UUID) — flexible identifier validation.
    const customPoId = `po-t5-${tag}-${t5Stamp()}`;
    let poId: string | undefined;
    try {
      const created = await createPurchaseOrder(
        db,
        { supplierId, orderDate: "2026-10-08", items: [{ bookId, quantityOrdered: 5, unitPrice: 20000 }] },
        { generateId: () => customPoId, generatePoNumber: () => `PO-T5-${t5Stamp()}` }
      );
      expect(created.ok).toBe(true);
      if (!created.ok) return;
      poId = created.data.id;
      expect(poId).toBe(customPoId);

      const printed = await markPrinted(db, poId);
      expect(printed.ok).toBe(true);

      const storage = new MemoryStorageService();
      const file = new File([new Uint8Array([7, 7, 7])], "bukti-t5.pdf", { type: "application/pdf" });
      const uploaded = await uploadSignedDoc(db, poId, file, storage);
      expect(uploaded.ok).toBe(true);
      if (!uploaded.ok) return;
      expect(uploaded.data.status).toBe("signed_uploaded");

      // Delivery via in-memory adapter: tanpa menyentuh globalThis.fetch / env.
      const mail = new InMemoryPoMailSender();
      const sent = await sendPo(db, poId, undefined, { mail });
      expect(sent.ok).toBe(true);
      if (!sent.ok) return;
      expect(mail.sent.length).toBe(1);
      expect(mail.sent[0].to).toContain("@supplier-test.co.id");

      const [row] = await db.select().from(purchaseOrders).where(eq(purchaseOrders.id, poId));
      expect(row.status).toBe("sent");
      expect(row.sentTo).toBe(mail.sent[0].to);
    } finally {
      await cleanupPo(poId, supplierId, bookId);
    }
  });

  it("maps in-memory mail failure to 502 with a clear message (no fetch mock)", async () => {
    const { createPurchaseOrder, markPrinted, uploadSignedDoc, sendPo } = await import(
      "../services/po-lifecycle"
    );
    const { InMemoryPoMailSender } = await import("../services/po-mail");
    const { MemoryStorageService } = await import("../../services/storage");

    const tag = "fail";
    const { supplierId, bookId } = await seedSupplierAndBook(tag);
    let poId: string | undefined;
    try {
      const created = await createPurchaseOrder(
        db,
        { supplierId, orderDate: "2026-10-08", items: [{ bookId, quantityOrdered: 2, unitPrice: 15000 }] },
        { generateId: () => crypto.randomUUID() }
      );
      expect(created.ok).toBe(true);
      if (!created.ok) return;
      poId = created.data.id;

      expect((await markPrinted(db, poId)).ok).toBe(true);
      const uploaded = await uploadSignedDoc(
        db,
        poId,
        new File([new Uint8Array([1])], "bukti.pdf", { type: "application/pdf" }),
        new MemoryStorageService()
      );
      expect(uploaded.ok).toBe(true);

      const mail = new InMemoryPoMailSender({ failNext: "SMTP relay terputus" });
      const sent = await sendPo(db, poId, undefined, { mail });
      expect(sent.ok).toBe(false);
      if (sent.ok) return;
      expect(sent.status).toBe(502);
      expect(sent.message).toMatch(/Gagal mengirim/);

      const [row] = await db.select().from(purchaseOrders).where(eq(purchaseOrders.id, poId));
      expect(row.status).toBe("signed_uploaded");
    } finally {
      await cleanupPo(poId, supplierId, bookId);
    }
  });

  it("derives canSend once via withSendReadiness (independent literals)", async () => {
    const { withSendReadiness } = await import("../services/po-lifecycle");
    const rows = withSendReadiness([
      { id: "x1", poNumber: "PO-DRAFT-1", status: "draft", signedDocUrl: null },
      { id: "x2", poNumber: "PO-SIGNED-2", status: "signed_uploaded", signedDocUrl: "/api/media/bukti.pdf" },
      { id: "x3", poNumber: "PO-LEGACY-3", status: "sent", signedDocUrl: null },
    ]);
    expect(rows[0].canSend).toBe(false);
    expect(rows[0].sendBlockedReason).toContain("PO-DRAFT-1");
    expect(rows[1].canSend).toBe(true);
    expect(rows[1].sendBlockedReason).toBeNull();
    expect(rows[2].canSend).toBe(true);
  });

  it("GET /purchase-orders exposes module-derived canSend (draft blocked, signed allowed)", async () => {
    const { markPrinted, uploadSignedDoc } = await import("../services/po-lifecycle");
    const { MemoryStorageService } = await import("../../services/storage");

    const tag = "list";
    const { supplierId, bookId } = await seedSupplierAndBook(tag);
    let poId: string | undefined;
    try {
      const { poId: createdId } = await createPo(supplierId, bookId);
      poId = createdId;
      expect(poId).toBeTruthy();

      const blocked = await (await procurementRouter.request("/purchase-orders", { method: "GET" })).json();
      const draftRow = (blocked.data as Array<{ id: string }>).find((p) => p.id === poId) as unknown as {
        canSend: boolean;
        sendBlockedReason: string | null;
      };
      expect(draftRow.canSend).toBe(false);
      expect(draftRow.sendBlockedReason).toMatch(/bukti tanda tangan/i);

      expect((await markPrinted(db, poId!)).ok).toBe(true);
      const uploaded = await uploadSignedDoc(
        db,
        poId!,
        new File([new Uint8Array([5, 5])], "bukti-list.pdf", { type: "application/pdf" }),
        new MemoryStorageService()
      );
      expect(uploaded.ok).toBe(true);

      const allowed = await (await procurementRouter.request("/purchase-orders", { method: "GET" })).json();
      const signedRow = (allowed.data as Array<{ id: string }>).find((p) => p.id === poId) as unknown as {
        canSend: boolean;
        sendBlockedReason: string | null;
      };
      expect(signedRow.canSend).toBe(true);
      expect(signedRow.sendBlockedReason).toBeNull();
    } finally {
      await cleanupPo(poId, supplierId, bookId);
    }
  });
});

describe("Gerbang kirim PO murni (T4)", () => {
  it("melewatkan semua status lama tanpa bukti (legacy exemption)", () => {
    for (const status of ["ordered", "sent", "partially_received", "received", "cancelled"] as const) {
      const gate = evaluateSendGate({ status, signedDocUrl: null, poNumber: "PO-X" });
      expect(gate.allowed).toBe(true);
    }
  });

  it("melewatkan alur baru yang sudah punya bukti dan menolak yang belum", () => {
    expect(evaluateSendGate({ status: "signed_uploaded", signedDocUrl: "r2://bukti.pdf", poNumber: "PO-X" }).allowed).toBe(true);
    const blocked = evaluateSendGate({ status: "printed", signedDocUrl: null, poNumber: "PO-9" });
    expect(blocked.allowed).toBe(false);
    if (!blocked.allowed) expect(blocked.message).toContain("PO-9");
    expect(evaluateSendGate({ status: "draft", signedDocUrl: null, poNumber: "PO-1" }).allowed).toBe(false);
  });

  it("memvalidasi berkas bukti: kosong, raksasa, tipe asing ditolak", () => {
    const pdf = (size: number, type: string) => new File([new Uint8Array(size)], "bukti.pdf", { type });
    expect(validateSignedDoc(pdf(0, "application/pdf")).ok).toBe(false);
    expect(validateSignedDoc(pdf(11 * 1024 * 1024, "application/pdf")).ok).toBe(false);
    expect(validateSignedDoc(pdf(10, "text/plain")).ok).toBe(false);
    const ok = validateSignedDoc(pdf(10, "application/pdf"));
    expect(ok.ok).toBe(true);
    if (ok.ok) expect(ok.contentType).toBe("application/pdf");
  });
});
