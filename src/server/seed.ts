import { db, type AppDatabase } from "../db";
import { BOOK_LIST, PACKAGE_DATA, seedCatalog } from "./seed-demo/catalog";
import type { SeedContext } from "./seed-demo/context";
import { seedDemoPack } from "./seed-demo/demo-pack";
import { DEMO_USERS, SCHOOL_DATA, seedIdentity } from "./seed-demo/identity";
import { seedOrders } from "./seed-demo/orders";
import { seedProcurement } from "./seed-demo/procurement";
import { seedStudents, STUDENT_DATA } from "./seed-demo/students";
import { seedUniformCore } from "./seed-demo/uniform-core";

/** Seed baseline: data minimum yang dipakai test dan auto-seed paket. */
async function seedBaseline(ctx: SeedContext) {
  await seedIdentity(ctx);
  await seedCatalog(ctx);
  await seedStudents(ctx);
  await seedOrders(ctx);
  await seedProcurement(ctx);
  await seedUniformCore(ctx);

  return {
    success: true,
    data: {
      schoolsSeeded: SCHOOL_DATA.length,
      usersSeeded: DEMO_USERS.length,
      booksSeeded: BOOK_LIST.length,
      packagesSeeded: PACKAGE_DATA.length,
      studentsSeeded: STUDENT_DATA.length,
    },
  };
}

export async function runIdempotentSeed(customDb: AppDatabase = db) {
  return seedBaseline({ db: customDb, now: new Date().toISOString() });
}

/**
 * Seed demo lengkap = baseline + pack operasional. Hanya dipanggil route demo
 * dan ekspor D1; test setup tetap memakai baseline agar deterministik.
 */
export async function runDemoSeed(customDb: AppDatabase = db) {
  const ctx: SeedContext = { db: customDb, now: new Date().toISOString() };
  const baseline = await seedBaseline(ctx);
  const pack = await seedDemoPack(ctx);
  return {
    success: true,
    data: {
      ...baseline.data,
      demoPack: true,
      pack,
    },
  };
}

