import { and, desc, eq, inArray } from "drizzle-orm";
import type { AppDatabase } from "../../../db";
import {
  schools,
  students,
  uniformVariants,
  uniformSizes,
  uniformStock,
  uniformPackages,
  uniformPackageBom,
  uniformPackageStock,
  uniformOrders,
  uniformOrderItems,
} from "../../../db/schema";
import {
  chunkRows,
  d1WriteErrorStatus,
  newWriteId,
  runWriteBatch,
  writeNow,
  type WriteDeps,
} from "../../lib/d1-write";
import { documentNumber } from "../../lib/document-number";
import { AccessHttpError } from "../access-scope";
import { readSettingsMap } from "../settings-map";
import { validateHomeAddress } from "../../../lib/home-address";
import { defaultStorage } from "../../../services/storage";
import { decodeBase64ToBytes } from "../../base64";
import { matchAnyLower } from "../../lib/partitioned-search";
import { pendingPaymentCounts } from "../order-payment-review";
import { uniformOrderStage, uniformStageFilter } from "./report";
import { KAIN_SIZE, type UniformError } from "./catalog";
import type { SubmitUniformOrderPayload } from "../../../lib/uniform-types";

export interface SubmitUniformOrderDeps extends WriteDeps {
  generateOrderNumber?: (nowIso: string) => string;
  orderPrefix?: string;
}

export const UNIFORM_ORDER_PREFIX_KEY = "uniform_order_prefix";
export const DEFAULT_UNIFORM_ORDER_PREFIX = "USO";

/** Toggle on/off pembelian satuan seragam (default buka agar kompatibel). */
export const UNIFORM_SATUAN_KEY = "uniform_satuan_enabled";

export const isUniformSatuanEnabled = async (database: AppDatabase): Promise<boolean> =>
  (await readSettingsMap(database))[UNIFORM_SATUAN_KEY] !== "false";

type VariantRow = typeof uniformVariants.$inferSelect;
type PackageRow = typeof uniformPackages.$inferSelect;

const invalid = (message: string): UniformError => ({ ok: false, status: 400, message });

const defaultOrderNumber = (prefix: string, nowIso: string): string =>
  documentNumber(prefix, nowIso.slice(0, 10).replaceAll("-", ""), Math.floor(Math.random() * 900 + 100));

export interface UniformOrderLine {
  packageId: string | null;
  variantId: string | null;
  size: string;
  quantity: number;
  unitPrice: number;
}

