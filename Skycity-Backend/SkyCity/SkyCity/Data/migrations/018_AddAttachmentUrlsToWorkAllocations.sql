-- Migration 018: Add AttachmentUrls column to WorkAllocations

IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='WorkAllocations' AND COLUMN_NAME='AttachmentUrls')
    ALTER TABLE WorkAllocations ADD AttachmentUrls NVARCHAR(2000) NULL;
