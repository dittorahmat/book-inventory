import * as fs from "fs";
import * as path from "path";
import * as xlsx from "xlsx";
import { getDatabase } from "../src/db";
import {
  uniformVariants,
  uniformSizes,
  uniformPackages,
  uniformPackageBom,
} from "../src/db/schema";
import { KAIN_SIZE } from "../src/server/services/uniform/catalog";
import { setVariantStockQuery } from "../src/server/services/uniform/stock";

interface ParsedVariant {
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
  sizes: string[];
}

interface DefaultPackageDefinition {
  id: string;
  code: string;
  name: string;
  jenjang: "tk" | "sd" | "smp" | "sma";
  gender: "male" | "female";
  academicYear: string;
  price: number;
  description: string;
  items: Array<{ variantId: string; quantity: number }>;
}

const SPORT_SIZES_BY_JENJANG: Record<string, string[]> = {
  tk: ["S", "M", "L", "XL"],
  sd: ["S", "M", "L", "XL", "2XL", "3XL", "4XL"],
  smp: ["S", "M", "L", "XL", "2XL", "3XL", "4XL", "5XL"],
  sma: ["S", "M", "L", "XL", "2XL", "3XL", "4XL", "5XL"],
};

function parseJenjang(header: string): "tk" | "sd" | "smp" | "sma" {
  const h = header.toUpperCase();
  if (h.includes("TK")) return "tk";
  if (h.includes("SD")) return "sd";
  if (h.includes("SMP")) return "smp";
  return "sma";
}

function parseGender(header: string): "male" | "female" {
  return header.toUpperCase().includes("AKHWAT") ? "female" : "male";
}

export function parseCatalogWorkbook(excelPath: string, sizeChartUrl: string, academicYear: string, now: string): ParsedVariant[] {
  const wb = xlsx.readFile(excelPath);
  const sheet = wb.Sheets["Sheet1"];
  const raw: unknown[][] = xlsx.utils.sheet_to_json(sheet, { header: 1 });

  let currentHeader = "";
  const variants: ParsedVariant[] = [];

  for (let i = 1; i < raw.length; i++) {
    const row = raw[i];
    if (!row || row.length === 0) continue;
    if (row[0] && String(row[0]).trim()) {
      currentHeader = String(row[0]).trim();
    }
    const itemName = row[1] ? String(row[1]).trim() : "";
    const price = row[2];
    if (!itemName || typeof price !== "number") continue;

    const jenjang = parseJenjang(currentHeader);
    const gender = parseGender(currentHeader);
    const isSport = itemName.toUpperCase().includes("OLAHRAGA");
    const kind: "kain_harian" | "olahraga" = isSport ? "olahraga" : "kain_harian";

    const itemSlug = itemName.toUpperCase().replace(/[^A-Z0-9]/g, "_");
    const code = `UNI-${jenjang.toUpperCase()}-${gender === "male" ? "IKH" : "AKH"}-${itemSlug}`;
    const id = `uv-${code.toLowerCase().replace(/_/g, "-")}`;

    const sizes = isSport ? (SPORT_SIZES_BY_JENJANG[jenjang] ?? []) : [KAIN_SIZE];

    variants.push({
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
      sizes,
    });
  }

  return variants;
}

export function buildDefaultPackages(variants: ParsedVariant[], academicYear: string): DefaultPackageDefinition[] {
  const groups: Record<string, ParsedVariant[]> = {};
  for (const v of variants) {
    const key = `${v.jenjang}_${v.gender}`;
    if (!groups[key]) groups[key] = [];
    groups[key].push(v);
  }

  const defs: DefaultPackageDefinition[] = [];
  for (const [key, list] of Object.entries(groups)) {
    const [jenjang, gender] = key.split("_") as ["tk" | "sd" | "smp" | "sma", "male" | "female"];
    const jenjangLabel = jenjang.toUpperCase();
    const genderLabel = gender === "male" ? "Ikhwan" : "Akhwat";
    const genderSlug = gender === "male" ? "IKH" : "AKH";
    const code = `PKG-UNIF-${jenjangLabel}-${genderSlug}-2026`;
    const id = `pkg-${code.toLowerCase().replace(/_/g, "-")}`;
    const name = `Paket Seragam Lengkap ${jenjangLabel} ${genderLabel} TA ${academicYear}`;
    const totalPrice = list.reduce((sum, item) => sum + item.price, 0);

    defs.push({
      id,
      code,
      name,
      jenjang,
      gender,
      academicYear,
      price: totalPrice,
      description: `Paket bundling lengkap seragam ${jenjangLabel} ${genderLabel} TA ${academicYear} (${list.length} item).`,
      items: list.map((item) => ({ variantId: item.id, quantity: 1 })),
    });
  }

  return defs;
}

