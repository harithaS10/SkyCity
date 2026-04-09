IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='AssistanceRequests' AND xtype='U')
BEGIN
    CREATE TABLE AssistanceRequests (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        UserId INT NOT NULL,
        AssociationId INT NOT NULL,
        Message NVARCHAR(500) NOT NULL,
        IsRead BIT NOT NULL DEFAULT 0,
        CreatedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE()
    );
    CREATE INDEX IX_AssistanceRequests_AssociationId ON AssistanceRequests(AssociationId);
END
