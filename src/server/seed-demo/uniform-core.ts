import { and, eq } from "drizzle-orm";
import {
  branchClaims,
  suppliers,
  uniformExchanges,
  uniformOrderItems,
  uniformOrders,
  uniformPackageBom,
  uniformPackageStock,
  uniformPackages,
  uniformPoItems,
  uniformPos,
  uniformRefunds,
  uniformSizes,
  uniformStock,
  uniformVariants,
} from "../../db/schema";
import type { SeedContext } from "./context";

export async function seedUniformCore({ db: targetDb, now }: SeedContext) {
  const AY = "2026/2027";
  const kainPrice: Record<string, number> = { tk: 100000, sd: 120000, smp: 135000, sma: 150000 };
  const olPrice: Record<string, number> = { tk: 95000, sd: 110000, smp: 125000, sma: 140000 };
  const olSizes: Record<string, string[]> = {
    tk: ["S", "M"],
    sd: ["S", "M", "L"],
    smp: ["M", "L", "XL"],
    sma: ["L", "XL", "XXL"],
  };
  const jenjangs = ["tk", "sd", "smp", "sma"] as const;
  const genders = ["male", "female"] as const;
  const genderLabel = { male: "Laki-laki", female: "Perempuan" } as const;
  const jenjangLabel = { tk: "TK", sd: "SD", smp: "SMP", sma: "SMA" } as const;

  await targetDb.insert(suppliers).values({
    id: "sup-demo-konveksi",
    code: "SUP-KONV-DEMO",
    name: "Konveksi Seragam Demo",
    contactPerson: "H. Bambang Konveksi",
    email: "order@konveksidemo.id",
    phone: "+62 21 5550199",
    address: "Jl. Konveksi Raya No. 9, Tangerang Selatan",
    createdAt: now,
    updatedAt: now,
  }).onConflictDoNothing();

  for (const j of jenjangs) {
    for (const g of genders) {
      const id = `uv-demo-kain-${j}-${g === "male" ? "m" : "f"}`;
      await targetDb.insert(uniformVariants).values({
        id,
        code: `UV-KAIN-${jenjangLabel[j]}-${g === "male" ? "M" : "F"}-2026`,
        name: `Kain Harian ${jenjangLabel[j]} ${genderLabel[g]}`,
        kind: "kain_harian",
        gender: g,
        jenjang: j,
        academicYear: AY,
        price: kainPrice[j],
        description: "Kain harian tanpa ukuran, dipotong penjahit.",
        createdAt: now,
        updatedAt: now,
      }).onConflictDoNothing();
      await targetDb.insert(uniformStock).values({
        id: `ust-demo-kain-${j}-${g === "male" ? "m" : "f"}`,
        variantId: id,
        size: "—",
        quantity: 40,
        updatedAt: now,
      }).onConflictDoNothing();
      await targetDb.update(uniformStock).set({ quantity: 40, updatedAt: now })
        .where(and(eq(uniformStock.variantId, id), eq(uniformStock.size, "—")));
    }
  }

  for (const j of jenjangs) {
    for (const g of genders) {
      const s = g === "male" ? "m" : "f";
      const id = `uv-demo-ol-${j}-${s}`;
      await targetDb.insert(uniformVariants).values({
        id,
        code: `UO-${jenjangLabel[j]}-${g === "male" ? "M" : "F"}-2026`,
        name: `Olahraga ${jenjangLabel[j]} ${genderLabel[g]}`,
        kind: "olahraga",
        gender: g,
        jenjang: j,
        academicYear: AY,
        price: olPrice[j],
        sizeChartUrl: "https://contoh.id/size-chart.png",
        description: "Pakaian jadi bersize, lihat size chart sebelum pesan.",
        createdAt: now,
        updatedAt: now,
      }).onConflictDoNothing();
      for (const [i, size] of olSizes[j].entries()) {
        await targetDb.insert(uniformSizes).values({
          id: `us-demo-ol-${j}-${s}-${size}`,
          variantId: id,
          size,
          sortOrder: i,
          createdAt: now,
        }).onConflictDoNothing();
        await targetDb.insert(uniformStock).values({
          id: `ust-demo-ol-${j}-${s}-${size}`,
          variantId: id,
          size,
          quantity: 15,
          updatedAt: now,
        }).onConflictDoNothing();
      }
    }
  }

  const pkgDefs = [
    { id: "upk-demo-sd-m", code: "UPK-DEMO-SD-M", name: "Paket Seragam SD Laki-laki", kain: "uv-demo-kain-sd-m", ol: "uv-demo-ol-sd-m", price: 230000 },
    { id: "upk-demo-sd-f", code: "UPK-DEMO-SD-F", name: "Paket Seragam SD Perempuan", kain: "uv-demo-kain-sd-f", ol: "uv-demo-ol-sd-f", price: 230000 },
    { id: "upk-demo-smp-m", code: "UPK-DEMO-SMP-M", name: "Paket Seragam SMP Laki-laki", kain: "uv-demo-kain-smp-m", ol: "uv-demo-ol-smp-m", price: 260000 },
  ];
  for (const p of pkgDefs) {
    await targetDb.insert(uniformPackages).values({
      id: p.id,
      code: p.code,
      name: `${p.name} 2026/2027`,
      academicYear: AY,
      price: p.price,
      description: "Kain harian + set olahraga (size dipilih saat pesan).",
      createdAt: now,
      updatedAt: now,
    }).onConflictDoNothing();
    await targetDb.insert(uniformPackageBom).values({
      id: `ubom-demo-${p.id}-kain`,
      packageId: p.id,
      variantId: p.kain,
      size: "—",
      quantity: 1,
      createdAt: now,
    }).onConflictDoNothing();
    await targetDb.insert(uniformPackageBom).values({
      id: `ubom-demo-${p.id}-ol`,
      packageId: p.id,
      variantId: p.ol,
      size: "—",
      quantity: 1,
      createdAt: now,
    }).onConflictDoNothing();
  }
  const pkgReady: Record<string, number> = { "upk-demo-sd-m": 4, "upk-demo-sd-f": 4, "upk-demo-smp-m": 5 };
  for (const p of pkgDefs) {
    await targetDb.insert(uniformPackageStock).values({
      id: `upst-demo-${p.id}`,
      packageId: p.id,
      quantity: pkgReady[p.id] ?? 4,
      updatedAt: now,
    }).onConflictDoNothing();
    await targetDb.update(uniformPackageStock).set({ quantity: pkgReady[p.id] ?? 4, updatedAt: now })
      .where(eq(uniformPackageStock.packageId, p.id));
  }

  await targetDb.insert(uniformPos).values({
    id: "upo-demo-01",
    poNumber: "UPO-DEMO-2026-01",
    supplierId: "sup-demo-konveksi",
    status: "received",
    orderDate: "2026-09-20",
    totalAmount: 13600000,
    notes: "Pengadaan awal seragam demo (kain + olahraga SD).",
    createdAt: now,
    updatedAt: now,
  }).onConflictDoNothing();
  const poLines = [
    { id: "upoi-demo-01-1", variantId: "uv-demo-kain-sd-m", size: "—", qty: 20, price: 120000 },
    { id: "upoi-demo-01-2", variantId: "uv-demo-kain-sd-f", size: "—", qty: 20, price: 120000 },
    { id: "upoi-demo-01-3", variantId: "uv-demo-ol-sd-m", size: "M", qty: 20, price: 110000 },
    { id: "upoi-demo-01-4", variantId: "uv-demo-ol-sd-m", size: "L", qty: 20, price: 110000 },
    { id: "upoi-demo-01-5", variantId: "uv-demo-ol-sd-f", size: "S", qty: 20, price: 110000 },
    { id: "upoi-demo-01-6", variantId: "uv-demo-ol-sd-f", size: "M", qty: 20, price: 110000 },
  ];
  for (const l of poLines) {
    await targetDb.insert(uniformPoItems).values({
      id: l.id,
      poId: "upo-demo-01",
      variantId: l.variantId,
      size: l.size,
      quantityOrdered: l.qty,
      quantityReceived: l.qty,
      unitPrice: l.price,
      createdAt: now,
    }).onConflictDoNothing();
  }

  const addr = "Jl. Merdeka No. 45, RT 02 RW 05, Depok, Jawa Barat 16418";
  const orderDefs = [
    { id: "ord-demo-uso-01", no: "USO-DEMO-01", studentId: "std-aisyah-2", ship: "belum_dikirim" as const, shippedAt: null as string | null, total: 230000 },
    { id: "ord-demo-uso-02", no: "USO-DEMO-02", studentId: "std-farhan-3", ship: "sudah_dikirim" as const, shippedAt: now, total: 230000 },
    { id: "ord-demo-uso-03", no: "USO-DEMO-03", studentId: "std-farhan-3", ship: "belum_dikirim" as const, shippedAt: null as string | null, total: 230000 },
    { id: "ord-demo-uso-04", no: "USO-DEMO-04", studentId: "std-kayla-5", ship: "belum_dikirim" as const, shippedAt: null as string | null, total: 110000 },
  ];
  for (const o of orderDefs) {
    await targetDb.insert(uniformOrders).values({
      id: o.id,
      orderNumber: o.no,
      studentId: o.studentId,
      schoolId: "school-alw-1",
      academicYear: AY,
      homeAddressSnapshot: addr,
      shipmentStatus: o.ship,
      shippedAt: o.shippedAt,
      totalAmount: o.total,
      paidAmount: o.total,
      notes: "Order demo portal seragam.",
      createdAt: now,
      updatedAt: now,
    }).onConflictDoNothing();
  }
  const itemDefs = [
    { id: "uoi-demo-01-1", orderId: "ord-demo-uso-01", packageId: "upk-demo-sd-f", variantId: null as string | null, size: "M", qty: 1, price: 230000 },
    { id: "uoi-demo-02-1", orderId: "ord-demo-uso-02", packageId: null as string | null, variantId: "uv-demo-kain-sd-m", size: "—", qty: 1, price: 120000 },
    { id: "uoi-demo-02-2", orderId: "ord-demo-uso-02", packageId: null as string | null, variantId: "uv-demo-ol-sd-m", size: "M", qty: 1, price: 110000 },
    { id: "uoi-demo-03-1", orderId: "ord-demo-uso-03", packageId: "upk-demo-sd-m", variantId: null as string | null, size: "M", qty: 1, price: 230000 },
    { id: "uoi-demo-04-1", orderId: "ord-demo-uso-04", packageId: null as string | null, variantId: "uv-demo-ol-sd-f", size: "S", qty: 1, price: 110000 },
  ];
  for (const it of itemDefs) {
    await targetDb.insert(uniformOrderItems).values({
      id: it.id,
      orderId: it.orderId,
      packageId: it.packageId,
      variantId: it.variantId,
      size: it.size,
      quantity: it.qty,
      unitPriceSnapshot: it.price,
      createdAt: now,
    }).onConflictDoNothing();
  }

  await targetDb.insert(uniformExchanges).values({
    id: "ex-demo-01",
    orderId: "ord-demo-uso-04",
    studentId: "std-kayla-5",
    oldVariantId: "uv-demo-ol-sd-f",
    oldSize: "S",
    newVariantId: "uv-demo-ol-sd-f",
    newSize: "M",
    reason: "Kekecilan, mohon tukar ke ukuran M.",
    status: "requested",
    createdAt: now,
    updatedAt: now,
  }).onConflictDoNothing();

  await targetDb.insert(uniformRefunds).values({
    id: "rf-demo-01",
    refundNumber: "RFD-U-DEMO-01",
    orderId: "ord-demo-uso-02",
    studentId: "std-farhan-3",
    amount: 50000,
    reason: "Jahitan lepas pada lengan olahraga.",
    status: "requested",
    createdAt: now,
    updatedAt: now,
  }).onConflictDoNothing();

  await targetDb.insert(branchClaims).values({
    id: "clm-demo-01",
    claimNumber: `CLM-DEMO-${now.slice(0, 7)}`,
    schoolId: "school-alw-1",
    period: now.slice(0, 7),
    status: "draft",
    totalQty: 5,
    totalAmount: 800000,
    createdAt: now,
    updatedAt: now,
  }).onConflictDoNothing();
}
