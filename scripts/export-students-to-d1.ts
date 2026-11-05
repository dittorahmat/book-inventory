import { parseStudentData } from "../src/lib/student-import-parser";
import * as fs from "fs";

function escapeSql(val: unknown): string {
  if (val === null || val === undefined) return "NULL";
  if (typeof val === "number") return String(val);
  return `'${String(val).replace(/'/g, "''")}'`;
}

function main() {
  const buf = fs.readFileSync("D:/development/DATA SISWA SD AL-WILDAN 1 TP. 2026-2027.xlsm");
  const result = parseStudentData(buf.buffer);
  const nowIso = new Date().toISOString();

  const statements: string[] = [];
  statements.push("DELETE FROM students WHERE school_id = 'school-alw-1';");

  const students = result.validStudents;
  for (let i = 0; i < students.length; i += 5) {
    const chunk = students.slice(i, i + 5);
    const rows = chunk
      .map((s) => {
        const id = crypto.randomUUID();
        return `(${escapeSql(id)}, 'school-alw-1', ${escapeSql(s.nis)}, ${escapeSql(s.name)}, ${escapeSql(s.gender)}, ${escapeSql(s.gradeLevel)}, ${escapeSql(s.curriculumType)}, ${escapeSql(s.stream)}, ${escapeSql(s.intakeType)}, ${escapeSql(s.academicYear)}, ${escapeSql(s.parentName)}, ${escapeSql(s.parentEmail)}, ${escapeSql(s.parentPhone)}, 'active', 0, 0, NULL, 0, NULL, ${escapeSql(nowIso)}, ${escapeSql(nowIso)})`;
      })
      .join(",\n");
    statements.push(
      `INSERT INTO students (id, school_id, nis, name, gender, grade_level, curriculum_type, stream, intake_type, academic_year, parent_name, parent_email, parent_phone, status, is_scholarship, has_taken_package, package_received_at, has_taken_uniform, uniform_received_at, created_at, updated_at) VALUES\n${rows};`
    );
  }

  fs.writeFileSync("./drizzle/seed-students-alw1.sql", statements.join("\n\n"), "utf-8");
  console.log(`Wrote ${statements.length} statements to ./drizzle/seed-students-alw1.sql`);
}

main();
