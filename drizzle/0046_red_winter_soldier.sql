CREATE TABLE `book_stocks` (
	`id` text PRIMARY KEY NOT NULL,
	`book_id` text NOT NULL,
	`school_id` text NOT NULL,
	`available_quantity` integer DEFAULT 0 NOT NULL,
	`reserved_quantity` integer DEFAULT 0 NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`book_id`) REFERENCES `books`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`school_id`) REFERENCES `schools`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `book_stocks_book_idx` ON `book_stocks` (`book_id`);--> statement-breakpoint
CREATE INDEX `book_stocks_school_idx` ON `book_stocks` (`school_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `book_stocks_book_school_unq` ON `book_stocks` (`book_id`,`school_id`);--> statement-breakpoint
CREATE TABLE `package_stocks` (
	`id` text PRIMARY KEY NOT NULL,
	`package_id` text NOT NULL,
	`school_id` text NOT NULL,
	`available_quantity` integer DEFAULT 0 NOT NULL,
	`reserved_quantity` integer DEFAULT 0 NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`package_id`) REFERENCES `book_packages`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`school_id`) REFERENCES `schools`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `package_stocks_package_idx` ON `package_stocks` (`package_id`);--> statement-breakpoint
CREATE INDEX `package_stocks_school_idx` ON `package_stocks` (`school_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `package_stocks_package_school_unq` ON `package_stocks` (`package_id`,`school_id`);--> statement-breakpoint
CREATE TABLE `stock_adjustments` (
	`id` text PRIMARY KEY NOT NULL,
	`school_id` text NOT NULL,
	`item_type` text DEFAULT 'loose' NOT NULL,
	`book_id` text,
	`package_id` text,
	`quantity` integer NOT NULL,
	`reason` text NOT NULL,
	`reference_document_number` text,
	`notes` text,
	`adjusted_by_user_id` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`school_id`) REFERENCES `schools`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`book_id`) REFERENCES `books`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`package_id`) REFERENCES `book_packages`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`adjusted_by_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `stock_adj_school_idx` ON `stock_adjustments` (`school_id`);--> statement-breakpoint
CREATE INDEX `stock_adj_created_idx` ON `stock_adjustments` (`created_at`);--> statement-breakpoint
ALTER TABLE `transfer_shipment_items` ADD `book_id` text REFERENCES books(id);