ALTER TABLE users ADD COLUMN display_name text;
UPDATE users SET display_name = 'Harikrishnan D' WHERE login_id = 'HARI D' AND display_name IS NULL;
