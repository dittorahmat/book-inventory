CREATE TABLE `book_package_schools` (
	`package_id` text NOT NULL,
	`school_id` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`package_id`) REFERENCES `book_packages`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`school_id`) REFERENCES `schools`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `book_package_schools_school_idx` ON `book_package_schools` (`school_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `book_package_schools_package_school_unq` ON `book_package_schools` (`package_id`,`school_id`);--> statement-breakpoint
ALTER TABLE `suppliers` ADD `type` text DEFAULT 'book' NOT NULL;