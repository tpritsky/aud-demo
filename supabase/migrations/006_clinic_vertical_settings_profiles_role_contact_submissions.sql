-- Phase 1: Clinic vertical/settings, profiles role (admin/member), contact_submissions table

-- Clinics: add vertical and settings
ALTER TABLE clinics
  ADD COLUMN IF NOT EXISTS vertical TEXT NOT NULL DEFAULT 'general',
  ADD COLUMN IF NOT EXISTS settings JSONB NOT NULL DEFAULT '{}';

-- Allow vertical values: audiology, ortho, law, general (and others later)
ALTER TABLE clinics
  DROP CONSTRAINT IF EXISTS clinics_vertical_check;
ALTER TABLE clinics
  ADD CONSTRAINT clinics_vertical_check CHECK (
    vertical IN ('audiology', 'ortho', 'law', 'general')
  );

-- Profiles: change role to admin | member (for clinic-admin model)
ALTER TABLE profiles
  DROP CONSTRAINT IF EXISTS profiles_role_check;
UPDATE profiles SET role = 'member' WHERE role IN ('audiologist', 'staff');
UPDATE profiles SET role = 'admin' WHERE role = 'admin';
ALTER TABLE profiles
  ADD CONSTRAINT profiles_role_check CHECK (role IN ('admin', 'member'));

-- Contact submissions: for "Register new business" / request-access form
CREATE TABLE contact_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT NOT NULL,
  business_type TEXT NOT NULL,
  phone_spend TEXT NOT NULL,
  message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_contact_submissions_created_at ON contact_submissions(created_at DESC);
CREATE INDEX idx_contact_submissions_email ON contact_submissions(email);

-- RLS: no direct client access; only API route with service role can insert/read
ALTER TABLE contact_submissions ENABLE ROW LEVEL SECURITY;

-- No policies for anon/authenticated = only service role (bypasses RLS) can access
