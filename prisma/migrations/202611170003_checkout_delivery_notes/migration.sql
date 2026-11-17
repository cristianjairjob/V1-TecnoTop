-- Additive only: historical names, addresses and orders remain untouched.
-- NULL means the legacy checkout did not collect these fields; never guess them.
ALTER TABLE `Customer`
  ADD COLUMN `firstName` VARCHAR(80) NULL,
  ADD COLUMN `lastName` VARCHAR(80) NULL;
ALTER TABLE `Order` ADD COLUMN `deliveryNotes` TEXT NULL;
