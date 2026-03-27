-- Migration 011: Add StaffTasks table
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='StaffTasks' AND xtype='U')
BEGIN
    CREATE TABLE StaffTasks (
        Id            INT IDENTITY(1,1) PRIMARY KEY,
        AssociationId INT NOT NULL,
        AssignedTo    INT NOT NULL,
        AssignedBy    INT NOT NULL,
        TaskName      NVARCHAR(255) NOT NULL,
        Description   NVARCHAR(1000) NULL,
        Priority      NVARCHAR(20) NOT NULL DEFAULT 'medium',
        Status        NVARCHAR(20) NOT NULL DEFAULT 'pending',
        IsRecurring   BIT NOT NULL DEFAULT 0,
        DueDate       DATETIME2 NOT NULL,
        CompletedAt   DATETIME2 NULL,
        IsDeleted     BIT NOT NULL DEFAULT 0,
        CreatedAt     DATETIME2 NOT NULL DEFAULT GETUTCDATE()
    );

    CREATE INDEX IX_StaffTasks_AssignedTo ON StaffTasks(AssignedTo);
    CREATE INDEX IX_StaffTasks_AssociationId ON StaffTasks(AssociationId);
END
