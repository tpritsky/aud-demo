# Implementation Plan: Pre-added Users + Clinic Admins + Get Started

Execute in order. Each phase is shippable on its own.

---

## Phase 1: Schema

**Goal:** Add vertical/settings to clinics, role to profiles, and a table for request-access submissions.

### 1.1 Migration: `006_clinic_vertical_settings_profiles_role_contact_submissions.sql`

- **clinics**
  - Add `vertical` TEXT (e.g. `'audiology' | 'ortho' | 'law' | 'general'`), default `'general'`.
  - Add `settings` JSONB (optional), default `{}`. For risk flags, emphasis, feature toggles later.
- **profiles**
  - Add `role` TEXT, default `'member'`, check `role IN ('admin', 'member')` (or `'owner'` if you want).
- **contact_submissions** (new table)
  - `id` UUID PK, `name` TEXT, `email` TEXT, `phone` TEXT, `business_type` TEXT, `phone_spend` TEXT (dropdown value), `message` TEXT nullable, `created_at` TIMESTAMPTZ.
  - RLS: service role or no public insert from client; use API route with service role to insert, or allow anon insert if you prefer (then validate in API).

### 1.2 Types

- Update `lib/db/types.ts`: `ClinicRow` (vertical, settings), `ProfileRow` (role), add `ContactSubmissionRow` and table in `Database`.
- Update `lib/types.ts` (or app types): clinic vertical enum, profile role type, contact submission shape if used in UI.

### 1.3 Backfill

- Existing profiles: set `role = 'admin'` where appropriate (e.g. all existing users, or first user per clinic).
- Existing clinics: set `vertical = 'audiology'` (or 'general').

**Done when:** Migration runs cleanly, types compile, existing users have a role.

---

## Phase 2: Landing + Get Started

**Goal:** One prominent “Get started” CTA that opens two choices: Register new business | Log into existing business.

### 2.1 Landing page (`app/page.tsx`)

- Make “Get started” the primary, above-the-fold CTA (large button).
- Click “Get started” → open a modal or navigate to `/get-started`.
- Option A: Modal with two buttons. Option B: Dedicated `/get-started` page with two cards/buttons. Choose one and stick to it.

### 2.2 Get started choices

- **Register new business** → Navigate to `/request-access` (or `/contact`).
- **Log into existing business** → Navigate to `/dashboard` (which shows the existing login screen in the app shell when not authenticated).

### 2.3 Nav links

- Ensure “Log In” / “Get Started” in the header point to the same flow (e.g. “Get started” opens the modal or `/get-started`).

**Done when:** From landing, one click to “Get started” → two clear options; Register goes to request-access, Log in goes to dashboard (login).

---

## Phase 3: Request-Access Form + API

**Goal:** Form for “Register new business” and “Not a member” path; submissions stored and (optional) team notified.

### 3.1 Route and form

- **Page:** `app/request-access/page.tsx` (or `app/contact/page.tsx`).
- **Fields:** Name, Email, Phone, Business type (dropdown), Current spend on phone answering (dropdown), Optional message (textarea).
- **Submit:** Client calls `POST /api/contact` (or `/api/request-access`).

### 3.2 API route

- **File:** `app/api/contact/route.ts` (or `app/api/request-access/route.ts`).
- Validate body (required fields, email format).
- Insert into `contact_submissions` (use Supabase client with service role, or anon if RLS allows insert).
- Optional: send email to team or webhook (e.g. Slack). Keep simple in v1.
- Return 200 and a simple success payload.

### 3.3 Thank-you

- After submit: redirect to `/request-access/thank-you` or show in-page success message with copy like “Thanks, we’ll be in touch.”

**Done when:** User can open request-access, submit form, see thank-you; row appears in `contact_submissions`.

---

## Phase 4: Login Screen Updates

**Goal:** No public sign-up; “Not a member? Request access” and clear copy for enterprise users.

### 4.1 Remove sign-up from login

- In `components/auth/login-screen.tsx`: Remove or hide the “Don’t have an account? Sign up” toggle and sign-up branch. Only show email + password and “Sign in.”

### 4.2 Add “Not a member” path

- Add link/button: “Not a member? Request access” → navigate to `/request-access`.
- Optional short line: “Only pre-added members can log in. Part of a company? Ask your system administrator to add you to your enterprise account.”

### 4.3 Failed login

- Keep generic “Invalid login credentials” (do not distinguish invalid email vs wrong password).
- Below error, add “Not a member? Request access” linking to `/request-access`.

**Done when:** Login has no sign-up; request-access is one click away; failed login suggests request access without leaking member existence.

---

## Phase 5: Clinic Admin – Team Page + Invite

**Goal:** Clinic admins can see members and invite by email; invited users get Supabase invite and profile linked to clinic.

### 5.1 Team / Members page

- **Route:** e.g. `app/settings/team/page.tsx` or `app/team/page.tsx`, or a “Team” tab under Settings.
- **Visibility:** Only for users with `profiles.role === 'admin'` (for their clinic). Others redirect or hide nav.
- **Content:**
  - List current members: from `profiles` where `clinic_id` = current user’s clinic. Show email, name, role. (Optionally allow admin to change role or remove member later.)
  - “Invite member” form: email (required), optional name, role (default member). Submit → call invite API.

### 5.2 Invite API (server-only, service role)

