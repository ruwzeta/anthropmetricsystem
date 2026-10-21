# Tester sign-in and the accuracy study

The **Testing** tab lets volunteers sign in, agree to the study terms, measure themselves with the app, enter their own tape measurements and leave feedback. The results are collected so the app's accuracy can be measured on real people.

Photos never leave the tester's device. Only numbers, ratings, comments and the device type are stored.

## How it works for a tester

1. Open the app, go to **Testing**, and sign in with an email address. Supabase emails a sign-in link and a 6-digit code; either works.
2. Read what is collected and agree (18 or older, and consent to the study). Name is required; age range and sex are optional.
3. Measure yourself with a tape first and write the values down, before looking at the app's numbers.
4. **Start a test**: enter height, take the front and side photos.
5. Under the measurement card, enter the tape values, rate the app (ease, and how close the values were) and add comments, then **Send test**.
6. Testers can see their own tests and can **Withdraw and delete my data** at any time.

## Without a server (default)

If no Supabase keys are set, the Testing tab runs in *test mode*: sign-in needs no email check and results are kept in that browser only. Whoever uses that device can see the study results and export them. This is useful for trying the flow or running a session on a single shared phone, but it does not collect results from other people.

## Setting up Supabase (to collect results from every tester)

Supabase's free plan is enough for a study of this size.

1. **Create a project** at <https://supabase.com/dashboard> (any region; note the database password somewhere safe, the app does not need it).
2. **Create the tables.** In the dashboard, open **SQL Editor → New query**, paste the whole of [`supabase/schema.sql`](../supabase/schema.sql) and run it. It creates `testers`, `test_submissions` and `study_admins` with row-level security, so each tester can only read and delete their own data.
3. **Allow the sign-in redirect.** Under **Authentication → URL Configuration** set **Site URL** to the app's address, for example `https://ruwzeta.github.io/anthropmetricsystem/`, and add the same address followed by `**` to **Redirect URLs**. Add `http://localhost:5173/**` too if you run it locally.
4. **Show the code in the sign-in email (recommended).** Under **Authentication → Emails → Magic Link**, add `{{ .Token }}` to the template, for example `Your code is {{ .Token }}`. Testers who open the email on another device can then type the code instead of following the link.
5. **Give the app the keys.** Under **Project Settings → API** (or **Connect**) copy the *Project URL* and the *publishable* key (called `anon` in older projects). The publishable key is meant to be public; row-level security is what protects the data. Never use the `service_role` / secret key in the app.
   - **GitHub Pages:** in the repository go to **Settings → Secrets and variables → Actions → Variables** and add `SUPABASE_URL` and `SUPABASE_ANON_KEY`. The Pages workflow passes them to the build. Re-run the workflow (or push) to rebuild.
   - **Local development:** create `.env.local` in the repository root (it is git-ignored):
     ```
     VITE_SUPABASE_URL=https://your-project.supabase.co
     VITE_SUPABASE_ANON_KEY=your-publishable-key
     ```
6. **Make yourself an admin.** Sign in once in the app as a tester, then in the SQL editor run:
   ```sql
   insert into public.study_admins (user_id)
   select id from auth.users where email = 'you@example.com';
   ```
   Reload the Testing tab and the **Study results** panel appears.

The built-in Supabase email sender is rate limited (a few emails per hour). For more than a handful of testers, add an SMTP provider under **Authentication → Emails → SMTP Settings**.

## Study results

Admins see, for each measurement, how many tests have a tape value, the **bias** (mean of photo − tape; positive means the app measures too large), the **mean absolute error**, and the share of tests within ±2 cm. These use the raw photo estimates, before any per-device calibration, so they describe the measuring method itself.

- **CSV** is long format, one row per test and measurement, in cm: `submission_id, tester_id, date, age_range, sex, height_cm, side_photo, measurement, photo_cm, confidence, shown_cm, tape_cm, error_cm, ease, trust, app_version, device`. Names and emails are left out; `tester_id` links rows from the same person. This is the file to analyse for the research paper.
- **JSON** has everything, including tester names and comments, for the study team only.

Change `CONSENT_VERSION` in [`src/lib/study.ts`](../src/lib/study.ts) whenever the consent text changes, and every tester is asked to agree again.
