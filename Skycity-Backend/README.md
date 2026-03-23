# Skycity Task & Report Management System

A robust .NET 8 Web API for managing associations, properties, and community-driven workflows.

## Features
- **10 Defined Roles**: Support for Super Admin, Admin, Manager, Staff, Vendor, Resident, and more.
- **Property Hierarchy**: Manage Associations -> Properties -> Buildings -> Units.
- **Workflow-driven Complaints**: Full lifecycle from Resident reporting to Vendor resolution and feedback.
- **Vendor Work Orders**: Assignment and approval workflow for external contractors.
- **Bill Tracking**: Read-only invoice management for residents and managers.
- **Role-specific Analytics**: Dashboards tailored to different user tiers.
- **Association Isolation**: Strict data partitioning based on AssociationId.

## Setup Instructions

### 1. Database Setup
1. Open SQL Server Management Studio (SSMS).
2. Connect to your instance (e.g., `103.230.85.44`).
3. Run the script: `Data/skycity_reporting_schema.sql` on the `Employeesreport` database.

### 2. Configuration
The API is pre-configured to connect to the `Employeesreport` database. You can adjust settings in `appsettings.json`.

### 3. Build and Run
```bash
# Navigate to project folder
cd Skycity-Backend

# Build project
dotnet build

# Run API
dotnet run
```

## API Modules
- `/api/auth` - Login and Registration
- `/api/association` - Association Management
- `/api/property` - Properties, Buildings, and Units
- `/api/complaints` - Resident Complaints & Feedback
- `/api/workorder` - Vendor Progress & Approvals
- `/api/bill` - Invoice Tracking
- `/api/dashboard` - Role-based Metrics

## Important Notes
- **No Payment Processing**: This system is purely for task/report management and invoice tracking.
- **Security**: JWT-based authentication is enforced for all protected routes.
