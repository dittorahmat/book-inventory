CREATE TABLE `uniform_payments` (
	`id` text PRIMARY KEY NOT NULL,
	`order_id` text NOT NULL,
	`transfer_amount` integer NOT NULL,
	`uniform_allocation_amount` integer NOT NULL,
	`payment_proof_url` text,
	`bank_name` text,
	`reference_number` text,
	`verified_by_user_id` text,
	`verified_at` text,
	`notes` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`order_id`) REFERENCES `uniform_orders`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`verified_by_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `uniform_payments_order_idx` ON `uniform_payments` (`order_id`);--> statement-breakpoint
ALTER TABLE `student_book_orders` ADD `payment_token` text;--> statement-breakpoint
ALTER TABLE `uniform_orders` ADD `payment_token` text;--> statement-breakpoint
ALTER TABLE `uniform_orders` ADD `payment_status` text DEFAULT 'unpaid' NOT NULL;