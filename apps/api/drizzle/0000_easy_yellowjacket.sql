CREATE TABLE `courses` (
	`id` text PRIMARY KEY NOT NULL,
	`code` text NOT NULL,
	`title` text NOT NULL,
	`description` text,
	`instructor_id` text NOT NULL,
	`capacity` integer DEFAULT 30 NOT NULL,
	FOREIGN KEY (`instructor_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `courses_code_unique` ON `courses` (`code`);--> statement-breakpoint
CREATE TABLE `enrollments` (
	`id` text PRIMARY KEY NOT NULL,
	`student_id` text NOT NULL,
	`course_id` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`grade` real,
	FOREIGN KEY (`student_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`course_id`) REFERENCES `courses`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`username` text NOT NULL,
	`password_hash` text NOT NULL,
	`name` text NOT NULL,
	`role` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_username_unique` ON `users` (`username`);