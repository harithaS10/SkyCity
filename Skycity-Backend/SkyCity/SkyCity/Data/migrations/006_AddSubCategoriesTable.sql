IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'SubCategories')
BEGIN
    CREATE TABLE SubCategories (
        Id INT PRIMARY KEY IDENTITY(1,1),
        CategoryId INT NOT NULL,
        SubCategoryName NVARCHAR(200) NOT NULL,
        Description NVARCHAR(1000) NULL,
        IsActive BIT NOT NULL DEFAULT 1,
        CreatedAt DATETIME2 NOT NULL DEFAULT GETDATE(),
        IsDeleted BIT NOT NULL DEFAULT 0,
        FOREIGN KEY (CategoryId) REFERENCES ComplaintCategories(Id)
    );
END
