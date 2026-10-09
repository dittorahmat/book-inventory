CREATE TABLE `internal_purchase_order_items` (
	`id` text PRIMARY KEY NOT NULL,
	`internal_po_id` text NOT NULL,
	`package_id` text NOT NULL,
	`quantity_ordered` integer NOT NULL,
	`quantity_fulfilled` integer DEFAULT 0 NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`internal_po_id`) REFERENCES `internal_purchase_orders`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`package_id`) REFERENCES `book_packages`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `internal_purchase_orders` (
	`id` text PRIMARY KEY NOT NULL,
	`po_number` text NOT NULL,
	`school_id` text NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`notes` text,
	`created_by_user_id` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`school_id`) REFERENCES `schools`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`created_by_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `internal_purchase_orders_po_number_unique` ON `internal_purchase_orders` (`po_number`);--> statement-breakpoint
CREATE TABLE `internal_shipment_items` (
	`id` text PRIMARY KEY NOT NULL,
	`shipment_id` text NOT NULL,
	`package_id` text,
	`package_item_id` text,
	`book_id` text,
	`quantity` integer DEFAULT 1 NOT NULL,
	`is_outstanding_followup` integer DEFAULT false NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`shipment_id`) REFERENCES `internal_shipments`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`package_id`) REFERENCES `book_packages`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`package_item_id`) REFERENCES `package_items`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`book_id`) REFERENCES `books`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `internal_shipments` (
	`id` text PRIMARY KEY NOT NULL,
	`internal_po_id` text NOT NULL,
	`delivery_note_number` text NOT NULL,
	`shipped_date` text NOT NULL,
	`received_date` text,
	`status` text DEFAULT 'in_transit' NOT NULL,
	`shipped_by_user_id` text,
	`received_by_user_id` text,
	`notes` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`internal_po_id`) REFERENCES `internal_purchase_orders`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`shipped_by_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`received_by_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `internal_shipments_delivery_note_number_unique` ON `internal_shipments` (`delivery_note_number`);--> statement-breakpoint
CREATE TABLE `purchase_order_receipt_items` (
	`id` text PRIMARY KEY NOT NULL,
	`receipt_id` text NOT NULL,
	`book_id` text NOT NULL,
	`quantity_received` integer NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`receipt_id`) REFERENCES `purchase_order_receipts`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`book_id`) REFERENCES `books`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `purchase_order_receipts` (
	`id` text PRIMARY KEY NOT NULL,
	`purchase_order_id` text NOT NULL,
	`delivery_note_number` text NOT NULL,
	`received_date` text NOT NULL,
	`received_by_user_id` text,
	`notes` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`purchase_order_id`) REFERENCES `purchase_orders`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`received_by_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `vendor_return_items` (
	`id` text PRIMARY KEY NOT NULL,
	`vendor_return_id` text NOT NULL,
	`book_id` text NOT NULL,
	`quantity` integer NOT NULL,
	`reason` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`vendor_return_id`) REFERENCES `vendor_returns`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`book_id`) REFERENCES `books`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `vendor_returns` (
	`id` text PRIMARY KEY NOT NULL,
	`return_number` text NOT NULL,
	`supplier_id` text NOT NULL,
	`purchase_order_id` text,
	`status` text DEFAULT 'draft' NOT NULL,
	`reason` text NOT NULL,
	`credit_note_amount` integer DEFAULT 0 NOT NULL,
	`handled_by_user_id` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`supplier_id`) REFERENCES `suppliers`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`purchase_order_id`) REFERENCES `purchase_orders`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`handled_by_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `vendor_returns_return_number_unique` ON `vendor_returns` (`return_number`);--> statement-breakpoint
ALTER TABLE `book_returns` ADD `refund_amount` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `student_book_orders` ADD `finance_handover_approved` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `student_book_orders` ADD `discount_amount` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `student_book_orders` ADD `discretion_type` text DEFAULT 'none' NOT NULL;--> statement-breakpoint
ALTER TABLE `student_book_orders` ADD `discretion_notes` text;--> statement-breakpoint
ALTER TABLE `student_book_orders` ADD `discretion_by_user_id` text REFERENCES users(id);