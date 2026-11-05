import { and, eq, inArray } from "drizzle-orm";
import type { AppDatabase } from "../../../db";
import { uniformStock, uniformOrderItems, uniformOrders } from "../../../db/schema";
import type { UniformError } from "./catalog";

const invalid = (message: string): UniformError => ({ ok: false, status: 400, message });

export async function validateUniformSizeRemoval(
  database: AppDatabase,
  variantId: string,
  removedSizes: string[]
): Promise<{ ok: true } | UniformError> {
  if (removedSizes.length === 0) return { ok: true };

  const stocks = await database
    .select()
    .from(uniformStock)
    .where(
      and(
        eq(uniformStock.variantId, variantId),
        inArray(uniformStock.size, removedSizes)
      )
    );
  const hasStock = stocks.some((s) => s.quantity > 0);
  if (hasStock) {
    return invalid("Ukuran tidak dapat dihapus karena masih memiliki saldo stok fisik di gudang.");
  }

  const activeOrders = await database
    .select({ id: uniformOrders.id, orderNumber: uniformOrders.orderNumber })
    .from(uniformOrderItems)
    .innerJoin(uniformOrders, eq(uniformOrderItems.orderId, uniformOrders.id))
    .where(
      and(
        eq(uniformOrderItems.variantId, variantId),
        inArray(uniformOrderItems.size, removedSizes),
        eq(uniformOrders.shipmentStatus, "belum_dikirim")
      )
    )
    .limit(1);

  if (activeOrders.length > 0) {
    return invalid(`Ukuran tidak dapat dihapus karena masih terikat pada pesanan pending (${activeOrders[0].orderNumber}).`);
  }

  return { ok: true };
}
