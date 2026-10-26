-- DropIndex
DROP INDEX `orders_status_idx` ON `orders`;

-- AlterTable
ALTER TABLE `cart_items` ALTER COLUMN `updated_at` DROP DEFAULT;

-- AlterTable
ALTER TABLE `carts` ALTER COLUMN `updated_at` DROP DEFAULT;

-- AlterTable
ALTER TABLE `orders` ALTER COLUMN `updated_at` DROP DEFAULT;
