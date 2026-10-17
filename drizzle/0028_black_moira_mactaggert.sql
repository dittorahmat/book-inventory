DROP INDEX `students_school_nis_idx`;--> statement-breakpoint
CREATE UNIQUE INDEX `students_school_nis_idx` ON `students` (`school_id`,`nis`);