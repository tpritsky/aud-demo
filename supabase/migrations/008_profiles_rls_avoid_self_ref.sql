-- Avoid RLS self-reference on profiles that can cause 500 on SELECT.
-- Replace the "read profiles in clinic" policy with a helper that reads
-- the current user's clinic_id without going through RLS.

CREATE OR REPLACE FUNCTION public.current_user_clinic_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT clinic_id FROM public.profiles WHERE id = auth.uid() AND clinic_id IS NOT NULL LIMIT 1;
$$;

DROP POLICY IF EXISTS "Users can read profiles in their clinic" ON profiles;

CREATE POLICY "Users can read profiles in their clinic" ON profiles
  FOR SELECT
  USING (
    clinic_id IS NOT NULL
    AND clinic_id = current_user_clinic_id()
  );
