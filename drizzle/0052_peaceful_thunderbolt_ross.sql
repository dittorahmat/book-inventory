ALTER TABLE `teacher_handbook_orders` ADD `settlement_status` text DEFAULT 'unpaid' NOT NULL;--> statement-breakpoint
ALTER TABLE `teacher_handbook_orders` ADD `settlement_amount` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `teacher_handbook_orders` ADD `paid_amount` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `teacher_handbook_orders` ADD `payment_proof_url` text;--> statement-breakpoint
ALTER TABLE `teacher_handbook_orders` ADD `settled_at` text;