import { Hono } from "hono";
import { eq } from "drizzle-orm";
import { db } from "../../db";
import { schools, books, bookItems, transferShipments, transferShipmentItems } from "../../db/schema";
import { auth } from "../auth";

export const demoRouter = new Hono();

demoRouter.post("/seed", async (c) => {
  const now = new Date().toISOString();

  // 1. Schools (4 Al Wildan Schools)
  const schoolData = [
    {
      id: "school-alw-1",
      name: "Al Wildan 1 (Islamic School Pusat)",
      code: "ALW-01-HQ",
      type: "main" as const,
      address: "Jl. Boulevard Al Wildan No. 1, Tangerang Selatan",
      phone: "+62 21 5550101",
    },
    {
      id: "school-alw-2",
      name: "Al Wildan 2 (Islamic School)",
      code: "ALW-02",
      type: "branch" as const,
      address: "Jl. Pendidikan Barat No. 12, Bekasi",
      phone: "+62 21 5550102",
    },
    {
      id: "school-alw-3",
      name: "Al Wildan 3 (Islamic School)",
      code: "ALW-03",
      type: "branch" as const,
      address: "Jl. KH. Hasyim Asyari No. 88, Tangerang",
      phone: "+62 21 5550103",
    },
    {
      id: "school-alw-4",
      name: "Al Wildan 4 (Islamic School)",
      code: "ALW-04",
      type: "branch" as const,
      address: "Jl. Raya Ciater No. 45, BSD City",
      phone: "+62 21 5550104",
    },
  ];

  for (const s of schoolData) {
    await db
      .insert(schools)
      .values({ ...s, createdAt: now, updatedAt: now })
      .onConflictDoUpdate({
        target: schools.id,
        set: { name: s.name, code: s.code, type: s.type, address: s.address, phone: s.phone, updatedAt: now },
      });
  }

  // 2. Demo Users (Central Admin & Branch Admins)
  const demoUsers = [
    {
      name: "Super Admin Al Wildan Pusat",
      email: "admin.pusat@alwildan.sch.id",
      password: "password123",
      role: "central_admin" as const,
      schoolId: "school-alw-1",
    },
    {
      name: "Branch Admin Al Wildan 2",
      email: "admin.cabang2@alwildan.sch.id",
      password: "password123",
      role: "branch_admin" as const,
      schoolId: "school-alw-2",
    },
    {
      name: "Branch Admin Al Wildan 3",
      email: "admin.cabang3@alwildan.sch.id",
      password: "password123",
      role: "branch_admin" as const,
      schoolId: "school-alw-3",
    },
    {
      name: "Branch Admin Al Wildan 4",
      email: "admin.cabang4@alwildan.sch.id",
      password: "password123",
      role: "branch_admin" as const,
      schoolId: "school-alw-4",
    },
  ];

  for (const u of demoUsers) {
    try {
      await auth.api.signUpEmail({
        body: {
          name: u.name,
          email: u.email,
          password: u.password,
          role: u.role,
          schoolId: u.schoolId,
        } as any,
      });
    } catch {
      // User might already exist in repeated seeding
    }
  }

  // 3. Cambridge Books Catalog
  const cambridgeBooks = [
    {
      id: "book-camb-01",
      isbn: "978-1108746281",
      title: "Cambridge Primary English Learner's Book 3 with Digital Access",
      author: "Katharine Baker, Joyce Vallar",
      publisher: "Cambridge University Press",
      publishYear: 2021,
      category: "English",
      description: "Comprehensive Cambridge Primary curriculum book developing reading, writing, and communication skills.",
      coverUrl: "https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=400",
    },
    {
      id: "book-camb-02",
      isbn: "978-1108746311",
      title: "Cambridge Primary Mathematics Learner's Book 4",
      author: "Emma Low, Mary Wood",
      publisher: "Cambridge University Press",
      publishYear: 2021,
      category: "Mathematics",
      description: "Active mathematics learning with engaging problems, investigations, and mathematical reasoning.",
      coverUrl: "https://images.unsplash.com/photo-1509228468518-180dd4864904?w=400",
    },
    {
      id: "book-camb-03",
      isbn: "978-1108742788",
      title: "Cambridge Lower Secondary Science Learner's Book 7",
      author: "Mary Jones, Diane Fellowes-Freeman",
      publisher: "Cambridge University Press",
      publishYear: 2021,
      category: "Science",
      description: "Enquiry-based science course covering Biology, Chemistry, Physics, and Earth and Space.",
      coverUrl: "https://images.unsplash.com/photo-1532094349884-543bc11b234d?w=400",
    },
    {
      id: "book-camb-04",
      isbn: "978-1108437189",
      title: "Cambridge IGCSE Mathematics Core and Extended Coursebook",
      author: "Karen Morrison, Nick Hamshaw",
      publisher: "Cambridge University Press",
      publishYear: 2022,
      category: "Mathematics",
      description: "Revised edition covering the complete Cambridge IGCSE Mathematics (0580/0980) syllabus.",
      coverUrl: "https://images.unsplash.com/photo-1635070041078-e363dbe005cb?w=400",
    },
    {
      id: "book-camb-05",
      isbn: "978-1108936767",
      title: "Cambridge IGCSE Biology Coursebook with Digital Access",
      author: "Mary Jones, Geoff Jones",
      publisher: "Cambridge University Press",
      publishYear: 2022,
      category: "Biology",
      description: "Engaging coverage of cell biology, human physiology, ecology, and biotechnology for IGCSE candidates.",
      coverUrl: "https://images.unsplash.com/photo-1532187863486-abf9dbad1b69?w=400",
    },
  ];

  for (const b of cambridgeBooks) {
    await db
      .insert(books)
      .values({ ...b, createdAt: now, updatedAt: now })
      .onConflictDoUpdate({
        target: books.id,
        set: {
          title: b.title,
          author: b.author,
          publisher: b.publisher,
          publishYear: b.publishYear,
          category: b.category,
          description: b.description,
          coverUrl: b.coverUrl,
          updatedAt: now,
        },
      });
  }

  // 4. Physical Book Items (Distributed across Al Wildan 1, 2, 3, 4)
  const itemsToCreate: Array<{
    id: string;
    bookId: string;
    currentSchoolId: string;
    barcode: string;
    condition: "new" | "good" | "fair";
    status: "in_stock" | "in_transit";
    notes?: string;
  }> = [];

  // Generate barcodes per school and book
  const distribution = [
    { schoolId: "school-alw-1", prefix: "ALW1", countPerBook: 8 },
    { schoolId: "school-alw-2", prefix: "ALW2", countPerBook: 5 },
    { schoolId: "school-alw-3", prefix: "ALW3", countPerBook: 4 },
    { schoolId: "school-alw-4", prefix: "ALW4", countPerBook: 3 },
  ];

  for (const dist of distribution) {
    for (let bIdx = 0; bIdx < cambridgeBooks.length; bIdx++) {
      const book = cambridgeBooks[bIdx];
      for (let i = 1; i <= dist.countPerBook; i++) {
        const paddedIndex = String(i).padStart(3, "0");
        const bookNum = String(bIdx + 1).padStart(2, "0");
        const categoryCode = book.category.substring(0, 3).toUpperCase();
        itemsToCreate.push({
          id: `item-${dist.prefix.toLowerCase()}-${bIdx + 1}-${paddedIndex}`,
          bookId: book.id,
          currentSchoolId: dist.schoolId,
          barcode: `${dist.prefix}-${categoryCode}${bookNum}-${paddedIndex}`,
          condition: i === 1 ? "fair" : i % 2 === 0 ? "new" : "good",
          status: "in_stock",
          notes: `Batch kurikulum 2026/2027 - ${dist.prefix}`,
        });
      }
    }
  }

  // Insert physical copies
  for (const item of itemsToCreate) {
    await db
      .insert(bookItems)
      .values({ ...item, createdAt: now, updatedAt: now })
      .onConflictDoUpdate({
        target: bookItems.id,
        set: {
          currentSchoolId: item.currentSchoolId,
          barcode: item.barcode,
          condition: item.condition,
          status: item.status,
          updatedAt: now,
        },
      });
  }

  // 5. Transfer Shipment Samples (HQ -> Branch 2, and Branch 2 -> Branch 3 direct transfer)
  const shipment1Id = "ship-demo-alw-01";
  const itemInTransit1 = itemsToCreate.find(
    (it) => it.currentSchoolId === "school-alw-1" && it.bookId === "book-camb-01"
  );

  if (itemInTransit1) {
    // Set item status to in_transit
    await db
      .update(bookItems)
      .set({ status: "in_transit", updatedAt: now })
      .where(eq(bookItems.id, itemInTransit1.id));

    await db
      .insert(transferShipments)
      .values({
        id: shipment1Id,
        shipmentNumber: "TRF-ALW-2026-001",
        fromSchoolId: "school-alw-1",
        toSchoolId: "school-alw-2",
        status: "in_transit",
        dispatchedAt: now,
        notes: "Distribusi buku Cambridge English Al Wildan 1 Pusat ke Al Wildan 2",
        createdAt: now,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: transferShipments.id,
        set: { status: "in_transit", updatedAt: now },
      });

    await db
      .insert(transferShipmentItems)
      .values({
        id: "ship-item-demo-01",
        shipmentId: shipment1Id,
        bookItemId: itemInTransit1.id,
        createdAt: now,
      })
      .onConflictDoNothing();
  }

  return c.json({
    success: true,
    message: "Al Wildan 4 campuses & Cambridge curriculum demo data seeded successfully",
    data: {
      schools: schoolData.length,
      demoUsers: demoUsers.length,
      books: cambridgeBooks.length,
      bookItems: itemsToCreate.length,
    },
  });
});
