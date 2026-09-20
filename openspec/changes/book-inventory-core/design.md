## Context

See [proposal.md](file:///D:/development/book-inventory/openspec/changes/book-inventory-core/proposal.md) for motivation and functional requirements.
The project requires building a book inventory and logistics transfer system using Bun, React, Vite, TypeScript, Hono, and Drizzle ORM.
A critical architectural constraint is portability: initial deployment targets Cloudflare (Workers + D1 + R2), with a seamless future transition to self-hosted VPS / On-Premise (Bun native SQLite + MinIO/S3).

## Goals / Non-Goals

**Goals:**
- Provide a unified SQLite schema in Drizzle (`drizzle-orm/sqlite-core`) that works with zero modifications across Cloudflare D1 and Bun native SQLite.
- Abstract the object storage provider to seamlessly switch between Cloudflare R2 bindings and S3-compatible APIs (MinIO / AWS SDK).
- Implement role-based inventory filtering ensuring branch administrators cannot access or modify inventory of other schools.
- Model the inter-school transfer logistics with strong data consistency and formal state transitions.
- Build a responsive React SPA adhering to anti-slop principles (clean layout, crisp typography, barcode scan feedback).

**Non-Goals:**
- Student/patron borrowing management (circulation desk / library loan system) - out of scope for this inventory distribution phase.
- Complex multi-currency financial accounting for book depreciation.

## Decisions

### 1. Database & ORM: Drizzle with SQLite Core
- **Decision**: Define all schemas using `drizzle-orm/sqlite-core`. In Cloudflare Workers, use `drizzle(env.DB)`. In Bun/VPS, use `drizzle(bunSqliteDatabase)`.
- **Alternatives Considered**:
  - *PostgreSQL/Neon*: Would avoid D1 limitations but introduces serverless latency, billing dependencies, and external network round-trips. SQLite core offers unified zero-change schema portability.

### 2. File & Cover Storage: Storage Adapter Interface
- **Decision**: Define a `StorageService` interface:
  ```ts
  interface StorageService {
    upload(key: string, file: Uint8Array | Blob, contentType: string): Promise<string>;
    getUrl(key: string): string;
  }
  ```
  Provide `R2StorageService` for Cloudflare and `S3StorageService` (via `@aws-sdk/client-s3`) for VPS/MinIO.
- **Alternatives Considered**: Direct binding everywhere (breaks on VPS).

### 3. Physical Tracking Model
- **Decision**: Two-tier model: `books` (katalog) and `book_items` (eksemplar fisik dengan barcode unik, `current_school_id`, `condition`, `status`).
- **Rationale**: Enables tracking exact books when damaged, lost, or in transit across schools.

### 4. Inter-School Transfer State Machine
- **Decision**: Shipments track state `draft` -> `pending_dispatch` -> `in_transit` -> `completed` (or `completed_with_discrepancy`).
- When `in_transit`, all associated `book_items` have `status = 'in_transit'`.
- When `completed`, atomic transaction updates `current_school_id` and restores status to `in_stock`.

## Risks / Trade-offs

- **[Risk] Cloudflare D1 Concurrency & Limitations** → *Mitigation*: Inter-school transfer transactions are lightweight batch updates. D1 transaction API (`db.batch(...)`) ensures atomicity for item transfers.
- **[Risk] Barcode Collision** → *Mitigation*: Enforce a database UNIQUE constraint on `barcode` in `book_items`.

## Migration Plan

- Deploy Drizzle schema using `drizzle-kit push` (or migration files).
- Run automated seed script for initial central school and test branches.
