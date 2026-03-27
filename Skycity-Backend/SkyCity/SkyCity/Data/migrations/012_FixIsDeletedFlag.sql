-- Migration 012: Fix inverted IsDeleted flag
-- Previously IsDeleted=true meant "active/visible", now IsDeleted=false means active
-- Flip all existing records that are currently "active" (IsDeleted=true) to the correct value (IsDeleted=false)

UPDATE Users               SET IsDeleted = 0 WHERE IsDeleted = 1;
UPDATE Associations        SET IsDeleted = 0 WHERE IsDeleted = 1;
UPDATE Properties          SET IsDeleted = 0 WHERE IsDeleted = 1;
UPDATE Buildings           SET IsDeleted = 0 WHERE IsDeleted = 1;
UPDATE Units               SET IsDeleted = 0 WHERE IsDeleted = 1;
UPDATE ComplaintCategories SET IsDeleted = 0 WHERE IsDeleted = 1;
UPDATE SubCategories       SET IsDeleted = 0 WHERE IsDeleted = 1;
UPDATE Products            SET IsDeleted = 0 WHERE IsDeleted = 1;
UPDATE Complaints          SET IsDeleted = 0 WHERE IsDeleted = 1;
UPDATE ComplaintAttachments SET IsDeleted = 0 WHERE IsDeleted = 1;
UPDATE WorkOrders          SET IsDeleted = 0 WHERE IsDeleted = 1;
UPDATE Bills               SET IsDeleted = 0 WHERE IsDeleted = 1;
UPDATE Notifications       SET IsDeleted = 0 WHERE IsDeleted = 1;
UPDATE AuditLogs           SET IsDeleted = 0 WHERE IsDeleted = 1;
UPDATE RoleDefinitions     SET IsDeleted = 0 WHERE IsDeleted = 1;
