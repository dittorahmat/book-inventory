CREATE TABLE `uniform_rejects` (
	`id` text PRIMARY KEY NOT NULL,
	`variant_id` text NOT NULL,
	`size` text DEFAULT '—' NOT NULL,
	`quantity` integer NOT NULL,
	`reason` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`variant_id`) REFERENCES `uniform_variants`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `uniform_rejects_variant_idx` ON `uniform_rejects` (`variant_id`);--> statement-breakpoint
ALTER TABLE `book_items` ADD `is_rejected` integer DEFAULT false NOT NULL;