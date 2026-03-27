-- Migration 014: Seed employee users for Association 8
-- Passwords are plain text (legacy format) - change after first login

INSERT INTO Users (Username, PasswordHash, FullName, Role, AssociationId, Phone, IsActive, IsDeleted, CreatedAt)
VALUES
  ('john.staff',    'Staff@123',    'John Mathew',      'staff',            8, '9876543201', 1, 0, GETUTCDATE()),
  ('priya.helpdesk','Help@123',     'Priya Nair',       'helpdesk',         8, '9876543202', 1, 0, GETUTCDATE()),
  ('ravi.manager',  'Manager@123',  'Ravi Kumar',       'property_manager', 8, '9876543203', 1, 0, GETUTCDATE()),
  ('anita.facility','Facility@123', 'Anita Sharma',     'facility_manager', 8, '9876543204', 1, 0, GETUTCDATE()),
  ('suresh.staff',  'Staff@123',    'Suresh Pillai',    'staff',            8, '9876543205', 1, 0, GETUTCDATE()),
  ('meena.vendor',  'Vendor@123',   'Meena Krishnan',   'vendor',           8, '9876543206', 1, 0, GETUTCDATE()),
  ('arjun.staff',   'Staff@123',    'Arjun Das',        'staff',            8, '9876543207', 1, 0, GETUTCDATE()),
  ('divya.helpdesk','Help@123',     'Divya Menon',      'helpdesk',         8, '9876543208', 1, 0, GETUTCDATE());
