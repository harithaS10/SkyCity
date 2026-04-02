-- Migration 015: Update role permission keys to match actual nav modules
-- Old keys: reports, tasks → New keys: complaints, work_orders, daily_reports

UPDATE Roles
SET PermissionsJson = REPLACE(
    REPLACE(
        REPLACE(PermissionsJson, '"reports":', '"daily_reports":'),
        '"tasks":', '"work_orders":'
    ),
    '"users":', '"complaints":'
)
WHERE PermissionsJson IS NOT NULL
  AND (PermissionsJson LIKE '%"reports":%' OR PermissionsJson LIKE '%"tasks":%');
