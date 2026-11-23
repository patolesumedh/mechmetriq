# MECHmetrIQ (MechOneHub) — Complete Step-by-Step Deployment Runbook (v3.1.0)

> **Who is this guide for?**
> This runbook is written for a first-time deployer ("zero assumptions"). Every code change, Dockerfile, Cloudflare Worker, database migration, and GitHub Actions pipeline is **already built inside this repository**. This guide walks you through the **exact manual clicks and terminal commands** in GoDaddy, Cloudflare, Google Cloud, Supabase, Upstash, Resend, and GitHub in the right order so you don't miss a single setting.

---

## Architecture at a Glance

- **Domains (GoDaddy → Cloudflare Free DNS):**
  - `https://mechonehub.com` — Primary Production App
  - `https://www.mechonehub.com`, `https://mechonehub.in`, `https://www.mechonehub.in` — 301 Redirects to `https://mechonehub.com`
  - `https://staging.mechonehub.com` — Pre-production Staging App (locked behind Cloudflare Access OTP login for team emails only)
- **Compute & Storage (Google Cloud `asia-south1` Mumbai):**
  - Two separate GCP projects: `mechonehub-staging` and `mechonehub-prod`
  - Two Cloud Run services per project: `mechonehub-web` (Next.js standalone) and `mechonehub-cad-worker` (Python 3.11 + CadQuery, zero DB credentials)
  - Private GCS buckets (`gs://mechonehub-<env>-cad-files`) + Pub/Sub (`cad-analysis-jobs`) + Secret Manager
- **Database, Auth, Cache & Email (Mumbai `ap-south-1`):**
  - Two Supabase Free projects (`mechonehub-staging`, `mechonehub-prod`)
  - Two Upstash Redis Free databases (`ap-south-1`)
  - Resend Free Custom SMTP (`no-reply@mechonehub.com`)

---

## STEP 0: Pre-Flight Account Checklist (Before You Start)

