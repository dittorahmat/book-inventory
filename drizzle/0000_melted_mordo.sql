CREATE TABLE `book_items` (
	`id` text PRIMARY KEY NOT NULL,
	`book_id` text NOT NULL,
	`current_school_id` text NOT NULL,
	`barcode` text NOT NULL,
	`condition` text DEFAULT 'new' NOT NULL,
	`status` text DEFAULT 'in_stock' NOT NULL,
	`notes` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`book_id`) REFERENCES `books`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`current_school_id`) REFERENCES `schools`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `book_items_barcode_unique` ON `book_items` (`barcode`);--> statement-breakpoint
CREATE TABLE `books` (
	`id` text PRIMARY KEY NOT NULL,
	`isbn` text NOT NULL,
	`title` text NOT NULL,
	`author` text NOT NULL,
	`publisher` text NOT NULL,
	`publish_year` integer,
	`category` text,
	`description` text,
	`cover_url` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `books_isbn_unique` ON `books` (`isbn`);--> statement-breakpoint
CREATE TABLE `schools` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`code` text NOT NULL,
	`type` text DEFAULT 'branch' NOT NULL,
	`address` text,
	`phone` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `schools_code_unique` ON `schools` (`code`);--> statement-breakpoint
CREATE TABLE `transfer_shipment_items` (
	`id` text PRIMARY KEY NOT NULL,
	`shipment_id` text NOT NULL,
	`book_item_id` text NOT NULL,
	`received_condition` text,
	`notes` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`shipment_id`) REFERENCES `transfer_shipments`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`book_item_id`) REFERENCES `book_items`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `transfer_shipments` (
	`id` text PRIMARY KEY NOT NULL,
	`shipment_number` text NOT NULL,
	`from_school_id` text NOT NULL,
	`to_school_id` text NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`dispatched_at` text,
	`received_at` text,
	`notes` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`from_school_id`) REFERENCES `schools`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`to_school_id`) REFERENCES `schools`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `transfer_shipments_shipment_number_unique` ON `transfer_shipments` (`shipment_number`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`school_id` text,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`role` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`school_id`) REFERENCES `schools`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);