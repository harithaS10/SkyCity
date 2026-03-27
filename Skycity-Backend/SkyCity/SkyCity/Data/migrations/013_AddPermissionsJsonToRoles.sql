-- Migration 013: Add PermissionsJson column to Roles table
IF NOT EXISTS (
    SELECT * FROM sys.columns 
    WHERE object_id = OBJECT_ID('Roles') AND name = 'PermissionsJson'
)
BEGIN
    ALTER TABLE Roles ADD PermissionsJson NVARCHAR(MAX) NULL;
END
