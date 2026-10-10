import { Hono, type Context } from "hono";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";
import { eq } from "drizzle-orm";
import { db } from "../../db";
import { purchaseOrders, suppliers } from "../../db/schema";
import {
  accessErrorResponse,
  assertLocationAllowed,
  requireScopedLogisticsActor,
  resolveLogisticsActor,
} from "../services/access-scope";
import { PRINTED_STATUS } from "../services/po-workflow";
import { markPrinted, uploadSignedDoc } from "../services/po-lifecycle";

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
    const { actor, locations } = await requireScopedLogisticsActor(db, c);
    const po = await loadPoOr404(c.req.param("id"));
    if (!po) return notFound(c);
    assertLocationAllowed(actor, po.targetSchoolId, locations);

    const result = await markPrinted(db, po.id);
    if (!result.ok) {
      return c.json({ success: false, message: result.message }, result.status);
    }
    if (result.data.status === PRINTED_STATUS && po.status === PRINTED_STATUS) {
      return c.json({ success: true, message: `PO ${po.poNumber} sudah berstatus dicetak`, data: po });
    }

    return c.json({
      success: true,
      message: `PO ${result.data.poNumber} ditandai sudah dicetak dan siap ditandatangani`,
      data: { id: result.data.id, status: result.data.status, printedAt: result.data.printedAt },
    });
  } catch (err) {
    return accessErrorResponse(c, err);
  }
});

// 2. Upload bukti TTD basah + cap (printed -> signed_uploaded)
poWorkflowRouter.post("/purchase-orders/:id/signed-doc", async (c) => {
  try {
    const { actor, locations } = await requireScopedLogisticsActor(db, c);
    const po = await loadPoOr404(c.req.param("id"));
    if (!po) return notFound(c);
    assertLocationAllowed(actor, po.targetSchoolId, locations);

    const body = await c.req.parseBody();
    const file = body["signedDoc"] as File | undefined;

    const result = await uploadSignedDoc(db, po.id, file);
    if (!result.ok) {
      return c.json({ success: false, message: result.message }, result.status);
    }

    return c.json({
      success: true,
      message: `Bukti tanda tangan PO ${result.data.poNumber} tersimpan. PO siap dikirim ke supplier.`,
      data: { id: result.data.id, status: result.data.status, signedDocUrl: result.data.signedDocUrl, signedDocName: result.data.signedDocName },
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
    await resolveLogisticsActor(c);
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
