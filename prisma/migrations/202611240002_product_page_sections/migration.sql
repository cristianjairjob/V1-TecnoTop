ALTER TABLE `Product` ADD COLUMN `pageContent` JSON NULL;
CREATE TABLE `NewsletterSubscriber` (
 `id` VARCHAR(191) NOT NULL, `email` VARCHAR(254) NOT NULL, `productId` VARCHAR(100) NOT NULL, `consentText` TEXT NOT NULL, `privacyVersion` VARCHAR(191) NOT NULL DEFAULT 'newsletter-v1', `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
 UNIQUE INDEX `NewsletterSubscriber_email_key`(`email`), PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
