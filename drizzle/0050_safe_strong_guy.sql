CREATE TABLE `teacher_handbook_allocations` (
	`id` text PRIMARY KEY NOT NULL,
	`order_id` text NOT NULL,
	`book_id` text NOT NULL,
	`teacher_name` text NOT NULL,
	`grade_level` text,
	`rombel` text,
	`subject` text,
	`quantity` integer NOT NULL,
	`delivered_quantity` integer DEFAULT 0 NOT NULL,
	`handed_over_quantity` integer DEFAULT 0 NOT NULL,
	`handed_over_at` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`order_id`) REFERENCES `teacher_handbook_orders`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`book_id`) REFERENCES `books`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `teacher_handbook_allocations_order_idx` ON `teacher_handbook_allocations` (`order_id`);--> statement-breakpoint
CREATE INDEX `teacher_handbook_allocations_book_idx` ON `teacher_handbook_allocations` (`book_id`);--> statement-breakpoint
CREATE TABLE `teacher_handbook_orders` (
	`id` text PRIMARY KEY NOT NULL,
	`order_number` text NOT NULL,
	`school_id` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`notes` text,
	`created_by` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`school_id`) REFERENCES `schools`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `teacher_handbook_orders_order_number_unique` ON `teacher_handbook_orders` (`order_number`);--> statement-breakpoint
CREATE INDEX `teacher_handbook_orders_school_idx` ON `teacher_handbook_orders` (`school_id`);--> statement-breakpoint
CREATE INDEX `teacher_handbook_orders_status_idx` ON `teacher_handbook_orders` (`status`);