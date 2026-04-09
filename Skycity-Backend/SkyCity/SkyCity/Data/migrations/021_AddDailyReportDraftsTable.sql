IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='DailyReportDrafts' AND xtype='U')
BEGIN
    CREATE TABLE DailyReportDrafts (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        UserId INT NOT NULL,
        AssociationId INT NOT NULL,
        ReportDate DATE NOT NULL,
        RowsJson NVARCHAR(MAX) NOT NULL DEFAULT '[]',
        IsSubmitted BIT NOT NULL DEFAULT 0,
        UpdatedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
        CreatedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
        CONSTRAINT UQ_DailyReportDraft_User_Date UNIQUE (UserId, ReportDate)
    );
    CREATE INDEX IX_DailyReportDrafts_UserId ON DailyReportDrafts(UserId);
    CREATE INDEX IX_DailyReportDrafts_AssociationId ON DailyReportDrafts(AssociationId);
END
