import { and, desc, eq, inArray } from "drizzle-orm";
import type { AppDatabase } from "../../../db";
import { books, schools, teacherHandbookAllocations, teacherHandbookOrders } from "../../../db/schema";
import { d1WriteErrorStatus, runWriteBatch, selectInChunks } from "../../lib/d1-write";

export interface TeacherAllocationInput {
  bookId: string;
  teacherName: string;
  gradeLevel?: string | null;
  rombel?: string | null;
  subject?: string | null;
  quantity: number;
}

export interface CreateTeacherHandbookOrderInput {
  schoolId: string;
  notes?: string | null;
  allocations: TeacherAllocationInput[];
}

export interface UpdateTeacherHandbookOrderInput {
  notes?: string | null;
  allocations: TeacherAllocationInput[];
}

export class TeacherHandbookError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number = 400
  ) {
    super(message);
    this.name = "TeacherHandbookError";
  }
}

async function execBatch(
  db: AppDatabase,
  stmts: Parameters<typeof runWriteBatch>[1],
  fallbackMsg: string
) {
  try {
    await runWriteBatch(db, stmts);
  } catch (err) {
    const mapped = d1WriteErrorStatus(err, fallbackMsg);
    if (mapped) {
      throw new TeacherHandbookError(mapped.message, mapped.status);
    }
    throw err;
  }
}

function generateOrderNumber(now: Date): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  const rand = crypto.randomUUID().slice(0, 4).toUpperCase();
  return `PG-${y}${m}${d}-${rand}`;
}

function chunkArray<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

export async function createTeacherHandbookOrder(
  db: AppDatabase,
  input: CreateTeacherHandbookOrderInput,
  createdBy: string | null,
  now: Date = new Date()
) {
  if (!input.allocations.length) {
    throw new TeacherHandbookError("Minimal harus ada satu alokasi guru.", 400);
  }

  const [school] = await db
    .select({ id: schools.id })
    .from(schools)
    .where(eq(schools.id, input.schoolId));
  if (!school) {
    throw new TeacherHandbookError("Sekolah cabang tidak ditemukan.", 404);
  }

  const bookIds = Array.from(new Set(input.allocations.map((a) => a.bookId)));
  const foundBooks = await selectInChunks(bookIds, (chunk) =>
    db.select({ id: books.id }).from(books).where(inArray(books.id, chunk))
  );
  if (foundBooks.length !== bookIds.length) {
    throw new TeacherHandbookError("Sebagian buku tidak ditemukan di master katalog.", 404);
  }

  const orderId = crypto.randomUUID();
  const orderNumber = generateOrderNumber(now);
  const isoNow = now.toISOString();

  const allocationRows = input.allocations.map((a) => ({
    id: crypto.randomUUID(),
    orderId,
    bookId: a.bookId,
    teacherName: a.teacherName.trim(),
    gradeLevel: a.gradeLevel?.trim() || null,
    rombel: a.rombel?.trim() || null,
    subject: a.subject?.trim() || null,
    quantity: a.quantity,
    deliveredQuantity: 0,
    handedOverQuantity: 0,
    handedOverAt: null,
    createdAt: isoNow,
    updatedAt: isoNow,
  }));

  const insertOrderStmt = db.insert(teacherHandbookOrders).values({
    id: orderId,
    orderNumber,
    schoolId: input.schoolId,
    status: "pending",
    notes: input.notes?.trim() || null,
    createdBy,
    createdAt: isoNow,
    updatedAt: isoNow,
  });

  const allocChunks = chunkArray(allocationRows, 10);
  await execBatch(
    db,
    [
      insertOrderStmt,
      ...allocChunks.map((chunk) => db.insert(teacherHandbookAllocations).values(chunk)),
    ],
    "Gagal menyimpan pesanan pegangan guru."
  );

  return getTeacherHandbookOrderById(db, orderId);
}

