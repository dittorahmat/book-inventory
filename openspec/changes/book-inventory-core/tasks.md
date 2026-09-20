## 1. Project Scaffolding & Database Schema

- [x] 1.1 Initialize project structure with Bun, Hono, React, Vite, TypeScript, and Drizzle ORM configuration and verify `bun install` completes cleanly
- [x] 1.2 Define Drizzle SQLite schemas for `schools`, `users`, `books`, `book_items`, `transfer_shipments`, and `transfer_shipment_items` and verify `bun run db:push` synchronizes without error
- [x] 1.3 Implement storage abstraction service for cover uploads (Cloudflare R2 and S3 compatible client) and verify unit test passes

## 2. Backend API Services & Quality Verification

- [x] 2.1 Implement school branch management API routes and test school creation and branch isolation logic
- [x] 2.2 Implement book catalog management API routes with image upload handling and verify test suite passes
- [x] 2.3 Implement physical copy (`book_items`) batch generation and barcode lookup API with unique tag constraints
- [x] 2.4 Implement inter-school transfer shipment API (`draft`, `dispatch`, `receive`, `discrepancy`) and verify end-to-end transfer tests pass

## 3. Frontend Development & Anti-Slop Verification

- [x] 3.1 Setup frontend layout with clean typography, branch selector, and navigation applying `design-taste-frontend` principles
- [x] 3.2 Build Book Catalog and Inventory Management views with barcode scan/search input and copy condition tracking
- [x] 3.3 Build Inter-School Transfer Logistics views (Dispatch from HQ and Receive at Branch) with shipment status timeline

## 4. Quality Checklist & Build Verification

- [x] 4.1 Run full quality checklist (`db:push`, `npm run type-check`, `npm run lint`, `npm run build`, `npm run test`) and verify zero errors