export async function submitUniformOrder(
  database: AppDatabase,
  payload: SubmitUniformOrderPayload,
  deps?: SubmitUniformOrderDeps
): Promise<{ ok: true; data: { order: typeof uniformOrders.$inferSelect; totalAmount: number } } | UniformError> {
  const now = writeNow(deps);
  const addressCheck = validateHomeAddress(payload.homeAddress);
  if (!addressCheck.ok) return invalid(addressCheck.message as string);
  if (!payload.items || payload.items.length === 0) return invalid("Pilih minimal satu paket atau satuan.");
  if (!/^\d{4}\/\d{4}$/.test(payload.academicYear)) return invalid("Format tahun ajaran wajib YYYY/YYYY.");

  const [student] = await database.select().from(students).where(eq(students.id, payload.studentId));
  if (!student) return { ok: false, status: 404, message: "Murid tidak ditemukan." };
  if (student.status === "new_pending" || student.status === "rejected") {
    return invalid("Murid belum terverifikasi admin sekolah.");
  }
  const schoolId: string = student.schoolId;
  const isScholarship = payload.orderType === "scholarship";
  if (isScholarship && !payload.scholarshipProofBase64) return invalid("Surat tanda beasiswa wajib dilampirkan.");
  const priorCount = await database
    .select({ id: uniformOrders.id })
    .from(uniformOrders)
    .where(eq(uniformOrders.studentId, payload.studentId))
    .limit(1);
  if (priorCount.length === 0 && !payload.items.some((i) => i.packageId)) {
    return invalid("Murid baru/pindahan wajib membeli paket seragam terlebih dahulu.");
  }
  if (payload.items.some((i) => i.variantId) && !(await isUniformSatuanEnabled(database))) {
    return invalid("Pembelian satuan seragam sedang ditutup oleh admin.");
  }

  const packageIds = [...new Set(payload.items.filter((i) => i.packageId).map((i) => i.packageId as string))];
  const satuanVariantIds = [...new Set(payload.items.filter((i) => i.variantId).map((i) => i.variantId as string))];
  for (const item of payload.items) {
    if ((item.packageId ? 1 : 0) + (item.variantId ? 1 : 0) !== 1) return invalid("Tiap baris wajib paket atau satuan, bukan keduanya.");
    if ((item.quantity ?? 1) < 1) return invalid("Kuantitas tiap baris minimal 1.");
  }
  const pkgs: PackageRow[] = packageIds.length > 0
    ? await database.select().from(uniformPackages).where(inArray(uniformPackages.id, packageIds))
    : [];
  if (pkgs.length !== packageIds.length) return invalid("Ada paket yang tidak dikenal.");
  const pkgById = new Map(pkgs.map((p) => [p.id, p]));
  const variants: VariantRow[] = satuanVariantIds.length > 0
    ? await database.select().from(uniformVariants).where(inArray(uniformVariants.id, satuanVariantIds))
    : [];
  if (variants.length !== satuanVariantIds.length) return invalid("Ada varian satuan yang tidak dikenal.");
  const variantById = new Map(variants.map((v) => [v.id, v]));

  // Validasi size satuan: kain "—", olahraga terdaftar.
  const olahragaIds = variants.filter((v) => v.kind === "olahraga").map((v) => v.id);
  const allowed: Array<typeof uniformSizes.$inferSelect> = olahragaIds.length > 0
    ? await database.select().from(uniformSizes).where(inArray(uniformSizes.variantId, olahragaIds))
    : [];
  const allowedSet = new Set(allowed.map((s) => `${s.variantId}::${s.size}`));
  for (const item of payload.items) {
    if (!item.variantId) continue;
    const v = variantById.get(item.variantId);
    const size = item.size?.trim() || KAIN_SIZE;
    if (!v) continue;
    if (v.kind === "kain_harian" && size !== KAIN_SIZE) return invalid("Kain harian tanpa ukuran.");
    if (v.kind === "olahraga" && !allowedSet.has(`${v.id}::${size}`)) return invalid(`Size ${size} tidak tersedia untuk ${v.name}.`);
    if (v.academicYear !== payload.academicYear) return invalid(`Varian ${v.name} bukan tahun ajaran ${payload.academicYear}.`);
  }

  // BOM paket + resolve size olahraga (BOM "—" via sizeOverrides).
  const bom: Array<{ packageId: string; variantId: string; size: string; quantity: number; kind: string }> =
    packageIds.length > 0
      ? await database
        .select({
          packageId: uniformPackageBom.packageId,
          variantId: uniformPackageBom.variantId,
          size: uniformPackageBom.size,
          quantity: uniformPackageBom.quantity,
          kind: uniformVariants.kind,
        })
        .from(uniformPackageBom)
        .innerJoin(uniformVariants, eq(uniformPackageBom.variantId, uniformVariants.id))
        .where(inArray(uniformPackageBom.packageId, packageIds))
      : [];
  const bomByPkg = new Map<string, typeof bom>();
  for (const b of bom) bomByPkg.set(b.packageId, [...(bomByPkg.get(b.packageId) ?? []), b]);
  const resolvedPkgSize = new Map<string, string>();
  for (const pid of packageIds) {
    const lines = bomByPkg.get(pid) ?? [];
    if (lines.length === 0) return invalid("Paket belum punya BOM.");
    for (const line of lines) {
      if (line.kind === "olahraga" && line.size === KAIN_SIZE && !(payload.sizeOverrides?.[line.variantId]?.trim())) {
        return invalid("Size olahraga dalam paket wajib dipilih.");
      }
    }
    const firstOlahraga = lines.find((l) => l.kind === "olahraga");
    resolvedPkgSize.set(
      pid,
      firstOlahraga ? (firstOlahraga.size !== KAIN_SIZE ? firstOlahraga.size : (payload.sizeOverrides?.[firstOlahraga.variantId]?.trim() ?? KAIN_SIZE)) : KAIN_SIZE
    );
  }

  // Kecukupan stok: paket (ready) + satuan (per varian-size).
  const ready: Array<typeof uniformPackageStock.$inferSelect> = packageIds.length > 0
    ? await database.select().from(uniformPackageStock).where(inArray(uniformPackageStock.packageId, packageIds))
    : [];
  const readyByPkg = new Map(ready.map((r) => [r.packageId, r.quantity]));
  const stocks: Array<typeof uniformStock.$inferSelect> = await database.select().from(uniformStock);
  const stockByKey = new Map(stocks.map((s) => [`${s.variantId}::${s.size}`, s]));
  const needSatuan = new Map<string, number>();
  for (const item of payload.items) {
    const qty = item.quantity ?? 1;
    if (item.packageId) {
      if ((readyByPkg.get(item.packageId) ?? 0) < qty) return invalid("Stok paket rakitan belum cukup — hubungi admin gudang.");
    } else if (item.variantId) {
      const key = `${item.variantId}::${item.size?.trim() || KAIN_SIZE}`;
      needSatuan.set(key, (needSatuan.get(key) ?? 0) + qty);
    }
  }
  for (const [key, qty] of needSatuan) {
    if ((stockByKey.get(key)?.quantity ?? 0) < qty) return invalid("Stok satuan tidak cukup untuk ukuran tersebut.");
  }

  // Total + baris order (beasiswa/free: total 0 menunggu verifikasi).
  const lines: UniformOrderLine[] = payload.items.map((item) => {
    const qty = item.quantity ?? 1;
    if (item.packageId) {
      const p = pkgById.get(item.packageId);
      return { packageId: item.packageId, variantId: null, size: resolvedPkgSize.get(item.packageId) ?? KAIN_SIZE, quantity: qty, unitPrice: p?.price ?? 0 };
    }
    const v = variantById.get(item.variantId as string);
    return { packageId: null, variantId: item.variantId as string, size: item.size?.trim() || KAIN_SIZE, quantity: qty, unitPrice: v?.price ?? 0 };
  });
  const total = isScholarship ? 0 : lines.reduce((sum, l) => sum + l.quantity * l.unitPrice, 0);
  const prefix = deps?.orderPrefix ?? (await readSettingsMap(database))[UNIFORM_ORDER_PREFIX_KEY] ?? DEFAULT_UNIFORM_ORDER_PREFIX;
  let scholarshipProofUrl: string | null = null;
  if (isScholarship && payload.scholarshipProofBase64) {
    scholarshipProofUrl = await defaultStorage.upload(
      `uniform-scholarships/${payload.studentId}_${Date.now()}.jpg`,
      decodeBase64ToBytes(payload.scholarshipProofBase64),
      "image/jpeg"
    );
  }

  // Tulis atomik (§10): order + item + kurangi stok dalam satu batch.
  // Tiap percobaan memakai orderId baru + best-effort hapus order yatim
  // parsial — retry dengan id sama menabrak UNIQUE dan menyisakan order
  // tanpa baris bila chunk items gagal setelah order ter-insert.
  const queries: unknown[] = [];
  const maxAttempts = 3;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const orderId = newWriteId(deps);
    const orderNumber = (deps?.generateOrderNumber ?? ((iso: string) => defaultOrderNumber(prefix, iso)))(now);
    try {
      queries.push(
        database.insert(uniformOrders).values({
          id: orderId,
          orderNumber,
          studentId: payload.studentId,
          schoolId,
          academicYear: payload.academicYear,
          homeAddressSnapshot: payload.homeAddress.trim(),
          shipmentStatus: "belum_dikirim",
          totalAmount: total,
          paidAmount: 0,
          paymentStatus: isScholarship ? "scholarship_pending" : "unpaid",
          orderType: isScholarship ? "scholarship" : "regular",
          scholarshipProofUrl,
          notes: payload.notes?.trim() || null,
          createdAt: now,
          updatedAt: now,
        })
      );
      for (const rows of chunkRows(
        lines.map((l) => ({ id: newWriteId(deps), orderId, packageId: l.packageId, variantId: l.variantId, size: l.size, quantity: l.quantity, unitPriceSnapshot: l.unitPrice, createdAt: now }))
      )) {
        queries.push(database.insert(uniformOrderItems).values(rows));
      }
      const needPaket = new Map<string, number>();
      for (const item of payload.items) {
        if (item.packageId) needPaket.set(item.packageId, (needPaket.get(item.packageId) ?? 0) + (item.quantity ?? 1));
      }
      for (const [packageId, qty] of needPaket) {
        const row = ready.find((r) => r.packageId === packageId);
        if (row) queries.push(database.update(uniformPackageStock).set({ quantity: row.quantity - qty, updatedAt: now }).where(eq(uniformPackageStock.id, row.id)));
      }
      for (const [key, qty] of needSatuan) {
        const row = stockByKey.get(key);
        if (row) queries.push(database.update(uniformStock).set({ quantity: row.quantity - qty, updatedAt: now }).where(eq(uniformStock.id, row.id)));
      }
      // Batch di-chunk per 10 query agar aman di limit D1, urutan FK terjaga.
      for (const group of chunkRows(queries, 10)) await runWriteBatch(database, group);
      const [created] = await database.select().from(uniformOrders).where(eq(uniformOrders.id, orderId));
      return { ok: true, data: { order: created, totalAmount: total } };
    } catch (err) {
      const mapped = d1WriteErrorStatus(err, "membuat order seragam");
      try {
        await database.delete(uniformOrders).where(eq(uniformOrders.id, orderId));
      } catch {
        // Abaikan: order mungkin tak pernah ter-insert.
      }
      if (mapped && attempt < maxAttempts - 1) {
        queries.length = 0;
        continue;
      }
      if (mapped) return { ok: false, ...mapped };
      throw err;
    }
  }
  return invalid("Gagal membuat order seragam, silakan ulangi.");
}

