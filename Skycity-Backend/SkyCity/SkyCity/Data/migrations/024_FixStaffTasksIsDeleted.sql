-- Fix existing StaffTasks that have IsDeleted=false (excluded by global filter)
-- In this codebase, IsDeleted=true means ACTIVE/VISIBLE, IsDeleted=false means deleted/excluded
UPDATE StaffTasks SET IsDeleted = 1 WHERE IsDeleted = 0;
