import { z } from "zod";
import type { AppDatabase } from "../../db";
import { systemSettings } from "../../db/schema";
import { eq } from "drizzle-orm";
import { writeNow, type WriteDeps } from "../lib/d1-write";

export const WAREHOUSE_RETURN_ADDRESS_KEY = "warehouse_return_address";

export const warehouseReturnAddressSchema = z.object({
  recipientName: z.string().trim().min(1, "Nama penerima / PIC gudang wajib diisi"),
  phone: z.string().trim().min(8, "Nomor kontak telepon/WA gudang wajib diisi"),
  addressLine: z.string().trim().min(5, "Alamat gudang wajib diisi"),
  district: z.string().trim().min(1, "Kecamatan wajib diisi"),
  city: z.string().trim().min(1, "Kota/Kabupaten wajib diisi"),
  postalCode: z.string().trim().min(5, "Kode pos wajib diisi (minimal 5 karakter)"),
  notes: z.string().trim().optional().default(""),
});

export type WarehouseReturnAddress = z.infer<typeof warehouseReturnAddressSchema>;

export const DEFAULT_RETURN_ADDRESS: WarehouseReturnAddress = {
  recipientName: "Gudang Logistik Pusat Al Wildan (Retur)",
  phone: "081234567890",
  addressLine: "Jl. Boulevard Al Wildan No. 1, Gudang Sentral",
  district: "Kelapa Dua",
  city: "Kabupaten Tangerang",
  postalCode: "15810",
  notes: "Wajib cantumkan No. Order / No. Tiket Retur di luar paket.",
};

export async function getWarehouseReturnAddress(database: AppDatabase): Promise<WarehouseReturnAddress> {
  const [row] = await database
    .select({ value: systemSettings.value })
    .from(systemSettings)
    .where(eq(systemSettings.key, WAREHOUSE_RETURN_ADDRESS_KEY));

  if (!row?.value) {
    return DEFAULT_RETURN_ADDRESS;
  }

  try {
    const parsed = JSON.parse(row.value);
    const valid = warehouseReturnAddressSchema.safeParse(parsed);
    return valid.success ? valid.data : DEFAULT_RETURN_ADDRESS;
  } catch {
    return DEFAULT_RETURN_ADDRESS;
  }
}

export async function saveWarehouseReturnAddress(
  database: AppDatabase,
  input: WarehouseReturnAddress,
  deps?: WriteDeps
): Promise<WarehouseReturnAddress> {
  const now = writeNow(deps);
  const validated = warehouseReturnAddressSchema.parse(input);
  const value = JSON.stringify(validated);

  await database
    .insert(systemSettings)
    .values({
      key: WAREHOUSE_RETURN_ADDRESS_KEY,
      value,
      description: "Alamat retur Gudang Pusat untuk pengembalian buku dan seragam",
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: systemSettings.key,
      set: {
        value,
        description: "Alamat retur Gudang Pusat untuk pengembalian buku dan seragam",
        updatedAt: now,
      },
    });

  return validated;
}
