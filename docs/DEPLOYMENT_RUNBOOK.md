# MECHmetrIQ (MechOneHub) — Complete Step-by-Step Deployment Runbook (v3.2.0)

> **Who is this guide for?**
> This runbook is written for a first-time deployer ("zero assumptions" beginner guide). Every code change, Dockerfile, Cloudflare Worker, database migration, and GitHub Actions pipeline is **already built inside this repository**. 
>
> This guide walks you through the **exact manual clicks and terminal commands** across GoDaddy, Cloudflare, Google Cloud Platform (GCP), Supabase, Upstash Redis, Resend, and GitHub in the right order. It includes solutions to every real-world error encountered during deployment (IAM permissions, billing linkage, unique namespaces, and headless CLI authentication).

---

## Architecture at a Glance

- **Domains (GoDaddy → Cloudflare Free DNS):**
  - `https://mechonehub.com` — Primary Production App
  - `https://www.mechonehub.com`, `https://mechonehub.in`, `https://www.mechonehub.in` — 301 Redirects to `https://mechonehub.com`
  - `https://staging.mechonehub.com` — Pre-production Staging App (locked behind Cloudflare Access OTP login)
- **Compute & Storage (Google Cloud `asia-south1` Mumbai):**
  - Production project: `mechonehub-live` (or your chosen globally unique ID)
  - Cloud Run services: `mechonehub-web` (Next.js standalone) and `mechonehub-cad-worker` (Python 3.11 + CadQuery)
  - Private GCS buckets (`gs://mechonehub-live-cad-files`, `gs://mechonehub-live-db-backups`) + Pub/Sub (`cad-analysis-jobs`) + Secret Manager
- **Database, Auth, Cache & Email (Mumbai `ap-south-1`):**
  - Supabase Free project (`mechonehub-prod`) using modern Publishable/Secret keys & Supavisor IPv4 Session Pooler
  - Upstash Redis Free database (`ap-south-1` Mumbai) for rate limiting & cache
  - Resend Free Custom SMTP (`no-reply@mechonehub.com`) to bypass Supabase's 2 emails/hour limit

---

## STEP 0: Pre-Flight Account Checklist & GitHub Authentication

