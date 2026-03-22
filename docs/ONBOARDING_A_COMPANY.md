# Onboarding a Company & Voice Agent Setup

How to onboard a new clinic/company and get their phone numbers set up with the voice agent.

---

## Who can onboard

You need a **super_admin** account. Create one (one-time) with:

```bash
node scripts/create-super-admin.js your-superadmin@example.com
```

Then sign in at your app URL and go to **Businesses** (`/businesses`).

---

## Step 1: Create the business (in the app)

1. Sign in as **super_admin** and open **Businesses** (`/businesses`).
2. In **Create new business**:
   - **Business name**: e.g. “Acme Hearing”
   - **Vertical**: Audiology, Ortho, Law, or General
3. Click **Create**. The new company appears in **All companies**.

---

## Step 2: Create the clinic’s first user (Supabase Dashboard)

The first admin must exist as a user before you can assign them in the app.

1. Open your **Supabase** project → **Authentication** → **Users**.
2. Click **Add user** → **Create new user** (or **Invite user**).
3. Enter the clinic admin’s **email** and a **temporary password** (or send invite).
4. Save. A row in `profiles` is created automatically by the app’s trigger.

---

## Step 3: Assign that user as admin of the business (in the app)

1. Back in **Businesses** (`/businesses`), find **Assign admins to a business**.
2. **Business**: Select the company you created (e.g. Acme Hearing).
3. In the user list, find the person you just created in Supabase (you may need to click **Refresh user list**).
4. Click that user. Confirm making them admin of the selected business.
5. They are now an **admin** of that clinic and can sign in.

---

## Step 4: You set their voice agent and clinic number (they don’t touch API or Eleven Labs)

**You** configure the voice agent and clinic number from the app so the clinic never has to.

1. In **Businesses** (`/businesses`), click the company you created.
2. In the detail sheet, open the **Voice agent & clinic number** section.
3. Enter:
   - **Clinic name**
   - **Clinic phone number** (their main number for display/context)
   - **Eleven Labs inbound agent ID** (voice agent for inbound calls)
   - **Eleven Labs outbound agent ID** (for outbound / callbacks)
   - **Eleven Labs phone number ID** (the number used for the agent)
4. Click **Save voice agent settings**. That clinic’s users will see this config in the app automatically; they don’t need to configure anything in Settings.

---

## How do I get the phone number ID for the number the business owns?

There are **two different** “phone number” fields:

| Field in the app | What it is |
|------------------|------------|
| **Clinic phone number** | The business’s own number (e.g. their main line). Used for **display and context** only (what patients see, what the agent says). You can type it in as they give it to you (e.g. `+1 (555) 123-4567`). |
| **Eleven Labs phone number ID** | An ID like `phnum_6801k9fx8bw8fw2tftsqdt4xmj58`. This is **not** derived from the business’s number. It’s the ID of a **phone number that Eleven Labs provides** and that the voice agent will use to make and receive calls. |

So: the business “owns” their **clinic phone number** (you just copy it). The **phone number ID** comes from **Eleven Labs**, for a number that **Eleven Labs** owns and that you assign to that business.

### How to get the Eleven Labs phone number ID

1. **Log in to Eleven Labs** (your platform account, or the account you use for Conversational AI / voice agents).
2. **Open the section where phone numbers are managed** (often **Conversational AI** → **Phone numbers**, or **Settings** → **Phone numbers** — the exact name depends on the current Eleven Labs product).
3. **Either:**
   - **Provision a new number** for this business: buy or assign a number there. Eleven Labs will show the number and its **Phone number ID** (starts with `phnum_`). Copy that ID into your app.
   - **Or use an existing number**: if you already have a number set up in Eleven Labs, open it and copy its **Phone number ID** (`phnum_...`).
4. **Paste that ID** into the **Eleven Labs phone number ID** field in your app (Businesses → company → Voice agent & clinic number).

So in practice: you get the **clinic phone number** from the business. You get the **phone number ID** from the Eleven Labs dashboard when you set up (or select) the number that will actually handle the AI calls for that business.

