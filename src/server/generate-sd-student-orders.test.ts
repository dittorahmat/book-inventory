import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { db } from "../db";
import { generateSdStudentOrdersAndHandover } from "./generate-sd-student-orders";
import {
  schools,
  students,
  bookPackages,
  bookPackageItems,
  books,
  bookStocks,
  studentBookOrders,
  studentOrderItems,
} from "../db/schema";
import { eq } from "drizzle-orm";

describe("generateSdStudentOrdersAndHandover (§0.4, §0.20, §0.62)", () => {
  const schoolId = "school-alw-1";

  beforeEach(async () => {
    // Bersihkan data uji
    await db.delete(studentOrderItems);
    await db.delete(studentBookOrders).where(eq(studentBookOrders.schoolId, schoolId));
    await db.delete(students).where(eq(students.schoolId, schoolId));
    await db.delete(bookPackageItems).where(eq(bookPackageItems.packageId, "pkg-sd1-inter"));
    await db.delete(bookPackages).where(eq(bookPackages.id, "pkg-sd1-inter"));
    await db.delete(bookStocks).where(eq(bookStocks.schoolId, schoolId));
    await db.delete(books).where(eq(books.id, "book-math-1"));
    await db.delete(books).where(eq(books.id, "book-sci-1"));
    await db.delete(schools).where(eq(schools.id, schoolId));

    // 1. Seed school
    await db.insert(schools).values({
      id: "school-alw-1",
      name: "Al-Wildan 1",
      code: "AW-1",
      type: "branch",
      address: "Gading Serpong",
      phone: "0812345678",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    // 2. Seed books
    await db.insert(books).values([
      {
        id: "book-math-1",
        isbn: "ISBN-MATH-1",
        title: "PRIME MATH 1A COURSEBOOK",
        author: "Author 1",
        publisher: "Publisher 1",
        price: 100000,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: "book-sci-1",
        isbn: "ISBN-SCI-1",
        title: "SCIENCE STUDENT BOOK",
        author: "Author 2",
        publisher: "Publisher 2",
        price: 120000,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ]);

    // 3. Seed stock at branch
    await db.insert(bookStocks).values([
      {
        id: "stock-m1",
        bookId: "book-math-1",
        schoolId: "school-alw-1",
        availableQuantity: 50,
        reservedQuantity: 0,
        updatedAt: new Date().toISOString(),
      },
      {
        id: "stock-s1",
        bookId: "book-sci-1",
        schoolId: "school-alw-1",
        availableQuantity: 50,
        reservedQuantity: 0,
        updatedAt: new Date().toISOString(),
      },
    ]);

    // 4. Seed packages & BOM
    await db.insert(bookPackages).values({
      id: "pkg-sd1-inter",
      code: "PKG-SD1-INTER-BARU",
      name: "Paket Buku SD Kelas 1 (INTER) Murid Baru/Pindahan TA 2026/2027",
      gradeLevel: "1",
      curriculumType: "INTER",
      intakeType: "baru",
      academicYear: "2026/2027",
      price: 220000,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    await db.insert(bookPackageItems).values([
      {
        id: "bpi-1",
        packageId: "pkg-sd1-inter",
        bookId: "book-math-1",
        quantity: 1,
        createdAt: new Date().toISOString(),
      },
      {
        id: "bpi-2",
        packageId: "pkg-sd1-inter",
        bookId: "book-sci-1",
        quantity: 1,
        createdAt: new Date().toISOString(),
      },
    ]);

    // 5. Seed SD students
    await db.insert(students).values([
      {
        id: "student-1",
        schoolId: "school-alw-1",
        nis: "NIS-001",
        name: "Siswa Satu",
        gradeLevel: "1",
        curriculumType: "INTER",
        intakeType: "baru",
        academicYear: "2026/2027",
        status: "active",
        hasTakenPackage: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: "student-2",
        schoolId: "school-alw-1",
        nis: "NIS-002",
        name: "Siswa Dua",
        gradeLevel: "1",
        curriculumType: "INTER",
        intakeType: "baru",
        academicYear: "2026/2027",
        status: "active",
        hasTakenPackage: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ]);
  });

  it("should create paid picked_up orders and deduct stock", async () => {
    const res = await generateSdStudentOrdersAndHandover(db, {
      schoolId: "school-alw-1",
      academicYear: "2026/2027",
    });

    expect(res.ordersCreated).toBe(2);
    expect(res.studentsUpdated).toBe(2);
    expect(res.booksDistributed).toBe(4);
    expect(res.totalOrderAmount).toBe(440000);

    // Verify orders
    const orders = await db.select().from(studentBookOrders).where(eq(studentBookOrders.schoolId, schoolId));
    expect(orders.length).toBe(2);
    expect(orders[0].paymentStatus).toBe("paid");
    expect(orders[0].fulfillmentStatus).toBe("picked_up");
    expect(orders[0].handoverDeliveryNumber).toContain("SJ-SERAH-AW1-2026");

    // Verify students updated
    const updatedStudents = await db.select().from(students).where(eq(students.schoolId, schoolId));
    expect(updatedStudents.every((s) => s.hasTakenPackage)).toBe(true);

    // Verify stock deducted
    const [mathStock] = await db.select().from(bookStocks).where(eq(bookStocks.bookId, "book-math-1"));
    expect(mathStock.availableQuantity).toBe(48); // 50 - 2

    const [sciStock] = await db.select().from(bookStocks).where(eq(bookStocks.bookId, "book-sci-1"));
    expect(sciStock.availableQuantity).toBe(48); // 50 - 2
  });

  afterEach(async () => {
    await db.delete(studentOrderItems);
    await db.delete(studentBookOrders).where(eq(studentBookOrders.schoolId, schoolId));
    await db.delete(students).where(eq(students.schoolId, schoolId));
    await db.delete(bookPackageItems).where(eq(bookPackageItems.packageId, "pkg-sd1-inter"));
    await db.delete(bookPackages).where(eq(bookPackages.id, "pkg-sd1-inter"));
    await db.delete(bookStocks).where(eq(bookStocks.schoolId, schoolId));
    await db.delete(books).where(eq(books.id, "book-math-1"));
    await db.delete(books).where(eq(books.id, "book-sci-1"));
    await db.delete(schools).where(eq(schools.id, schoolId));
  });
});
