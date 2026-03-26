-- Migration 010: Add Clients table
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='Clients' AND xtype='U')
BEGIN
    CREATE TABLE Clients (
        Id          INT IDENTITY(1,1) PRIMARY KEY,
        AssociationId INT NOT NULL,
        Name        NVARCHAR(255) NOT NULL,
        Company     NVARCHAR(255) NOT NULL,
        Email       NVARCHAR(255) NOT NULL,
        Phone       NVARCHAR(50) NULL,
        LogoUrl     NVARCHAR(500) NULL,
        IsActive    BIT NOT NULL DEFAULT 1,
        IsDeleted   BIT NOT NULL DEFAULT 0,
        CreatedAt   DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
        CONSTRAINT FK_Clients_Associations FOREIGN KEY (AssociationId) REFERENCES Associations(Id) ON DELETE CASCADE
    );

    CREATE INDEX IX_Clients_AssociationId ON Clients(AssociationId);
END