### Using the business’s existing number vs. a new number

You’re right that you can’t just “point” the AI at the business’s current number without some kind of verification or approval. In practice there are two paths:

**Option A – New number from Eleven Labs (simplest)**  
- You **provision a new number** from Eleven Labs (no ownership check on the business’s number).  
- You get the **phone number ID** for that new number from the Eleven Labs dashboard and enter it in the app.  
- You give **that new number** to the business. They can:  
  - Forward their existing clinic number to this new number (with their current carrier), or  
  - Start giving out the new number to patients.  
- The AI answers on the new number. No port or carrier approval needed for the new number itself; any “back check” is only if they set up forwarding with their carrier.

**Option B – Use the business’s current number for the AI**  
- To have the **AI answer directly on the number patients already call**, that number usually has to be **ported** to Eleven Labs (or their telephony partner) or otherwise verified.  
- That process involves the **business** proving ownership (carrier forms, verification, sometimes a port request). So there **is** a back check and approval — with the carrier and/or Eleven Labs — before that number can be used for the agent.  
- Once the port/verification is done, that number will appear in your Eleven Labs dashboard and you’ll get its **phone number ID** to paste into the app.

So: **no, you can’t just take a number of your choice and have it take AI calls without verification/approval.** Either you use a **new** number from Eleven Labs (and optionally have the business forward to it), or you go through the **port/verification** process for their existing number and then use that number’s ID once it’s approved.

### How hard is port verification?

**In general (US number porting):** Medium effort, not instant.

- **What’s involved:** The business (or you on their behalf) submits a **Letter of Authorization (LOA)** and account details to the *gaining* carrier (the one that will host the number — e.g. Twilio). The *losing* carrier (current provider) must approve the port. Details (account number, PIN, service address, billing address) have to match the losing carrier’s records or the port is rejected.
- **Time:** In the US, often **10–30 business days** (sometimes a few days for simple cases). Don’t cancel the old service until the port completes or you can lose the number.
- **Difficulty:** Mostly paperwork and correct info. One wrong digit or mismatched address can mean rejection and starting over. So it’s not “hard” in a technical sense, but it’s **fussy and slow**.

**With Eleven Labs specifically:** Eleven Labs doesn’t port numbers themselves. They let you **import** numbers from:

- **Twilio** (number must already be on Twilio — so you’d **port the business’s number to Twilio first**, then import that Twilio number into Eleven Labs using Twilio SID/token), or  
- **SIP trunk** (the number stays where it is; you connect it to Eleven Labs via SIP so calls are sent to the AI).

So the “port verification” you’re thinking of is really **Twilio’s port process** (or another carrier’s) if you want the business’s existing number. That’s the step that has the LOA, approval, and 1–4 week timeline. Once the number is on Twilio, connecting it to Eleven Labs is just config (and you get the `phnum_...` ID from Eleven Labs after the import).

**Bottom line:** Port verification is **medium** — doable, but it’s paperwork, correct account details, and a 1–4 week wait. Easiest path is still **new number from Twilio → import into Eleven Labs → give that number to the business** (or have them forward their existing number to it), and skip porting entirely unless they must keep answering on the exact same number from day one.

---

## Optional: Invite more team members (by the clinic admin)

After the first admin is set up, they can:

1. Go to **Team** (`/team`).
2. Use **Invite member** (email + optional name + role).
3. Invited users get an email to set their password and join the same clinic.

No need for you to create those users in Supabase; the clinic admin does it from the app.

---

## Summary

| Step | Where | What |
|------|--------|------|
| 1 | App → **Businesses** | Create the company (name + vertical). |
| 2 | Supabase → **Auth → Users** | Create the first user (email + password or invite). |
| 3 | App → **Businesses** | Assign that user as **admin** of the new company. |
| 4 | App → **Businesses** → click company → **Voice agent & clinic number** | You set clinic name, phone number, and Eleven Labs agent/phone IDs. The clinic never touches API or Eleven Labs. |
