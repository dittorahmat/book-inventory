ALTER TABLE `order_payments` ADD `rejected_at` text;--> statement-breakpoint
ALTER TABLE `order_payments` ADD `reject_reason` text;--> statement-breakpoint
ALTER TABLE `uniform_payments` ADD `rejected_at` text;--> statement-breakpoint
ALTER TABLE `uniform_payments` ADD `reject_reason` text;--> statement-breakpoint
-- Backfill: sebelum perubahan ini setiap baris pembayaran langsung dianggap efektif,
-- jadi seluruh baris lama (verified_at masih NULL) ditandai terverifikasi pada created_at.
-- Baris baru setelah migrasi ini dibuat dengan verified_at NULL secara sengaja (pending).
UPDATE `order_payments` SET `verified_at` = `created_at` WHERE `verified_at` IS NULL;--> statement-breakpoint
UPDATE `uniform_payments` SET `verified_at` = `created_at` WHERE `verified_at` IS NULL;