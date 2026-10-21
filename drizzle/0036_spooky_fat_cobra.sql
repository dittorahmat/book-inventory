CREATE TABLE `term_reconciliation_items` (
	`id` text PRIMARY KEY NOT NULL,
	`reconciliation_id` text NOT NULL,
	`item_type` text DEFAULT 'package' NOT NULL,
	`package_id` text,
	`book_id` text,
	`total_inbound` integer DEFAULT 0 NOT NULL,
	`total_distributed` integer DEFAULT 0 NOT NULL,
	`system_remaining` integer DEFAULT 0 NOT NULL,
	`physical_remaining` integer DEFAULT 0 NOT NULL,
	`discrepancy_quantity` integer DEFAULT 0 NOT NULL,
	`unit_price` integer DEFAULT 0 NOT NULL,
	`total_loss_amount` integer DEFAULT 0 NOT NULL,
	`notes` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`reconciliation_id`) REFERENCES `term_reconciliations`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`package_id`) REFERENCES `book_packages`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`book_id`) REFERENCES `books`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `term_reconciliation_items_recon_idx` ON `term_reconciliation_items` (`reconciliation_id`);--> statement-breakpoint
CREATE INDEX `term_reconciliation_items_package_idx` ON `term_reconciliation_items` (`package_id`);--> statement-breakpoint
CREATE INDEX `term_reconciliation_items_book_idx` ON `term_reconciliation_items` (`book_id`);--> statement-breakpoint
CREATE TABLE `term_reconciliations` (
	`id` text PRIMARY KEY NOT NULL,
	`reconciliation_number` text NOT NULL,
	`school_id` text NOT NULL,
	`academic_year` text NOT NULL,
	`term` text NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`notes` text,
	`total_inbound` integer DEFAULT 0 NOT NULL,
	`total_distributed` integer DEFAULT 0 NOT NULL,
	`total_system_remaining` integer DEFAULT 0 NOT NULL,
	`total_physical_remaining` integer DEFAULT 0 NOT NULL,
	`total_discrepancy` integer DEFAULT 0 NOT NULL,
	`total_loss_amount` integer DEFAULT 0 NOT NULL,
	`created_by_user_id` text,
	`finalized_at` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`school_id`) REFERENCES `schools`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`created_by_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `term_reconciliations_reconciliation_number_unique` ON `term_reconciliations` (`reconciliation_number`);--> statement-breakpoint
CREATE INDEX `term_reconciliations_school_idx` ON `term_reconciliations` (`school_id`);--> statement-breakpoint
CREATE INDEX `term_reconciliations_school_period_idx` ON `term_reconciliations` (`school_id`,`academic_year`,`term`);--> statement-breakpoint
CREATE INDEX `term_reconciliations_status_idx` ON `term_reconciliations` (`status`);
