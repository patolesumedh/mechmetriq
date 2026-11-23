# Step-by-Step Guide: Connect MechOneHub to the Right Supabase Database & Log In as Super Admin

*(Written in plain, simple steps — no DevOps background required)*

---

## Why Login Said "Incorrect Email or Password" (In Simple Words)

Think of Supabase as a **filing cabinet** that holds your users and passwords:
1. Your actual accounts (`patole.sumedh@gmail.com` and `admin@mechonehub.com`) are inside Supabase cabinet **`lrxohksguucgpkgtcois`**.
2. However, the live website (`https://mechonehub.com`) was built pointing to a **different** Supabase cabinet (`zeiaakrvcduzkrnebiis`).
3. Because the website is checking the wrong cabinet, it says *"Incorrect email or password"* every time you try to log in.

To fix this permanently, we just need to copy the keys from your **`lrxohksguucgpkgtcois`** Supabase project and paste them into **GitHub** and **Google Cloud Run**.

---

## Step 1: Copy Your 3 Keys from Supabase (`lrxohksguucgpkgtcois`)

Keep a Notepad window open on your computer to temporarily paste 3 values.

1. Open your Supabase API settings page by clicking this link:
   👉 **[https://supabase.com/dashboard/project/lrxohksguucgpkgtcois/settings/api](https://supabase.com/dashboard/project/lrxohksguucgpkgtcois/settings/api)**
2. Copy these 3 items into Notepad:
   * **Item 1 — Project URL:**
     ```text
     https://lrxohksguucgpkgtcois.supabase.co
     ```
   * **Item 2 — `anon` `public` key:**
     Under **Project API keys**, find the row labelled **`anon` `public`**, click **Copy**, and paste it into Notepad. *(It starts with `eyJ...`)*
   * **Item 3 — `service_role` `secret` key:**
     Right below `anon`, find the row labelled **`service_role` `secret`**, click **Reveal**, click **Copy**, and paste it into Notepad. *(It also starts with `eyJ...` — never share this publicly).*

---

## Step 2: Update the Keys in GitHub (So the Website Builds with the Right Database)

> **Why this matters:** When GitHub builds your website container, it bakes `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` directly into the browser files.

1. Open your GitHub repository Settings:
   👉 **[https://github.com/patolesumedh/mechmetriq/settings/environments](https://github.com/patolesumedh/mechmetriq/settings/environments)**
2. Click on **`production`**.
3. Scroll down to **Environment variables** and **Environment secrets**. Where you see the items below, click the **pencil icon (Edit)** next to each one and update its value:
   * **`NEXT_PUBLIC_SUPABASE_URL`** → set to:
     ```text
     https://lrxohksguucgpkgtcois.supabase.co
     ```
   * **`NEXT_PUBLIC_SUPABASE_ANON_KEY`** → paste **Item 2 (`anon` `public` key)** from your Notepad.
   * **`SUPABASE_SERVICE_ROLE_KEY`** (under Secrets) → paste **Item 3 (`service_role` `secret` key)** from your Notepad.
4. Also check **[Settings → Secrets and variables → Actions](https://github.com/patolesumedh/mechmetriq/settings/secrets/actions)** (both the **Secrets** tab and the **Variables** tab). If `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, or `SUPABASE_SERVICE_ROLE_KEY` are listed there too, update them to the exact same values from **`lrxohksguucgpkgtcois`**.

---

## Step 3: Update Google Cloud Run (`mechonehub-web`) Environment Variables & Secrets

Now we make sure the live Google Cloud server running `mechonehub-web` also uses the keys from **`lrxohksguucgpkgtcois`**.

### Part 3A: Update `SUPABASE_SERVICE_ROLE_KEY` in Google Secret Manager (if stored as a secret)
1. Open Google Cloud Secret Manager (make sure the project dropdown at the top left says **`mechonehub-prod`**):
   👉 **[https://console.cloud.google.com/security/secret-manager?project=mechonehub-prod](https://console.cloud.google.com/security/secret-manager?project=mechonehub-prod)**
2. Look for **`SUPABASE_SERVICE_ROLE_KEY`** in the list and click on it.
3. Click **"+ NEW VERSION"** at the top.
4. Paste **Item 3 (`service_role` `secret` key)** into the Secret value box.
5. Check the box *"Disable all past versions"* (optional, keeps it clean) and click **"ADD NEW VERSION"**.

### Part 3B: Update `mechonehub-web` in Google Cloud Run
1. Open Google Cloud Run:
   👉 **[https://console.cloud.google.com/run?project=mechonehub-prod](https://console.cloud.google.com/run?project=mechonehub-prod)**
2. Click on the service named **`mechonehub-web`**.
3. At the top of the screen, click **"EDIT & DEPLOY NEW REVISION"**.
4. Scroll down and click the **"Variables & Secrets"** tab (inside the Container settings panel).
5. Look under **Environment Variables**:
   * Find **`NEXT_PUBLIC_SUPABASE_URL`** (or click **"+ Add Variable"** if it isn't listed) and set its value to:
     ```text
     https://lrxohksguucgpkgtcois.supabase.co
     ```
   * Find **`NEXT_PUBLIC_SUPABASE_ANON_KEY`** (or click **"+ Add Variable"**) and paste **Item 2 (`anon` `public` key)**.
   * Find **`SUPABASE_SERVICE_ROLE_KEY`**:
     * If it is listed as a plain Environment Variable, paste **Item 3 (`service_role` `secret` key)**.
     * If it is listed under Secrets (referencing Secret Manager `SUPABASE_SERVICE_ROLE_KEY`), make sure Version is set to **`latest`**.
6. Click the blue **"DEPLOY"** button at the very bottom of the page and wait ~30 seconds for the green checkmark.

---

## Step 4: Rebuild the Website Once in GitHub Actions

Because Next.js bakes `NEXT_PUBLIC_SUPABASE_URL` into the browser JavaScript during the Docker build step, you must trigger one build after updating Step 2:

1. Go to your GitHub Actions tab:
   👉 **[https://github.com/patolesumedh/mechmetriq/actions/workflows/deploy-production.yml](https://github.com/patolesumedh/mechmetriq/actions/workflows/deploy-production.yml)**
2. On the right side, click the **"Run workflow"** dropdown button.
3. Leave the `revision` box **empty** (so it runs a full build with your new `lrxohksguucgpkgtcois` keys) and click the green **"Run workflow"** button.
4. Wait ~2–3 minutes for all jobs (`migrate`, `build`, `deploy`) to turn green ✅.

---

## Step 5: Promote Your Account to Super Admin in Supabase

Now let's make sure your user account inside **`lrxohksguucgpkgtcois`** is marked as an active, email-verified **Super Admin** (`role = 'admin'`).

### Easiest Way (Using Your Existing `patole.sumedh@gmail.com` Account):
1. If you haven't created `patole.sumedh@gmail.com` yet, either sign up normally on `https://mechonehub.com/register` **OR** go to **[Supabase → Authentication → Users](https://supabase.com/dashboard/project/lrxohksguucgpkgtcois/auth/users)** → click **"Add user" → "Create new user"**, enter your email & password, leave **"Auto Confirm User"** checked, and click **"Create user"**.
2. Open the SQL Editor for **`lrxohksguucgpkgtcois`**:
   👉 **[https://supabase.com/dashboard/project/lrxohksguucgpkgtcois/sql/new](https://supabase.com/dashboard/project/lrxohksguucgpkgtcois/sql/new)**
3. Paste the SQL below and click **"Run"** (bottom right):

```sql
-- 1. Confirm email in Supabase Auth
UPDATE auth.users
SET email_confirmed_at = COALESCE(email_confirmed_at, now()),
    updated_at = now()
WHERE lower(email) IN ('patole.sumedh@gmail.com', 'admin@mechonehub.com');

-- 2. Promote profile to Super Admin
PERFORM set_config('mmq.trusted_profile_write', 'on', true);
```

*(Or run this single block which works in one click)*:

```sql
DO $$
BEGIN
  PERFORM set_config('mmq.trusted_profile_write', 'on', true);

  UPDATE auth.users
  SET email_confirmed_at = COALESCE(email_confirmed_at, now()),
      updated_at = now()
  WHERE lower(email) IN ('patole.sumedh@gmail.com', 'admin@mechonehub.com');

  UPDATE public.profiles
  SET role = 'admin',
      account_status = 'active',
      email_verified = true,
      verification_required = false
  WHERE lower(email) IN ('patole.sumedh@gmail.com', 'admin@mechonehub.com');

  PERFORM set_config('mmq.trusted_profile_write', 'off', true);
END $$;
```

---

## Step 6: Log In as Super Admin & Set Up 2FA (First-Time Login)

1. Open **`https://mechonehub.com/login`** (do a hard refresh `Ctrl + Shift + R` so your browser loads the freshly built JavaScript).
2. Enter your email (`patole.sumedh@gmail.com` or `admin@mechonehub.com`) and password, and click **Log In**.
3. **Two-Factor Authentication Setup (`/mfa/setup`):**
   * For security, MechOneHub requires all Super Admins to have an authenticator app enabled.
   * On your first login, you will automatically see a **QR Code** screen (`/mfa/setup`).
   * Open **Google Authenticator** (or Microsoft Authenticator / Authy) on your phone, tap **`+` → Scan a QR code**, and scan the QR code on screen.
   * Type the **6-digit code** shown in your phone app into the box and click **Verify**.
4. **You're in!**
   * You will land directly on the **Super Admin Dashboard (`/admin`)**.
   * From **`/admin/users/new`**, you can now create additional Admins, Vendors, and Buyers directly through the website UI anytime.