export async function listTeacherHandbookOrders(
  db: AppDatabase,
  filter: { schoolId?: string; status?: string } = {}
) {
  const conditions = [];
  if (filter.schoolId) {
    conditions.push(eq(teacherHandbookOrders.schoolId, filter.schoolId));
  }
  if (filter.status) {
    conditions.push(
      eq(
        teacherHandbookOrders.status,
        filter.status as "pending" | "in_transit" | "received" | "completed" | "cancelled"
      )
    );
  }

  const orders = await db
    .select({
      id: teacherHandbookOrders.id,
      orderNumber: teacherHandbookOrders.orderNumber,
      schoolId: teacherHandbookOrders.schoolId,
      schoolName: schools.name,
      status: teacherHandbookOrders.status,
      shipmentId: teacherHandbookOrders.shipmentId,
      settlementStatus: teacherHandbookOrders.settlementStatus,
      settlementAmount: teacherHandbookOrders.settlementAmount,
      paidAmount: teacherHandbookOrders.paidAmount,
      paymentProofUrl: teacherHandbookOrders.paymentProofUrl,
      settledAt: teacherHandbookOrders.settledAt,
      notes: teacherHandbookOrders.notes,
      createdBy: teacherHandbookOrders.createdBy,
      createdAt: teacherHandbookOrders.createdAt,
      updatedAt: teacherHandbookOrders.updatedAt,
    })
    .from(teacherHandbookOrders)
    .leftJoin(schools, eq(teacherHandbookOrders.schoolId, schools.id))
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(teacherHandbookOrders.createdAt))
    .limit(100);

  if (!orders.length) return [];

  const orderIds = orders.map((o) => o.id);
  const allocations = await selectInChunks(orderIds, (chunk) =>
    db
      .select({
        id: teacherHandbookAllocations.id,
        orderId: teacherHandbookAllocations.orderId,
        bookId: teacherHandbookAllocations.bookId,
        bookTitle: books.title,
        bookPrice: books.price,
        teacherName: teacherHandbookAllocations.teacherName,
        gradeLevel: teacherHandbookAllocations.gradeLevel,
        rombel: teacherHandbookAllocations.rombel,
        subject: teacherHandbookAllocations.subject,
        quantity: teacherHandbookAllocations.quantity,
        deliveredQuantity: teacherHandbookAllocations.deliveredQuantity,
        handedOverQuantity: teacherHandbookAllocations.handedOverQuantity,
        handedOverAt: teacherHandbookAllocations.handedOverAt,
      })
      .from(teacherHandbookAllocations)
      .leftJoin(books, eq(teacherHandbookAllocations.bookId, books.id))
      .where(inArray(teacherHandbookAllocations.orderId, chunk))
  );

  const allocByOrder = new Map<string, typeof allocations>();
  for (const a of allocations) {
    const list = allocByOrder.get(a.orderId) ?? [];
    list.push(a);
    allocByOrder.set(a.orderId, list);
  }

  return orders.map((o) => ({
    ...o,
    allocations: allocByOrder.get(o.id) ?? [],
  }));
}

export async function getTeacherHandbookOrderById(db: AppDatabase, orderId: string) {
  const [order] = await db
    .select({
      id: teacherHandbookOrders.id,
      orderNumber: teacherHandbookOrders.orderNumber,
      schoolId: teacherHandbookOrders.schoolId,
      schoolName: schools.name,
      status: teacherHandbookOrders.status,
      shipmentId: teacherHandbookOrders.shipmentId,
      settlementStatus: teacherHandbookOrders.settlementStatus,
      settlementAmount: teacherHandbookOrders.settlementAmount,
      paidAmount: teacherHandbookOrders.paidAmount,
      paymentProofUrl: teacherHandbookOrders.paymentProofUrl,
      settledAt: teacherHandbookOrders.settledAt,
      notes: teacherHandbookOrders.notes,
      createdBy: teacherHandbookOrders.createdBy,
      createdAt: teacherHandbookOrders.createdAt,
      updatedAt: teacherHandbookOrders.updatedAt,
    })
    .from(teacherHandbookOrders)
    .leftJoin(schools, eq(teacherHandbookOrders.schoolId, schools.id))
    .where(eq(teacherHandbookOrders.id, orderId));

  if (!order) return null;

  const allocations = await db
    .select({
      id: teacherHandbookAllocations.id,
      orderId: teacherHandbookAllocations.orderId,
      bookId: teacherHandbookAllocations.bookId,
      bookTitle: books.title,
      bookPrice: books.price,
      teacherName: teacherHandbookAllocations.teacherName,
      gradeLevel: teacherHandbookAllocations.gradeLevel,
      rombel: teacherHandbookAllocations.rombel,
      subject: teacherHandbookAllocations.subject,
      quantity: teacherHandbookAllocations.quantity,
      deliveredQuantity: teacherHandbookAllocations.deliveredQuantity,
      handedOverQuantity: teacherHandbookAllocations.handedOverQuantity,
      handedOverAt: teacherHandbookAllocations.handedOverAt,
    })
    .from(teacherHandbookAllocations)
    .leftJoin(books, eq(teacherHandbookAllocations.bookId, books.id))
    .where(eq(teacherHandbookAllocations.orderId, orderId));

  return { ...order, allocations };
}