/** Verifikasi beasiswa seragam oleh staf: approve (lunas) atau reject. */
export async function resolveUniformScholarship(
  database: AppDatabase,
  orderId: string,
  action: "approve" | "reject",
  deps?: WriteDeps
): Promise<{ ok: true; data: typeof uniformOrders.$inferSelect } | UniformError> {
  const now = writeNow(deps);
  const [order]: Array<typeof uniformOrders.$inferSelect> = await database
    .select()
    .from(uniformOrders)
    .where(eq(uniformOrders.id, orderId));
  if (!order) return { ok: false, status: 404, message: "Order seragam tidak ditemukan." };
  if (order.orderType !== "scholarship" || order.paymentStatus !== "scholarship_pending") {
    return invalid("Order ini bukan pengajuan beasiswa yang menunggu verifikasi.");
  }
  const paymentStatus = action === "approve" ? "paid" : "unpaid";
  await database.update(uniformOrders).set({ paymentStatus, updatedAt: now }).where(eq(uniformOrders.id, orderId));
  const [updated] = await database.select().from(uniformOrders).where(eq(uniformOrders.id, orderId));
  return { ok: true, data: updated };
}

/** Tandai kiriman gudang: belum_dikirim → sudah_dikirim (+ shippedAt). Satu arah, tanpa un-ship. */
export async function markUniformShipped(
  database: AppDatabase,
  orderId: string,
  deps?: WriteDeps
): Promise<{ ok: true; data: typeof uniformOrders.$inferSelect } | UniformError> {
  const now = writeNow(deps);
  const [order]: Array<typeof uniformOrders.$inferSelect> = await database
    .select()
    .from(uniformOrders)
    .where(eq(uniformOrders.id, orderId));
  if (!order) return { ok: false, status: 404, message: "Order seragam tidak ditemukan." };
  if (order.shipmentStatus === "sudah_dikirim") return invalid("Order sudah ditandai terkirim.");
  await database
    .update(uniformOrders)
    .set({ shipmentStatus: "sudah_dikirim", shippedAt: now, updatedAt: now })
    .where(eq(uniformOrders.id, orderId));
  await database
    .update(students)
    .set({ hasTakenUniform: true, updatedAt: now })
    .where(eq(students.id, order.studentId));
  const [updated] = await database.select().from(uniformOrders).where(eq(uniformOrders.id, orderId));
  return { ok: true, data: updated };
}

