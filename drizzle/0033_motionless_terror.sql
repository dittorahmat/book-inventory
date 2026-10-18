-- Ganti nama (bukan drop+create) agar baris klaim tidak hilang.
-- `ALTER TABLE ... RENAME TO` otomatis memperbarui referensi FK di
-- `branch_charges.claim_id`, jadi tabel itu tidak perlu dibangun ulang.
-- Nama indeks TIDAK ikut berubah saat rename, termasuk indeks otomatis dari
-- `.unique()` pada kolom, jadi ketiganya diganti nama eksplisit di sini.
ALTER TABLE `uniform_claims` RENAME TO `branch_claims`;--> statement-breakpoint
DROP INDEX IF EXISTS `uniform_claims_claim_number_unique`;--> statement-breakpoint
DROP INDEX IF EXISTS `uniform_claims_school_period_idx`;--> statement-breakpoint
DROP INDEX IF EXISTS `uniform_claims_school_period_unq`;--> statement-breakpoint
CREATE UNIQUE INDEX `branch_claims_claim_number_unique` ON `branch_claims` (`claim_number`);--> statement-breakpoint
CREATE INDEX `branch_claims_school_period_idx` ON `branch_claims` (`school_id`,`period`);--> statement-breakpoint
CREATE UNIQUE INDEX `branch_claims_school_period_unq` ON `branch_claims` (`school_id`,`period`);
