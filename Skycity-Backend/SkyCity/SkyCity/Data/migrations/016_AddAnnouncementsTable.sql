-- Migration 016: Add Announcements table with IsActive and soft delete support

IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'Announcements')
BEGIN
    CREATE TABLE Announcements (
        Id         INT            IDENTITY(1,1) PRIMARY KEY,
        CompanyId  INT            NOT NULL,
        Message    NVARCHAR(500)  NOT NULL,
        StartAt    DATETIME2      NOT NULL,
        EndAt      DATETIME2      NOT NULL,
        IsActive   BIT            NOT NULL DEFAULT 1,
        IsDeleted  BIT            NOT NULL DEFAULT 1,  -- 1 = active/visible, 0 = soft-deleted
        CreatedAt  DATETIME2      NOT NULL DEFAULT GETUTCDATE(),

        CONSTRAINT FK_Announcements_Associations FOREIGN KEY (CompanyId)
            REFERENCES Associations(Id) ON DELETE CASCADE
    );

    CREATE INDEX IX_Announcements_CompanyId ON Announcements(CompanyId);
    CREATE INDEX IX_Announcements_IsDeleted  ON Announcements(IsDeleted);
END