export interface UniformOrderListFilters {
  schoolId?: string;
  shipmentStatus?: string;
  paymentStatus?: string;
  stage?: string;
  search?: string;
}

/** Gerbang scope order seragam: 403 bila order ada di luar penugasan aktor. */
export const assertUniformOrderInScope = async (
  database: AppDatabase,
  scope: string[],
  orderId: string
): Promise<void> => {
  const [o] = await database
    .select({ schoolId: uniformOrders.schoolId })
    .from(uniformOrders)
    .where(eq(uniformOrders.id, orderId));
  if (!o || scope.includes(o.schoolId)) return;
  throw new AccessHttpError(403, "Akses order di luar sekolah penugasan dilarang");
};

/**
 * Daftar order seragam ber-scope (filter sekolah/status/tahap/pencarian dalam
 * sekolah) + jumlah klaim pembayaran pending per baris dalam satu grup-baca.
 * Pencarian wajib terpartisi sekolah (penegakan di route).
 */
export async function listUniformOrders(database: AppDatabase, filters: UniformOrderListFilters) {
  const conditions = [];
  if (filters.schoolId) conditions.push(eq(uniformOrders.schoolId, filters.schoolId));
  if (filters.shipmentStatus === "belum_dikirim" || filters.shipmentStatus === "sudah_dikirim") {
    conditions.push(eq(uniformOrders.shipmentStatus, filters.shipmentStatus));
  }
  if (
    filters.paymentStatus === "unpaid" ||
    filters.paymentStatus === "partial" ||
    filters.paymentStatus === "paid" ||
    filters.paymentStatus === "scholarship_pending"
  ) {
    conditions.push(eq(uniformOrders.paymentStatus, filters.paymentStatus));
  }
  conditions.push(...uniformStageFilter(filters.stage));
  if (filters.search) {
    const matched = matchAnyLower([students.name, students.nis, uniformOrders.orderNumber], filters.search);
    if (matched) conditions.push(matched);
  }
  const rows = await database
    .select({
      id: uniformOrders.id,
      orderNumber: uniformOrders.orderNumber,
      studentId: uniformOrders.studentId,
      studentName: students.name,
      nis: students.nis,
      gradeLevel: students.gradeLevel,
      schoolId: uniformOrders.schoolId,
      schoolName: schools.name,
      shipmentStatus: uniformOrders.shipmentStatus,
      shippedAt: uniformOrders.shippedAt,
      shippingCost: uniformOrders.shippingCost,
      shippingResi: uniformOrders.shippingResi,
      invoiceSentAt: uniformOrders.invoiceSentAt,
      paymentStatus: uniformOrders.paymentStatus,
      orderType: uniformOrders.orderType,
      totalAmount: uniformOrders.totalAmount,
      paidAmount: uniformOrders.paidAmount,
      homeAddressSnapshot: uniformOrders.homeAddressSnapshot,
      createdAt: uniformOrders.createdAt,
    })
    .from(uniformOrders)
    .innerJoin(students, eq(uniformOrders.studentId, students.id))
    .innerJoin(schools, eq(uniformOrders.schoolId, schools.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(uniformOrders.createdAt))
    .limit(50);
  const pending = await pendingPaymentCounts(database, "seragam", rows.map((r) => r.id));
  return rows.map((r) => ({ ...r, stage: uniformOrderStage(r), pendingCount: pending.get(r.id) ?? 0 }));
}
