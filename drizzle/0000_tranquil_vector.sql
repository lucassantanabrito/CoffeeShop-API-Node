CREATE TABLE `drink_options` (
	`type` text PRIMARY KEY NOT NULL,
	`label` text NOT NULL,
	`price` real NOT NULL,
	`has_milk` integer DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE `order_items` (
	`id` text PRIMARY KEY NOT NULL,
	`order_id` integer NOT NULL,
	`type` text NOT NULL,
	`label` text NOT NULL,
	`quantity` integer NOT NULL,
	`milk` text NOT NULL,
	`notes` text NOT NULL,
	`price` real NOT NULL,
	FOREIGN KEY (`order_id`) REFERENCES `orders`(`seq`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `orders` (
	`seq` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`customer_name` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`total` real NOT NULL,
	`created_at` integer NOT NULL
);
