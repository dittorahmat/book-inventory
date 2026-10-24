import { db, type AppDatabase } from "../db";
import { BOOK_LIST, PACKAGE_DATA, seedCatalog } from "./seed-demo/catalog";
import type { SeedContext } from "./seed-demo/context";
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
