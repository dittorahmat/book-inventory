import { Database } from "bun:sqlite";
import { execFileSync } from "node:child_process";
import { writeFileSync, unlinkSync, existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import * as XLSX from "xlsx";
import { normalizeBookTitle } from "../src/lib/isbn";

function tokenSetKey(t: string): string {
  if (!t) return "";
  const cleaned = String(t)
    .toUpperCase()
    .replace(/PR1ME/g, "PRIME")
    .replace(/\bMATHS\b/g, "MATH")
    .replace(/\bBK\b/g, "BOOK")
    .replace(/\bCOURSE BOOK\b/g, "COURSEBOOK")
    .replace(/\(INDONESIA EDITION\)|\( INDONESIA EDITION\)/g, "")
    .replace(/[^A-Z0-9]/g, " ")
    .trim();
  const tokens = cleaned.split(/\s+/).filter(Boolean).sort();
  return tokens.join(" ");
}

interface BookRow {
  id: string;
  isbn: string | null;
  title: string;
  publisher: string | null;
}

interface LinkRow {
  bookId: string;
  supplierId: string;
}

interface SheetVendorConfig {
  sheet: string;
  supId: string;
  startRow: number;
  titleCol: number | null;
  isbnCol: number | null;
}

const sheetVendorConfigs: SheetVendorConfig[] = [
  { sheet: "CNL", supId: "sup-cnl", startRow: 10, titleCol: 2, isbnCol: 1 },
  { sheet: "Mentari", supId: "sup-mentari", startRow: 9, titleCol: 2, isbnCol: 1 },
  { sheet: "PELANGI", supId: "sup-pelangi", startRow: 8, titleCol: 1, isbnCol: null },
  { sheet: "ERLANGGA", supId: "sup-erlangga", startRow: 8, titleCol: 4, isbnCol: null },
  { sheet: "DARSYAFII", supId: "sup-darsyafii", startRow: 8, titleCol: 2, isbnCol: null },
  { sheet: "BUKU UMUM SURAHMAN", supId: "sup-segara-makmur", startRow: 7, titleCol: 1, isbnCol: null },
  { sheet: "QC & TAHSIN", supId: "sup-segara-makmur", startRow: 7, titleCol: 1, isbnCol: null },
  { sheet: "NAHWU DAN KHAT ABDURRAHMAN", supId: "sup-dakwah-taklim", startRow: 7, titleCol: 1, isbnCol: null },
];

function matchAndComputeLinks(
  books: BookRow[],
  existingLinks: LinkRow[],
  wb: XLSX.WorkBook
): LinkRow[] {
  const linkSet = new Set(existingLinks.map((l) => `${l.bookId}:${l.supplierId}`));
  const newLinks: LinkRow[] = [];

  const addLink = (bookId: string, supplierId: string) => {
    const key = `${bookId}:${supplierId}`;
    if (!linkSet.has(key)) {
      linkSet.add(key);
      newLinks.push({ bookId, supplierId });
    }
  };

  const byIsbn = new Map<string, BookRow>();
  const byNorm = new Map<string, BookRow[]>();
  const byToken = new Map<string, BookRow[]>();

  for (const b of books) {
    if (b.isbn) {
      const cleanIsbn = String(b.isbn).replace(/[^0-9A-Za-z]/g, "").toUpperCase();
      if (cleanIsbn) byIsbn.set(cleanIsbn, b);
    }
    const n = normalizeBookTitle(b.title);
    const nList = byNorm.get(n) ?? [];
    nList.push(b);
    byNorm.set(n, nList);

    const t = tokenSetKey(b.title);
    const tList = byToken.get(t) ?? [];
    tList.push(b);
    byToken.set(t, tList);
  }

  for (const cfg of sheetVendorConfigs) {
    const ws = wb.Sheets[cfg.sheet];
    if (!ws) continue;
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1 }) as any[][];

    for (let r = cfg.startRow; r < rows.length; r++) {
      const row = rows[r];
      if (!row) continue;

      let matchedBook: BookRow | null = null;

      // Cek ISBN jika ada
      if (cfg.isbnCol !== null && row[cfg.isbnCol]) {
        const rawIsbn = String(row[cfg.isbnCol]).replace(/[^0-9A-Za-z]/g, "").toUpperCase();
        if (rawIsbn && byIsbn.has(rawIsbn)) {
          matchedBook = byIsbn.get(rawIsbn)!;
        }
      }

      // Cek judul exact normal
      if (!matchedBook && cfg.titleCol !== null && row[cfg.titleCol]) {
        const rawTitle = String(row[cfg.titleCol]).trim();
        const norm = normalizeBookTitle(rawTitle);
        const normMatches = byNorm.get(norm);
        if (normMatches && normMatches.length > 0) {
          matchedBook = normMatches[0];
        }
      }

      // Cek tokenSetKey
      if (!matchedBook && cfg.titleCol !== null && row[cfg.titleCol]) {
        const rawTitle = String(row[cfg.titleCol]).trim();
        const tok = tokenSetKey(rawTitle);
        const tokMatches = byToken.get(tok);
        if (tokMatches && tokMatches.length > 0) {
          matchedBook = tokMatches[0];
        }
      }

      if (matchedBook) {
        addLink(matchedBook.id, cfg.supId);
      }
    }
  }

  // Propagasi asosiasi supplier untuk judul buku identik
  const knownTitleSuppliers = new Map<string, Set<string>>();
  for (const l of [...existingLinks, ...newLinks]) {
    const b = books.find((x) => x.id === l.bookId);
    if (b) {
      const norm = normalizeBookTitle(b.title);
      const set = knownTitleSuppliers.get(norm) ?? new Set<string>();
      set.add(l.supplierId);
      knownTitleSuppliers.set(norm, set);
    }
  }

  for (const b of books) {
    const norm = normalizeBookTitle(b.title);
    const sups = knownTitleSuppliers.get(norm);
    if (sups && sups.size > 0) {
      for (const sId of sups) {
        addLink(b.id, sId);
      }
    }
  }

  // Fallback khusus Al-Wildan Press -> PT Segara Makmur Sejati
  for (const b of books) {
    const hasAnyLink = linkSet.has(`${b.id}:sup-segara-makmur`) ||
      existingLinks.some((l) => l.bookId === b.id) ||
      newLinks.some((l) => l.bookId === b.id);

    if (!hasAnyLink && (b.publisher === "Al-Wildan Press" || b.publisher === "Al Wildan")) {
      addLink(b.id, "sup-segara-makmur");
    }
  }

  return newLinks;
}

