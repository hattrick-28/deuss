/*
  # Disable public sign-up

  1. Security Changes
    - Only admin@deuss.com user is allowed
    - Disable public registration by setting max users to 1
  
  2. Important Notes
    - This prevents any new sign-ups
    - Admin user must be created manually via dashboard
*/

-- This is a configuration change that needs to be done via Supabase dashboard
-- The auth settings don't have SQL access for security reasons
-- You need to go to: Authentication > Providers > Email > Settings
-- And turn OFF "Enable Email Signups" or set a max user limit
