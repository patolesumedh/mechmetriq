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

#### Issue 5: "PERMISSION_DENIED: Permission 'iam.serviceAccounts.setIamPolicy' or 'getAccessToken' denied"
- **Cause:**
  1. In Google Workspace organizations, users have `Owner (legacy)` by default, which lacks granular permission (`roles/iam.serviceAccountAdmin`) to attach Workload Identity bindings to service accounts.
  2. GitHub Actions and Docker Artifact Registry push require the `deployer` service account to be bound to the repository ID (`attribute.repository_id/1468384222`), to have `roles/iam.serviceAccountTokenCreator` on itself, and to have `roles/secretmanager.secretAccessor` on `ORIGIN_VERIFY_SECRET`.
- **Fix:**
  1. Open [console.cloud.google.com/iam-admin/iam?project=mechonehub-live](https://console.cloud.google.com/iam-admin/iam?project=mechonehub-live).
  2. Click the pencil icon next to your email (`admin@mechonehub.com`).
  3. Click **+ Add another role** → select **Service Account Admin**. Click **Save**.
  4. Run the complete IAM binding block in Cloud Shell (now also built into `scripts/provision-gcp.sh`):
     ```bash
     PROJECT_ID="mechonehub-live"
     PROJECT_NUM=$(gcloud projects describe "$PROJECT_ID" --format="value(projectNumber)")

     # Allow GitHub repo (all branches + production/staging environments) to impersonate deployer
     gcloud iam service-accounts add-iam-policy-binding "deployer@${PROJECT_ID}.iam.gserviceaccount.com" \
       --project="$PROJECT_ID" \
       --role="roles/iam.workloadIdentityUser" \
       --member="principalSet://iam.googleapis.com/projects/${PROJECT_NUM}/locations/global/workloadIdentityPools/github/attribute.repository_id/1468384222"

     gcloud iam service-accounts add-iam-policy-binding "deployer@${PROJECT_ID}.iam.gserviceaccount.com" \
       --project="$PROJECT_ID" \
       --role="roles/iam.workloadIdentityUser" \
       --member="principalSet://iam.googleapis.com/projects/${PROJECT_NUM}/locations/global/workloadIdentityPools/github/attribute.environment/production"

     gcloud iam service-accounts add-iam-policy-binding "deployer@${PROJECT_ID}.iam.gserviceaccount.com" \
       --project="$PROJECT_ID" \
       --role="roles/iam.workloadIdentityUser" \
       --member="principalSet://iam.googleapis.com/projects/${PROJECT_NUM}/locations/global/workloadIdentityPools/github/attribute.environment/staging"

     # Allow deployer to mint OAuth2 access tokens and read ORIGIN_VERIFY_SECRET during CI health checks
     gcloud iam service-accounts add-iam-policy-binding "deployer@${PROJECT_ID}.iam.gserviceaccount.com" \
       --project="$PROJECT_ID" \
       --role="roles/iam.serviceAccountTokenCreator" \
       --member="serviceAccount:deployer@${PROJECT_ID}.iam.gserviceaccount.com"

     gcloud secrets add-iam-policy-binding ORIGIN_VERIFY_SECRET \
       --project="$PROJECT_ID" \
       --role="roles/secretmanager.secretAccessor" \
       --member="serviceAccount:deployer@${PROJECT_ID}.iam.gserviceaccount.com"
     ```

#### Issue 6: Google Workspace Org Policy "Domain restricted sharing" blocks `allUsers`
- **Symptoms:**
  - Running `gcloud run services add-iam-policy-binding mechonehub-web --member="allUsers" ...` fails with:
    `FAILED_PRECONDITION: One or more users named in the policy do not belong to a permitted customer, perhaps due to an organization policy.`
  - Visiting `https://mechonehub.com` shows Google's 403 HTML page:
    `Error: Forbidden - Your client does not have permission to get URL / from this server.`
- **Cause:**
  Google Workspace organizations enforce `constraints/iam.allowedPolicyMemberDomains` ("Domain restricted sharing") by default, blocking `allUsers` from being added as a Cloud Run invoker.
- **Fix:**
  1. In Google Cloud Console, go to **IAM & Admin → Organization Policies** (ensure your project `MechOneHub prod` / `mechonehub-live` is selected in the top picker).
  2. Click **Domain restricted sharing** → **Edit policy**.
  3. Under **Policy source**, select **Override parent's policy**.
  4. Under **Rules**, click **Add a rule** (or edit the existing rule) → under **Policy values**, select **Allow all** → click **Set policy**.
  5. In Cloud Shell, grant public invoker access to `mechonehub-web` (remember: `mechonehub-web` is still protected by the `X-Origin-Verify` header injected by Cloudflare):
     ```bash
     gcloud run services add-iam-policy-binding mechonehub-web \
       --project=mechonehub-live \
       --region=asia-south1 \
       --member="allUsers" \
       --role="roles/run.invoker"
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

### ⚠️ Common CI/CD Issues & How They Are Solved in Our Workflows

#### 1. Supabase CLI Rate-Limit & PostgreSQL 17 (`Invalid db.major_version: 17`)
- **Symptoms:**
  - `supabase/setup-cli@v1` with `version: latest` fails with `Failed to resolve latest Supabase CLI release: rate limit exceeded`.
  - Older pinned CLI versions (e.g., `2.15.5`) fail with `Failed reading config: Invalid db.major_version: 17`.
- **Resolution (built into workflows):**
  All workflows (`deploy-production.yml`, `deploy-staging.yml`, `ci.yml`) pin `supabase/setup-cli@v1` to **`version: 3.3.0`** (which supports PostgreSQL 17 and downloads the binary asset directly without querying `/releases/latest`) and pass `github-token: ${{ secrets.GITHUB_TOKEN }}`. In addition, the `migrate` step includes an automatic `psql` fallback for idempotent migrations `0023`–`0025`.

#### 2. Docker Push to Artifact Registry (`gcloud.auth.docker-helper` 403 / `getAccessToken` denied)
- **Symptoms:**
  - Docker finishes building the Next.js image (`#18 exporting layers done`), then fails during push with:
    `ERROR: (gcloud.auth.docker-helper) There was a problem refreshing your current auth tokens: ('Unable to acquire impersonated credentials' ... Permission 'iam.serviceAccounts.getAccessToken' denied)`
- **Cause:**
  `gcloud auth configure-docker` invokes a sub-process helper inside Docker Buildx that attempts to re-impersonate the `deployer` service account without an active OAuth2 token.
- **Resolution (built into workflows + IAM):**
  1. In GCP IAM, `deployer` is granted `roles/iam.serviceAccountTokenCreator` on itself and `roles/iam.workloadIdentityUser` for `attribute.repository_id/1468384222` (see Step 3, Issue 5).
  2. In `deploy-production.yml` and `deploy-staging.yml`, `google-github-actions/auth@v2` is configured with `token_format: 'access_token'` and paired with `docker/login-action@v3` (`username: oauth2accesstoken`, `password: ${{ steps.auth.outputs.access_token }}`), completely bypassing `gcloud.auth.docker-helper`.

#### 3. Candidate Revision Health-Check 403 & Pinned Traffic on Initial Placeholder Revision
- **Symptoms:**
  - GitHub Actions `deploy` step fails with `curl: (22) The requested URL returned error: 403` when probing `$CANDIDATE_URL/api/health`, OR the build & deploy succeed in GitHub Actions, yet visiting `https://mechonehub.com` still shows Google's `"It's running! ... mechonehub-web-00001-qsd"` placeholder screen.
- **Cause:**
  When a Cloud Run service has ever been deployed with `--no-traffic`, Cloud Run pins 100% of live traffic to the old revision name (`00001-qsd`) rather than `LATEST`. Subsequent `gcloud run deploy --tag` commands create new revisions without moving live traffic away from the pinned revision.
- **Resolution (built into workflows):**
  After deploying the tagged revision and verifying `$CANDIDATE_URL/api/health` (passing both `Authorization: Bearer $ID_TOKEN` and `X-Origin-Verify: $ORIGIN_SECRET`), the workflow explicitly executes:
  ```bash
  gcloud run services update-traffic mechonehub-web \
    --region asia-south1 \
    --project mechonehub-live \
    --to-latest
  ```
  This shifts 100% of live traffic to the newly verified revision immediately.

---

## STEP 6: Verification & Post-Launch Checklist

Once GitHub Actions finishes deployment, verify these checks:

### Functional Checks
- [x] **Live Web:** Visit `https://mechonehub.com/` → verify official vector logo, navigation, and pages render (`HTTP 200 OK`).
- [x] **Health Endpoint:** Visit `https://mechonehub.com/api/health` → returns `{"status":"ok"}`.
- [ ] **Sign Up / Login:** Sign up a test account. Confirm Cloudflare Turnstile passes, Resend delivers the 6-digit verification code, and login persists.
- [ ] **CAD Analysis:** Go to `/buyer/quote`, upload a `.STEP` file. Confirm direct upload to `gs://mechonehub-live-cad-files`, Pub/Sub invocation of `mechonehub-cad-worker`, and thumbnail generation.

### Security Checks
- [x] **Direct Cloud Run Lock:** Visiting `https://mechonehub-web-486135922224.asia-south1.run.app/` directly returns **`403 Forbidden`**. All traffic must enter through Cloudflare!
- [x] **Internal Endpoints Protected:** Visiting `https://mechonehub.com/api/internal/cad-result` returns **`404`**.

---

## STEP 7: Maintenance & Routine Operations

1. **Deploying Future Changes:**
   Simply push or merge your code into `main`! GitHub Actions will:
   - Run database migrations via Supavisor.
   - Build new Docker images and push to Mumbai Artifact Registry.
   - Deploy a zero-downtime tagged revision to Cloud Run.
   - Health-check the candidate revision.
   - Shift 100% traffic to the latest revision (`--to-latest`).
2. **Rotating Secrets:**
   Update the secret in Google Secret Manager. Cloud Run automatically mounts `:latest` on every subsequent revision.
3. **Database Backups:**
   Trigger the `Nightly Database Backup` workflow in GitHub Actions to create encrypted `.dump.age` files in `gs://mechonehub-live-db-backups/daily/`.

---

## STEP 8: Deploying the Isolated Staging Website (`https://staging.mechonehub.com`)

> **Important Note on Staging Isolation:**
> Until you configure the `staging` environment in GitHub with its own `GCP_PROJECT` variable, `.github/workflows/deploy-staging.yml` safely skips the Cloud Run build & deploy jobs so pushes to the `staging` branch never overwrite your production `mechonehub-live` service.

When you are ready to launch a dedicated staging website at **`https://staging.mechonehub.com`**, you do **NOT** need to repeat GoDaddy DNS migration or Resend domain verification. Only perform these 5 isolated resource steps:

### 8.1 Create Staging Supabase & Upstash Redis (Mumbai `ap-south-1`)
1. **Supabase:** Create a second Free project named `mechonehub-staging` in Mumbai (`ap-south-1`).
   - In **Authentication → URL Configuration**: set **Site URL** to `https://staging.mechonehub.com` and **Redirect URL** to `https://staging.mechonehub.com/auth/callback`.
   - In **Authentication → SMTP Settings**: reuse the exact same Resend SMTP settings (`smtp.resend.com`, port `465`, sender `no-reply@mechonehub.com`).
   - In **Cloudflare Turnstile**: either add `staging.mechonehub.com` to your Turnstile widget domains or create a `MechOneHub Staging` Turnstile widget, and paste its Secret Key into staging Supabase Auth.
2. **Upstash Redis:** Create a second Free Redis database named `mechonehub-staging` in Mumbai (`ap-south-1`). Copy its `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`.

### 8.2 Provision the Staging GCP Project (`mechonehub-staging-live`)
1. In **Google Cloud Shell**, run `scripts/provision-gcp.sh` with `ENV=staging` and a unique project ID:
   ```bash
   cd ~/Mechonehub
   git pull

   ENV=staging \
     PROJECT_ID="mechonehub-staging-live" \
     UPSTASH_REDIS_REST_URL="<YOUR_STAGING_UPSTASH_REST_URL>" \
     ./scripts/provision-gcp.sh
   ```
   *(If prompted that billing is not linked, link your billing account to `mechonehub-staging-live` in the GCP Console and re-run the command).*
2. **Override "Domain restricted sharing" on `mechonehub-staging-live`:**
   - Go to **IAM & Admin → Organization Policies** (select project `mechonehub-staging-live`).
   - Click **Domain restricted sharing → Edit policy → Override parent's policy → Rules: Allow all → Set policy**.
   - Grant `allUsers` invoker on staging `mechonehub-web`:
     ```bash
     gcloud run services add-iam-policy-binding mechonehub-web \
       --project=mechonehub-staging-live \
       --region=asia-south1 \
       --member="allUsers" \
       --role="roles/run.invoker"
     ```
3. **Populate Secrets in `mechonehub-staging-live` Secret Manager:**
   Go to [console.cloud.google.com/security/secret-manager?project=mechonehub-staging-live](https://console.cloud.google.com/security/secret-manager?project=mechonehub-staging-live) and add versions for:
   - `SUPABASE_SERVICE_ROLE_KEY` (from `mechonehub-staging` Supabase)
   - `UPSTASH_REDIS_REST_TOKEN` (from `mechonehub-staging` Upstash)
   - `KYC_ENCRYPTION_KEY`, `SENTRY_DSN`, `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET` (test keys).

### 8.3 Update & Deploy the Staging Cloudflare Worker (`mechonehub-edge-proxy-staging`)
1. Copy the staging `mechonehub-web` Cloud Run hostname printed at the end of Step 8.2 (e.g., `mechonehub-web-<STAGING_PROJECT_NUM>.asia-south1.run.app`).
2. Update `[env.staging.vars]` in `cloudflare-worker/wrangler.toml`:
   ```toml
   [env.staging.vars]
   CLOUD_RUN_HOST = "mechonehub-web-<STAGING_PROJECT_NUM>.asia-south1.run.app"
   ```
3. In Cloud Shell, deploy the staging worker and attach its `ORIGIN_VERIFY_SECRET`:
   ```bash
   cd ~/Mechonehub/cloudflare-worker
   export CLOUDFLARE_API_TOKEN="<YOUR_CF_API_TOKEN>"

   npx wrangler deploy --env staging

   STAGING_SECRET=$(gcloud secrets versions access latest --secret=ORIGIN_VERIFY_SECRET --project=mechonehub-staging-live)
   printf "%s" "$STAGING_SECRET" | npx wrangler secret put ORIGIN_VERIFY_SECRET --env staging
   ```

### 8.4 Configure GitHub Environment: `staging`
1. Go to [github.com/admin-mechonehub/Mechonehub](https://github.com/admin-mechonehub/Mechonehub) → **Settings → Environments → New environment** → Name: **`staging`**.
2. Add **`GCP_PROJECT`** = `mechonehub-staging-live` under **Environment variables** (this unlocks the `build` and `deploy` jobs in `deploy-staging.yml`).
3. Add these under **Environment secrets** (or **Environment variables**):
   | Name | Value |
   | :--- | :--- |
   | **`GCP_PROJECT`** | `mechonehub-staging-live` |
   | **`GCP_WIF_PROVIDER`** | `projects/<STAGING_PROJECT_NUM>/locations/global/workloadIdentityPools/github/providers/github-actions` |
   | **`NEXT_PUBLIC_SITE_URL`** | `https://staging.mechonehub.com` |
   | **`NEXT_PUBLIC_SUPABASE_URL`** | `https://<STAGING_SUPABASE_REF>.supabase.co` |
   | **`NEXT_PUBLIC_SUPABASE_ANON_KEY`** | Staging Supabase Publishable Key (`sb_pub_...`) |
   | **`NEXT_PUBLIC_TURNSTILE_SITE_KEY`** | Turnstile Site Key |
   | **`SUPABASE_SESSION_POOLER_URL`** | `postgresql://postgres.<STAGING_REF>:<PASS>@aws-0-ap-south-1.pooler.supabase.com:5432/postgres` |
   | **`CLOUDFLARE_API_TOKEN`** | Cloudflare API Token |

4. **(Optional) Lock `staging.mechonehub.com` behind Cloudflare Zero Trust Access:**
   In Cloudflare Dashboard → **Zero Trust → Access → Applications → Add an application → Self-hosted**:
   - Application domain: `staging.mechonehub.com`
   - Policy: **Allow** emails ending in `@mechonehub.com` (One-Time PIN).
   - Bypass rule for `/api/webhooks/*` and `/api/health`.
