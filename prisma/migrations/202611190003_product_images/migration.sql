CREATE TABLE `ProductImage` (
 `id` VARCHAR(191) NOT NULL,
 `productId` VARCHAR(191) NOT NULL,
 `data` LONGBLOB NOT NULL,
 `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
 INDEX `ProductImage_productId_idx`(`productId`),
 PRIMARY KEY (`id`),
 CONSTRAINT `ProductImage_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `Product`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
