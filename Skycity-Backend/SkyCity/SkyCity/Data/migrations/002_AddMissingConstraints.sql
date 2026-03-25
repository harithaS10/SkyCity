-- File: Data/migrations/002_AddMissingConstraints.sql
-- Add missing foreign keys and performance indexes

-- 1. Add ResidentId FK to Units (was missing)
ALTER TABLE Units
ADD CONSTRAINT FK_Units_Resident 
FOREIGN KEY (ResidentId) REFERENCES Users(Id);

-- 2. Performance Indexes for Workflows
-- Complaints
CREATE INDEX IX_Complaints_Status ON Complaints(Status);
CREATE INDEX IX_Complaints_AssignedTo ON Complaints(AssignedTo);
CREATE INDEX IX_Complaints_CategoryId ON Complaints(CategoryId);
CREATE INDEX IX_Complaints_CreatedAt ON Complaints(CreatedAt DESC);

-- Work Orders
CREATE INDEX IX_WorkOrders_VendorId ON WorkOrders(VendorId);
CREATE INDEX IX_WorkOrders_Status ON WorkOrders(Status);
CREATE INDEX IX_WorkOrders_ComplaintId ON WorkOrders(ComplaintId);

-- Notifications & Auditing
CREATE INDEX IX_Notifications_UserId_IsRead ON Notifications(UserId, IsRead);
CREATE INDEX IX_AuditLogs_AssociationId_Timestamp ON AuditLogs(AssociationId, Timestamp DESC);

-- 3. Soft Delete Columns
ALTER TABLE Associations ADD IsDeleted BIT DEFAULT 0 NOT NULL;
ALTER TABLE Properties ADD IsDeleted BIT DEFAULT 0 NOT NULL;
ALTER TABLE Buildings ADD IsDeleted BIT DEFAULT 0 NOT NULL;
ALTER TABLE Units ADD IsDeleted BIT DEFAULT 0 NOT NULL;
ALTER TABLE Complaints ADD IsDeleted BIT DEFAULT 0 NOT NULL;
ALTER TABLE WorkOrders ADD IsDeleted BIT DEFAULT 0 NOT NULL;
ALTER TABLE Bills ADD IsDeleted BIT DEFAULT 0 NOT NULL;

-- 4. Multitenancy Optimization
CREATE INDEX IX_Users_AssociationId_Role ON Users(AssociationId, Role);
CREATE INDEX IX_Bills_UnitId_Status ON Bills(UnitId, Status);
