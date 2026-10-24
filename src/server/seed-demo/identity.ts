import { eq } from "drizzle-orm";
import { hashPassword, verifyPassword } from "better-auth/crypto";
import { accounts, schools, users } from "../../db/schema";
import type { SeedContext } from "./context";

export const SCHOOL_DATA = [
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
  {
    id: "school-warehouse",
    name: "Gudang Logistik Al Wildan",
    code: "GUDANG-LOG",
    type: "warehouse" as const,
    address: "Jl. Gudang Logistik No. 1, Tangerang Selatan",
    phone: "+62 21 5550100",
  },
];

export const DEMO_USERS = [
  {
    id: "usr-admin-pusat",
    name: "School Admin Al Wildan 1",
    email: "admin.pusat@alwildan.sch.id",
    role: "school_admin" as const,
    schoolId: "school-alw-1",
  },
  {
    id: "usr-admin-cabang2",
    name: "Branch Admin Al Wildan 2",
    email: "admin.cabang2@alwildan.sch.id",
    role: "branch_admin" as const,
    schoolId: "school-alw-2",
  },
  {
    id: "usr-admin-cabang3",
    name: "Branch Admin Al Wildan 3",
    email: "admin.cabang3@alwildan.sch.id",
    role: "branch_admin" as const,
    schoolId: "school-alw-3",
  },
  {
    id: "usr-admin-cabang4",
    name: "Branch Admin Al Wildan 4",
    email: "admin.cabang4@alwildan.sch.id",
    role: "branch_admin" as const,
    schoolId: "school-alw-4",
  },
  {
    id: "usr-admin-gudang",
    name: "Super Admin Gudang Logistik",
    email: "admin.gudang@alwildan.sch.id",
    role: "central_admin" as const,
    schoolId: "school-warehouse",
  },
  {
    id: "usr-admin-buku",
    name: "Admin Gudang Buku",
    email: "admin.buku@alwildan.sch.id",
    role: "warehouse_books_admin" as const,
    schoolId: "school-warehouse",
  },
  {
    id: "usr-admin-seragam",
    name: "Admin Gudang Seragam",
    email: "admin.seragam@alwildan.sch.id",
    role: "warehouse_uniforms_admin" as const,
    schoolId: "school-warehouse",
  },
];

export async function seedIdentity({ db: targetDb, now }: SeedContext) {
  for (const s of SCHOOL_DATA) {
    await targetDb
      .insert(schools)
      .values({ ...s, createdAt: now, updatedAt: now })
      .onConflictDoUpdate({
        target: schools.id,
        set: { name: s.name, code: s.code, type: s.type, address: s.address, phone: s.phone, updatedAt: now },
      });
  }

  // Hash scrypt asli untuk 'password123' (stub base64 lama tak pernah lolos
  // verifikasi Better-Auth → login demo selalu 401; lihat insiden Okt 2026).
  const demoPasswordHash = await hashPassword("password123");
  for (const u of DEMO_USERS) {
    try {
      await targetDb.insert(users).values({
        id: u.id,
        name: u.name,
        email: u.email,
        emailVerified: true,
        role: u.role,
        schoolId: u.schoolId,
        createdAt: new Date(),
        updatedAt: new Date(),
      }).onConflictDoNothing();

      // For Better-Auth credential accounts: accountId WAJIB user id —
      // sign-in mencocokkan accountId === user.id (bukan email); baris
      // ber-accountId email tak pernah ketemu → 401 permanen (Okt 2026).
      await targetDb.insert(accounts).values({
        id: `acc-${u.id}`,
        userId: u.id,
        accountId: u.id,
        providerId: "credential",
        password: demoPasswordHash,
        createdAt: new Date(),
        updatedAt: new Date(),
      }).onConflictDoNothing();

      // Self-healing: stub warisan (tak terverifikasi) diganti hash asli,
      // dan accountId email warisan dipetakan ke user id.
      const [existing] = await targetDb
        .select({ accountId: accounts.accountId, password: accounts.password })
        .from(accounts)
        .where(eq(accounts.id, `acc-${u.id}`));
      if (existing) {
        let valid = false;
        try {
          valid = existing.password
            ? await verifyPassword({ hash: existing.password, password: "password123" })
            : false;
        } catch {
          valid = false;
        }
        if (!valid || existing.accountId !== u.id) {
          await targetDb
            .update(accounts)
            .set({ accountId: u.id, password: demoPasswordHash, updatedAt: new Date() })
            .where(eq(accounts.id, `acc-${u.id}`));
        }
      }
    } catch {
      // Ignored if user already exists
    }
  }
}
