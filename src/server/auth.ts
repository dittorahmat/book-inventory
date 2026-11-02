import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "../db";
import * as schema from "../db/schema";

export function resolveAuthSecret(): string {
  const secret = process.env.BETTER_AUTH_SECRET;
  if (process.env.NODE_ENV === "production" && (!secret || secret.trim() === "")) {
    throw new Error("BETTER_AUTH_SECRET environment variable is strictly required in production mode");
  }
  return secret || "development-secret-key-book-inventory-1234567890";
}

export const auth = betterAuth({
  baseURL: process.env.BETTER_AUTH_URL || (process.env.NODE_ENV === "production" ? "https://book-inventory.tech1solusi.workers.dev" : "http://localhost:3000"),
  secret: resolveAuthSecret(),
  trustedOrigins: [
    "http://localhost:5173",
    "http://localhost:3000",
    "https://book-inventory.tech1solusi.workers.dev",
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
