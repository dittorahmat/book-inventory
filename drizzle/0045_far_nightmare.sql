PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_book_packages` (
	`id` text PRIMARY KEY NOT NULL,
	`code` text NOT NULL,
	`name` text NOT NULL,
	`grade_level` text NOT NULL,
	`curriculum_type` text DEFAULT 'INTER' NOT NULL,
	`stream` text,
	`intake_type` text DEFAULT 'baru' NOT NULL,
	`academic_year` text NOT NULL,
	`price` integer DEFAULT 0 NOT NULL,
	`description` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_book_packages`("id", "code", "name", "grade_level", "curriculum_type", "stream", "intake_type", "academic_year", "price", "description", "created_at", "updated_at") SELECT "id", "code", "name", "grade_level", "curriculum_type", "stream", "intake_type", "academic_year", "price", "description", "created_at", "updated_at" FROM `book_packages`;--> statement-breakpoint
DROP TABLE `book_packages`;--> statement-breakpoint
ALTER TABLE `__new_book_packages` RENAME TO `book_packages`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `book_packages_code_unique` ON `book_packages` (`code`);--> statement-breakpoint
CREATE TABLE `__new_students` (
	`id` text PRIMARY KEY NOT NULL,
	`school_id` text NOT NULL,
	`nis` text NOT NULL,
	`name` text NOT NULL,
	`gender` text,
	`grade_level` text NOT NULL,
	`curriculum_type` text DEFAULT 'INTER' NOT NULL,
	`stream` text,
	`intake_type` text DEFAULT 'baru' NOT NULL,
	`academic_year` text NOT NULL,
	`parent_name` text,
	`parent_email` text,
	`parent_phone` text,
	`status` text DEFAULT 'active' NOT NULL,
	`is_scholarship` integer DEFAULT false NOT NULL,
	`has_taken_package` integer DEFAULT false NOT NULL,
	`package_received_at` text,
	`has_taken_uniform` integer DEFAULT false NOT NULL,
	`uniform_received_at` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`school_id`) REFERENCES `schools`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_students`("id", "school_id", "nis", "name", "gender", "grade_level", "curriculum_type", "stream", "intake_type", "academic_year", "parent_name", "parent_email", "parent_phone", "status", "is_scholarship", "has_taken_package", "package_received_at", "has_taken_uniform", "uniform_received_at", "created_at", "updated_at") SELECT "id", "school_id", "nis", "name", "gender", "grade_level", "curriculum_type", "stream", "intake_type", "academic_year", "parent_name", "parent_email", "parent_phone", "status", "is_scholarship", "has_taken_package", "package_received_at", "has_taken_uniform", "uniform_received_at", "created_at", "updated_at" FROM `students`;--> statement-breakpoint
DROP TABLE `students`;--> statement-breakpoint
ALTER TABLE `__new_students` RENAME TO `students`;--> statement-breakpoint
CREATE INDEX `students_school_status_name_idx` ON `students` (`school_id`,`status`,`name`);--> statement-breakpoint
CREATE UNIQUE INDEX `students_school_nis_idx` ON `students` (`school_id`,`nis`);