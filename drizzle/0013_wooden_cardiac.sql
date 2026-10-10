CREATE INDEX `book_items_school_idx` ON `book_items` (`current_school_id`);--> statement-breakpoint
CREATE INDEX `package_items_school_idx` ON `package_items` (`current_school_id`);--> statement-breakpoint
CREATE INDEX `purchase_orders_target_school_idx` ON `purchase_orders` (`target_school_id`);