- **File:** `app/api/invite/route.ts`.
- **Auth:** Require authenticated user; verify they are admin for their clinic (load profile by auth.uid(), check role).
- **Body:** email, optional full_name, role (default 'member').
- **Logic:**
  - Create Supabase admin client with `SUPABASE_SERVICE_ROLE_KEY`.
  - Call `auth.admin.inviteUserByEmail(email, { data: { full_name } })` (or equivalent). Optionally set redirectTo for post-set-password.
  - After invite (or in a trigger/hook): ensure `profiles` row for that user with `clinic_id` = admin’s clinic and `role` = body.role. Options: (a) create profile in same API after invite (you’ll have the new user id from the invite response), or (b) use a Supabase trigger on auth.users that creates profile and sets clinic_id/role from metadata you pass in invite options. Option (a) is simpler if Supabase returns the created user.
- Return 200 or 4xx with clear message (e.g. “User already invited” or “Invalid email”).

### 5.3 Profile creation for invited user

- If Supabase’s `inviteUserByEmail` creates the user immediately, you get the user id in the response. In the same API, insert into `profiles` (id = new user id, clinic_id = admin’s clinic_id, role = member, email = invited email). If the trigger `handle_new_user` already creates a profile, you’ll need to update that profile with clinic_id and role (or create a new trigger that runs on invite and sets metadata). Easiest: in invite API, after invite, upsert profile for that user id with clinic_id and role.
- Ensure RLS allows this: e.g. service role bypasses RLS, or a policy that allows insert/update for profiles when the current user is an admin of the same clinic_id (complex). Simplest: do profile insert/update from the API route using the service role client so RLS doesn’t block.

### 5.4 Sidebar / nav

- Add “Team” (or “Members”) to the sidebar for admin users only (read profile.role from store or context).

**Done when:** Clinic admin can open Team, see members, invite by email; invited user receives email, sets password, and can log in; their profile has correct clinic_id and role.

---

## Phase 6: RLS + Security

**Goal:** Members see only their clinic’s data; only admins can invite; service role never in client.

### 6.1 Profiles RLS

- Users can read profiles where `clinic_id` = their own `profiles.clinic_id` (same clinic). Optionally: only admins can update other users’ role or delete; members can update only their own row (e.g. full_name).
- If you use “list members” from the app with the anon key, ensure SELECT is allowed for same-clinic profiles. Invite API uses service role so it can create/update profiles regardless.

### 6.2 Clinics RLS

- Already: users can SELECT/UPDATE clinic where they belong (profile.clinic_id = clinic.id). Add UPDATE for clinic.vertical and clinic.settings for admin only if you want; or allow any same-clinic user to edit (simpler).

### 6.3 contact_submissions

- No direct client insert if you prefer: only API route (with or without service role) inserts. Or allow anon insert with a simple policy and validate in API.

### 6.4 Checklist

- Service role key only in server env and API routes, never in client bundle.
- Login never reveals whether email exists; “Request access” is the only path for non-members.
- Invite API checks current user is admin of the clinic before calling auth.admin.inviteUserByEmail.

**Done when:** RLS matches the above; no service role in client; invite is admin-only.

---

## Phase 7: Docs – First Clinic Admin

**Goal:** Clear steps for creating the first clinic and first clinic admin (no in-app “create clinic” for v1).

### 7.1 Document

- Add a section to `SUPABASE_SETUP.md` or a new `FIRST_CLINIC_ADMIN.md`: 
  1. Create clinic: insert into `clinics` (name, vertical). Note the clinic id.
  2. Create first user: Supabase Dashboard → Authentication → Users → Add user (or Invite by email). Set email and (temporary or invite) password.
  3. Create profile: insert into `profiles` (id = auth user id, email, clinic_id = clinic id, role = 'admin'). Or run a small SQL script that does (1)+(3) and you add the user in the dashboard.
- Optional: one-time script or SQL that creates a clinic and outputs “Now add a user in Supabase and run this with the user id: INSERT INTO profiles ...”.

**Done when:** Someone can follow the doc to create a clinic and first admin, then that admin can log in and invite members.

---

## Order Summary

1. **Phase 1** – Schema and types.
2. **Phase 2** – Get started on landing and two options.
3. **Phase 3** – Request-access form, API, thank-you.
4. **Phase 4** – Login: no sign-up, request-access link and copy.
5. **Phase 5** – Team page and invite API (service role, profile upsert).
6. **Phase 6** – RLS and security review.
7. **Phase 7** – Docs for first clinic admin.

---

## Files to Add/Edit (Quick Reference)

| Phase | Add | Edit |
|-------|-----|------|
| 1 | `supabase/migrations/006_*.sql` | `lib/db/types.ts`, `lib/types.ts` |
| 2 | `app/get-started/page.tsx` or modal in `app/page.tsx` | `app/page.tsx` (CTA, links) |
| 3 | `app/request-access/page.tsx`, `app/request-access/thank-you/page.tsx`, `app/api/contact/route.ts` | – |
| 4 | – | `components/auth/login-screen.tsx` |
| 5 | `app/team/page.tsx` (or under settings), `app/api/invite/route.ts` | Sidebar nav (Team for admins), `components/providers/app-provider.tsx` or store (load profile.role) |
| 6 | – | RLS in migration or new migration |
| 7 | `FIRST_CLINIC_ADMIN.md` or section in `SUPABASE_SETUP.md` | – |

You can start with Phase 1 and proceed in order; each phase leaves the app in a working state.
