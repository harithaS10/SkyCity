IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'WorkCategories')
BEGIN
    CREATE TABLE WorkCategories (
        Id INT PRIMARY KEY IDENTITY(1,1),
        WorkCode NVARCHAR(50) NOT NULL,
        WorkTitle NVARCHAR(255) NOT NULL,
        WorkType NVARCHAR(100) NOT NULL DEFAULT 'Standard',
        IsActive BIT NOT NULL DEFAULT 1,
        CreatedAt DATETIME2 NOT NULL DEFAULT GETDATE()
    );
END
