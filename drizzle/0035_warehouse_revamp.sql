ALTER TABLE `internal_shipments` ADD `delivery_proof_url` text;--> statement-breakpoint
ALTER TABLE `student_book_orders` ADD `scholarship_discount_pct` integer;--> statement-breakpoint
ALTER TABLE `student_book_orders` ADD `scholarship_discount_approved_at` text;--> statement-breakpoint
ALTER TABLE `student_book_orders` ADD `scholarship_discount_approved_by_user_id` text REFERENCES users(id);--> statement-breakpoint
ALTER TABLE `student_book_orders` ADD `first_payment_proof_url` text;--> statement-breakpoint
ALTER TABLE `student_book_orders` ADD `first_payment_verified_at` text;--> statement-breakpoint
ALTER TABLE `student_book_orders` ADD `first_payment_verified_by_user_id` text REFERENCES users(id);--> statement-breakpoint
ALTER TABLE `students` ADD `package_received_at` text;--> statement-breakpoint
ALTER TABLE `students` ADD `uniform_received_at` text;