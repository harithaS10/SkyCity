IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'Products')
BEGIN
    CREATE TABLE Products (
        Id INT PRIMARY KEY IDENTITY(1,1),
        CategoryId INT NOT NULL,
        SubCategoryId INT NULL,
        ProductName NVARCHAR(255) NOT NULL,
        Price DECIMAL(18,2) NOT NULL,
        Description NVARCHAR(2000) NULL,
        ImageUrl NVARCHAR(500) NULL,
        IsActive BIT NOT NULL DEFAULT 1,
        CreatedAt DATETIME2 NOT NULL DEFAULT GETDATE(),
        IsDeleted BIT NOT NULL DEFAULT 0,
        FOREIGN KEY (CategoryId) REFERENCES ComplaintCategories(Id),
        FOREIGN KEY (SubCategoryId) REFERENCES SubCategories(Id)
    );
END
