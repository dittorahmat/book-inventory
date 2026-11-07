import * as fs from "fs";
import * as path from "path";
import * as xlsx from "xlsx";
import { getDatabase } from "../src/db";
import {
  uniformVariants,
  uniformSizes,
  uniformStock,
  uniformPackages,
  uniformPackageBom,
  uniformPackageStock,
  uniformPoItems,
  uniformPos,
  uniformOrderItems,
  uniformOrders,
  uniformExchanges,
  uniformRefunds,
  uniformRejects,
} from "../src/db/schema";
import { KAIN_SIZE } from "../src/server/services/uniform/catalog";

async function main() {
  console.log("=== Import Uniform Catalog ===");
  const db = await getDatabase();

  const excelPath = process.env.CATALOG_EXCEL_PATH || path.resolve("data/katalog seragam aw.xlsx");
  const sizeChartUrl = "/size-chart-olahraga-2026.jpeg";
  const academicYear = "2026/2027";
  const now = new Date().toISOString();

  // 1. Kosongkan tabel seragam lokal (child -> parent)
  console.log("Cleaning up local uniform tables...");
  await db.delete(uniformRejects);
  await db.delete(uniformRefunds);
  await db.delete(uniformExchanges);
  await db.delete(uniformOrderItems);
  await db.delete(uniformOrders);
  await db.delete(uniformPoItems);
  await db.delete(uniformPos);
  await db.delete(uniformPackageStock);
  await db.delete(uniformPackageBom);
  await db.delete(uniformPackages);
  await db.delete(uniformStock);
  await db.delete(uniformSizes);
  await db.delete(uniformVariants);
  console.log("Local uniform tables cleared.");

  // 2. Baca file Excel
  const wb = xlsx.readFile(excelPath);
  const sheet = wb.Sheets["Sheet1"];
  const raw: any[][] = xlsx.utils.sheet_to_json(sheet, { header: 1 });

  let currentHeader = "";
  const variantsToInsert: Array<{
    id: string;
    code: string;
    name: string;
    kind: "kain_harian" | "olahraga";
    gender: "male" | "female";
    jenjang: "tk" | "sd" | "smp" | "sma";
    academicYear: string;
    price: number;
    sizeChartUrl: string | null;
    description: string;
    createdAt: string;
    updatedAt: string;
  }> = [];

  const sizesToInsert: Array<{
    id: string;
    variantId: string;
    size: string;
    sortOrder: number;
    createdAt: string;
  }> = [];

  const sportSizesByJenjang: Record<string, string[]> = {
    tk: ["S", "M", "L", "XL"],
    sd: ["S", "M", "L", "XL", "2XL", "3XL", "4XL"],
    smp: ["S", "M", "L", "XL", "2XL", "3XL", "4XL", "5XL"],
    sma: ["S", "M", "L", "XL", "2XL", "3XL", "4XL", "5XL"],
  };

  for (let i = 1; i < raw.length; i++) {
    const row = raw[i];
    if (!row || row.length === 0) continue;
    if (row[0] && String(row[0]).trim()) {
      currentHeader = String(row[0]).trim();
    }
    const itemName = row[1] ? String(row[1]).trim() : "";
    const price = row[2];
    if (!itemName || typeof price !== "number") continue;

    let jenjang: "tk" | "sd" | "smp" | "sma" = "tk";
    let gender: "male" | "female" = "male";

    const h = currentHeader.toUpperCase();
    if (h.includes("TK")) jenjang = "tk";
    else if (h.includes("SD")) jenjang = "sd";
    else if (h.includes("SMP")) jenjang = "smp";
    else if (h.includes("SMA")) jenjang = "sma";

    if (h.includes("IKHWAN")) gender = "male";
    else if (h.includes("AKHWAT")) gender = "female";

    const isSport = itemName.toUpperCase().includes("OLAHRAGA");
    const kind: "kain_harian" | "olahraga" = isSport ? "olahraga" : "kain_harian";

    const itemSlug = itemName.toUpperCase().replace(/[^A-Z0-9]/g, "_");
    const code = `UNI-${jenjang.toUpperCase()}-${gender === "male" ? "IKH" : "AKH"}-${itemSlug}`;
    const id = `uv-${code.toLowerCase().replace(/_/g, "-")}`;

    const variantRecord = {
      id,
      code,
      name: `${itemName} (${jenjang.toUpperCase()} ${gender === "male" ? "Ikhwan" : "Akhwat"})`,
      kind,
      gender,
      jenjang,
      academicYear,
      price,
      sizeChartUrl: isSport ? sizeChartUrl : null,
      description: `Katalog Seragam ${academicYear} - ${currentHeader}`,
      createdAt: now,
      updatedAt: now,
    };
    variantsToInsert.push(variantRecord);

    if (isSport) {
      const allowedSizes = sportSizesByJenjang[jenjang] || [];
      allowedSizes.forEach((sz, idx) => {
        sizesToInsert.push({
          id: `usz-${id}-${sz.toLowerCase()}`,
          variantId: id,
          size: sz,
          sortOrder: idx + 1,
          createdAt: now,
        });
      });
    }
  }

  console.log(`Parsed ${variantsToInsert.length} variants and ${sizesToInsert.length} size options.`);

  // 3. Insert ke database lokal
  // Batch insert variants
  const CHUNK_SIZE = 20;
  for (let i = 0; i < variantsToInsert.length; i += CHUNK_SIZE) {
    const chunk = variantsToInsert.slice(i, i + CHUNK_SIZE);
    await db.insert(uniformVariants).values(chunk);
  }
  console.log("Uniform variants inserted successfully.");

  for (let i = 0; i < sizesToInsert.length; i += CHUNK_SIZE) {
    const chunk = sizesToInsert.slice(i, i + CHUNK_SIZE);
    await db.insert(uniformSizes).values(chunk);
  }
  console.log("Uniform sizes inserted successfully.");

  // Also initialize uniform stock records with 0
  const stockToInsert: Array<{
    id: string;
    variantId: string;
    size: string;
    quantity: number;
    updatedAt: string;
  }> = [];

  for (const v of variantsToInsert) {
    if (v.kind === "kain_harian") {
      stockToInsert.push({
        id: `ustk-${v.id}-kain`,
        variantId: v.id,
        size: KAIN_SIZE,
        quantity: 0,
        updatedAt: now,
      });
    } else {
      const allowedSizes = sportSizesByJenjang[v.jenjang] || [];
      for (const sz of allowedSizes) {
        stockToInsert.push({
          id: `ustk-${v.id}-${sz.toLowerCase()}`,
          variantId: v.id,
          size: sz,
          quantity: 0,
          updatedAt: now,
        });
      }
    }
  }

  for (let i = 0; i < stockToInsert.length; i += CHUNK_SIZE) {
    const chunk = stockToInsert.slice(i, i + CHUNK_SIZE);
    await db.insert(uniformStock).values(chunk);
  }
  console.log(`Initialized ${stockToInsert.length} uniform stock rows with 0.`);

  // 4. Generate SQL migration script for remote D1
  console.log("Generating SQL file for Cloudflare D1 migration...");
  const sqlStatements: string[] = [];

  // Cleanup D1 statements
  sqlStatements.push(`DELETE FROM uniform_rejects;`);
  sqlStatements.push(`DELETE FROM uniform_refunds;`);
  sqlStatements.push(`DELETE FROM uniform_exchanges;`);
  sqlStatements.push(`DELETE FROM uniform_order_items;`);
  sqlStatements.push(`DELETE FROM uniform_orders;`);
  sqlStatements.push(`DELETE FROM uniform_po_items;`);
  sqlStatements.push(`DELETE FROM uniform_pos;`);
  sqlStatements.push(`DELETE FROM uniform_package_stock;`);
  sqlStatements.push(`DELETE FROM uniform_package_bom;`);
  sqlStatements.push(`DELETE FROM uniform_packages;`);
  sqlStatements.push(`DELETE FROM uniform_stock;`);
  sqlStatements.push(`DELETE FROM uniform_sizes;`);
  sqlStatements.push(`DELETE FROM uniform_variants;`);

  // Insert variants
  for (const v of variantsToInsert) {
    const chartVal = v.sizeChartUrl ? `'${v.sizeChartUrl}'` : "NULL";
    const descVal = v.description.replace(/'/g, "''");
    const nameVal = v.name.replace(/'/g, "''");
    sqlStatements.push(
      `INSERT INTO uniform_variants (id, code, name, kind, gender, jenjang, academic_year, price, size_chart_url, description, created_at, updated_at) VALUES ('${v.id}', '${v.code}', '${nameVal}', '${v.kind}', '${v.gender}', '${v.jenjang}', '${v.academicYear}', ${v.price}, ${chartVal}, '${descVal}', '${v.createdAt}', '${v.updatedAt}');`
    );
  }

  // Insert sizes
  for (const s of sizesToInsert) {
    sqlStatements.push(
      `INSERT INTO uniform_sizes (id, variant_id, size, sort_order, created_at) VALUES ('${s.id}', '${s.variantId}', '${s.size}', ${s.sortOrder}, '${s.createdAt}');`
    );
  }

  // Insert stock
  for (const st of stockToInsert) {
    sqlStatements.push(
      `INSERT INTO uniform_stock (id, variant_id, size, quantity, updated_at) VALUES ('${st.id}', '${st.variantId}', '${st.size}', ${st.quantity}, '${st.updatedAt}');`
    );
  }

  const d1SqlPath = "data/migrate-uniforms-d1.sql";
  fs.writeFileSync(d1SqlPath, sqlStatements.join("\n"), "utf8");
  console.log(`Saved ${sqlStatements.length} SQL statements to ${d1SqlPath}`);

  console.log("=== Import Finished Successfully ===");
}

main().catch((err) => {
  console.error("Migration error:", err);
  process.exit(1);
});
