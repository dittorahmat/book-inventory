CREATE TABLE `school_grade_allowed_books` (
	`id` text PRIMARY KEY NOT NULL,
	`school_id` text NOT NULL,
	`grade_level` text NOT NULL,
	`book_id` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`school_id`) REFERENCES `schools`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`book_id`) REFERENCES `books`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `school_grade_allowed_books_lookup_idx` ON `school_grade_allowed_books` (`school_id`,`grade_level`);--> statement-breakpoint
CREATE UNIQUE INDEX `school_grade_allowed_books_unq` ON `school_grade_allowed_books` (`school_id`,`grade_level`,`book_id`);