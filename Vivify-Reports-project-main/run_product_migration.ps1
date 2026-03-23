# PowerShell script to run the product management migration
# Run this script to create the Categories and Products tables

Write-Host "Running Product Management Migration..." -ForegroundColor Green

# Get the connection string from appsettings.json
$appsettingsPath = "EmployeeReportingAPI/appsettings.json"
if (Test-Path $appsettingsPath) {
    $appsettings = Get-Content $appsettingsPath | ConvertFrom-Json
    $connectionString = $appsettings.ConnectionStrings.DefaultConnection
    Write-Host "Found connection string in appsettings.json" -ForegroundColor Yellow
} else {
    Write-Host "appsettings.json not found. Please update the connection string below." -ForegroundColor Red
    $connectionString = "Server=your_server;Database=your_database;Trusted_Connection=true;"
}

# Path to the migration script
$migrationScript = "EmployeeReportingAPI/Migrations/add_product_management_tables.sql"

if (Test-Path $migrationScript) {
    Write-Host "Migration script found: $migrationScript" -ForegroundColor Green
    
    try {
        # Run the SQL script using sqlcmd
        Write-Host "Executing migration script..." -ForegroundColor Yellow
        sqlcmd -S "your_server_name" -d "your_database_name" -i $migrationScript -E
        
        Write-Host "Migration completed successfully!" -ForegroundColor Green
        Write-Host "Categories and Products tables should now be available." -ForegroundColor Green
    }
    catch {
        Write-Host "Error running migration: $($_.Exception.Message)" -ForegroundColor Red
        Write-Host "Please run the SQL script manually in SQL Server Management Studio" -ForegroundColor Yellow
    }
} else {
    Write-Host "Migration script not found: $migrationScript" -ForegroundColor Red
}

Write-Host "`nNext steps:" -ForegroundColor Cyan
Write-Host "1. Verify the tables were created in your database" -ForegroundColor White
Write-Host "2. Restart your API server" -ForegroundColor White
Write-Host "3. Test the Product Management pages" -ForegroundColor White