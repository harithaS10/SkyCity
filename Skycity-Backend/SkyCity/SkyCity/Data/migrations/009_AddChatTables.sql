IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'ChatMessages')
BEGIN
    CREATE TABLE ChatMessages (
        Id INT PRIMARY KEY IDENTITY(1,1),
        SenderId INT NOT NULL,
        ReceiverId INT NULL,
        GroupId INT NULL,
        Message NVARCHAR(MAX) NOT NULL,
        Type NVARCHAR(50) NOT NULL DEFAULT 'text',
        Payload NVARCHAR(MAX) NULL,
        IsRead BIT NOT NULL DEFAULT 0,
        CreatedAt DATETIME2 NOT NULL DEFAULT GETDATE(),
        FOREIGN KEY (SenderId) REFERENCES Users(Id)
    );
END

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'ChatGroups')
BEGIN
    CREATE TABLE ChatGroups (
        Id INT PRIMARY KEY IDENTITY(1,1),
        GroupName NVARCHAR(255) NOT NULL,
        CreatedBy INT NOT NULL,
        AssociationId INT NOT NULL,
        CreatedAt DATETIME2 NOT NULL DEFAULT GETDATE(),
        FOREIGN KEY (CreatedBy) REFERENCES Users(Id)
    );
END

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'ChatGroupMembers')
BEGIN
    CREATE TABLE ChatGroupMembers (
        Id INT PRIMARY KEY IDENTITY(1,1),
        GroupId INT NOT NULL,
        UserId INT NOT NULL,
        FOREIGN KEY (GroupId) REFERENCES ChatGroups(Id),
        FOREIGN KEY (UserId) REFERENCES Users(Id)
    );
END
