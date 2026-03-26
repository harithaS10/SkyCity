-- Add CreatedAt to ComplaintCategories if missing
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('ComplaintCategories') AND name = 'CreatedAt')
    ALTER TABLE ComplaintCategories ADD CreatedAt DATETIME2 NOT NULL DEFAULT GETDATE();
