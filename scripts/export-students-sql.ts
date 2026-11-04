import { Database } from "bun:sqlite";
import { writeFileSync } from "fs";

const db = new Database("./data/inventory.db", { readonly: true });
const students = db.prepare("SELECT * FROM students").all() as Record<string, unknown>[];

console.log("Generating chunked insert for", students.length, "students...");
const lines: string[] = [];

for (let i = 0; i < students.length; i += 10) {
  const chunk = students.slice(i, i + 10);
  const cols = Object.keys(chunk[0]);
  const valRows = chunk.map((r) => {
    const vals = cols.map((c) => {
      const v = r[c];
      if (v === null || v === undefined) return "NULL";
      if (typeof v === "number") return String(v);
      return `'${String(v).replace(/'/g, "''")}'`;
    });
    return `(${vals.join(", ")})`;
  });
  lines.push(`INSERT OR IGNORE INTO students (${cols.join(", ")}) VALUES\n${valRows.join(",\n")};`);
}

writeFileSync("./drizzle/students-d1.sql", lines.join("\n\n"));
console.log("Wrote ./drizzle/students-d1.sql");