async function main() {
  console.log("=== Memulai Sinkronisasi Supplier Katalog Buku (Tiket #404) ===");

  const fileId = "141ecGw58OW6PGnvz8cIiAgpjeQY1iSs_EtPu7bxf8Uw";
  const exportUrl = `https://docs.google.com/spreadsheets/d/${fileId}/export?format=xlsx`;
  console.log("1. Mengunduh data spreadsheet vendor PO...");
  const res = await fetch(exportUrl);
  if (!res.ok) throw new Error(`Gagal mengunduh spreadsheet: ${res.statusText}`);
  const buf = Buffer.from(await res.arrayBuffer());
  const wb = XLSX.read(buf, { type: "buffer" });

  // -------------------------------------------------------------
  // A. Sinkronisasi Database Lokal SQLite
  // -------------------------------------------------------------
  console.log("\n--- [A] SINKRONISASI DATABASE LOKAL SQLITE ---");
  const localDbPath = process.env.DB_PATH || "./data/inventory.db";
  const localDb = new Database(localDbPath);

  const localBooks = localDb.query("SELECT id, isbn, title, publisher FROM books;").all() as BookRow[];
  const localExistingLinks = localDb.query("SELECT book_id as bookId, supplier_id as supplierId FROM book_suppliers;").all() as LinkRow[];

  const localNewLinks = matchAndComputeLinks(localBooks, localExistingLinks, wb);
  console.log(`Menemukan ${localNewLinks.length} relasi baru untuk lokal SQLite.`);

  if (localNewLinks.length > 0) {
    const now = new Date().toISOString();
    localDb.run("BEGIN TRANSACTION;");
    try {
      const stmt = localDb.prepare("INSERT OR IGNORE INTO book_suppliers (book_id, supplier_id, created_at) VALUES (?, ?, ?);");
      for (const link of localNewLinks) {
        stmt.run(link.bookId, link.supplierId, now);
      }
      localDb.run("COMMIT;");
      console.log(`✓ Berhasil menyimpan ${localNewLinks.length} relasi ke database lokal SQLite.`);
    } catch (err) {
      localDb.run("ROLLBACK;");
      console.error("✗ Gagal menyimpan ke lokal SQLite:", err);
      process.exit(1);
    }
  }

  const [localTotal] = localDb.query("SELECT count(*) as cnt FROM book_suppliers;").all() as Array<{ cnt: number }>;
  const [unmappedLocal] = localDb.query("SELECT count(*) as cnt FROM books WHERE id NOT IN (SELECT book_id FROM book_suppliers);").all() as Array<{ cnt: number }>;
  console.log(`Total relasi lokal sekarang: ${localTotal.cnt} (Sisa tanpa supplier: ${unmappedLocal.cnt})`);

  // -------------------------------------------------------------
  // B. Sinkronisasi Cloudflare D1 Remote
  // -------------------------------------------------------------
  console.log("\n--- [B] SINKRONISASI CLOUDFLARE D1 REMOTE ---");
  let d1Books: BookRow[] = [];
  let d1ExistingLinks: LinkRow[] = [];

  const d1BooksFile = "./data/d1-books.json";
  const d1SuppliersFile = "./data/d1-book-suppliers.json";

  if (existsSync(d1BooksFile) && existsSync(d1SuppliersFile)) {
    console.log("Membaca cache buku dan book_suppliers D1 dari file lokal...");
    const bContent = readFileSync(d1BooksFile, "utf-8");
    const sContent = readFileSync(d1SuppliersFile, "utf-8");
    d1Books = JSON.parse(bContent.slice(bContent.indexOf("[")))[0].results;
    d1ExistingLinks = JSON.parse(sContent.slice(sContent.indexOf("[")))[0].results;
  } else {
    console.log("Mengambil data books dan book_suppliers langsung dari D1 remote...");
    const bOut = execFileSync("bun", ["scripts/db-d1-exec.ts", "SELECT id, isbn, title, publisher FROM books;"], { encoding: "utf-8" });
    const sOut = execFileSync("bun", ["scripts/db-d1-exec.ts", "SELECT book_id as bookId, supplier_id as supplierId FROM book_suppliers;"], { encoding: "utf-8" });
    d1Books = JSON.parse(bOut.slice(bOut.indexOf("[")))[0].results;
    d1ExistingLinks = JSON.parse(sOut.slice(sOut.indexOf("[")))[0].results;
  }

  console.log(`Data D1 Remote: ${d1Books.length} buku, ${d1ExistingLinks.length} relasi eksisting.`);

  const d1NewLinks = matchAndComputeLinks(d1Books, d1ExistingLinks, wb);
  console.log(`Menemukan ${d1NewLinks.length} relasi baru yang valid untuk D1 remote.`);

  if (d1NewLinks.length > 0) {
    const now = new Date().toISOString();
    const chunkSize = 10;
    const sqlStatements: string[] = [];

    for (let i = 0; i < d1NewLinks.length; i += chunkSize) {
      const chunk = d1NewLinks.slice(i, i + chunkSize);
      const values = chunk
        .map((c) => `('${c.bookId}', '${c.supplierId}', '${now}')`)
        .join(", ");
      sqlStatements.push(`INSERT OR IGNORE INTO book_suppliers (book_id, supplier_id, created_at) VALUES ${values};`);
    }

    const tempSqlFile = resolve("./data/sql-sync-d1-suppliers.sql");
    writeFileSync(tempSqlFile, sqlStatements.join("\n"), "utf-8");

    try {
      console.log(`Mengeksekusi ${sqlStatements.length} batch statement ke Cloudflare D1 Remote...`);
      execFileSync("bun", ["scripts/db-d1-exec.ts", "--file=" + tempSqlFile], {
        stdio: "inherit",
        env: process.env,
      });
      console.log("✓ Berhasil menerapkan ke Cloudflare D1 Remote!");
    } catch (err) {
      console.error("✗ Gagal menyimpan ke Cloudflare D1 remote:", err);
      process.exit(1);
    } finally {
      try {
        unlinkSync(tempSqlFile);
      } catch {
        // temp file already deleted
      }
    }
  }

  // Cleanup temporary snapshot files if exist
  try {
    if (existsSync(d1BooksFile)) unlinkSync(d1BooksFile);
    if (existsSync(d1SuppliersFile)) unlinkSync(d1SuppliersFile);
  } catch {
    // ignore
  }

  console.log("\n=== SINKRONISASI SUPPLIER SELESAI DENGAN SUKSES ===");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
