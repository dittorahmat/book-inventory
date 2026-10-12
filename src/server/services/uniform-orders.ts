import { eq, inArray } from "drizzle-orm";
import type { AppDatabase } from "../../db";
import {
  students,
  uniformVariants,
  uniformSizes,
  uniformStock,
  uniformPackages,
  uniformPackageBom,
  uniformPackageStock,
  uniformOrders,
  uniformOrderItems,
} from "../../db/schema";
import {
  chunkRows,
  d1WriteErrorStatus,
  newWriteId,
  runWriteBatch,
  writeNow,
  type WriteDeps,
} from "../lib/d1-write";
import { readSettingsMap } from "./settings-map";
import { KAIN_SIZE, type UniformError } from "./uniform-catalog";
import type { SubmitUniformOrderPayload } from "../../lib/uniform-types";

export interface SubmitUniformOrderDeps extends WriteDeps {
  generateOrderNumber?: (nowIso: string) => string;
  orderPrefix?: string;
}

export const UNIFORM_ORDER_PREFIX_KEY = "uniform_order_prefix";
export const DEFAULT_UNIFORM_ORDER_PREFIX = "USO";

type VariantRow = typeof uniformVariants.$inferSelect;
type PackageRow = typeof uniformPackages.$inferSelect;

const invalid = (message: string): UniformError => ({ ok: false, status: 400, message });

const defaultOrderNumber = (prefix: string, nowIso: string): string =>
  `${prefix}-${nowIso.slice(0, 10).replaceAll("-", "")}-${Math.floor(Math.random() * 900 + 100)}`;

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
  const homeAddress = payload.homeAddress.trim();
  if (!homeAddress) return invalid("Alamat rumah wajib diisi.");
  if (!payload.items || payload.items.length === 0) return invalid("Pilih minimal satu paket atau satuan.");
  if (!/^\d{4}\/\d{4}$/.test(payload.academicYear)) return invalid("Format tahun ajaran wajib YYYY/YYYY.");

  const [student] = await database.select().from(students).where(eq(students.id, payload.studentId));
  if (!student) return { ok: false, status: 404, message: "Murid tidak ditemukan." };
  if (student.status === "new_pending" || student.status === "rejected") {
    return invalid("Murid belum terverifikasi admin sekolah.");
  }
  const schoolId: string = student.schoolId;

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

  // Total + baris order.
  const lines: UniformOrderLine[] = payload.items.map((item) => {
    const qty = item.quantity ?? 1;
    if (item.packageId) {
      const p = pkgById.get(item.packageId);
      return { packageId: item.packageId, variantId: null, size: resolvedPkgSize.get(item.packageId) ?? KAIN_SIZE, quantity: qty, unitPrice: p?.price ?? 0 };
    }
    const v = variantById.get(item.variantId as string);
    return { packageId: null, variantId: item.variantId as string, size: item.size?.trim() || KAIN_SIZE, quantity: qty, unitPrice: v?.price ?? 0 };
  });
  const total = lines.reduce((sum, l) => sum + l.quantity * l.unitPrice, 0);
  const prefix = deps?.orderPrefix ?? (await readSettingsMap(database))[UNIFORM_ORDER_PREFIX_KEY] ?? DEFAULT_UNIFORM_ORDER_PREFIX;

  // Tulis atomik (§10): order + item + kurangi stok dalam satu batch.
  const orderId = newWriteId(deps);
  const queries: unknown[] = [];
  const maxAttempts = 3;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const orderNumber = (deps?.generateOrderNumber ?? ((iso: string) => defaultOrderNumber(prefix, iso)))(now);
    try {
      queries.push(
        database.insert(uniformOrders).values({
          id: orderId,
          orderNumber,
          studentId: payload.studentId,
          schoolId,
          academicYear: payload.academicYear,
          homeAddressSnapshot: homeAddress,
          shipmentStatus: "belum_dikirim",
          totalAmount: total,
          paidAmount: total,
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
      for (const item of payload.items) {
        const qty = item.quantity ?? 1;
        if (item.packageId) {
          const row = ready.find((r) => r.packageId === item.packageId);
          if (row) queries.push(database.update(uniformPackageStock).set({ quantity: row.quantity - qty, updatedAt: now }).where(eq(uniformPackageStock.id, row.id)));
        } else if (item.variantId) {
          const row = stockByKey.get(`${item.variantId}::${item.size?.trim() || KAIN_SIZE}`);
          if (row) queries.push(database.update(uniformStock).set({ quantity: row.quantity - (needSatuan.get(`${item.variantId}::${item.size?.trim() || KAIN_SIZE}`) ?? qty), updatedAt: now }).where(eq(uniformStock.id, row.id)));
        }
      }
      // Batch di-chunk per 10 query agar aman di limit D1, urutan FK terjaga.
      for (const group of chunkRows(queries, 10)) await runWriteBatch(database, group);
      const [created] = await database.select().from(uniformOrders).where(eq(uniformOrders.id, orderId));
      return { ok: true, data: { order: created, totalAmount: total } };
    } catch (err) {
      const mapped = d1WriteErrorStatus(err, "membuat order seragam");
      if (mapped && attempt < maxAttempts - 1) {
        queries.length = 0;
        await new Promise((r) => setTimeout(r, 5));
        continue;
      }
      if (mapped) return { ok: false, ...mapped };
      throw err;
    }
  }
  return invalid("Gagal membuat order seragam, silakan ulangi.");
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
  const [updated] = await database.select().from(uniformOrders).where(eq(uniformOrders.id, orderId));
  return { ok: true, data: updated };
}
