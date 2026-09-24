CREATE TABLE `book_package_items` (
	`id` text PRIMARY KEY NOT NULL,
	`package_id` text NOT NULL,
	`book_id` text NOT NULL,
	`quantity` integer DEFAULT 1 NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`package_id`) REFERENCES `book_packages`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`book_id`) REFERENCES `books`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `book_packages` (
	`id` text PRIMARY KEY NOT NULL,
	`code` text NOT NULL,
	`name` text NOT NULL,
	`grade_level` text NOT NULL,
	`curriculum_type` text DEFAULT 'international' NOT NULL,
	`academic_year` text NOT NULL,
	`price` integer DEFAULT 0 NOT NULL,
	`description` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `book_packages_code_unique` ON `book_packages` (`code`);--> statement-breakpoint
CREATE TABLE `book_returns` (
	`id` text PRIMARY KEY NOT NULL,
	`order_id` text NOT NULL,
	`student_id` text NOT NULL,
	`defective_book_id` text NOT NULL,
	`replacement_book_item_id` text,
	`reason` text NOT NULL,
	`photo_proof_url` text,
	`status` text DEFAULT 'reported' NOT NULL,
	`handled_by_user_id` text,
	`resolved_at` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`order_id`) REFERENCES `student_book_orders`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`student_id`) REFERENCES `students`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`defective_book_id`) REFERENCES `books`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`replacement_book_item_id`) REFERENCES `book_items`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`handled_by_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `order_payments` (
	`id` text PRIMARY KEY NOT NULL,
	`order_id` text NOT NULL,
	`transfer_amount` integer NOT NULL,
	`book_allocation_amount` integer NOT NULL,
	`payment_proof_url` text,
	`bank_name` text,
	`reference_number` text,
	`verified_by_user_id` text,
	`verified_at` text,
	`notes` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`order_id`) REFERENCES `student_book_orders`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`verified_by_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `package_items` (
	`id` text PRIMARY KEY NOT NULL,
	`package_id` text NOT NULL,
	`current_school_id` text NOT NULL,
	`barcode` text NOT NULL,
	`status` text DEFAULT 'in_stock' NOT NULL,
	`notes` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`package_id`) REFERENCES `book_packages`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`current_school_id`) REFERENCES `schools`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `package_items_barcode_unique` ON `package_items` (`barcode`);--> statement-breakpoint
CREATE TABLE `purchase_order_items` (
	`id` text PRIMARY KEY NOT NULL,
	`purchase_order_id` text NOT NULL,
	`book_id` text NOT NULL,
	`quantity_ordered` integer NOT NULL,
	`quantity_received` integer DEFAULT 0 NOT NULL,
	`unit_price` integer DEFAULT 0 NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`purchase_order_id`) REFERENCES `purchase_orders`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`book_id`) REFERENCES `books`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `purchase_orders` (
	`id` text PRIMARY KEY NOT NULL,
	`po_number` text NOT NULL,
	`supplier_id` text NOT NULL,
	`target_school_id` text NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`order_date` text NOT NULL,
	`expected_arrival_date` text,
	`total_amount` integer DEFAULT 0 NOT NULL,
	`notes` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`supplier_id`) REFERENCES `suppliers`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`target_school_id`) REFERENCES `schools`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `purchase_orders_po_number_unique` ON `purchase_orders` (`po_number`);--> statement-breakpoint
CREATE TABLE `student_book_orders` (
	`id` text PRIMARY KEY NOT NULL,
	`order_number` text NOT NULL,
	`student_id` text NOT NULL,
	`school_id` text NOT NULL,
	`package_id` text,
	`order_type` text DEFAULT 'regular' NOT NULL,
	`payment_status` text DEFAULT 'unpaid' NOT NULL,
	`fulfillment_status` text DEFAULT 'waiting_preparation' NOT NULL,
	`total_amount` integer DEFAULT 0 NOT NULL,
	`paid_amount` integer DEFAULT 0 NOT NULL,
	`assigned_package_item_id` text,
	`handover_delivery_number` text,
	`handover_date` text,
	`handover_recipient` text,
	`scholarship_proof_url` text,
	`notes` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`student_id`) REFERENCES `students`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`school_id`) REFERENCES `schools`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`package_id`) REFERENCES `book_packages`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`assigned_package_item_id`) REFERENCES `package_items`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `student_book_orders_order_number_unique` ON `student_book_orders` (`order_number`);--> statement-breakpoint
CREATE TABLE `students` (
	`id` text PRIMARY KEY NOT NULL,
	`school_id` text NOT NULL,
	`nis` text NOT NULL,
	`name` text NOT NULL,
	`gender` text,
	`grade_level` text NOT NULL,
	`curriculum_type` text DEFAULT 'international' NOT NULL,
	`academic_year` text NOT NULL,
	`parent_name` text,
	`parent_email` text,
	`parent_phone` text,
	`status` text DEFAULT 'active' NOT NULL,
	`is_scholarship` integer DEFAULT false NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`school_id`) REFERENCES `schools`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `suppliers` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`code` text NOT NULL,
	`contact_person` text,
	`email` text,
	`phone` text,
	`address` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `suppliers_code_unique` ON `suppliers` (`code`);--> statement-breakpoint
CREATE TABLE `system_settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL,
	`description` text,
	`updated_at` text NOT NULL
);
