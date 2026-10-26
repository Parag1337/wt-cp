-- Durable payment and ordering idempotency (production-readiness work).
-- Additive only: no existing tables or columns are modified or dropped.

-- AlterTable: client-generated idempotency key per checkout attempt.
-- Unique per customer, so a duplicate submission replays the original order.
ALTER TABLE `orders` ADD COLUMN `idempotency_key` VARCHAR(64) NULL;

-- CreateTable removed 2026-10-27 (approved minimal fix): `webhook_events` was
-- already created by 20261026000000_add_admin_inventory_audit with an identical
-- definition (same columns, status index, unique (provider, event_id)). The
-- duplicated CREATE TABLE made every fresh `prisma migrate deploy` fail with
-- MySQL 1050. Databases that applied this migration earlier keep their recorded
-- checksum row; `migrate deploy` skips applied migrations by name, so the
-- corrected content only affects future fresh provisioning.

-- CreateIndex: composite unique key; existing rows keep NULL keys, which are
-- never in conflict for MySQL composite unique indexes.
CREATE UNIQUE INDEX `orders_customer_idempotency_key` ON `orders`(`customer_id`, `idempotency_key`);
