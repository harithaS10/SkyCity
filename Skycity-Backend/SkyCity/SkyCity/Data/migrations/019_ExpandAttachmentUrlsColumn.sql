-- Migration 019: Expand AttachmentUrls to NVARCHAR(MAX) to store base64 data

IF EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='WorkAllocations' AND COLUMN_NAME='AttachmentUrls')
BEGIN
    ALTER TABLE WorkAllocations ALTER COLUMN AttachmentUrls NVARCHAR(MAX) NULL;
END
