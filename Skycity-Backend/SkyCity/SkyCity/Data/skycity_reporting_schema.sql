/*
  Skycity Task & Report Management System - Full Schema
  Association-based Tenant Isolation
*/

-- Associations (renamed from Companies/Tenants)
CREATE TABLE Associations (
    Id INT PRIMARY KEY IDENTITY(1,1),
    AssociationName NVARCHAR(255) NOT NULL,
    AdminId INT NOT NULL,
    LogoUrl NVARCHAR(500),
    ThemeColor NVARCHAR(7) DEFAULT '#3B82F6',
    Slug NVARCHAR(100) UNIQUE NOT NULL,
    Address NVARCHAR(500),
    Phone NVARCHAR(20),
    Email NVARCHAR(255),
    CreatedAt DATETIME2 DEFAULT GETDATE(),
    IsActive BIT DEFAULT 1
);

-- Properties
CREATE TABLE Properties (
    Id INT PRIMARY KEY IDENTITY(1,1),
    AssociationId INT NOT NULL,
    PropertyName NVARCHAR(255) NOT NULL,
    Address NVARCHAR(500),
    TotalUnits INT,
    CreatedAt DATETIME2 DEFAULT GETDATE(),
    FOREIGN KEY (AssociationId) REFERENCES Associations(Id)
);

-- Buildings
CREATE TABLE Buildings (
    Id INT PRIMARY KEY IDENTITY(1,1),
    PropertyId INT NOT NULL,
    BuildingName NVARCHAR(100) NOT NULL,
    Floors INT,
    CreatedAt DATETIME2 DEFAULT GETDATE(),
    FOREIGN KEY (PropertyId) REFERENCES Properties(Id)
);

-- Units
CREATE TABLE Units (
    Id INT PRIMARY KEY IDENTITY(1,1),
    BuildingId INT NOT NULL,
    UnitNumber NVARCHAR(50) NOT NULL,
    FloorNumber INT,
    Area DECIMAL(10,2),
    ResidentId INT NULL,
    IsOccupied BIT DEFAULT 0,
    CreatedAt DATETIME2 DEFAULT GETDATE(),
    FOREIGN KEY (BuildingId) REFERENCES Buildings(Id)
);

-- Users Table (Updated)
CREATE TABLE Users (
    Id INT PRIMARY KEY IDENTITY(1,1),
    Username NVARCHAR(100) NOT NULL UNIQUE,
    PasswordHash NVARCHAR(MAX) NOT NULL,
    FullName NVARCHAR(200),
    Role NVARCHAR(50) NOT NULL, -- super_admin, admin, etc.
    AssociationId INT NULL,
    PropertyId INT NULL,
    BuildingId INT NULL,
    UnitId INT NULL,
    Phone NVARCHAR(20),
    Address NVARCHAR(500),
    ProfilePicture NVARCHAR(500),
    IsActive BIT DEFAULT 1,
    LastLoginAt DATETIME2 NULL,
    CreatedAt DATETIME2 DEFAULT GETDATE(),
    FOREIGN KEY (AssociationId) REFERENCES Associations(Id),
    FOREIGN KEY (PropertyId) REFERENCES Properties(Id),
    FOREIGN KEY (BuildingId) REFERENCES Buildings(Id),
    FOREIGN KEY (UnitId) REFERENCES Units(Id)
);

-- Roles Table (Updated)
CREATE TABLE Roles (
    Id INT PRIMARY KEY IDENTITY(1,1),
    RoleName NVARCHAR(100) NOT NULL,
    RoleType NVARCHAR(50) NOT NULL,
    PermissionLevel INT DEFAULT 0,
    CanCreateUsers BIT DEFAULT 0,
    CanAssignComplaints BIT DEFAULT 0,
    CanApproveWorkOrders BIT DEFAULT 0,
    CanViewFinancials BIT DEFAULT 0
);

-- Complaint Categories
CREATE TABLE ComplaintCategories (
    Id INT PRIMARY KEY IDENTITY(1,1),
    AssociationId INT NOT NULL,
    CategoryName NVARCHAR(100) NOT NULL,
    Department NVARCHAR(100),
    EstimatedTime INT,
    IsActive BIT DEFAULT 1,
    FOREIGN KEY (AssociationId) REFERENCES Associations(Id)
);

