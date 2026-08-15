CREATE TABLE `followUpPreferences` (
	`id` int AUTO_INCREMENT NOT NULL,
	`storyRunId` int NOT NULL,
	`isOptedIn` boolean NOT NULL DEFAULT false,
	`inactivityHours` int NOT NULL DEFAULT 48,
	`lastFollowUpAt` timestamp,
	`schedule_cron_task_uid` varchar(65),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `followUpPreferences_id` PRIMARY KEY(`id`),
	CONSTRAINT `followUpPreferences_storyRunId_unique` UNIQUE(`storyRunId`)
);
--> statement-breakpoint
CREATE TABLE `storyBotAccess` (
	`id` int AUTO_INCREMENT NOT NULL,
	`storyBotId` int NOT NULL,
	`userId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `storyBotAccess_id` PRIMARY KEY(`id`),
	CONSTRAINT `storyBotAccess_bot_user_unique` UNIQUE(`storyBotId`,`userId`)
);
--> statement-breakpoint
CREATE TABLE `storyBots` (
	`id` int AUTO_INCREMENT NOT NULL,
	`ownerId` int NOT NULL,
	`name` varchar(120) NOT NULL,
	`description` text NOT NULL,
	`avatarSymbol` varchar(12) NOT NULL DEFAULT '✦',
	`behavioralInstruction` text NOT NULL,
	`storyPremise` text NOT NULL,
	`roleOptions` json NOT NULL,
	`worldRules` text NOT NULL,
	`endingConditions` text NOT NULL,
	`visibility` enum('public','private') NOT NULL DEFAULT 'private',
	`allowTelegramMedia` boolean NOT NULL DEFAULT false,
	`isArchived` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `storyBots_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `storyMessages` (
	`id` int AUTO_INCREMENT NOT NULL,
	`storyRunId` int NOT NULL,
	`role` enum('user','assistant','system') NOT NULL,
	`content` text NOT NULL,
	`channel` enum('web','telegram','system') NOT NULL,
	`sequence` int NOT NULL,
	`mediaKind` enum('none','sticker','gif') NOT NULL DEFAULT 'none',
	`mediaReference` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `storyMessages_id` PRIMARY KEY(`id`),
	CONSTRAINT `storyMessages_run_sequence_unique` UNIQUE(`storyRunId`,`sequence`)
);
--> statement-breakpoint
CREATE TABLE `storyRuns` (
	`id` int AUTO_INCREMENT NOT NULL,
	`storyBotId` int NOT NULL,
	`participantId` int NOT NULL,
	`title` varchar(180) NOT NULL,
	`selectedRole` varchar(160) NOT NULL,
	`status` enum('active','ended','archived') NOT NULL DEFAULT 'active',
	`stateSummary` text NOT NULL,
	`stateJson` json NOT NULL,
	`endingTitle` varchar(180),
	`endingText` text,
	`messageCount` int NOT NULL DEFAULT 0,
	`lastInteractionAt` timestamp NOT NULL DEFAULT (now()),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `storyRuns_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `telegramLinks` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`telegramUserId` varchar(32),
	`telegramChatId` varchar(32),
	`linkCodeHash` varchar(128),
	`linkCodeExpiresAt` timestamp,
	`activeStoryRunId` int,
	`linkedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `telegramLinks_id` PRIMARY KEY(`id`),
	CONSTRAINT `telegramLinks_userId_unique` UNIQUE(`userId`),
	CONSTRAINT `telegramLinks_telegramUserId_unique` UNIQUE(`telegramUserId`)
);
--> statement-breakpoint
CREATE TABLE `telegramUpdates` (
	`id` int AUTO_INCREMENT NOT NULL,
	`updateId` varchar(32) NOT NULL,
	`processedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `telegramUpdates_id` PRIMARY KEY(`id`),
	CONSTRAINT `telegramUpdates_updateId_unique` UNIQUE(`updateId`)
);
--> statement-breakpoint
CREATE TABLE `userIntegrationSettings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`grokApiKeyCiphertext` text,
	`grokModel` varchar(80) NOT NULL DEFAULT 'grok-4.6',
	`telegramBotTokenCiphertext` text,
	`telegramWebhookSecretCiphertext` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `userIntegrationSettings_id` PRIMARY KEY(`id`),
	CONSTRAINT `userIntegrationSettings_userId_unique` UNIQUE(`userId`)
);
--> statement-breakpoint
ALTER TABLE `followUpPreferences` ADD CONSTRAINT `followUpPreferences_storyRunId_storyRuns_id_fk` FOREIGN KEY (`storyRunId`) REFERENCES `storyRuns`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `storyBotAccess` ADD CONSTRAINT `storyBotAccess_storyBotId_storyBots_id_fk` FOREIGN KEY (`storyBotId`) REFERENCES `storyBots`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `storyBotAccess` ADD CONSTRAINT `storyBotAccess_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `storyBots` ADD CONSTRAINT `storyBots_ownerId_users_id_fk` FOREIGN KEY (`ownerId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `storyMessages` ADD CONSTRAINT `storyMessages_storyRunId_storyRuns_id_fk` FOREIGN KEY (`storyRunId`) REFERENCES `storyRuns`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `storyRuns` ADD CONSTRAINT `storyRuns_storyBotId_storyBots_id_fk` FOREIGN KEY (`storyBotId`) REFERENCES `storyBots`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `storyRuns` ADD CONSTRAINT `storyRuns_participantId_users_id_fk` FOREIGN KEY (`participantId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `telegramLinks` ADD CONSTRAINT `telegramLinks_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `telegramLinks` ADD CONSTRAINT `telegramLinks_activeStoryRunId_storyRuns_id_fk` FOREIGN KEY (`activeStoryRunId`) REFERENCES `storyRuns`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `userIntegrationSettings` ADD CONSTRAINT `userIntegrationSettings_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `followUpPreferences_schedule_uid_idx` ON `followUpPreferences` (`schedule_cron_task_uid`);--> statement-breakpoint
CREATE INDEX `storyBotAccess_userId_idx` ON `storyBotAccess` (`userId`);--> statement-breakpoint
CREATE INDEX `storyBots_ownerId_idx` ON `storyBots` (`ownerId`);--> statement-breakpoint
CREATE INDEX `storyBots_visibility_idx` ON `storyBots` (`visibility`);--> statement-breakpoint
CREATE INDEX `storyMessages_run_created_idx` ON `storyMessages` (`storyRunId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `storyRuns_participantId_idx` ON `storyRuns` (`participantId`);--> statement-breakpoint
CREATE INDEX `storyRuns_storyBotId_idx` ON `storyRuns` (`storyBotId`);--> statement-breakpoint
CREATE INDEX `storyRuns_status_updated_idx` ON `storyRuns` (`participantId`,`status`,`updatedAt`);--> statement-breakpoint
CREATE INDEX `telegramLinks_telegramUserId_idx` ON `telegramLinks` (`telegramUserId`);