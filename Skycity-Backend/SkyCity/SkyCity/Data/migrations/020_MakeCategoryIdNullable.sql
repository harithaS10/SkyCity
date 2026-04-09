-- Migration 020: Make CategoryId nullable on Complaints table
-- Drop the FK constraint first, then alter the column

-- Find and drop the FK constraint
DECLARE @constraintName NVARCHAR(200)
SELECT @constraintName = name 
FROM sys.foreign_keys 
WHERE parent_object_id = OBJECT_ID('Complaints') 
  AND name LIKE '%Categ%'

IF @constraintName IS NOT NULL
BEGIN
    EXEC('ALTER TABLE Complaints DROP CONSTRAINT ' + @constraintName)
END

-- Make CategoryId nullable
IF EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS 
           WHERE TABLE_NAME='Complaints' AND COLUMN_NAME='CategoryId' 
           AND IS_NULLABLE='NO')
BEGIN
    ALTER TABLE Complaints ALTER COLUMN CategoryId INT NULL;
END