Create or log into these accounts and **enable 2-Factor Authentication (Authenticator App)** on all of them:
1. **GoDaddy** ([dcc.godaddy.com](https://dcc.godaddy.com)) — where `mechonehub.com` and `mechonehub.in` are registered.
2. **Cloudflare** ([dash.cloudflare.com](https://dash.cloudflare.com)) — Free Plan.
3. **Google Cloud Platform** ([console.cloud.google.com](https://console.cloud.google.com)) — activate the $300 90-day free trial credit.
4. **Supabase** ([supabase.com/dashboard](https://supabase.com/dashboard)) — Free Plan.
5. **Upstash** ([console.upstash.com](https://console.upstash.com)) — Free Plan.
6. **Resend** ([resend.com](https://resend.com)) — Free Plan.
7. **Sentry** ([sentry.io](https://sentry.io)) — Free Developer Plan.
8. **BetterStack** ([betterstack.com](https://betterstack.com)) — Free Uptime Plan.
9. **GitHub** ([github.com/admin-mechonehub/Mechonehub](https://github.com/admin-mechonehub/Mechonehub)).

Also install on your computer (or use **Google Cloud Shell** in your browser, which already has `gcloud`, `openssl`, `git`, and `node` pre-installed!):
- Google Cloud CLI (`gcloud`)
- Node.js 22+ (`node`, `npx`)
- GitHub CLI (`gh`)

---

## STEP 1: GoDaddy → Cloudflare DNS Migration & Edge Security (Day 1A)

### 1.1 Export Existing DNS & Turn OFF DNSSEC in GoDaddy
1. Log into **GoDaddy → My Products → DNS** for **`mechonehub.com`**.
2. Take a screenshot or click **Export** of your current DNS records (especially any **MX** email records if you use Google Workspace / Zoho / Microsoft 365).
3. Click **DNSSEC** and make sure **DNSSEC is OFF**. *(If DNSSEC is left ON when you change nameservers, your domain will go offline with `SERVFAIL`.)*
4. Repeat steps 1–3 for **`mechonehub.in`**.

### 1.2 Add Both Domains to Cloudflare (Free Plan)
1. In **Cloudflare Dashboard**, click **Add a domain** → enter `mechonehub.com` → choose the **Free ($0)** plan.
2. Check the imported DNS records:
   - If you have **MX** records for business email, make sure their proxy toggle is **DNS Only (Grey Cloud)**.
   - Delete any GoDaddy "Parked" `A` or `CNAME` records on `@` and `www`.
3. Add these **3 placeholder `AAAA` records** on **`mechonehub.com`** (all **Proxied / Orange Cloud**):
   | Type | Name | IPv6 Address | Proxy Status | Purpose |
   | :--- | :--- | :--- | :--- | :--- |
   | `AAAA` | `@` | `100::` | **Proxied (Orange Cloud)** | Handled by Production Cloudflare Worker |
   | `AAAA` | `www` | `100::` | **Proxied (Orange Cloud)** | Handled by 301 Redirect Rule |
   | `AAAA` | `staging` | `100::` | **Proxied (Orange Cloud)** | Handled by Staging Cloudflare Worker |
4. Copy the **2 Cloudflare Nameservers** shown (e.g., `xxx.ns.cloudflare.com`, `yyy.ns.cloudflare.com`).
5. Go to **GoDaddy → `mechonehub.com` → DNS → Nameservers → Change Nameservers → I'll use my own nameservers**, paste the 2 Cloudflare nameservers, and click **Save**.
6. Now repeat in Cloudflare: click **Add a domain** → enter `mechonehub.in` → **Free ($0)** plan.
7. Add these **2 placeholder `AAAA` records** on **`mechonehub.in`** (both **Proxied / Orange Cloud**):
   | Type | Name | IPv6 Address | Proxy Status | Purpose |
   | :--- | :--- | :--- | :--- | :--- |
   | `AAAA` | `@` | `100::` | **Proxied (Orange Cloud)** | Handled by 301 Redirect Rule |
   | `AAAA` | `www` | `100::` | **Proxied (Orange Cloud)** | Handled by 301 Redirect Rule |
8. Copy the 2 Cloudflare nameservers assigned to `mechonehub.in` and set them in **GoDaddy → `mechonehub.in` → Nameservers**.

### 1.3 Configure SSL, Bot Fight Mode OFF, 301 Redirects & WAF Rules in Cloudflare
Perform these in **both** `mechonehub.com` and `mechonehub.in` zones in Cloudflare:
1. **SSL/TLS → Overview:** Set encryption mode to **Full (Strict)**.
2. **SSL/TLS → Edge Certificates:**
   - Enable **Always Use HTTPS** = **ON**
   - Enable **Automatic HTTPS Rewrites** = **ON**
   - Enable **TLS 1.3** = **ON**
   - Set **Minimum TLS Version** = **TLS 1.2**
   - *(Leave HSTS OFF until Step 7 once you have verified HTTPS works on all subdomains.)*
3. **Security → Bots:** Ensure **Bot Fight Mode is OFF**. *(On the Free plan it cannot be skipped for webhook paths and would block Razorpay webhooks and uptime checks.)*
4. **Security → Settings:** Security Level = **Medium**, **Browser Integrity Check = ON**.

Now create the **301 Redirect Rules**:
1. In the **`mechonehub.com`** zone → **Rules → Redirect Rules → Create rule**:
   - **Rule name:** `Redirect www to apex`
   - **When incoming requests match:** Custom filter expression → Field: `Hostname` | Operator: `equals` | Value: `www.mechonehub.com`
   - **Then → URL redirect:**
     - Type: **Dynamic**
     - Expression: `concat("https://mechonehub.com", http.request.uri.path)`
     - Status code: **301**
     - Check **Preserve query string**
   - Click **Deploy**.
2. In the **`mechonehub.in`** zone → **Rules → Redirect Rules → Create rule**:
   - **Rule name:** `Redirect all mechonehub.in to mechonehub.com`
   - **When incoming requests match:** **All incoming requests**
   - **Then → URL redirect:**
     - Type: **Dynamic**
     - Expression: `concat("https://mechonehub.com", http.request.uri.path)`
     - Status code: **301**
     - Check **Preserve query string**
   - Click **Deploy**.
   - Also in **`mechonehub.in` → DNS → Records**, add two anti-spoofing `TXT` records (DNS Only / Grey Cloud) since `.in` never sends email:
     - Type: `TXT` | Name: `@` | Content: `"v=spf1 -all"`
     - Type: `TXT` | Name: `_dmarc` | Content: `"v=DMARC1; p=reject;"`

Now configure **WAF & Rate Limiting** in the **`mechonehub.com`** zone:
1. **Security → WAF → Managed rules:** Confirm **Cloudflare Free Managed Ruleset** is **Enabled**.
2. **Security → WAF → Custom rules → Create rule #1:**
   - **Rule name:** `Block internal callback path at edge`
   - **Edit expression:** `starts_with(http.request.uri.path, "/api/internal/")`
   - **Action:** **Block** → Click **Deploy**.
3. **Security → WAF → Custom rules → Create rule #2:**
   - **Rule name:** `Block common scanner probes`
   - **Edit expression:** `(http.request.uri.path contains "/wp-admin" or http.request.uri.path contains "/.env" or http.request.uri.path contains "/.git" or http.request.uri.path contains "/xmlrpc.php")`
   - **Action:** **Block** → Click **Deploy**.
4. **Security → WAF → Rate limiting rules → Create rule (1 free rule):**
   - **Rule name:** `Rate limit auth and price preview POSTs`
   - **Edit expression:** `((http.request.uri.path in {"/login" "/register" "/forgot-password"}) or starts_with(http.request.uri.path, "/api/preview-price")) and http.request.method eq "POST"`
   - **Characteristics:** IP
   - **Rate:** `30` requests per `1 minute`
   - **Action:** **Block** for `10 minutes` → Click **Deploy**.

### 1.4 Lock `staging.mechonehub.com` Behind Cloudflare Access (Free Zero Trust)
1. In Cloudflare sidebar, click **Zero Trust** (choose the **Free** plan, up to 50 users).
2. Go to **Access → Applications → Add an application → Self-hosted**:
   - **Application name:** `MechOneHub Staging`
   - **Session Duration:** `24 hours`
   - **Application domain:** Subdomain = `staging`, Domain = `mechonehub.com`
3. Click **Next** to create a Policy:
   - **Policy name:** `Team Members Only`
   - **Action:** `Allow`
   - **Include rule:** Selector = `Emails` → enter your email and your teammates' emails.
4. Click **Next → Save application**. Now strangers and search engines cannot view staging; team members get an instant one-time PIN in their email.

### 1.5 Create Two Cloudflare Turnstile CAPTCHA Widgets
1. In Cloudflare Dashboard → **Turnstile → Add widget**:
   - **Widget #1 (Production):**
     - Name: `MechOneHub Production`
     - Hostnames: `mechonehub.com`
     - Widget Mode: **Managed**
     - Click **Create** and copy the **Site Key** and **Secret Key** (save them in your password manager).
   - **Widget #2 (Staging & Local Dev):**
     - Name: `MechOneHub Staging`
     - Hostnames: `staging.mechonehub.com`, `localhost`
     - Widget Mode: **Managed**
     - Click **Create** and copy the **Site Key** and **Secret Key**.

---

## STEP 2: Supabase Free (Mumbai), Upstash Redis & Resend SMTP (Day 2)

### 2.1 Create Two Supabase Projects in Mumbai (`ap-south-1`)
1. Go to [supabase.com/dashboard](https://supabase.com/dashboard) → **New project**:
   - **Project 1:** Name = `mechonehub-staging`, Region = **South Asia (Mumbai `ap-south-1`)**, Plan = **Free**. Save the Database Password!
   - **Project 2:** Name = `mechonehub-prod`, Region = **South Asia (Mumbai `ap-south-1`)**, Plan = **Free**. Use a **different** strong Database Password!
2. For **each** project, record three values from **Project Settings → API** and **Project Settings → Database**:
   - `Project URL` (`https://<project_ref>.supabase.co`)
   - `anon` `public` key
   - `service_role` `secret` key
   - **Session Pooler Connection String (IPv4):** Click **Connect** at the top of the Supabase dashboard → select **Session pooler** (Port **`5432`**, host `aws-0-ap-south-1.pooler.supabase.com`) → copy the URI:
     ```text
     postgresql://postgres.<PROJECT_REF>:<YOUR_DB_PASSWORD>@aws-0-ap-south-1.pooler.supabase.com:5432/postgres
     ```

### 2.2 Configure Supabase Auth URLs & Turnstile CAPTCHA
1. In **`mechonehub-prod` → Authentication → URL Configuration**:
   - **Site URL:** `https://mechonehub.com`
   - **Redirect URLs:** Add **ONLY** `https://mechonehub.com/auth/callback` *(no wildcards, no staging, no localhost!)*.
2. In **`mechonehub-staging` → Authentication → URL Configuration**:
   - **Site URL:** `https://staging.mechonehub.com`
   - **Redirect URLs:** Add `https://staging.mechonehub.com/auth/callback` and `http://localhost:3000/auth/callback`.
3. In **both** projects → **Authentication → Bot and Abuse Protection**:
   - Toggle **Enable CAPTCHA protection = ON**
   - Choose **Cloudflare Turnstile**
   - Paste the **Production Turnstile Secret Key** in `mechonehub-prod`, and the **Staging Turnstile Secret Key** in `mechonehub-staging` → Click **Save**.
4. In **both** projects:
   - **Authentication → Providers → Email:** Ensure **Confirm email** is **ON**. Disable unused Phone / OAuth providers.
   - **Authentication → Multi-Factor:** Ensure **TOTP (App Authenticator)** is **Enabled**.
   - **Database → Settings → SSL Configuration:** Turn **Enforce SSL on incoming connections = ON**.

### 2.3 Connect Resend Free Custom SMTP (Fixes Supabase's 2 Emails/Hour Limit)
1. Log into [resend.com](https://resend.com) → **Domains → Add Domain** → enter `mechonehub.com` (Region: closest available).
2. Copy the **DKIM (`TXT`)**, **SPF (`MX` + `TXT`)**, and **DMARC (`TXT`)** records shown in Resend and add them in **Cloudflare → `mechonehub.com` → DNS → Records** (set proxy to **DNS Only / Grey Cloud**).
   - For DMARC (`_dmarc`), set content to: `"v=DMARC1; p=none; rua=mailto:dmarc@mechonehub.com"`
3. Click **Verify DNS Records** in Resend.
4. In Resend → **API Keys**, create **two Sending-Only API keys** restricted to `mechonehub.com`:
   - `mechonehub-prod-smtp`
   - `mechonehub-staging-smtp`
5. In **Supabase → Authentication → SMTP Settings**, enable **Custom SMTP** in both projects:
   - **Host:** `smtp.resend.com`
   - **Port:** `465`
   - **Username:** `resend`
   - **Password:** Paste `mechonehub-prod-smtp` key (for prod) or `mechonehub-staging-smtp` key (for staging)
   - **Sender email:** `no-reply@mechonehub.com` (prod) / `staging-no-reply@mechonehub.com` (staging)
   - **Sender name:** `MechOneHub`
6. In **Supabase → Authentication → Email Templates** (both projects), update the 3 templates so links verify on our server and include the 6-digit OTP code:
   - **Confirm signup:**
     ```html
     <p>Your MechOneHub verification code is <b>{{ .Token }}</b></p>
     <p>Or <a href="{{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=email">verify your email</a></p>
     ```
   - **Reset password:**
     ```html
     <p><a href="{{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=recovery&next=/reset-password">Reset your MechOneHub password</a></p>
     ```
   - **Change email address:**
     ```html
     <p><a href="{{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=email_change">Confirm your new email address</a></p>
     ```

### 2.4 Create a Read-Only Backup Database Role & Offline `age` Encryption Key
1. In **`mechonehub-prod` → SQL Editor**, run this once to create a read-only Postgres user for nightly backups (so the backup secret cannot modify or delete rows):
   ```sql
   create role backup_reader with login password '<db-password>'; -- gitleaks:allow
   grant connect on database postgres to backup_reader;
   grant usage on schema public, auth to backup_reader;
   grant select on all tables in schema public, auth to backup_reader;
   grant select on all sequences in schema public, auth to backup_reader;
   alter default privileges in schema public, auth grant select on tables to backup_reader;
   alter default privileges in schema public, auth grant select on sequences to backup_reader;
   ```
   Your backup connection string (`PROD_SUPABASE_SESSION_POOLER_URL`) will be:
   ```text
   postgresql://backup_reader.<PROD_PROJECT_REF>:<BACKUP_READER_PASSWORD>@aws-0-ap-south-1.pooler.supabase.com:5432/postgres
   ```
2. On your computer (or Cloud Shell), generate an `age` keypair for encrypting nightly database backups:
   ```bash
   sudo apt-get update && sudo apt-get install -y age
   age-keygen -o mechonehub-backup.key
   cat mechonehub-backup.key
   ```
   - Copy the **`# public key: age1...`** string — this goes into GitHub (`BACKUP_AGE_PUBLIC_KEY`).
   - Save the entire `mechonehub-backup.key` file in your **offline password manager** (shared with 2 owners) and delete it from the shell (`shred -u mechonehub-backup.key`).

### 2.5 Create Two Upstash Redis Databases in Mumbai (`ap-south-1`)
1. Go to [console.upstash.com](https://console.upstash.com) → **Create Database**:
   - **Database 1:** Name = `mechonehub-staging`, Primary Region = **AWS `ap-south-1` (Mumbai)**, Plan = **Free**.
   - **Database 2:** Name = `mechonehub-prod`, Primary Region = **AWS `ap-south-1` (Mumbai)**, Plan = **Free**.
2. Copy `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` for both databases.

---

## STEP 3: Provision Google Cloud Staging & Prod Projects (Day 1B, Day 3 & Day 4A)

We included an automated provisioning script (`scripts/provision-gcp.sh`) in this repository that creates the GCP projects, enables APIs, creates Artifact Registry + cleanup rules, creates private CIS 5.1 GCS buckets with per-environment CORS and lifecycle policies, sets up least-privilege Service Accounts, creates Pub/Sub topics + authenticated push subscriptions (`--max-delivery-attempts=5`), pins Secret Manager secrets to `asia-south1`, deploys placeholder Cloud Run services, and configures keyless GitHub Workload Identity Federation.

### 3.1 Run the Provisioning Script for Staging & Production
Open **Google Cloud Shell** (or your local terminal logged into `gcloud auth login`), clone this repo, and run:

```bash
# Set your GitHub repository name and numeric ID (1468384222 for admin-mechonehub/Mechonehub):
export GITHUB_REPO="admin-mechonehub/Mechonehub"
export GITHUB_REPO_ID="1468384222"
echo "Numeric Repo ID: ${GITHUB_REPO_ID}"

# 1. Provision STAGING (mechonehub-staging)
chmod +x scripts/provision-gcp.sh
ENV=staging \
  GITHUB_REPO="$GITHUB_REPO" \
  GITHUB_REPO_ID="$GITHUB_REPO_ID" \
  UPSTASH_REDIS_REST_URL="https://<your-staging-upstash>.upstash.io" \
  ./scripts/provision-gcp.sh

# 2. Provision PRODUCTION (mechonehub-prod)
ENV=prod \
  GITHUB_REPO="$GITHUB_REPO" \
  GITHUB_REPO_ID="$GITHUB_REPO_ID" \
  UPSTASH_REDIS_REST_URL="https://<your-prod-upstash>.upstash.io" \
  ./scripts/provision-gcp.sh
```

> **Don't forget Billing Budget Alerts!**
> In [GCP Console → Billing → Budgets & alerts](https://console.cloud.google.com/billing/budgets), create two budget alerts:
> - `mechonehub-prod`: ₹500 / ₹1,000 / ₹2,000
> - `mechonehub-staging`: ₹200 / ₹500

### 3.2 Populate Your Secret Values in GCP Secret Manager
`provision-gcp.sh` auto-generated random 32-byte secrets for `ORIGIN_VERIFY_SECRET` and `CAD_CALLBACK_SECRET`, and created secret containers for the remaining keys. Populate the real values in **both** projects (`mechonehub-staging` and `mechonehub-prod`, using **different values per environment**):

```bash
# Run once for PROJECT_ID=mechonehub-staging, then repeat for PROJECT_ID=mechonehub-prod:
export PROJECT_ID="mechonehub-staging"

# Generate a 32-byte base64 KYC encryption key (SAVE THIS OFFLINE IN YOUR PASSWORD MANAGER!)
printf '%s' "$(openssl rand -base64 32)" | gcloud secrets versions add KYC_ENCRYPTION_KEY --data-file=- --project="$PROJECT_ID"

printf '%s' "<YOUR_SUPABASE_SERVICE_ROLE_KEY>" | gcloud secrets versions add SUPABASE_SERVICE_ROLE_KEY --data-file=- --project="$PROJECT_ID"
printf '%s' "<YOUR_UPSTASH_REDIS_REST_TOKEN>"  | gcloud secrets versions add UPSTASH_REDIS_REST_TOKEN  --data-file=- --project="$PROJECT_ID"
printf '%s' "<YOUR_SENTRY_DSN>"                | gcloud secrets versions add SENTRY_DSN                --data-file=- --project="$PROJECT_ID"
printf '%s' "<YOUR_RAZORPAY_TEST_KEY_ID>"      | gcloud secrets versions add RAZORPAY_KEY_ID           --data-file=- --project="$PROJECT_ID"
printf '%s' "<YOUR_RAZORPAY_TEST_KEY_SECRET>"  | gcloud secrets versions add RAZORPAY_KEY_SECRET       --data-file=- --project="$PROJECT_ID"
printf '%s' "<YOUR_RAZORPAY_WEBHOOK_SECRET>"   | gcloud secrets versions add RAZORPAY_WEBHOOK_SECRET   --data-file=- --project="$PROJECT_ID"
```

---

## STEP 4: Deploy the Cloudflare Worker Reverse Proxy (Day 4B)

1. Retrieve the Cloud Run URLs and auto-generated `ORIGIN_VERIFY_SECRET` values from your two GCP projects:
   ```bash
   # Production Cloud Run hostname & origin secret:
   gcloud run services describe mechonehub-web --project=mechonehub-prod --region=asia-south1 --format="value(status.url)"
   gcloud secrets versions access latest --secret=ORIGIN_VERIFY_SECRET --project=mechonehub-prod

   # Staging Cloud Run hostname & origin secret:
   gcloud run services describe mechonehub-web --project=mechonehub-staging --region=asia-south1 --format="value(status.url)"
   gcloud secrets versions access latest --secret=ORIGIN_VERIFY_SECRET --project=mechonehub-staging
   ```
2. Open `cloudflare-worker/wrangler.toml` and replace the placeholder `CLOUD_RUN_HOST` hostnames (without `https://`) with the two `*.a.run.app` hostnames above.
3. Deploy the Cloudflare Worker for both Production and Staging:
   ```bash
   cd cloudflare-worker
   npx wrangler login

   # Paste the PROD ORIGIN_VERIFY_SECRET when prompted:
   npx wrangler secret put ORIGIN_VERIFY_SECRET

   # Paste the STAGING ORIGIN_VERIFY_SECRET when prompted:
   npx wrangler secret put ORIGIN_VERIFY_SECRET --env staging

   # Deploy both Worker routes:
   npx wrangler deploy
   npx wrangler deploy --env staging
   ```

---

## STEP 5: Configure GitHub Environments, Variables, Rulesets & Labels

### 5.1 Create Release Labels
In your GitHub repository → **Issues / Pull requests → Labels**, create three labels:
- `release:major`
- `release:minor`
- `release:patch`

### 5.2 Create Repository-Level Variables (for `supabase-keepalive.yml`)
Go to **GitHub Repo → Settings → Secrets and variables → Actions → Variables tab → New repository variable**:
- `PROD_SUPABASE_URL` = `https://<prod-ref>.supabase.co`
- `PROD_SUPABASE_ANON_KEY` = `<prod-anon-key>`
- `STAGING_SUPABASE_URL` = `https://<staging-ref>.supabase.co`
- `STAGING_SUPABASE_ANON_KEY` = `<staging-anon-key>`

### 5.3 Create the 3 GitHub Environments (`staging`, `production`, `backups`)
Go to **GitHub Repo → Settings → Environments**:

1. **Environment: `staging`**
   - **Deployment branches:** Selected branches → add `staging`
   - **Environment Variables:**
     - `GCP_PROJECT` = `mechonehub-staging`
     - `GCP_WIF_PROVIDER` = `projects/<STAGING_PROJECT_NUM>/locations/global/workloadIdentityPools/github/providers/github-actions`
     - `NEXT_PUBLIC_SUPABASE_URL` = `https://<staging-ref>.supabase.co`
     - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = `<staging-anon-key>`
     - `NEXT_PUBLIC_SITE_URL` = `https://staging.mechonehub.com`
     - `NEXT_PUBLIC_TURNSTILE_SITE_KEY` = `<staging-turnstile-site-key>`
   - **Environment Secrets:**
     - `SUPABASE_SESSION_POOLER_URL` = `postgresql://postgres.<STAGING_REF>:<PASS>@aws-0-ap-south-1.pooler.supabase.com:5432/postgres`

2. **Environment: `production`**
   - **Required reviewers:** Check this box and add `@admin-mechonehub` and `@ShrinivasLimaye`
   - **Deployment branches:** Selected branches → add `main`
   - **Environment Variables:**
     - `GCP_PROJECT` = `mechonehub-prod`
     - `GCP_WIF_PROVIDER` = `projects/<PROD_PROJECT_NUM>/locations/global/workloadIdentityPools/github/providers/github-actions`
     - `NEXT_PUBLIC_SUPABASE_URL` = `https://<prod-ref>.supabase.co`
     - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = `<prod-anon-key>`
     - `NEXT_PUBLIC_SITE_URL` = `https://mechonehub.com`
     - `NEXT_PUBLIC_TURNSTILE_SITE_KEY` = `<prod-turnstile-site-key>`
   - **Environment Secrets:**
     - `SUPABASE_SESSION_POOLER_URL` = `postgresql://postgres.<PROD_REF>:<PASS>@aws-0-ap-south-1.pooler.supabase.com:5432/postgres`

3. **Environment: `backups`**
   - **Deployment branches:** Selected branches → add `staging` (and `main`)
   - **Environment Variables:**
     - `GCP_WIF_PROVIDER_PROD` = `projects/<PROD_PROJECT_NUM>/locations/global/workloadIdentityPools/github/providers/github-actions`
     - `BACKUP_AGE_PUBLIC_KEY` = `age1...` (your public key from Step 2.4)
   - **Environment Secrets:**
     - `PROD_SUPABASE_SESSION_POOLER_URL` = `postgresql://backup_reader.<PROD_REF>:<PASS>@aws-0-ap-south-1.pooler.supabase.com:5432/postgres`

### 5.4 Configure GitHub Branch Rulesets & Default Branch
1. Push the `staging` branch to GitHub (`git push -u origin staging`) and in **Settings → General**, set the **Default branch** to `staging`.
2. In **Settings → Actions → General → Workflow permissions**, select **Read repository contents and packages permissions**.
3. In **Settings → Rules → Rulesets**, create two branch rulesets (`staging` and `main`):
   - Block force pushes and branch deletions.
   - Require a pull request before merging (1+ approval, require review from **Code Owners**).
   - Require status checks to pass: `web`, `parser`, `migrations`, `security`, `pr-title` (plus `guard-main-source` on `main`).
   - Allowed merge methods: **Squash** on `staging`; **Merge commit** (for release PRs) + **Squash** (for `hotfix/*`) on `main`.

---

## STEP 6: End-to-End Verification Checklist (Day 6)

Once your PR merges into `staging`, `deploy-staging.yml` will automatically run `supabase db push`, build the containers, deploy a no-traffic Cloud Run revision, probe `/api/health`, and shift 100% traffic. Seed staging once if needed:
```bash
psql "postgresql://postgres.<STAGING_REF>:<PASS>@aws-0-ap-south-1.pooler.supabase.com:5432/postgres" -f supabase/seed.sql
```

Verify every item below on **Staging (`https://staging.mechonehub.com`)** first, then on **Production (`https://mechonehub.com`)**:

### Functional Checks
- [ ] **Domains & 301 Redirects:**
  - `http://mechonehub.com` → 301 → `https://mechonehub.com`
  - `https://www.mechonehub.com/buyer` → 301 → `https://mechonehub.com/buyer`
  - `https://mechonehub.in/buyer?ref=test` → 301 → `https://mechonehub.com/buyer?ref=test`
  - `https://www.mechonehub.in` → 301 → `https://mechonehub.com/`
- [ ] **Auth, Turnstile & Resend Emails:** Sign up a fresh test account. Confirm Turnstile widget passes, Resend delivers the 6-digit OTP email from `no-reply@mechonehub.com`, login persists across refreshes, and admin login requires TOTP MFA (`aal2`).
- [ ] **Direct GCS CAD Upload & Worker Callback:** Upload a `.STEP` file on `/buyer/quote`. Confirm direct `PUT` to `https://storage.googleapis.com/...` succeeds (200 OK), Pub/Sub triggers `mechonehub-cad-worker`, the HMAC callback updates the analysis to `completed`, and the rendered thumbnail + 3 price tiers appear.
- [ ] **Keep-Alive & Nightly Backup Workflows:** In GitHub → Actions, manually trigger **Supabase Database Keep-Alive** and **Nightly Database Backup to GCS**. Confirm both turn green and a non-empty `backup_YYYYMMDD_HHMMSS.dump.age` object appears in `gs://mechonehub-prod-db-backups/daily/`.

### Security Checks
- [ ] **Origin Lock:** Open your raw `https://mechonehub-web-xxxx-el.a.run.app/` URL directly in a browser → must return **`403 Forbidden`**. Open `https://mechonehub-web-xxxx-el.a.run.app/api/health` → must return **`200 {"status":"ok"}`**.
- [ ] **Internal Callback Blocked at Edge:** Visit `https://mechonehub.com/api/internal/cad-result` → must return **`404`** or **`403`**.
- [ ] **Staging Privacy:** Open `https://staging.mechonehub.com` in an Incognito window → must show the **Cloudflare Access login screen**.
- [ ] **Security Headers:** Test `https://mechonehub.com` on [securityheaders.com](https://securityheaders.com) → verify `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`, `Cross-Origin-Opener-Policy`, and `Content-Security-Policy-Report-Only` are present and no `x-powered-by` header leaks.

---

## STEP 7: Production Launch & Day-7 Hardening

1. **Open Release PR `staging` → `main`:**
   - Title: `release: v1.0.0`
   - Add label: `release:major`
   - Merge using **Create a merge commit**.
2. **Approve Production Deployment:**
   - Go to **GitHub → Actions → Deploy — production** → click **Review deployments → Approve and deploy**.
   - Watch the pipeline migrate `mechonehub-prod`, build images, health-check the new revision, shift 100% traffic, and publish GitHub Release `v1.0.0`.
3. **Enable HSTS in Cloudflare (Day 7):**
   - Once HTTPS is confirmed on `mechonehub.com` and `staging.mechonehub.com`, go to **Cloudflare → `mechonehub.com` → SSL/TLS → Edge Certificates → HSTS**:
   - Enable HSTS with `Max-Age: 1 month (30 days)`, **Include subdomains: ON**, **Preload: OFF** (raise to 12 months after 30 clean days).
4. **Re-Enable DNSSEC via Cloudflare → GoDaddy:**
   - In **Cloudflare → DNS → Settings → Enable DNSSEC** for both `mechonehub.com` and `mechonehub.in`, then copy each DS record into **GoDaddy → DNS → DNSSEC**.
5. **Configure BetterStack Uptime Monitor:**
   - In [betterstack.com](https://betterstack.com), add a 5-minute monitor on `https://mechonehub.com/api/health`.
6. **Enable Live Razorpay Payments (When Ready to Transact):**
   - Store your live `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, and `RAZORPAY_WEBHOOK_SECRET` in `mechonehub-prod` Secret Manager.
   - Switch `PAYMENTS_MODE=live` on production only:
     ```bash
     gcloud run services update mechonehub-web \
       --project=mechonehub-prod --region=asia-south1 \
       --update-env-vars="PAYMENTS_MODE=live"
     ```
7. **Retire Old Vercel / Render Deployments:**
   - Once `mechonehub.com` has run cleanly, pause/delete the legacy Render and Vercel services and remove `render.yaml` in a follow-up `chore/` PR.