Create or log into these accounts and **enable 2-Factor Authentication (Authenticator App)** on all of them:
1. **GoDaddy** ([dcc.godaddy.com](https://dcc.godaddy.com)) — where `mechonehub.com` and `mechonehub.in` are registered.
2. **Cloudflare** ([dash.cloudflare.com](https://dash.cloudflare.com)) — Free Plan.
3. **Google Cloud Platform** ([console.cloud.google.com](https://console.cloud.google.com)) — activate your billing / free trial credit.
4. **Supabase** ([supabase.com/dashboard](https://supabase.com/dashboard)) — Free Plan.
5. **Upstash** ([console.upstash.com](https://console.upstash.com)) — Free Plan.
6. **Resend** ([resend.com](https://resend.com)) — Free Plan.
7. **GitHub** ([github.com/admin-mechonehub/Mechonehub](https://github.com/admin-mechonehub/Mechonehub)) — Numeric Repo ID: `1468384222`.

> ### ⚠️ Common Problem: GitHub "Password authentication is not supported"
> GitHub no longer allows you to type your account password when cloning or pushing via git.
> **Solution:** Generate a GitHub Personal Access Token (PAT):
> 1. Go to [github.com/settings/tokens](https://github.com/settings/tokens) → **Generate new token (classic)**.
> 2. Name: `cloud-deploy`, Check the **`repo`** checkbox.
> 3. Click **Generate token** and copy the `ghp_...` key.
> 4. When terminal prompts for a password, paste this `ghp_...` token.

---

## STEP 1: GoDaddy → Cloudflare DNS Migration & Edge Security

### 1.1 Turn OFF DNSSEC in GoDaddy
1. Log into **GoDaddy → My Products → DNS** for **`mechonehub.com`**.
2. Click **DNSSEC** and confirm **DNSSEC is OFF**. *(If left ON when changing nameservers, your domain will go offline with `SERVFAIL`.)*
3. Repeat for **`mechonehub.in`**.

### 1.2 Add Both Domains to Cloudflare (Free Plan)
1. In **Cloudflare Dashboard** → click **Add a domain** → enter `mechonehub.com` → choose **Free ($0)**.
2. Add these placeholder `AAAA` records (all **Proxied / Orange Cloud**):
   | Type | Name | IPv6 Address | Proxy Status | Purpose |
   | :--- | :--- | :--- | :--- | :--- |
   | `AAAA` | `@` | `100::` | **Proxied (Orange Cloud)** | Handled by Cloudflare Worker |
   | `AAAA` | `www` | `100::` | **Proxied (Orange Cloud)** | Handled by 301 Redirect Rule |
   | `AAAA` | `staging` | `100::` | **Proxied (Orange Cloud)** | Handled by Staging Worker |
3. Copy the **2 Cloudflare Nameservers** shown and paste them into **GoDaddy → `mechonehub.com` → Nameservers → Change Nameservers**.
4. Repeat for `mechonehub.in` (add `@` and `www` with `100::` and set nameservers in GoDaddy).

### 1.3 Configure SSL, 301 Redirects & Cloudflare Turnstile
1. **SSL/TLS → Overview:** Set encryption mode to **Full (Strict)**.
2. **SSL/TLS → Edge Certificates:**
   - **Always Use HTTPS** = **ON**
   - **TLS 1.3** = **ON**
   - **Minimum TLS Version** = **TLS 1.2**
3. **Security → Bots:** Ensure **Bot Fight Mode is OFF** *(avoids blocking payment webhooks)*.
4. **Rules → Redirect Rules → Create rule:**
   - Redirect `www.mechonehub.com` to `https://mechonehub.com` (301 Dynamic Redirect).
   - In `mechonehub.in`, redirect all traffic to `https://mechonehub.com` (301 Dynamic Redirect).

### 1.4 Create Turnstile CAPTCHA Widget
1. In Cloudflare Dashboard → click **Turnstile** (left sidebar) → **Add widget**:
   - **Widget name:** `MechOneHub Production`
   - **Domains:** `mechonehub.com`
   - **Widget Mode:** **Managed**
2. Click **Create** and save both keys:
   - **Site Key** (Public): Goes into GitHub Environment as `NEXT_PUBLIC_TURNSTILE_SITE_KEY`.
   - **Secret Key** (Private): Goes into Supabase Auth settings.

---

## STEP 2: Supabase (Modern Keys), Upstash Redis & Resend SMTP

### 2.1 Create Supabase Project in Mumbai (`ap-south-1`)
1. Go to [supabase.com/dashboard](https://supabase.com/dashboard) → **New project**:
   - **Name:** `mechonehub-prod`
   - **Region:** **South Asia (Mumbai `ap-south-1`)**
   - **Plan:** Free ($0)
2. Save your Database Password!
3. Go to **Project Settings → API Keys**:
   - Copy **Project URL** (`https://<project-ref>.supabase.co`).
   - Copy **Publishable Key (`sb_pub_...`)** — used in frontend (`NEXT_PUBLIC_SUPABASE_ANON_KEY`).
   - Click reveal on **Secret Key (`sb_sec_...`)** — used in server/secret manager (`SUPABASE_SERVICE_ROLE_KEY`).
4. Click the top **Connect** button:
   - Select **Session Pooler** (Port `5432`, IPv4, host `aws-0-ap-south-1.pooler.supabase.com`).
   - Copy the URI:
     ```text
     postgresql://postgres.<PROJECT_REF>:<YOUR_DB_PASSWORD>@aws-0-ap-south-1.pooler.supabase.com:5432/postgres
     ```

### 2.2 Configure Supabase Auth URLs & Turnstile CAPTCHA
1. In **Authentication → URL Configuration**:
   - **Site URL:** `https://mechonehub.com`
   - **Redirect URLs:** Add `https://mechonehub.com/auth/callback` strictly.
2. In **Authentication → Bot and Abuse Protection**:
   - Toggle **Enable CAPTCHA protection = ON**.
   - Choose **Cloudflare Turnstile** and paste your Turnstile **Secret Key**.
3. In **Authentication → Multi-Factor**:
   - Enable **TOTP (App Authenticator)**.

### 2.3 Connect Resend Custom SMTP (Fixes 2 Emails/Hour Limit)
1. Go to [resend.com](https://resend.com) → **Domains → Add Domain** → `mechonehub.com`.
2. Cloudflare Domain Connect will prompt with **Authorize DNS records from Resend** → click **Authorize** (Cloudflare adds DKIM and CNAMEs automatically as **DNS Only / Grey Cloud**).
3. In Resend → **API Keys** → **Create API Key**:
   - Name: `mechonehub-prod-smtp`, Permission: Sending access, Domain: `mechonehub.com`. Copy key (`re_...`).
4. In **Supabase → Authentication → SMTP Settings**:
   - Toggle **Enable Custom SMTP = ON**.
   - **Sender email:** `no-reply@mechonehub.com` | **Sender name:** `MechOneHub`
   - **Host:** `smtp.resend.com` | **Port:** `465` | **Username:** `resend` | **Password:** Your Resend key (`re_...`).
5. In **Authentication → Email Templates**:
   - Update **Confirm signup**:
     ```html
     <h2>Welcome to MechOneHub</h2>
     <p>Your verification code is: <b>{{ .Token }}</b></p>
     <p><a href="{{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=email">Verify My Email</a></p>
     ```
   - Update **Reset password**:
     ```html
     <h2>Reset Your MechOneHub Password</h2>
     <p><a href="{{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=recovery&next=/reset-password">Reset Password</a></p>
     ```

### 2.4 Create Read-Only Backup User in Supabase
In **Supabase → SQL Editor**, run:
```sql
create role backup_reader with login password '<YOUR_BACKUP_PASSWORD>';
grant connect on database postgres to backup_reader;
grant usage on schema public, auth to backup_reader;
grant select on all tables in schema public, auth to backup_reader;
grant select on all sequences in schema public, auth to backup_reader;
alter default privileges in schema public, auth grant select on tables to backup_reader;
alter default privileges in schema public, auth grant select on sequences to backup_reader;
```
*(Backup URI: `postgresql://backup_reader.<PROJECT_REF>:<YOUR_BACKUP_PASSWORD>@aws-0-ap-south-1.pooler.supabase.com:5432/postgres`)*.

### 2.5 Create Upstash Redis Database (Mumbai `ap-south-1`)
1. In [console.upstash.com](https://console.upstash.com) → **Create Database**:
   - Name: `mechonehub-prod`, Region: **AWS `ap-south-1` (Mumbai)**.
2. In the database overview, scroll to **REST API** → click the **`.env`** tab:
   - Copy `UPSTASH_REDIS_REST_URL` (`https://...upstash.io`)
   - Copy `UPSTASH_REDIS_REST_TOKEN` (`AX...`)

---

## STEP 3: Google Cloud Platform (GCP) Provisioning & Fixes

Open **Google Cloud Shell** ([console.cloud.google.com](https://console.cloud.google.com/)) by clicking the `>_` terminal icon in the top right.

### 3.1 Clone the Repository
```bash
git clone https://github.com/admin-mechonehub/Mechonehub.git
cd Mechonehub
```

### 3.2 Run the Provisioning Script
```bash
chmod +x scripts/provision-gcp.sh

ENV=prod \
  PROJECT_ID="mechonehub-live" \
  UPSTASH_REDIS_REST_URL="<YOUR_UPSTASH_REST_URL>" \
  ./scripts/provision-gcp.sh
```

---

### ⚠️ Common GCP Problems & Solutions Experienced:

#### Issue 1: "Project ID is already in use by another project"
- **Cause:** GCP project IDs are globally unique across all Google Cloud users worldwide.
- **Fix:** Specify a unique ID via `PROJECT_ID="mechonehub-live"` (or `mechonehub-app-prod`).

#### Issue 2: "Project display name contains invalid characters"
- **Cause:** Google Cloud prohibits parentheses `(` or `)` in project display names.
- **Fix:** The script uses clean display names without parentheses (e.g. `MechOneHub prod`).

#### Issue 3: "Billing account is not open / UREQ_PROJECT_BILLING_NOT_FOUND"
- **Cause:** Cloud Run and Artifact Registry require an active billing account linked to the project.
- **Fix:** Go to [console.cloud.google.com/billing/linkedaccount?project=mechonehub-live](https://console.cloud.google.com/billing/linkedaccount?project=mechonehub-live), select your Billing Account, and click **Set Account**.

#### Issue 4: "Bucket namespace is shared by all users / HTTPError 409"
- **Cause:** Google Cloud Storage bucket names are globally unique worldwide.
- **Fix:** The script dynamically names buckets based on your project: `gs://mechonehub-live-cad-files` and `gs://mechonehub-live-db-backups`.

#### Issue 5: "PERMISSION_DENIED: Permission 'iam.serviceAccounts.setIamPolicy' denied"
- **Cause:** In Google Workspace organizations, users have `Owner (legacy)` by default, which lacks granular permission to bind Workload Identity to service accounts.
- **Fix:**
  1. Open [console.cloud.google.com/iam-admin/iam?project=mechonehub-live](https://console.cloud.google.com/iam-admin/iam?project=mechonehub-live).
  2. Click the pencil icon next to your email (`admin@mechonehub.com`).
  3. Click **+ Add another role** → select **Service Account Admin**. Click **Save**.
  4. Run the binding command in Cloud Shell:
     ```bash
     PROJECT_NUM=$(gcloud projects describe mechonehub-live --format="value(projectNumber)")
     gcloud iam service-accounts add-iam-policy-binding "deployer@mechonehub-live.iam.gserviceaccount.com" \
       --project=mechonehub-live \
       --role="roles/iam.workloadIdentityUser" \
       --member="principalSet://iam.googleapis.com/projects/${PROJECT_NUM}/locations/global/workloadIdentityPools/github/attribute.environment/production"
     ```

---

### 3.3 Populate Secrets in Secret Manager via UI (or CLI)
Go to [console.cloud.google.com/security/secret-manager?project=mechonehub-live](https://console.cloud.google.com/security/secret-manager?project=mechonehub-live):
Click on each secret → click **+ New version** → paste value → **Add new version**:

1. **`KYC_ENCRYPTION_KEY`**: Generate via `openssl rand -base64 32` (save in password manager).
2. **`SUPABASE_SERVICE_ROLE_KEY`**: Your Supabase Secret Key (`sb_sec_...`).
3. **`UPSTASH_REDIS_REST_TOKEN`**: Your Upstash Token (`AX...`).
4. **`SENTRY_DSN`**: `https://dummy@sentry.io/123` (or real Sentry DSN).
5. **`RAZORPAY_KEY_ID`**: `rzp_test_placeholder` (or real Razorpay Key ID).
6. **`RAZORPAY_KEY_SECRET`**: `rzp_test_secret_placeholder` (or real Razorpay Key Secret).
7. **`RAZORPAY_WEBHOOK_SECRET`**: `rzp_webhook_placeholder` (or real webhook secret).

*(Note: `ORIGIN_VERIFY_SECRET` and `CAD_CALLBACK_SECRET` are auto-generated with random 32-byte tokens by the script).*

---

## STEP 4: Deploy the Cloudflare Worker Edge Proxy

The reverse proxy lives in `cloudflare-worker/` and forwards traffic to Cloud Run while attaching the origin verification secret.

### 4.1 Generate Cloudflare API Token (Avoids Headless Login Issues)
Because Google Cloud Shell runs on a remote container, it cannot open a browser on `localhost:8976`.
1. Go to [dash.cloudflare.com/profile/api-tokens](https://dash.cloudflare.com/profile/api-tokens) → **Create Token**.
2. Click **Use template** next to **Edit Cloudflare Workers**.
3. Under **Account Resources**: select your account. Under **Zone Resources**: select `All zones` (or `mechonehub.com`).
4. Click **Continue to summary** → **Create Token** → Copy your token.

### 4.2 Deploy from Cloud Shell
In Cloud Shell, run:
```bash
cd ~/Mechonehub/cloudflare-worker

export CLOUDFLARE_API_TOKEN="<YOUR_COPIED_TOKEN>"

npx wrangler deploy
```

### 4.3 Attach the Origin Secret
```bash
SECRET=$(gcloud secrets versions access latest --secret=ORIGIN_VERIFY_SECRET --project=mechonehub-live)

printf "%s" "$SECRET" | npx wrangler secret put ORIGIN_VERIFY_SECRET
```

---

## STEP 5: Configure GitHub Environments & CI/CD Pipeline

Go to [github.com/admin-mechonehub/Mechonehub](https://github.com/admin-mechonehub/Mechonehub) → **Settings → Environments**:

### 5.1 Environment: `production`
Click **New environment** → Name: `production`:
Add these to **Environment secrets** (our workflows support `vars.KEY || secrets.KEY` seamlessly):

| Secret / Variable Name | Value |
| :--- | :--- |
| **`GCP_PROJECT`** | `mechonehub-live` |
| **`GCP_WIF_PROVIDER`** | `projects/486135922224/locations/global/workloadIdentityPools/github/providers/github-actions` |
| **`NEXT_PUBLIC_SITE_URL`** | `https://mechonehub.com` |
| **`NEXT_PUBLIC_SUPABASE_URL`** | `https://<YOUR_SUPABASE_REF>.supabase.co` |
| **`NEXT_PUBLIC_SUPABASE_ANON_KEY`** | Modern Supabase Publishable Key (`sb_pub_...`) |
| **`NEXT_PUBLIC_TURNSTILE_SITE_KEY`** | Cloudflare Turnstile Site Key (from Step 1.4) |
| **`SUPABASE_SESSION_POOLER_URL`** | `postgresql://postgres.<REF>:<PASS>@aws-0-ap-south-1.pooler.supabase.com:5432/postgres` |
| **`CLOUDFLARE_API_TOKEN`** | Cloudflare API Token (from Step 4.1) |

---

### ⚠️ Common CI/CD Issue: Candidate Revision Health-Check 403
- **Symptoms:** GitHub Actions `deploy` step fails with `curl: (22) The requested URL returned error: 403` when probing `$CANDIDATE_URL/api/health`.
- **Cause:** Cloud Run tagged revisions require an authenticated Google Cloud caller identity token (`Authorization: Bearer $(gcloud auth print-identity-token)`) and the application's edge verification header (`X-Origin-Verify`).
- **Resolution (built into workflow):** The pipeline automatically generates the identity token and pulls `ORIGIN_VERIFY_SECRET` to verify `/api/health` before shifting 100% traffic live!

### ⚠️ Google Workspace Org Policy Issue: "Domain restricted sharing" blocks `allUsers`
- **Symptoms:**
  - Running `gcloud run services add-iam-policy-binding mechonehub-web --member="allUsers" ...` fails with:
    `FAILED_PRECONDITION: One or more users named in the policy do not belong to a permitted customer, perhaps due to an organization policy.`
  - Direct browser visits to `https://mechonehub.com` display:
    `Error: Forbidden - Your client does not have permission to get URL / from this server.`
- **Cause:**
  When Google Workspace or Cloud Identity manages the domain (`mechonehub.com`), Google Cloud automatically enforces the Organization Policy `constraints/iam.allowedPolicyMemberDomains` ("Domain restricted sharing"). This prevents any IAM binding to `allUsers`.
- **Resolution:**
  1. In Google Cloud Console, navigate to **IAM & Admin → Organization Policies**.
  2. Filter or search for **Domain restricted sharing**.
  3. Ensure your project (`mechonehub-live` / `MechOneHub prod`) is selected in the top bar.
  4. Click **Edit policy**:
     - Under **Policy source**, select **Override parent's policy**.
     - Under **Rules**, click **Add a rule** (or edit existing rule).
     - Under **Policy values**, select **Allow all** (or set enforcement to **Off**).
     - Click **Set policy**.
  5. Return to Cloud Shell and re-run:
     ```bash
     gcloud run services add-iam-policy-binding mechonehub-web \
       --project=mechonehub-live \
       --region=asia-south1 \
       --member="allUsers" \
       --role="roles/run.invoker"
     ```
  6. Re-run the failed GitHub Actions job or refresh `https://mechonehub.com`.

---

## STEP 6: Verification & Post-Launch Checklist

Once GitHub Actions finishes deployment, verify these checks:

### Functional Checks
- [ ] **Live Web:** Visit `https://mechonehub.com/` → verify official vector logo, navigation, and pages render.
- [ ] **Health Endpoint:** Visit `https://mechonehub.com/api/health` → returns `{"status":"ok"}`.
- [ ] **Sign Up / Login:** Sign up a test account. Confirm Cloudflare Turnstile passes, Resend delivers the 6-digit verification code, and login persists.
- [ ] **CAD Analysis:** Go to `/buyer/quote`, upload a `.STEP` file. Confirm direct upload to `gs://mechonehub-live-cad-files`, Pub/Sub invocation of `mechonehub-cad-worker`, and thumbnail generation.

### Security Checks
- [ ] **Direct Cloud Run Lock:** Visiting `https://mechonehub-web-486135922224.asia-south1.run.app/` directly returns **`403 Forbidden`**. All traffic must enter through Cloudflare!
- [ ] **Internal Endpoints Protected:** Visiting `https://mechonehub.com/api/internal/cad-result` returns `404` or `403`.

---

## STEP 7: Maintenance & Routine Operations

1. **Deploying Future Changes:**
   Simply push or merge your code into `main`! GitHub Actions will:
   - Run database migrations via Supavisor.
   - Build new Docker images and push to Mumbai Artifact Registry.
   - Deploy a zero-downtime tagged revision to Cloud Run.
   - Health-check the candidate revision.
   - Shift 100% traffic to the new build.
2. **Rotating Secrets:**
   Update the secret in Google Secret Manager. Cloud Run automatically mounts `:latest` on every subsequent revision.
3. **Database Backups:**
   Trigger the `Nightly Database Backup` workflow in GitHub Actions to create encrypted `.dump.age` files in `gs://mechonehub-live-db-backups/daily/`.
