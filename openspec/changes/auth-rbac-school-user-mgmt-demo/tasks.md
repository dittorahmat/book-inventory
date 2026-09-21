## 1. Better-Auth Setup & Database Schema

- [x] 1.1 Install `better-auth` dependency and verify clean installation without peer dependency conflicts
- [x] 1.2 Update Drizzle database schema (`src/db/schema.ts`) with auth tables (`user`, `session`, `account`, `verification`) including `role` and `schoolId`, then run `bun run db:push`
- [x] 1.3 Configure Better-Auth instance in `src/server/auth.ts` with Drizzle SQLite adapter and mount router on `/api/auth/*` in `src/server/index.ts`
- [x] 1.4 Implement auth verification middleware in Hono to protect API routes and enforce RBAC / branch isolation

## 2. User & School Management APIs

- [x] 2.1 Implement `src/server/routes/users.ts` with endpoints for listing, creating, and updating users with role and school assignments, and write unit tests in `users.test.ts`
- [x] 2.2 Update `src/server/routes/schools.ts` to support updating school details and ensure strict single HQ validation
- [x] 2.3 Mount user routes on `/api/users` in Hono backend

## 3. Demo Cambridge Data Seeding

- [x] 3.1 Create demo seed utility/endpoint (`POST /api/demo/seed`) generating 4 Al Wildan schools (Pusat + 3 Cabang), demo user accounts, and Cambridge curriculum books (Primary English, Math, Science, IGCSE) with physical copies and barcode tags
- [x] 3.2 Add sample in-transit transfer shipments between Al Wildan schools in the seed to demonstrate logistics workflows
- [x] 3.3 Verify demo seed execution and validate created records via automated test

## 4. Frontend Authentication & Login View

- [x] 4.1 Create Better-Auth client in `src/lib/auth-client.ts`
- [x] 4.2 Build editorial-styled Login page with Quick-Demo buttons for instant login (Central Admin & Branch Admins)
- [x] 4.3 Update application header in `src/App.tsx` with user profile info, active role badge, logout button, and conditional role-based navigation

## 5. Frontend Settings View (School & User Management)

- [x] 5.1 Build `SettingsView.tsx` with tabs for "School Hierarchy" and "User Accounts"
- [x] 5.2 Implement School management UI (list, add new branch school, edit school details)
- [x] 5.3 Implement User management UI (list users, register admin with role & school assignment)
- [x] 5.4 Restrict Settings tab visibility and operations to `central_admin` users only

## 6. Verification & Quality Checks

- [x] 6.1 Run full type checking (`npm run type-check`) and verify zero TypeScript errors
- [x] 6.2 Run linter (`npm run lint`) and resolve any styling or import issues
- [x] 6.3 Run full test suite (`npm run test`) and verify all tests pass
- [x] 6.4 Run build check (`npm run build`) and verify production client and server bundles build cleanly
