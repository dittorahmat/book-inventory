CREATE TABLE `branch_charges` (
	`id` text PRIMARY KEY NOT NULL,
	`charge_number` text NOT NULL,
	`school_id` text NOT NULL,
	`source_type` text NOT NULL,
	`source_id` text NOT NULL,
	`trigger_event` text NOT NULL,
	`chargeable_at` text NOT NULL,
	`goods_amount` integer DEFAULT 0 NOT NULL,
	`shipping_amount` integer DEFAULT 0 NOT NULL,
	`status` text DEFAULT 'open' NOT NULL,
	`claim_id` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`school_id`) REFERENCES `schools`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`claim_id`) REFERENCES `uniform_claims`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `branch_charges_charge_number_unique` ON `branch_charges` (`charge_number`);--> statement-breakpoint
CREATE INDEX `branch_charges_school_status_idx` ON `branch_charges` (`school_id`,`status`);--> statement-breakpoint
CREATE INDEX `branch_charges_claim_idx` ON `branch_charges` (`claim_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `branch_charges_source_unq` ON `branch_charges` (`source_type`,`source_id`);--> statement-breakpoint
CREATE TABLE `payment_allocations` (
	`id` text PRIMARY KEY NOT NULL,
	`receipt_id` text NOT NULL,
	`order_id` text NOT NULL,
	`kind` text NOT NULL,
	`amount` integer NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`receipt_id`) REFERENCES `payment_receipts`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `payment_allocations_receipt_idx` ON `payment_allocations` (`receipt_id`);--> statement-breakpoint
CREATE INDEX `payment_allocations_order_idx` ON `payment_allocations` (`kind`,`order_id`);--> statement-breakpoint
CREATE TABLE `payment_receipts` (
	`id` text PRIMARY KEY NOT NULL,
	`student_id` text NOT NULL,
	`school_id` text NOT NULL,
	`amount` integer NOT NULL,
	`bank_name` text NOT NULL,
	`reference_number` text,
	`proof_url` text,
	`received_at` text NOT NULL,
	`verified_by_user_id` text,
	`verified_at` text,
	`rejected_at` text,
	`reject_reason` text,
	`created_by_user_id` text,
	`notes` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`student_id`) REFERENCES `students`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`school_id`) REFERENCES `schools`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`verified_by_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`created_by_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `payment_receipts_student_idx` ON `payment_receipts` (`student_id`);--> statement-breakpoint
CREATE INDEX `payment_receipts_school_received_idx` ON `payment_receipts` (`school_id`,`received_at`);--> statement-breakpoint
INSERT INTO `payment_receipts` (`id`,`student_id`,`school_id`,`amount`,`bank_name`,`reference_number`,`proof_url`,`received_at`,`verified_by_user_id`,`verified_at`,`rejected_at`,`reject_reason`,`created_by_user_id`,`notes`,`created_at`,`updated_at`)
SELECT 'rcp-b-' || p.`id`, o.`student_id`, o.`school_id`, p.`transfer_amount`,
       COALESCE(NULLIF(TRIM(p.`bank_name`), ''), 'Tanpa Bank'),
       NULLIF(TRIM(p.`reference_number`), ''),
       p.`payment_proof_url`, p.`created_at`, p.`verified_by_user_id`, p.`verified_at`,
       p.`rejected_at`, p.`reject_reason`, NULL, p.`notes`, p.`created_at`, p.`created_at`
FROM `order_payments` p
JOIN `student_book_orders` o ON o.`id` = p.`order_id`;--> statement-breakpoint
INSERT INTO `payment_allocations` (`id`,`receipt_id`,`order_id`,`kind`,`amount`,`created_at`)
SELECT 'alc-b-' || p.`id`, 'rcp-b-' || p.`id`, p.`order_id`, 'buku', p.`book_allocation_amount`, p.`created_at`
FROM `order_payments` p WHERE p.`book_allocation_amount` > 0;--> statement-breakpoint
INSERT INTO `payment_receipts` (`id`,`student_id`,`school_id`,`amount`,`bank_name`,`reference_number`,`proof_url`,`received_at`,`verified_by_user_id`,`verified_at`,`rejected_at`,`reject_reason`,`created_by_user_id`,`notes`,`created_at`,`updated_at`)
SELECT 'rcp-u-' || p.`id`, o.`student_id`, o.`school_id`, p.`transfer_amount`,
       COALESCE(NULLIF(TRIM(p.`bank_name`), ''), 'Tanpa Bank'),
       NULLIF(TRIM(p.`reference_number`), ''),
       p.`payment_proof_url`, p.`created_at`, p.`verified_by_user_id`, p.`verified_at`,
       p.`rejected_at`, p.`reject_reason`, NULL, p.`notes`, p.`created_at`, p.`created_at`
FROM `uniform_payments` p
JOIN `uniform_orders` o ON o.`id` = p.`order_id`;--> statement-breakpoint
INSERT INTO `payment_allocations` (`id`,`receipt_id`,`order_id`,`kind`,`amount`,`created_at`)
SELECT 'alc-u-' || p.`id`, 'rcp-u-' || p.`id`, p.`order_id`, 'seragam', p.`uniform_allocation_amount`, p.`created_at`
FROM `uniform_payments` p WHERE p.`uniform_allocation_amount` > 0;--> statement-breakpoint
-- Dedupe lintas KEDUA tabel lama sebelum indeks unik dipasang: satu struk bisa
-- tercatat di order_payments DAN uniform_payments (itulah bug double-count yang
-- ditutup ADR-0012). Hanya entri paling awal yang mempertahankan nomornya.
UPDATE `payment_receipts` SET `reference_number` = NULL
WHERE `reference_number` IS NOT NULL
  AND `id` NOT IN (
    SELECT MIN(`id`) FROM `payment_receipts`
    WHERE `reference_number` IS NOT NULL
    GROUP BY `bank_name`, `reference_number`
  );--> statement-breakpoint
CREATE UNIQUE INDEX `payment_receipts_bank_ref_unq` ON `payment_receipts` (`bank_name`,`reference_number`);