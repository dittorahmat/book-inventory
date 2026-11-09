import { describe, it, expect } from "bun:test";
import { db } from "../src/db";
import { createTestBook, createTestPackage, createTestSchool, createTestStudent } from "./fixtures";

describe("Test fixtures convenience exports", () => {
  it("creates standard valid fixtures adhering to NOT NULL schema constraints", async () => {
    const school = await createTestSchool(db, { name: "Convenience School" });
    expect(school.id).toStartWith("sch-test-");

    const book = await createTestBook(db, { title: "Convenience Book" });
    expect(book.id).toStartWith("book-test-");
    expect(book.author).toBe("Penulis Uji");

    const pkg = await createTestPackage(db, { name: "Convenience Package" });
    expect(pkg.id).toStartWith("pkg-test-");

    const student = await createTestStudent(db, { schoolId: school.id, name: "Convenience Student" });
    expect(student.id).toStartWith("stu-test-");
    expect(student.schoolId).toBe(school.id);
  });
});
