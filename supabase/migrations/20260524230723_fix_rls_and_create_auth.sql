/*
  # Fix RLS policies for authentication

  1. Security Changes
    - Update RLS policies to require authentication
    - Remove overly permissive policies
    - All data now protected - requires login to access

  2. Important Notes
    - Auth will be handled via Supabase client (email/password)
    - User admin@deuss.com will be created from UI
    - Data persists across sessions when authenticated
*/

-- Drop existing permissive policies
DROP POLICY IF EXISTS "Users can view all clients" ON clients;
DROP POLICY IF EXISTS "Users can insert clients" ON clients;
DROP POLICY IF EXISTS "Users can update clients" ON clients;
DROP POLICY IF EXISTS "Users can delete clients" ON clients;
DROP POLICY IF EXISTS "Users can view all bookings" ON bookings;
DROP POLICY IF EXISTS "Users can insert bookings" ON bookings;
DROP POLICY IF EXISTS "Users can update bookings" ON bookings;
DROP POLICY IF EXISTS "Users can delete bookings" ON bookings;
DROP POLICY IF EXISTS "Users can view all history" ON history;
DROP POLICY IF EXISTS "Users can insert history" ON history;
DROP POLICY IF EXISTS "Users can delete history" ON history;

-- Create new restrictive policies that require auth
CREATE POLICY "Authenticated users can view clients"
  ON clients FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert clients"
  ON clients FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update clients"
  ON clients FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete clients"
  ON clients FOR DELETE
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can view bookings"
  ON bookings FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert bookings"
  ON bookings FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update bookings"
  ON bookings FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete bookings"
  ON bookings FOR DELETE
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can view history"
  ON history FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert history"
  ON history FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete history"
  ON history FOR DELETE
  TO authenticated
  USING (true);
