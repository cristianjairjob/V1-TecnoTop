ALTER TABLE `Product` ADD COLUMN `highlights` JSON NULL, ADD COLUMN `displayStock` INTEGER NULL;
-- Preserve the current notice once; purchases only decrement the real stock.
UPDATE `Product` SET `displayStock` = CASE WHEN `stock` BETWEEN 1 AND 10 THEN `stock` ELSE NULL END;
