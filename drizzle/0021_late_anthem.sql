CREATE TABLE `book_suppliers` (
	`book_id` text NOT NULL,
	`supplier_id` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`book_id`) REFERENCES `books`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`supplier_id`) REFERENCES `suppliers`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `book_suppliers_supplier_idx` ON `book_suppliers` (`supplier_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `book_suppliers_book_supplier_unq` ON `book_suppliers` (`book_id`,`supplier_id`);--> statement-breakpoint
ALTER TABLE `books` ADD `public_title` text;