export async function updateTeacherHandbookOrder(
  db: AppDatabase,
  orderId: string,
  input: UpdateTeacherHandbookOrderInput,
  schoolScope?: string | null,
  now: Date = new Date()
) {
  if (!input.allocations.length) {
    throw new TeacherHandbookError("Minimal harus ada satu alokasi guru.", 400);
  }

  const [existing] = await db
    .select()
    .from(teacherHandbookOrders)
    .where(eq(teacherHandbookOrders.id, orderId));
  if (!existing) {
    throw new TeacherHandbookError("Pesanan Pegangan Guru tidak ditemukan.", 404);
  }
  if (schoolScope && existing.schoolId !== schoolScope) {
    throw new TeacherHandbookError("Tidak memiliki akses ke pesanan cabang lain.", 403);
  }
  if (existing.status !== "pending") {
    throw new TeacherHandbookError(
      "Pesanan hanya dapat diubah selama status masih pending (belum dikirim).",
      400
    );
  }

  const bookIds = Array.from(new Set(input.allocations.map((a) => a.bookId)));
  const foundBooks = await selectInChunks(bookIds, (chunk) =>
    db.select({ id: books.id }).from(books).where(inArray(books.id, chunk))
  );
  if (foundBooks.length !== bookIds.length) {
    throw new TeacherHandbookError("Sebagian buku tidak ditemukan di master katalog.", 404);
  }

  const isoNow = now.toISOString();
  const allocationRows = input.allocations.map((a) => ({
    id: crypto.randomUUID(),
    orderId,
    bookId: a.bookId,
    teacherName: a.teacherName.trim(),
    gradeLevel: a.gradeLevel?.trim() || null,
    rombel: a.rombel?.trim() || null,
    subject: a.subject?.trim() || null,
    quantity: a.quantity,
    deliveredQuantity: 0,
    handedOverQuantity: 0,
    handedOverAt: null,
    createdAt: isoNow,
    updatedAt: isoNow,
  }));

  const allocChunks = chunkArray(allocationRows, 10);
  await execBatch(
    db,
    [
      db
        .update(teacherHandbookOrders)
        .set({ notes: input.notes?.trim() || null, updatedAt: isoNow })
        .where(eq(teacherHandbookOrders.id, orderId)),
      db.delete(teacherHandbookAllocations).where(eq(teacherHandbookAllocations.orderId, orderId)),
      ...allocChunks.map((chunk) => db.insert(teacherHandbookAllocations).values(chunk)),
    ],
    "Gagal memperbarui pesanan pegangan guru."
  );

  return getTeacherHandbookOrderById(db, orderId);
}

export async function cancelTeacherHandbookOrder(
  db: AppDatabase,
  orderId: string,
  schoolScope?: string | null,
  now: Date = new Date()
) {
  const [existing] = await db
    .select()
    .from(teacherHandbookOrders)
    .where(eq(teacherHandbookOrders.id, orderId));
  if (!existing) {
    throw new TeacherHandbookError("Pesanan Pegangan Guru tidak ditemukan.", 404);
  }
  if (schoolScope && existing.schoolId !== schoolScope) {
    throw new TeacherHandbookError("Tidak memiliki akses ke pesanan cabang lain.", 403);
  }
  if (existing.status !== "pending") {
    throw new TeacherHandbookError(
      "Pesanan hanya dapat dibatalkan selama status masih pending (belum dikirim).",
      400
    );
  }

  await db
    .update(teacherHandbookOrders)
    .set({ status: "cancelled", updatedAt: now.toISOString() })
    .where(eq(teacherHandbookOrders.id, orderId));

  return getTeacherHandbookOrderById(db, orderId);
}
