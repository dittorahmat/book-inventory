import { Hono, type Context } from "hono";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";
import { eq } from "drizzle-orm";
import { db } from "../../db";
import { purchaseOrders, suppliers } from "../../db/schema";
import { defaultStorage } from "../../services/storage";
import {
  accessErrorResponse,
  assertLocationAllowed,
  loadLocationIds,
  requireLogisticsRole,
  resolveRequestActor,
} from "../services/access-scope";
import { PRINTED_STATUS, SIGNED_UPLOADED_STATUS, validateSignedDoc } from "../services/po-workflow";

/** Endpoint alur PO cetak → tanda tangan → upload, plus ubah master supplier. */
export const poWorkflowRouter = new Hono();

async function loadPoOr404(poId: string) {
  const [po] = await db.select().from(purchaseOrders).where(eq(purchaseOrders.id, poId));
  return po ?? null;
}

function notFound(c: Context) {
  return c.json({ success: false, message: "Purchase Order tidak ditemukan" }, 404);
}

// 1. Tandai PO sudah dicetak (draft -> printed)
poWorkflowRouter.post("/purchase-orders/:id/print", async (c) => {
  try {
    const actor = await resolveRequestActor(c);
    requireLogisticsRole(actor);
    const locations = await loadLocationIds(db);
    const po = await loadPoOr404(c.req.param("id"));
    if (!po) return notFound(c);
    assertLocationAllowed(actor, po.targetSchoolId, locations);

    if (po.status === PRINTED_STATUS) {
      return c.json({ success: true, message: `PO ${po.poNumber} sudah berstatus dicetak`, data: po });
    }
    if (po.status !== "draft") {
      return c.json(
        { success: false, message: `Hanya PO berstatus draft yang dapat ditandai dicetak (PO ${po.poNumber} saat ini ${po.status})` },
        400
      );
    }

    const now = new Date().toISOString();
    await db
      .update(purchaseOrders)
      .set({ status: PRINTED_STATUS, printedAt: now, updatedAt: now })
      .where(eq(purchaseOrders.id, po.id));

    return c.json({
      success: true,
      message: `PO ${po.poNumber} ditandai sudah dicetak dan siap ditandatangani`,
      data: { id: po.id, status: PRINTED_STATUS, printedAt: now },
    });
  } catch (err) {
    return accessErrorResponse(c, err);
  }
});

// 2. Upload bukti TTD basah + cap (printed -> signed_uploaded)
poWorkflowRouter.post("/purchase-orders/:id/signed-doc", async (c) => {
  try {
    const actor = await resolveRequestActor(c);
    requireLogisticsRole(actor);
    const locations = await loadLocationIds(db);
    const po = await loadPoOr404(c.req.param("id"));
    if (!po) return notFound(c);
    assertLocationAllowed(actor, po.targetSchoolId, locations);

    const canUpload = po.status === PRINTED_STATUS || po.status === SIGNED_UPLOADED_STATUS;
    if (!canUpload) {
      return c.json(
        { success: false, message: `Berkas bukti hanya dapat diupload pada PO berstatus dicetak atau sudah upload bukti (PO ${po.poNumber} saat ini ${po.status})` },
        400
      );
    }

    const body = await c.req.parseBody();
    const file = body["signedDoc"] as File | undefined;
    if (!file) {
      return c.json({ success: false, message: "Berkas bukti tanda tangan wajib diupload" }, 400);
    }

    const validation = validateSignedDoc(file);
    if (!validation.ok) {
      return c.json({ success: false, message: validation.message }, 400);
    }

    const extension = (file.name.split(".").pop() || "pdf").toLowerCase();
    const key = `po-signed/${po.id}-${Date.now()}.${extension}`;
    const signedDocUrl = await defaultStorage.upload(key, await file.arrayBuffer(), validation.contentType);

    const now = new Date().toISOString();
    await db
      .update(purchaseOrders)
      .set({
        status: SIGNED_UPLOADED_STATUS,
        signedDocUrl,
        signedDocName: file.name,
        signedDocType: validation.contentType,
        signedDocUploadedAt: now,
        updatedAt: now,
      })
      .where(eq(purchaseOrders.id, po.id));

    return c.json({
      success: true,
      message: `Bukti tanda tangan PO ${po.poNumber} tersimpan. PO siap dikirim ke supplier.`,
      data: { id: po.id, status: SIGNED_UPLOADED_STATUS, signedDocUrl, signedDocName: file.name },
    });
  } catch (err) {
    return accessErrorResponse(c, err);
  }
});

const updateSupplierSchema = z.object({
  code: z.string().min(1, "Kode supplier wajib diisi").optional(),
  name: z.string().min(1, "Nama supplier wajib diisi").optional(),
  contactPerson: z.string().optional(),
  email: z.string().email("Format email tidak valid").optional(),
  phone: z.string().optional(),
  address: z.string().optional(),
});

// 3. Ubah master supplier (kode harus tetap unik)
poWorkflowRouter.patch("/suppliers/:id", zValidator("json", updateSupplierSchema), async (c) => {
  try {
    const actor = await resolveRequestActor(c);
    requireLogisticsRole(actor);
    const body = c.req.valid("json");
    const supplierId = c.req.param("id");

    const [existing] = await db.select().from(suppliers).where(eq(suppliers.id, supplierId));
    if (!existing) {
      return c.json({ success: false, message: "Supplier tidak ditemukan" }, 404);
    }

    if (body.code && body.code !== existing.code) {
      const [duplicate] = await db.select().from(suppliers).where(eq(suppliers.code, body.code));
      if (duplicate) {
        return c.json({ success: false, message: "Kode supplier sudah terdaftar" }, 400);
      }
    }

    await db
      .update(suppliers)
      .set({
        ...(body.code !== undefined ? { code: body.code } : {}),
        ...(body.name !== undefined ? { name: body.name } : {}),
        ...(body.contactPerson !== undefined ? { contactPerson: body.contactPerson || null } : {}),
        ...(body.email !== undefined ? { email: body.email || null } : {}),
        ...(body.phone !== undefined ? { phone: body.phone || null } : {}),
        ...(body.address !== undefined ? { address: body.address || null } : {}),
        updatedAt: new Date().toISOString(),
      })
      .where(eq(suppliers.id, supplierId));

    const [updated] = await db.select().from(suppliers).where(eq(suppliers.id, supplierId));
    return c.json({ success: true, message: "Data supplier diperbarui", data: updated });
  } catch (err) {
    return accessErrorResponse(c, err);
  }
});