async function main() {
  console.log("=== Import Uniform Catalog & Default Packages ===");
  const db = await getDatabase();

  const excelPath = process.env.CATALOG_EXCEL_PATH || path.resolve("data/katalog seragam aw.xlsx");
  const sizeChartUrl = "/size-chart-olahraga-2026.jpeg";
  const academicYear = "2026/2027";
  const now = new Date().toISOString();

  const variants = parseCatalogWorkbook(excelPath, sizeChartUrl, academicYear, now);
  console.log(`Parsed ${variants.length} catalog items from spreadsheet.`);

  // 1. Bersihkan varian & paket lama secara aman di DB lokal
  console.log("Resetting local uniform catalog & package tables...");
  await db.delete(uniformPackageBom);
  await db.delete(uniformPackages);
  await db.delete(uniformSizes);
  await db.delete(uniformVariants);

  // 2. Insert variants in chunks (max 10 rows per insert, sesuai D1 & ADR-0010 §10.1)
  const D1_CHUNK_SIZE = 10;
  for (let i = 0; i < variants.length; i += D1_CHUNK_SIZE) {
    const chunk = variants.slice(i, i + D1_CHUNK_SIZE).map((v) => ({
      id: v.id,
      code: v.code,
      name: v.name,
      kind: v.kind,
      gender: v.gender,
      jenjang: v.jenjang,
      academicYear: v.academicYear,
      price: v.price,
      sizeChartUrl: v.sizeChartUrl,
      description: v.description,
      createdAt: v.createdAt,
      updatedAt: v.updatedAt,
    }));
    await db.insert(uniformVariants).values(chunk);
  }
  console.log(`Inserted ${variants.length} variants.`);

  // 3. Insert uniform sizes
  const sizesToInsert: Array<{ id: string; variantId: string; size: string; sortOrder: number; createdAt: string }> = [];
  for (const v of variants) {
    if (v.kind === "olahraga") {
      v.sizes.forEach((sz, idx) => {
        sizesToInsert.push({
          id: `usz-${v.id}-${sz.toLowerCase()}`,
          variantId: v.id,
          size: sz,
          sortOrder: idx + 1,
          createdAt: now,
        });
      });
    }
  }

  for (let i = 0; i < sizesToInsert.length; i += D1_CHUNK_SIZE) {
    const chunk = sizesToInsert.slice(i, i + D1_CHUNK_SIZE);
    await db.insert(uniformSizes).values(chunk);
  }
  console.log(`Inserted ${sizesToInsert.length} sizes for sport variants.`);

  // 4. Inisialisasi stok awal via single-writer seam (setVariantStockQuery)
  console.log("Initializing stock balances via single-writer seam (setVariantStockQuery)...");
  let stockRowsCount = 0;
  for (const v of variants) {
    for (const sz of v.sizes) {
      await setVariantStockQuery(db, { variantId: v.id, size: sz, quantity: 0 }, { now });
      stockRowsCount++;
    }
  }
  console.log(`Initialized ${stockRowsCount} stock rows.`);

  // 5. Inisialisasi 8 Default Packages & BOM
  const defaultPackages = buildDefaultPackages(variants, academicYear);
  console.log(`Creating ${defaultPackages.length} default uniform packages...`);

  for (const p of defaultPackages) {
    await db.insert(uniformPackages).values({
      id: p.id,
      code: p.code,
      name: p.name,
      academicYear: p.academicYear,
      price: p.price,
      description: p.description,
      createdAt: now,
      updatedAt: now,
    });

    const bomRows = p.items.map((it) => ({
      id: `bom-${p.id}-${it.variantId}`,
      packageId: p.id,
      variantId: it.variantId,
      size: KAIN_SIZE,
      quantity: it.quantity,
      createdAt: now,
    }));

    for (let i = 0; i < bomRows.length; i += D1_CHUNK_SIZE) {
      await db.insert(uniformPackageBom).values(bomRows.slice(i, i + D1_CHUNK_SIZE));
    }
  }
  console.log(`Inserted ${defaultPackages.length} default packages with all BOM items.`);

  // 6. Generate safe D1 SQL migration file
  const sqlStatements: string[] = [];
  sqlStatements.push("DELETE FROM uniform_package_bom;");
  sqlStatements.push("DELETE FROM uniform_packages;");
  sqlStatements.push("DELETE FROM uniform_sizes;");
  sqlStatements.push("DELETE FROM uniform_variants;");

  for (const v of variants) {
    const chartVal = v.sizeChartUrl ? `'${v.sizeChartUrl}'` : "NULL";
    const descVal = v.description.replace(/'/g, "''");
    const nameVal = v.name.replace(/'/g, "''");
    sqlStatements.push(
      `INSERT INTO uniform_variants (id, code, name, kind, gender, jenjang, academic_year, price, size_chart_url, description, created_at, updated_at) VALUES ('${v.id}', '${v.code}', '${nameVal}', '${v.kind}', '${v.gender}', '${v.jenjang}', '${v.academicYear}', ${v.price}, ${chartVal}, '${descVal}', '${v.createdAt}', '${v.updatedAt}');`
    );
  }

  for (const s of sizesToInsert) {
    sqlStatements.push(
      `INSERT INTO uniform_sizes (id, variant_id, size, sort_order, created_at) VALUES ('${s.id}', '${s.variantId}', '${s.size}', ${s.sortOrder}, '${s.createdAt}');`
    );
  }

  for (const p of defaultPackages) {
    const descVal = p.description.replace(/'/g, "''");
    const nameVal = p.name.replace(/'/g, "''");
    sqlStatements.push(
      `INSERT INTO uniform_packages (id, code, name, academic_year, price, description, created_at, updated_at) VALUES ('${p.id}', '${p.code}', '${nameVal}', '${p.academicYear}', ${p.price}, '${descVal}', '${now}', '${now}');`
    );

    for (const it of p.items) {
      const bomId = `bom-${p.id}-${it.variantId}`;
      sqlStatements.push(
        `INSERT INTO uniform_package_bom (id, package_id, variant_id, size, quantity, created_at) VALUES ('${bomId}', '${p.id}', '${it.variantId}', '${KAIN_SIZE}', ${it.quantity}, '${now}');`
      );
    }
  }

  const d1SqlPath = "data/migrate-uniforms-d1.sql";
  fs.writeFileSync(d1SqlPath, sqlStatements.join("\n"), "utf8");
  console.log(`Generated ${sqlStatements.length} migration statements to ${d1SqlPath}`);

  console.log("=== Import Finished Successfully ===");
}

if (import.meta.main) {
  main().catch((err) => {
    console.error("Migration error:", err);
    process.exit(1);
  });
}
