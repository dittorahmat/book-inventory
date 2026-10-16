ALTER TABLE `student_book_orders` ADD `shipping_cost` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `student_book_orders` ADD `shipping_resi` text;--> statement-breakpoint
ALTER TABLE `student_book_orders` ADD `invoice_sent_at` text;--> statement-breakpoint
ALTER TABLE `uniform_orders` ADD `shipping_cost` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `uniform_orders` ADD `shipping_resi` text;--> statement-breakpoint
ALTER TABLE `uniform_orders` ADD `invoice_sent_at` text;