ALTER TABLE `books` ADD `buy_price` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `books` ADD `sell_price` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `purchase_order_items` ADD `discount_percent` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `purchase_orders` ADD `subtotal_gross` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `purchase_orders` ADD `discount_total` integer DEFAULT 0 NOT NULL;