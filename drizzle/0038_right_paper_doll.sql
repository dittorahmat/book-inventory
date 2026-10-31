DROP INDEX `payment_receipts_bank_ref_unq`;--> statement-breakpoint
ALTER TABLE `payment_receipts` ADD `direction` text DEFAULT 'in' NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX `payment_receipts_bank_ref_unq` ON `payment_receipts` (`direction`,`bank_name`,`reference_number`);