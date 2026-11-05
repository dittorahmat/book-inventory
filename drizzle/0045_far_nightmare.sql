ALTER TABLE `book_packages` ADD COLUMN `stream` text;--> statement-breakpoint
ALTER TABLE `book_packages` ADD COLUMN `intake_type` text DEFAULT 'baru' NOT NULL;--> statement-breakpoint
ALTER TABLE `students` ADD COLUMN `stream` text;--> statement-breakpoint
ALTER TABLE `students` ADD COLUMN `intake_type` text DEFAULT 'baru' NOT NULL;
