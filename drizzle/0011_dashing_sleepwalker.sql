CREATE INDEX `returns_status_idx` ON `book_returns` (`status`);--> statement-breakpoint
CREATE INDEX `returns_order_idx` ON `book_returns` (`order_id`);--> statement-breakpoint
CREATE INDEX `orders_school_number_idx` ON `student_book_orders` (`school_id`,`order_number`);--> statement-breakpoint
CREATE INDEX `orders_school_payment_fulfillment_idx` ON `student_book_orders` (`school_id`,`payment_status`,`fulfillment_status`);--> statement-breakpoint
CREATE INDEX `students_school_status_name_idx` ON `students` (`school_id`,`status`,`name`);--> statement-breakpoint
CREATE INDEX `students_school_nis_idx` ON `students` (`school_id`,`nis`);