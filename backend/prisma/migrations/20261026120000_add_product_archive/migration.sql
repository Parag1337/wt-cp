-- Archive products instead of deleting them when they appear in historical orders.
-- Archived products are hidden from the storefront and cannot be added to a cart.
ALTER TABLE `products` ADD COLUMN `archived_at` TIMESTAMP(0) NULL;

CREATE INDEX `products_archived_at_idx` ON `products`(`archived_at`);
