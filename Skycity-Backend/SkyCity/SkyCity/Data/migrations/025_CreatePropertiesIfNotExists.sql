-- Migration 025: Create Properties table and related tables if they don't exist
-- Run this on the production database (Employeesreport)

IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'Properties')
BEGIN
    CREATE TABLE Properties (
        Id INT PRIMARY KEY IDENTITY(1,1),
        AssociationId INT NOT NULL,
        PropertyName NVARCHAR(255) NOT NULL,
        Address NVARCHAR(500) NULL,
        TotalUnits INT NOT NULL DEFAULT 0,
        PropertyType NVARCHAR(20) NOT NULL DEFAULT 'apartment',
        TowerName NVARCHAR(100) NULL,
        FloorNo NVARCHAR(20) NULL,
        DoorNo NVARCHAR(20) NULL,
        ContactName NVARCHAR(100) NULL,
        ContactMobile NVARCHAR(20) NULL,
        CommonAreas NVARCHAR(500) NULL,
        CreatedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
        IsDeleted BIT NOT NULL DEFAULT 1,
        FOREIGN KEY (AssociationId) REFERENCES Associations(Id)
    );
    PRINT 'Created Properties table';
END
ELSE
BEGIN
    -- Ensure all columns exist (for partial migrations)
    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='Properties' AND COLUMN_NAME='PropertyType')
        ALTER TABLE Properties ADD PropertyType NVARCHAR(20) NOT NULL DEFAULT 'apartment';
    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='Properties' AND COLUMN_NAME='TowerName')
        ALTER TABLE Properties ADD TowerName NVARCHAR(100) NULL;
    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='Properties' AND COLUMN_NAME='FloorNo')
        ALTER TABLE Properties ADD FloorNo NVARCHAR(20) NULL;
    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='Properties' AND COLUMN_NAME='DoorNo')
        ALTER TABLE Properties ADD DoorNo NVARCHAR(20) NULL;
    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='Properties' AND COLUMN_NAME='ContactName')
        ALTER TABLE Properties ADD ContactName NVARCHAR(100) NULL;
    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='Properties' AND COLUMN_NAME='ContactMobile')
        ALTER TABLE Properties ADD ContactMobile NVARCHAR(20) NULL;
    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='Properties' AND COLUMN_NAME='CommonAreas')
        ALTER TABLE Properties ADD CommonAreas NVARCHAR(500) NULL;
    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='Properties' AND COLUMN_NAME='IsDeleted')
        ALTER TABLE Properties ADD IsDeleted BIT NOT NULL DEFAULT 1;
    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='Properties' AND COLUMN_NAME='TotalUnits')
        ALTER TABLE Properties ADD TotalUnits INT NOT NULL DEFAULT 0;
    PRINT 'Properties table already exists - ensured all columns present';
END

-- Buildings
IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'Buildings')
BEGIN
    CREATE TABLE Buildings (
        Id INT PRIMARY KEY IDENTITY(1,1),
        PropertyId INT NOT NULL,
        BuildingName NVARCHAR(100) NOT NULL,
        Floors INT NOT NULL DEFAULT 0,
        CreatedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
        IsDeleted BIT NOT NULL DEFAULT 1,
        FOREIGN KEY (PropertyId) REFERENCES Properties(Id)
    );
    PRINT 'Created Buildings table';
END

-- Units
IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'Units')
BEGIN
    CREATE TABLE Units (
        Id INT PRIMARY KEY IDENTITY(1,1),
        BuildingId INT NOT NULL,
        UnitNumber NVARCHAR(50) NOT NULL,
        FloorNumber INT NOT NULL DEFAULT 0,
        Area DECIMAL(10,2) NOT NULL DEFAULT 0,
        ResidentId INT NULL,
        IsOccupied BIT NOT NULL DEFAULT 0,
        CreatedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
        IsDeleted BIT NOT NULL DEFAULT 1,
        FOREIGN KEY (BuildingId) REFERENCES Buildings(Id)
    );
    PRINT 'Created Units table';
END
