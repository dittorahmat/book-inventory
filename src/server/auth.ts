import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "../db";
import * as schema from "../db/schema";

export const auth = betterAuth({
  secret: process.env.BETTER_AUTH_SECRET || "development-secret-key-book-inventory-1234567890",
  trustedOrigins: [
    "http://localhost:5173",
    "http://localhost:3000",
    "https://book-inventory.tech1solusi.workers.dev",
    /^https:\/\/.*\.workers\.dev$/ as any,
    /^https:\/\/.*\.pages\.dev$/ as any,
  ],
  database: drizzleAdapter(db, {
    provider: "sqlite",
    schema: {
      user: schema.users,
      session: schema.sessions,
      account: schema.accounts,
      verification: schema.verifications,
    },
  }),
  user: {
    additionalFields: {
      role: {
        type: "string",
        required: false,
        defaultValue: "branch_admin",
      },
      schoolId: {
        type: "string",
        required: false,
      },
    },
  },
  emailAndPassword: {
    enabled: true,
    autoSignIn: true,
  },
});
