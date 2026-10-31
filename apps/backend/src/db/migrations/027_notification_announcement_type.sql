-- Announcements notify staff: add the missing enum value (the insert failed silently before)
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'announcement';
