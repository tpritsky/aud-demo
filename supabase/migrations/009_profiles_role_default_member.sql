-- Fix: profiles.role default was still 'audiologist' after 006 changed CHECK to admin|member.
-- New users created by handle_new_user() trigger get role from default; without this they violate the constraint.

ALTER TABLE profiles
  ALTER COLUMN role SET DEFAULT 'member';

-- Make trigger explicitly set role so it doesn't rely on column default
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    'member'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
