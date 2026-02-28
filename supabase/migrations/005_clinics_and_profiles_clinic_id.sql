-- Clinics table: organizations that users belong to
CREATE TABLE clinics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_clinics_name ON clinics(name);

-- Add clinic_id to profiles (users belong to a clinic)
ALTER TABLE profiles
  ADD COLUMN clinic_id UUID REFERENCES clinics(id) ON DELETE SET NULL;

CREATE INDEX idx_profiles_clinic_id ON profiles(clinic_id);

-- Trigger for clinics updated_at
CREATE TRIGGER update_clinics_updated_at BEFORE UPDATE ON clinics
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- RLS for clinics
ALTER TABLE clinics ENABLE ROW LEVEL SECURITY;

-- Users can view and update their own clinic (where profile.clinic_id = clinics.id)
CREATE POLICY "Users can view their clinic" ON clinics
  FOR SELECT USING (
    id IN (SELECT clinic_id FROM profiles WHERE id = auth.uid())
  );

CREATE POLICY "Users can update their clinic" ON clinics
  FOR UPDATE USING (
    id IN (SELECT clinic_id FROM profiles WHERE id = auth.uid())
  );

-- Users can insert a clinic when authenticated (e.g. during signup or settings)
CREATE POLICY "Authenticated users can insert clinics" ON clinics
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- Service role can read all clinics (for webhooks/admin)
CREATE POLICY "Service role can read all clinics" ON clinics
  FOR SELECT USING (true);
