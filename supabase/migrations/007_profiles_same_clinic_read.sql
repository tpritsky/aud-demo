-- Allow users to read profiles in their own clinic (for Team / members list)
CREATE POLICY "Users can read profiles in their clinic" ON profiles
  FOR SELECT USING (
    clinic_id IS NOT NULL
    AND clinic_id IN (
      SELECT clinic_id FROM profiles WHERE id = auth.uid() AND clinic_id IS NOT NULL
    )
  );
