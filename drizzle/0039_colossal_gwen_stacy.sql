CREATE TABLE `refund_slips` (
	`id` text PRIMARY KEY NOT NULL,
	`kind` text NOT NULL,
	`slip_number` text NOT NULL,
	`order_id` text NOT NULL,
	`order_number` text NOT NULL,
	`student_id` text NOT NULL,
	`student_name` text NOT NULL,
	`nis` text NOT NULL,
	`school_id` text NOT NULL,
	`refund_amount` integer NOT NULL,
	`status` text DEFAULT 'approved' NOT NULL,
	`courier_resi` text,
	`letter_proof_url` text,
	`approved_at` text NOT NULL,
	`disbursed_at` text,
	`disbursed_bank_name` text,
	`disbursed_reference_number` text,
	`disbursed_proof_url` text,
	`disbursed_notes` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`student_id`) REFERENCES `students`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`school_id`) REFERENCES `schools`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `refund_slips_slip_number_unique` ON `refund_slips` (`slip_number`);--> statement-breakpoint
CREATE INDEX `refund_slips_school_approved_idx` ON `refund_slips` (`school_id`,`approved_at`);--> statement-breakpoint
CREATE INDEX `refund_slips_order_idx` ON `refund_slips` (`order_id`);--> statement-breakpoint
ALTER TABLE `uniform_refunds` ADD `courier_resi` text;--> statement-breakpoint
ALTER TABLE `uniform_refunds` ADD `letter_proof_url` text;
--> statement-breakpoint
-- Backfill Slip Bukti Pengembalian lama dari system_settings (ADR-0019).
-- Baris KV tidak dihapus (migrasi non-destruktif); hanya berhenti dibaca.
INSERT OR IGNORE INTO `refund_slips` (
	`id`, `kind`, `slip_number`, `order_id`, `order_number`, `student_id`, `student_name`, `nis`,
	`school_id`, `refund_amount`, `status`, `courier_resi`, `letter_proof_url`,
	`approved_at`, `created_at`, `updated_at`
)
SELECT
	json_extract(s.value, '$.slipNumber'),
	'buku',
	json_extract(s.value, '$.slipNumber'),
	json_extract(s.value, '$.orderId'),
	coalesce(json_extract(s.value, '$.orderNumber'), '-'),
	json_extract(s.value, '$.studentId'),
	coalesce(json_extract(s.value, '$.studentName'), 'Siswa'),
	coalesce(json_extract(s.value, '$.nis'), '-'),
	json_extract(s.value, '$.schoolId'),
	coalesce(json_extract(s.value, '$.refundAmount'), 0),
	CASE WHEN EXISTS (
		SELECT 1 FROM `book_returns` br
		WHERE br.`order_id` = json_extract(s.value, '$.orderId') AND br.`status` = 'refunded'
	) THEN 'refunded' ELSE 'approved' END,
	NULL,
	json_extract(s.value, '$.letterProofUrl'),
	coalesce(json_extract(s.value, '$.approvedAt'), s.`updated_at`),
	coalesce(json_extract(s.value, '$.approvedAt'), s.`updated_at`),
	coalesce(json_extract(s.value, '$.approvedAt'), s.`updated_at`)
FROM `system_settings` s
WHERE s.`key` LIKE 'withdrawal_slip_book_%'
	AND json_valid(s.`value`)
	AND json_extract(s.`value`, '$.slipNumber') IS NOT NULL;
--> statement-breakpoint
INSERT OR IGNORE INTO `refund_slips` (
	`id`, `kind`, `slip_number`, `order_id`, `order_number`, `student_id`, `student_name`, `nis`,
	`school_id`, `refund_amount`, `status`, `courier_resi`, `letter_proof_url`,
	`approved_at`, `created_at`, `updated_at`
)
SELECT
	json_extract(s.value, '$.slipNumber'),
	'seragam',
	json_extract(s.value, '$.slipNumber'),
	json_extract(s.value, '$.orderId'),
	coalesce(json_extract(s.value, '$.orderNumber'), '-'),
	json_extract(s.value, '$.studentId'),
	coalesce(json_extract(s.value, '$.studentName'), 'Siswa'),
	coalesce(json_extract(s.value, '$.nis'), '-'),
	json_extract(s.value, '$.schoolId'),
	coalesce(json_extract(s.value, '$.refundAmount'), 0),
	CASE WHEN EXISTS (
		SELECT 1 FROM `uniform_refunds` ur
		WHERE ur.`order_id` = json_extract(s.value, '$.orderId') AND ur.`status` = 'refunded'
	) THEN 'refunded' ELSE 'approved' END,
	nullif(json_extract(s.value, '$.courierResi'), '-'),
	json_extract(s.value, '$.letterProofUrl'),
	coalesce(json_extract(s.value, '$.approvedAt'), s.`updated_at`),
	coalesce(json_extract(s.value, '$.approvedAt'), s.`updated_at`),
	coalesce(json_extract(s.value, '$.approvedAt'), s.`updated_at`)
FROM `system_settings` s
WHERE s.`key` LIKE 'withdrawal_slip_uniform_%'
	AND json_valid(s.`value`)
	AND json_extract(s.`value`, '$.slipNumber') IS NOT NULL;
--> statement-breakpoint
-- Resi & surat retur seragam lama: pindahkan ke kolom terstruktur.
UPDATE `uniform_refunds`
SET `courier_resi` = (
	SELECT json_extract(s.value, '$.courierResi') FROM `system_settings` s
	WHERE s.`key` = 'uniform_withdrawal_resi_' || `uniform_refunds`.`id` AND json_valid(s.value)
)
WHERE `courier_resi` IS NULL
	AND EXISTS (
		SELECT 1 FROM `system_settings` s
		WHERE s.`key` = 'uniform_withdrawal_resi_' || `uniform_refunds`.`id`
			AND json_valid(s.value)
			AND json_extract(s.value, '$.courierResi') IS NOT NULL
	);
--> statement-breakpoint
UPDATE `uniform_refunds`
SET `letter_proof_url` = (
	SELECT json_extract(s.value, '$.letterProofUrl') FROM `system_settings` s
	WHERE s.`key` = 'uniform_withdrawal_resi_' || `uniform_refunds`.`id` AND json_valid(s.value)
)
WHERE `letter_proof_url` IS NULL
	AND EXISTS (
		SELECT 1 FROM `system_settings` s
		WHERE s.`key` = 'uniform_withdrawal_resi_' || `uniform_refunds`.`id`
			AND json_valid(s.value)
			AND json_extract(s.value, '$.letterProofUrl') IS NOT NULL
	);