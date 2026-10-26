-- Durable payment and ordering idempotency (production-readiness work).
-- Additive only: no existing tables or columns are modified or dropped.

-- AlterTable: client-generated idempotency key per checkout attempt.
-- Unique per customer, so a duplicate submission replays the original order.
ALTER TABLE `orders` ADD COLUMN `idempotency_key` VARCHAR(64) NULL;

-- CreateTable: provider webhook events. One row per provider event id; the
-- unique (provider, event_id) index is the durable idempotency guarantee for
-- Razorpay redeliveries.
CREATE TABLE `webhook_events` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `provider` VARCHAR(32) NOT NULL DEFAULT 'razorpay',
    `event_id` VARCHAR(64) NOT NULL,
    `event_type` VARCHAR(64) NOT NULL,
    `status` VARCHAR(32) NOT NULL DEFAULT 'received',
    `note` TEXT NULL,
    `received_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `processed_at` TIMESTAMP(0) NULL,

    INDEX `webhook_events_status_idx`(`status`),
    UNIQUE INDEX `webhook_events_provider_event_id`(`provider`, `event_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex: composite unique key; existing rows keep NULL keys, which are
-- never in conflict for MySQL composite unique indexes.
CREATE UNIQUE INDEX `orders_customer_idempotency_key` ON `orders`(`customer_id`, `idempotency_key`);
