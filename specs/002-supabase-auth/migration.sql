-- SQL Migration: Profiles Table for Neon PostgreSQL
-- Feature: 002-supabase-auth
-- Date: 27 November 2025
--
-- NOTE: This migration is for NEON PostgreSQL (not Supabase).
-- Supabase is used ONLY for authentication (auth.users).
-- All application data (profiles, etc.) lives in Neon.
--
-- INSTRUCTIONS:
-- Run this script in your Neon PostgreSQL database:
-- 
-- Option 1: Neon Console SQL Editor
--   1. Go to your Neon project dashboard (https://console.neon.tech)
--   2. Navigate to SQL Editor
--   3. Paste this entire script
--   4. Click "Run"
--
-- Option 2: Using Drizzle Kit (recommended for ongoing development)
--   1. Ensure DATABASE_URL is set in .env
--   2. Run: npx drizzle-kit push
--
-- IMPORTANT: Run this BEFORE testing the application!

-- ============================================
-- 1. Create profiles table
-- ============================================
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY,  -- Links to Supabase auth.users.id
  username TEXT UNIQUE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  
  -- Username validation constraints
  CONSTRAINT username_length CHECK (length(username) >= 3 AND length(username) <= 30),
  CONSTRAINT username_format CHECK (username ~ '^[a-zA-Z0-9_]+$')
);

-- ============================================
-- 2. Create helper function for updated_at
-- ============================================
-- NOTE: The UNIQUE constraint on username automatically creates an index,
-- so no explicit CREATE INDEX is needed for username lookups.

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 3. Create trigger for auto-updating updated_at
-- ============================================
DROP TRIGGER IF EXISTS update_profiles_updated_at ON profiles;
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- VERIFICATION
-- ============================================
-- After running, verify the setup:
-- 1. Check table exists: SELECT * FROM profiles LIMIT 1;
-- 2. Check constraints: SELECT conname FROM pg_constraint WHERE conrelid = 'profiles'::regclass;
-- 3. Check indexes: SELECT indexname FROM pg_indexes WHERE tablename = 'profiles';
