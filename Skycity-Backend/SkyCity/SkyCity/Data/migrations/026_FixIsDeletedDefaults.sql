-- Migration 026: Fix IsDeleted defaults
-- In this app, IsDeleted=1 means ACTIVE/VISIBLE, IsDeleted=0 means soft-deleted
-- All existing rows need IsDeleted=1 to be visible

-- Fix existing rows that have IsDeleted=0 (they appear deleted but should be active)
UPDATE Properties SET IsDeleted = 1 WHERE IsDeleted = 0;
UPDATE Buildings SET IsDeleted = 1 WHERE IsDeleted = 0;
UPDATE Units SET IsDeleted = 1 WHERE IsDeleted = 0;
UPDATE Associations SET IsDeleted = 1 WHERE IsDeleted = 0;
UPDATE Users SET IsDeleted = 1 WHERE IsDeleted = 0;
UPDATE Roles SET IsDeleted = 1 WHERE IsDeleted = 0;
UPDATE Clients SET IsDeleted = 1 WHERE IsDeleted = 0;
UPDATE StaffTasks SET IsDeleted = 1 WHERE IsDeleted = 0;
UPDATE Announcements SET IsDeleted = 1 WHERE IsDeleted = 0;

-- Fix column defaults so new rows default to visible (IsDeleted=1)
IF EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='Properties' AND COLUMN_NAME='IsDeleted')
BEGIN
    -- Drop old default constraint if exists
    DECLARE @constraintName NVARCHAR(200);
    SELECT @constraintName = dc.name 
    FROM sys.default_constraints dc
    JOIN sys.columns c ON dc.parent_object_id = c.object_id AND dc.parent_column_id = c.column_id
    JOIN sys.tables t ON c.object_id = t.object_id
    WHERE t.name = 'Properties' AND c.name = 'IsDeleted';
    IF @constraintName IS NOT NULL
        EXEC('ALTER TABLE Properties DROP CONSTRAINT ' + @constraintName);
    ALTER TABLE Properties ADD DEFAULT 1 FOR IsDeleted;
END
