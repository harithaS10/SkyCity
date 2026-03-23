-- File: Data/migrations/003_AddSoftDeleteAndIndexes.sql

-- Add IsDeleted columns to all tables (already integrated in 002 but here for completeness)
-- Actually, I'll only add what's missing or re-apply for safety if script is run again.
-- Standard approach is to use IF NOT EXISTS but keep it simple as a reference script.

-- Add missing ResidentId foreign key (Critical task from prompt)
IF NOT EXISTS (SELECT * FROM sys.foreign_keys WHERE name = 'FK_Units_Resident')
BEGIN
    ALTER TABLE Units
    ADD CONSTRAINT FK_Units_Resident 
    FOREIGN KEY (ResidentId) REFERENCES Users(Id);
END

-- Add performance indexes
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_Complaints_Status')
    CREATE INDEX IX_Complaints_Status ON Complaints(Status);

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_Complaints_AssignedTo')
    CREATE INDEX IX_Complaints_AssignedTo ON Complaints(AssignedTo);

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_Complaints_CategoryId')
    CREATE INDEX IX_Complaints_CategoryId ON Complaints(CategoryId);

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_WorkOrders_VendorId')
    CREATE INDEX IX_WorkOrders_VendorId ON WorkOrders(VendorId);

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_WorkOrders_Status')
    CREATE INDEX IX_WorkOrders_Status ON WorkOrders(Status);

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_Notifications_UserId_IsRead')
    CREATE INDEX IX_Notifications_UserId_IsRead ON Notifications(UserId, IsRead);

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_Bills_UnitId_Status')
    CREATE INDEX IX_Bills_UnitId_Status ON Bills(UnitId, Status);

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_Users_AssociationId_Role')
    CREATE INDEX IX_Users_AssociationId_Role ON Users(AssociationId, Role);

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_Complaints_CreatedAt')
    CREATE INDEX IX_Complaints_CreatedAt ON Complaints(CreatedAt DESC);

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_WorkOrders_CreatedAt')
    CREATE INDEX IX_WorkOrders_CreatedAt ON WorkOrders(CreatedAt DESC);
