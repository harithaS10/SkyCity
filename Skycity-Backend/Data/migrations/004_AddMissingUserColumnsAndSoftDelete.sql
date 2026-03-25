-- File: Data/migrations/004_AddMissingUserColumnsAndSoftDelete.sql
-- Adds columns that exist in the C# models but are missing from the database

-- Users table: missing soft delete, profile, and status columns
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Users') AND name = 'IsDeleted')
    ALTER TABLE Users ADD IsDeleted BIT NOT NULL DEFAULT 0;

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Users') AND name = 'IsActive')
    ALTER TABLE Users ADD IsActive BIT NOT NULL DEFAULT 1;

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Users') AND name = 'LastLoginAt')
    ALTER TABLE Users ADD LastLoginAt DATETIME2 NULL;

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Users') AND name = 'Phone')
    ALTER TABLE Users ADD Phone NVARCHAR(20) NULL;

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Users') AND name = 'Address')
    ALTER TABLE Users ADD Address NVARCHAR(500) NULL;

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Users') AND name = 'ProfilePicture')
    ALTER TABLE Users ADD ProfilePicture NVARCHAR(500) NULL;

-- Users: FK columns (may already exist from base schema, guard anyway)
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Users') AND name = 'AssociationId')
    ALTER TABLE Users ADD AssociationId INT NULL;

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Users') AND name = 'PropertyId')
    ALTER TABLE Users ADD PropertyId INT NULL;

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Users') AND name = 'BuildingId')
    ALTER TABLE Users ADD BuildingId INT NULL;

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Users') AND name = 'UnitId')
    ALTER TABLE Users ADD UnitId INT NULL;

-- ComplaintCategories: missing IsDeleted
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('ComplaintCategories') AND name = 'IsDeleted')
    ALTER TABLE ComplaintCategories ADD IsDeleted BIT NOT NULL DEFAULT 0;

-- ComplaintAttachments: missing IsDeleted
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('ComplaintAttachments') AND name = 'IsDeleted')
    ALTER TABLE ComplaintAttachments ADD IsDeleted BIT NOT NULL DEFAULT 0;

-- Notifications: missing IsDeleted
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Notifications') AND name = 'IsDeleted')
    ALTER TABLE Notifications ADD IsDeleted BIT NOT NULL DEFAULT 0;

-- AuditLogs: missing IsDeleted
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('AuditLogs') AND name = 'IsDeleted')
    ALTER TABLE AuditLogs ADD IsDeleted BIT NOT NULL DEFAULT 0;

-- Roles: missing IsDeleted
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Roles') AND name = 'IsDeleted')
    ALTER TABLE Roles ADD IsDeleted BIT NOT NULL DEFAULT 0;

-- WorkOrders: missing WorkTitle column
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('WorkOrders') AND name = 'WorkTitle')
    ALTER TABLE WorkOrders ADD WorkTitle NVARCHAR(255) NULL;

-- Associations: missing IsDeleted (in case 002 wasn't run)
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Associations') AND name = 'IsDeleted')
    ALTER TABLE Associations ADD IsDeleted BIT NOT NULL DEFAULT 0;

-- Properties: missing IsDeleted (in case 002 wasn't run)
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Properties') AND name = 'IsDeleted')
    ALTER TABLE Properties ADD IsDeleted BIT NOT NULL DEFAULT 0;

-- Buildings: missing IsDeleted (in case 002 wasn't run)
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Buildings') AND name = 'IsDeleted')
    ALTER TABLE Buildings ADD IsDeleted BIT NOT NULL DEFAULT 0;

-- Units: missing IsDeleted (in case 002 wasn't run)
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Units') AND name = 'IsDeleted')
    ALTER TABLE Units ADD IsDeleted BIT NOT NULL DEFAULT 0;

-- Complaints: missing IsDeleted (in case 002 wasn't run)
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Complaints') AND name = 'IsDeleted')
    ALTER TABLE Complaints ADD IsDeleted BIT NOT NULL DEFAULT 0;

-- Bills: missing IsDeleted (in case 002 wasn't run)
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Bills') AND name = 'IsDeleted')
    ALTER TABLE Bills ADD IsDeleted BIT NOT NULL DEFAULT 0;

-- WorkOrders: missing IsDeleted (in case 002 wasn't run)
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('WorkOrders') AND name = 'IsDeleted')
    ALTER TABLE WorkOrders ADD IsDeleted BIT NOT NULL DEFAULT 0;
