/*
  Warnings:

  - Added the required column `address_line1` to the `orders` table without a default value. This is not possible if the table is not empty.
  - Added the required column `city` to the `orders` table without a default value. This is not possible if the table is not empty.
  - Added the required column `full_name` to the `orders` table without a default value. This is not possible if the table is not empty.
  - Added the required column `phone` to the `orders` table without a default value. This is not possible if the table is not empty.
  - Added the required column `pincode` to the `orders` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE `orders` ADD COLUMN `address_line1` VARCHAR(255) NOT NULL,
    ADD COLUMN `address_line2` VARCHAR(255) NULL,
    ADD COLUMN `city` VARCHAR(100) NOT NULL,
    ADD COLUMN `full_name` VARCHAR(120) NOT NULL,
    ADD COLUMN `payment_method` VARCHAR(32) NOT NULL DEFAULT 'cod',
    ADD COLUMN `payment_ref` VARCHAR(255) NULL,
    ADD COLUMN `payment_status` VARCHAR(32) NOT NULL DEFAULT 'pending',
    ADD COLUMN `phone` VARCHAR(20) NOT NULL,
    ADD COLUMN `pincode` VARCHAR(10) NOT NULL,
    ADD COLUMN `razorpay_order_id` VARCHAR(255) NULL,
    ADD COLUMN `state` VARCHAR(100) NOT NULL DEFAULT 'Maharashtra';
