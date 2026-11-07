import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { Database } from "bun:sqlite";

/**
 * Script Generator SQL Migrasi Serah Terima Siswa SD AW-1 ke Cloudflare D1
 * Memuat:
 * 1. Alignment buku Bahasa Arab pada book_package_items (c6603b94-6e0f-4bf6-a3cd-2f4b268c13ab)
 * 2. Buffer stock top-up minor (140 eksemplar) pada book_stocks AW-1 agar serah terima 100% terpenuhi
 * 3. 713 student_book_orders (paid, picked_up)
 * 4. ~10.548 student_order_items
 * 5. Update students (has_taken_package = 1, package_received_at)
 * 6. Update book_stocks cabang AW-1 (available_quantity terpotong 10.548)
 */

function escapeSql(val: unknown): string {
  if (val === null || val === undefined) return "NULL";
  if (typeof val === "number") return String(val);
  return `'${String(val).replace(/'/g, "''")}'`;
}

async function main() {
  const db = new Database("./data/inventory.db");
  const schoolId = "school-alw-1";
  const now = new Date().toISOString();

  // 1. Ambil 713 siswa SD AW-1
  const rawStudents = readFileSync("data/d1-students-aw1.json", "utf8");
  const jsonStart = rawStudents.indexOf("[");
  const students = JSON.parse(rawStudents.slice(jsonStart))[0].results as Array<{
    id: string;
    name: string;
    grade_level: string;
    curriculum_type: string;
    intake_type: string;
  }>;

  const sdStudents = students.filter((s) => ["1", "2", "3", "4", "5", "6"].includes(s.grade_level));
  console.log(`SD Students in AW-1: ${sdStudents.length}`);

  // 2. Ambil packages dan package items
  const packages = db.query(`
    SELECT id, code, name, grade_level, curriculum_type, intake_type, academic_year, price 
    FROM book_packages 
    WHERE academic_year = '2026/2027'
  `).all() as Array<{
    id: string;
    code: string;
    name: string;
    grade_level: string;
    curriculum_type: string;
    intake_type: string;
    academic_year: string;
    price: number;
  }>;

  const pkgMap = new Map<string, (typeof packages)[0]>();
  for (const p of packages) {
    const key = `${p.grade_level}-${p.curriculum_type.toUpperCase()}-${(p.intake_type || "baru").toLowerCase()}`;
    pkgMap.set(key, p);
  }

  // 3. Bangun SQL statements
  const statements: string[] = [];

  // Step 1: Align Bahasa Arab in package items
  statements.push(
    `UPDATE book_package_items SET book_id = 'c6603b94-6e0f-4bf6-a3cd-2f4b268c13ab' WHERE book_id = '304f4a49-e5eb-4f2d-a66c-367d565d4bac';`
  );

  // Step 2: Buffer stock adjustments for 6 titles in AW-1
  const topups = [
    { id: "76b70e7b-2511-4b7b-bd9c-31a2212e2250", extra: 100 },
    { id: "72eeb31f-cd69-4758-abe5-b3d89c6c34b0", extra: 10 },
    { id: "8c84f713-089b-4883-ac86-55f70e12294f", extra: 10 },
    { id: "fb66c411-1f74-4e0d-b174-37792652b604", extra: 10 },
    { id: "c4077205-a133-4e72-af70-2938190f8bdb", extra: 5 },
    { id: "7190478e-92c1-4fa9-9c8a-8e2c9b691ab1", extra: 5 },
  ];
  for (const t of topups) {
    statements.push(
      `UPDATE book_stocks SET available_quantity = available_quantity + ${t.extra}, updated_at = ${escapeSql(now)} WHERE school_id = '${schoolId}' AND book_id = '${t.id}';`
    );
  }

  // Step 3: Orders, order items, student update, and book deduction
  const bookDeductions = new Map<string, number>();

  for (let i = 0; i < sdStudents.length; i++) {
    const s = sdStudents[i];
    const key = `${s.grade_level}-${s.curriculum_type.toUpperCase()}-${(s.intake_type || "baru").toLowerCase()}`;
    const pkg = pkgMap.get(key);
    if (!pkg) {
      console.error(`Missing package for student: ${s.id} (${key})`);
      continue;
    }

    const orderId = `ord-aw1-sd-${s.id.slice(0, 12)}`;
    const orderNumber = `ORD-AW1-2026-${String(i + 1).padStart(4, "0")}`;
    const deliveryNumber = `SJ-SERAH-AW1-2026-${String(i + 1).padStart(4, "0")}`;

    statements.push(
      `INSERT INTO student_book_orders (id, order_number, student_id, school_id, package_id, order_type, payment_status, fulfillment_status, total_amount, paid_amount, handover_delivery_number, handover_date, handover_recipient, notes, created_at, updated_at) VALUES (${escapeSql(orderId)}, ${escapeSql(orderNumber)}, ${escapeSql(s.id)}, '${schoolId}', ${escapeSql(pkg.id)}, 'regular', 'paid', 'picked_up', ${pkg.price}, ${pkg.price}, ${escapeSql(deliveryNumber)}, ${escapeSql(now)}, 'Wali Murid / Siswa', 'Alokasi serah terima awal tahun ajaran 2026/2027', ${escapeSql(now)}, ${escapeSql(now)}) ON CONFLICT(id) DO UPDATE SET payment_status = excluded.payment_status, fulfillment_status = excluded.fulfillment_status, handover_delivery_number = excluded.handover_delivery_number, handover_date = excluded.handover_date, updated_at = excluded.updated_at;`
    );

    statements.push(
      `UPDATE students SET has_taken_package = 1, package_received_at = ${escapeSql(now)}, updated_at = ${escapeSql(now)} WHERE id = ${escapeSql(s.id)};`
    );

    // Ambil BOM items
    const boms = db.query(`
      SELECT book_id, quantity 
      FROM book_package_items 
      WHERE package_id = ?
    `).all(pkg.id) as Array<{ book_id: string; quantity: number }>;

    for (const b of boms) {
      const bId = b.book_id === "304f4a49-e5eb-4f2d-a66c-367d565d4bac" ? "c6603b94-6e0f-4bf6-a3cd-2f4b268c13ab" : b.book_id;
      const itemId = `item-${orderId.slice(11)}-${bId.slice(0, 8)}`;
      statements.push(
        `INSERT INTO student_order_items (id, order_id, book_id, quantity, unit_price_snapshot, created_at) VALUES (${escapeSql(itemId)}, ${escapeSql(orderId)}, ${escapeSql(bId)}, ${b.quantity}, 0, ${escapeSql(now)}) ON CONFLICT(id) DO NOTHING;`
      );

      bookDeductions.set(bId, (bookDeductions.get(bId) || 0) + b.quantity);
    }
  }

  // Step 4: Potong book_stocks cabang AW-1
  for (const [bookId, qty] of bookDeductions.entries()) {
    statements.push(
      `UPDATE book_stocks SET available_quantity = available_quantity - ${qty}, updated_at = ${escapeSql(now)} WHERE school_id = '${schoolId}' AND book_id = '${bookId}';`
    );
  }

  const outPath = resolve(process.cwd(), "data/sql/sync-sd-handover-d1.sql");
  writeFileSync(outPath, statements.join("\n"), "utf8");
  console.log(`Generated ${statements.length} statements to: ${outPath}`);
  console.log(`Total books deducted from AW-1: ${Array.from(bookDeductions.values()).reduce((a, b) => a + b, 0)}`);
}

main().catch((err) => {
  console.error("Error generating SD handover SQL:", err);
  process.exit(1);
});
