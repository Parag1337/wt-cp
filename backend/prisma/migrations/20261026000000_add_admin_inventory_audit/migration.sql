/*
  Warnings:

  - Added the required column `role` to the `customers` table with a default value. Existing customers are assigned the `CUSTOMER` role and are NOT admins.
  - Added the required columns `stock_quantity` and `low_stock_threshold` to the `products` table with default values.
  - Added the required column `status` and optional `internal_notes` to the `inquiries` table.
  - Created the `stock_adjustments` and `order_status_history` audit tables.
*/

-- AlterTable
ALTER TABLE `customers` ADD COLUMN `role` VARCHAR(32) NOT NULL DEFAULT 'CUSTOMER';

-- AlterTable
ALTER TABLE `products` ADD COLUMN `stock_quantity` INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN `low_stock_threshold` INTEGER NOT NULL DEFAULT 5;

-- AlterTable
ALTER TABLE `inquiries` ADD COLUMN `status` VARCHAR(32) NOT NULL DEFAULT 'PENDING',
    ADD COLUMN `internal_notes` TEXT NULL;

-- CreateTable
CREATE TABLE IF NOT EXISTS `stock_adjustments` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `product_id` INTEGER NOT NULL,
    `admin_id` INTEGER NOT NULL,
    `delta` INTEGER NOT NULL,
    `reason` VARCHAR(255) NOT NULL,
    `previous_quantity` INTEGER NOT NULL,
    `new_quantity` INTEGER NOT NULL,
    `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    INDEX `stock_adjustments_product_id_idx`(`product_id`),
    INDEX `stock_adjustments_admin_id_idx`(`admin_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE IF NOT EXISTS `order_status_history` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `order_id` INTEGER NOT NULL,
    `admin_id` INTEGER NULL,
    `status` VARCHAR(32) NOT NULL,
    `note` TEXT NULL,
    `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    INDEX `order_status_history_order_id_idx`(`order_id`),
    INDEX `order_status_history_admin_id_idx`(`admin_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `stock_adjustments` ADD CONSTRAINT `stock_adjustments_product_id_fkey` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `stock_adjustments` ADD CONSTRAINT `stock_adjustments_admin_id_fkey` FOREIGN KEY (`admin_id`) REFERENCES `customers`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `order_status_history` ADD CONSTRAINT `order_status_history_order_id_fkey` FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `order_status_history` ADD CONSTRAINT `order_status_history_admin_id_fkey` FOREIGN KEY (`admin_id`) REFERENCES `customers`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE IF NOT EXISTS `webhook_events` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `provider` VARCHAR(32) NOT NULL DEFAULT 'razorpay',
    `event_id` VARCHAR(64) NOT NULL,
    `event_type` VARCHAR(64) NOT NULL,
    `status` VARCHAR(32) NOT NULL DEFAULT 'received',
    `note` TEXT NULL,
    `received_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `processed_at` TIMESTAMP(0) NULL,

    UNIQUE INDEX `webhook_events_provider_event_id`(`provider`, `event_id`),
    INDEX `webhook_events_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
