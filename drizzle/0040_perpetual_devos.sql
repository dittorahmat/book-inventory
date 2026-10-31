ALTER TABLE `book_returns` ADD `kind` text DEFAULT 'defect' NOT NULL;--> statement-breakpoint
ALTER TABLE `refund_slips` ADD `source_id` text;--> statement-breakpoint
ALTER TABLE `uniform_refunds` ADD `kind` text DEFAULT 'defect' NOT NULL;
--> statement-breakpoint
-- Backfill pembeda jalur dari tag lama (ADR-0019). Non-destruktif: tag dibuang
-- dari teks alasan karena kini ada kolom `kind` yang menjadi sumber kebenaran.
UPDATE `book_returns`
SET `kind` = 'withdrawal',
	`reason` = trim(replace(`reason`, '[PENGUNDURAN DIRI]', ''))
WHERE `reason` LIKE '[PENGUNDURAN DIRI]%';
--> statement-breakpoint
UPDATE `uniform_refunds`
SET `kind` = 'withdrawal',
	`reason` = trim(replace(`reason`, '[PENGUNDURAN DIRI]', ''))
WHERE `reason` LIKE '[PENGUNDURAN DIRI]%';
--> statement-breakpoint
-- Tautkan slip lama ke baris sumbernya agar pencairan Finance menandai baris benar.
UPDATE `refund_slips`
SET `source_id` = (
	SELECT br.`id` FROM `book_returns` br
	WHERE br.`order_id` = `refund_slips`.`order_id` AND br.`kind` = 'withdrawal'
	ORDER BY br.`created_at` DESC LIMIT 1
)
WHERE `kind` = 'buku' AND `source_id` IS NULL;
--> statement-breakpoint
UPDATE `refund_slips`
SET `source_id` = (
	SELECT ur.`id` FROM `uniform_refunds` ur
	WHERE ur.`order_id` = `refund_slips`.`order_id` AND ur.`kind` = 'withdrawal'
	ORDER BY ur.`created_at` DESC LIMIT 1
)
WHERE `kind` = 'seragam' AND `source_id` IS NULL;