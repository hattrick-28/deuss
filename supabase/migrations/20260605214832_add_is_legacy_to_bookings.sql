/*
  # Add is_legacy column to bookings table
  
  Tracks whether a booking is from a legacy package or regular package.
  This allows proper calculation of revenue vs. bonus for legacy bookings.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'bookings' AND column_name = 'is_legacy'
  ) THEN
    ALTER TABLE bookings ADD COLUMN is_legacy boolean DEFAULT false;
  END IF;
END $$;