-- Complaints
CREATE TABLE Complaints (
    Id INT PRIMARY KEY IDENTITY(1,1),
    ComplaintNumber NVARCHAR(50) UNIQUE NOT NULL,
    ResidentId INT NOT NULL,
    UnitId INT NOT NULL,
    CategoryId INT NOT NULL,
    Title NVARCHAR(255) NOT NULL,
    Description NVARCHAR(MAX),
    Priority NVARCHAR(20) DEFAULT 'Medium',
    Status NVARCHAR(50) DEFAULT 'Open',
    AssignedTo INT NULL,
    AssignedBy INT NULL,
    AssignedAt DATETIME2 NULL,
    Resolution NVARCHAR(MAX),
    ResolutionNotes NVARCHAR(MAX),
    Rating INT NULL,
    Feedback NVARCHAR(MAX),
    CreatedAt DATETIME2 DEFAULT GETDATE(),
    ResolvedAt DATETIME2 NULL,
    ClosedAt DATETIME2 NULL,
    FOREIGN KEY (ResidentId) REFERENCES Users(Id),
    FOREIGN KEY (UnitId) REFERENCES Units(Id),
    FOREIGN KEY (CategoryId) REFERENCES ComplaintCategories(Id),
    FOREIGN KEY (AssignedTo) REFERENCES Users(Id),
    FOREIGN KEY (AssignedBy) REFERENCES Users(Id)
);

-- Complaint Attachments
CREATE TABLE ComplaintAttachments (
    Id INT PRIMARY KEY IDENTITY(1,1),
    ComplaintId INT NOT NULL,
    FileName NVARCHAR(255),
    FilePath NVARCHAR(500),
    FileType NVARCHAR(50),
    UploadedBy INT,
    UploadedAt DATETIME2 DEFAULT GETDATE(),
    FOREIGN KEY (ComplaintId) REFERENCES Complaints(Id)
);

-- Work Orders
CREATE TABLE WorkOrders (
    Id INT PRIMARY KEY IDENTITY(1,1),
    WorkOrderNumber NVARCHAR(50) UNIQUE NOT NULL,
    ComplaintId INT NOT NULL,
    VendorId INT NOT NULL,
    Description NVARCHAR(MAX),
    EstimatedCost DECIMAL(18,2) NULL,
    ActualCost DECIMAL(18,2) NULL,
    Status NVARCHAR(50) DEFAULT 'Pending',
    ApprovedBy INT NULL,
    ApprovedAt DATETIME2 NULL,
    CompletedAt DATETIME2 NULL,
    CreatedAt DATETIME2 DEFAULT GETDATE(),
    FOREIGN KEY (ComplaintId) REFERENCES Complaints(Id),
    FOREIGN KEY (VendorId) REFERENCES Users(Id),
    FOREIGN KEY (ApprovedBy) REFERENCES Users(Id)
);

-- Bills (Read-only)
CREATE TABLE Bills (
    Id INT PRIMARY KEY IDENTITY(1,1),
    UnitId INT NOT NULL,
    BillNumber NVARCHAR(50) UNIQUE NOT NULL,
    BillType NVARCHAR(50),
    Amount DECIMAL(18,2),
    Tax DECIMAL(18,2),
    TotalAmount DECIMAL(18,2),
    DueDate DATE,
    Status NVARCHAR(50) DEFAULT 'Pending',
    PaidAt DATETIME2 NULL,
    PaymentReference NVARCHAR(100) NULL,
    CreatedAt DATETIME2 DEFAULT GETDATE(),
    FOREIGN KEY (UnitId) REFERENCES Units(Id)
);

-- Notifications
CREATE TABLE Notifications (
    Id INT PRIMARY KEY IDENTITY(1,1),
    UserId INT NOT NULL,
    Title NVARCHAR(255),
    Message NVARCHAR(MAX),
    Type NVARCHAR(50),
    ReferenceId INT,
    IsRead BIT DEFAULT 0,
    CreatedAt DATETIME2 DEFAULT GETDATE(),
    FOREIGN KEY (UserId) REFERENCES Users(Id)
);

-- Audit Logs
CREATE TABLE AuditLogs (
    Id INT PRIMARY KEY IDENTITY(1,1),
    UserId INT NOT NULL,
    AssociationId INT NOT NULL,
    Action NVARCHAR(100) NOT NULL,
    Module NVARCHAR(50) NOT NULL,
    RecordId INT,
    OldValue NVARCHAR(MAX),
    NewValue NVARCHAR(MAX),
    IPAddress NVARCHAR(50),
    UserAgent NVARCHAR(255),
    Timestamp DATETIME2 DEFAULT GETDATE(),
    FOREIGN KEY (UserId) REFERENCES Users(Id),
    FOREIGN KEY (AssociationId) REFERENCES Associations(Id)
);
