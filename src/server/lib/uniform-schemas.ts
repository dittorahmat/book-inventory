import { z } from "zod";
import { idSchema, academicYearSchema } from "./validators";

/** Skema validasi route seragam: hanya validasi + bentuk payload, tanpa logika bisnis. */

export const variantSchema = z.object({
  code: z.string().min(1, "Kode varian wajib diisi"),
  name: z.string().min(1, "Nama varian wajib diisi"),
  kind: z.enum(["kain_harian", "olahraga"]),
  gender: z.enum(["male", "female"]),
  jenjang: z.enum(["tk", "sd", "smp", "sma"]),
  academicYear: academicYearSchema,
  price: z.number().int().min(0).default(0),
  sizeChartUrl: z.string().optional(),
  description: z.string().optional(),
  sizes: z.array(z.string().min(1)).default([]),
});

export const uniformPackageSchema = z.object({
  code: z.string().min(1, "Kode paket wajib diisi"),
  name: z.string().min(1, "Nama paket wajib diisi"),
  academicYear: academicYearSchema,
  price: z.number().int().min(0).default(0),
  description: z.string().optional(),
  items: z
    .array(
      z.object({
        variantId: idSchema,
        size: z.string().optional(),
        quantity: z.number().int().min(1).default(1),
      })
    )
    .min(1, "Paket wajib punya minimal satu komponen"),
});

export const uniformPoSchema = z.object({
  supplierId: idSchema,
  orderDate: z.string().optional(),
  notes: z.string().optional(),
  poNumber: z.string().optional(),
  lines: z
    .array(
      z.object({
        variantId: idSchema,
        size: z.string().optional(),
        quantityOrdered: z.number().int().min(1).max(500),
        unitPrice: z.number().int().min(0).default(0),
      })
    )
    .min(1, "PO wajib punya minimal satu baris"),
});

export const receiveSchema = z.object({
  lines: z
    .array(
      z.object({
        variantId: idSchema,
        size: z.string().optional(),
        quantity: z.number().int().min(1).max(500),
      })
    )
    .min(1, "Penerimaan wajib punya minimal satu baris"),
});

export const assembleSchema = z.object({
  quantity: z.number().int().min(1).max(500),
  sizeOverrides: z.record(z.string(), z.string().min(1)).optional(),
});

export const exchangeSchema = z.object({
  orderId: idSchema,
  oldVariantId: idSchema,
  oldSize: z.string().min(1, "Size lama wajib diisi"),
  newVariantId: idSchema,
  newSize: z.string().min(1, "Size baru wajib diisi"),
  reason: z.string().min(1, "Alasan wajib diisi"),
});

export const resolveExchangeSchema = z.object({
  action: z.enum(["approve", "complete", "reject", "approve_ready", "approve_backorder"]),
  replacementResi: z.string().optional(),
  estimatedShipDate: z.string().optional(),
});

export const refundSchema = z.object({
  orderId: idSchema,
  amount: z.number().int().min(1).optional(),
  reason: z.string().min(1, "Alasan wajib diisi"),
});

export const resolveRefundSchema = z.object({
  action: z.enum(["approve", "refund", "reject"]),
});

export const claimSchema = z.object({
  schoolId: idSchema,
  period: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Periode wajib format YYYY-MM"),
});
