CREATE TABLE `notifications` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`title` text NOT NULL,
	`message` text NOT NULL,
	`type` text NOT NULL,
	`is_read` integer DEFAULT 0 NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_enrollments` (
	`id` text PRIMARY KEY NOT NULL,
	`status` text NOT NULL,
	`course_id` text NOT NULL,
	`user_id` text NOT NULL,
	`instructor_id` text NOT NULL,
	`section` text NOT NULL,
	`schedule_array` text NOT NULL,
	`date_enrolled` text,
	`date_requested` text NOT NULL,
	`grade` real,
	`remark` text,
	FOREIGN KEY (`course_id`) REFERENCES `courses`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`instructor_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_enrollments`("id", "status", "course_id", "user_id", "instructor_id", "section", "schedule_array", "date_enrolled", "date_requested", "grade", "remark") SELECT "id", "status", "course_id", "user_id", "instructor_id", "section", "schedule_array", "date_enrolled", "date_requested", "grade", "remark" FROM `enrollments`;--> statement-breakpoint
DROP TABLE `enrollments`;--> statement-breakpoint
ALTER TABLE `__new_enrollments` RENAME TO `enrollments`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE TABLE `__new_courses` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`description` text,
	`capacity` integer NOT NULL,
	`lab_credits` real NOT NULL,
	`lec_credits` real NOT NULL,
	`instructor_id` text NOT NULL,
	`prerequisites` text NOT NULL,
	FOREIGN KEY (`instructor_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_courses`("id", "title", "description", "capacity", "lab_credits", "lec_credits", "instructor_id", "prerequisites") SELECT "id", "title", "description", "capacity", "lab_credits", "lec_credits", "instructor_id", "prerequisites" FROM `courses`;--> statement-breakpoint
DROP TABLE `courses`;--> statement-breakpoint
ALTER TABLE `__new_courses` RENAME TO `courses`;--> statement-breakpoint
ALTER TABLE `users` ADD `college` text;--> statement-breakpoint
ALTER TABLE `users` ADD `program` text;--> statement-breakpoint
ALTER TABLE `users` ADD `campus` text;