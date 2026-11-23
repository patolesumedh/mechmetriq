#!/usr/bin/env bash
# ==============================================================================
# MECHmetrIQ (MechOneHub) — GCP Environment Provisioning Script (v3.1.0)
#
# Provisions an isolated GCP project in asia-south1 (Mumbai):
#   - ENV=staging -> project mechonehub-staging (GitHub Environment: staging)
#   - ENV=prod    -> project mechonehub-prod    (GitHub Environment: production + backups)
#
# Usage:
#   ENV=staging GITHUB_REPO=admin-mechonehub/Mechonehub ./scripts/provision-gcp.sh
#   ENV=prod    GITHUB_REPO=admin-mechonehub/Mechonehub ./scripts/provision-gcp.sh
# ==============================================================================

set -euo pipefail

ENV="${ENV:-}"
if [[ "$ENV" != "staging" && "$ENV" != "prod" ]]; then
  echo "Error: ENV must be set to 'staging' or 'prod'." >&2
  echo "Usage: ENV=staging|prod [GITHUB_REPO=admin-mechonehub/Mechonehub] [GITHUB_REPO_ID=1468384222] ./scripts/provision-gcp.sh" >&2
  exit 1
fi

PROJECT_ID="${PROJECT_ID:-mechonehub-${ENV}}"
REGION="${REGION:-asia-south1}"
GITHUB_REPO="${GITHUB_REPO:-admin-mechonehub/Mechonehub}"
GH_ENV_NAME="$([[ "$ENV" == "prod" ]] && echo "production" || echo "staging")"
SITE_URL="$([[ "$ENV" == "prod" ]] && echo "https://mechonehub.com" || echo "https://staging.mechonehub.com")"
CAD_BUCKET="gs://mechonehub-${ENV}-cad-files"
BACKUP_BUCKET="gs://mechonehub-prod-db-backups"

echo "==> Provisioning MechOneHub [${ENV}] in project ${PROJECT_ID} (${REGION})..."

# 1. Create or select project
if ! gcloud projects describe "$PROJECT_ID" >/dev/null 2>&1; then
  echo "==> Creating GCP project ${PROJECT_ID}..."
  gcloud projects create "$PROJECT_ID" --name="MechOneHub ${ENV}"
  if [[ -z "${BILLING_ACCOUNT:-}" ]]; then
    BILLING_ACCOUNT="$(gcloud billing accounts list --filter='open=true' --format='value(name)' 2>/dev/null | head -n1 || true)"
  fi
  if [[ -n "${BILLING_ACCOUNT:-}" ]]; then
    echo "==> Linking billing account ${BILLING_ACCOUNT}..."
    gcloud billing projects link "$PROJECT_ID" --billing-account="$BILLING_ACCOUNT"
  else
    echo "NOTE: Link your billing account in the GCP Console or re-run with BILLING_ACCOUNT=XXXXXX-XXXXXX-XXXXXX."
  fi
fi

gcloud config set project "$PROJECT_ID"
PROJECT_NUM="$(gcloud projects describe "$PROJECT_ID" --format="value(projectNumber)")"

# 2. Enable required APIs
echo "==> Enabling required GCP APIs..."
gcloud services enable \
  run.googleapis.com \
  pubsub.googleapis.com \
  storage.googleapis.com \
  secretmanager.googleapis.com \
  artifactregistry.googleapis.com \
  iamcredentials.googleapis.com \
  sts.googleapis.com \
  --project="$PROJECT_ID"

# 3. Artifact Registry + Cleanup Policy
echo "==> Configuring Artifact Registry repository 'mechonehub'..."
if ! gcloud artifacts repositories describe mechonehub --location="$REGION" --project="$PROJECT_ID" >/dev/null 2>&1; then
  gcloud artifacts repositories create mechonehub \
    --repository-format=docker \
    --location="$REGION" \
    --description="MECHmetrIQ containers (${ENV})" \
    --project="$PROJECT_ID"
fi

gcloud artifacts repositories set-cleanup-policies mechonehub \
  --location="$REGION" \
  --project="$PROJECT_ID" \
  --policy="infra/artifact-cleanup-policy.json" || true

# 4. Private GCS Buckets (CIS 5.1) + Per-Environment CORS + Lifecycle Rules
echo "==> Creating private GCS buckets (CIS 5.1 enforced)..."
if ! gcloud storage buckets describe "$CAD_BUCKET" --project="$PROJECT_ID" >/dev/null 2>&1; then
  gcloud storage buckets create "$CAD_BUCKET" \
    --project="$PROJECT_ID" \
    --location="$REGION" \
    --default-storage-class=STANDARD \
    --uniform-bucket-level-access \
    --public-access-prevention
fi

gcloud storage buckets update "$CAD_BUCKET" \
  --cors-file="infra/cors.${ENV}.json" \
  --lifecycle-file="infra/lifecycle-cad.json" \
  --project="$PROJECT_ID"

if [[ "$ENV" == "prod" ]]; then
  if ! gcloud storage buckets describe "$BACKUP_BUCKET" --project="$PROJECT_ID" >/dev/null 2>&1; then
    gcloud storage buckets create "$BACKUP_BUCKET" \
      --project="$PROJECT_ID" \
      --location="$REGION" \
      --default-storage-class=STANDARD \
      --uniform-bucket-level-access \
      --public-access-prevention
  fi
  gcloud storage buckets update "$BACKUP_BUCKET" \
    --lifecycle-file="infra/lifecycle-backups.json" \
    --project="$PROJECT_ID"
fi

# 5. Least-Privilege Service Accounts & Scoped IAM
echo "==> Creating least-privilege service accounts..."
for SA in web-runtime cad-worker-runtime pubsub-invoker deployer; do
  if ! gcloud iam service-accounts describe "${SA}@${PROJECT_ID}.iam.gserviceaccount.com" --project="$PROJECT_ID" >/dev/null 2>&1; then
    gcloud iam service-accounts create "$SA" --display-name="${SA} (${ENV})" --project="$PROJECT_ID"
  fi
done

if [[ "$ENV" == "prod" ]]; then
  if ! gcloud iam service-accounts describe "backup-writer@${PROJECT_ID}.iam.gserviceaccount.com" --project="$PROJECT_ID" >/dev/null 2>&1; then
    gcloud iam service-accounts create backup-writer --display-name="Nightly backup writer (write-only)" --project="$PROJECT_ID"
  fi
fi

SA_WEB="web-runtime@${PROJECT_ID}.iam.gserviceaccount.com"
SA_WORKER="cad-worker-runtime@${PROJECT_ID}.iam.gserviceaccount.com"
SA_INVOKER="pubsub-invoker@${PROJECT_ID}.iam.gserviceaccount.com"
SA_DEPLOYER="deployer@${PROJECT_ID}.iam.gserviceaccount.com"

# Web: create + read objects (no delete), sign URLs as itself only
gcloud storage buckets add-iam-policy-binding "$CAD_BUCKET" \
  --member="serviceAccount:${SA_WEB}" --role="roles/storage.objectCreator" --project="$PROJECT_ID"
gcloud storage buckets add-iam-policy-binding "$CAD_BUCKET" \
  --member="serviceAccount:${SA_WEB}" --role="roles/storage.objectViewer" --project="$PROJECT_ID"
gcloud iam service-accounts add-iam-policy-binding "$SA_WEB" \
  --member="serviceAccount:${SA_WEB}" --role="roles/iam.serviceAccountTokenCreator" --project="$PROJECT_ID"

# Worker: read everything in CAD bucket, write ONLY under derived/
gcloud storage buckets add-iam-policy-binding "$CAD_BUCKET" \
  --member="serviceAccount:${SA_WORKER}" --role="roles/storage.objectViewer" --project="$PROJECT_ID"
gcloud storage buckets add-iam-policy-binding "$CAD_BUCKET" \
  --member="serviceAccount:${SA_WORKER}" --role="roles/storage.objectCreator" \
  --condition="title=derived-only,expression=resource.name.startsWith('projects/_/buckets/mechonehub-${ENV}-cad-files/objects/derived/')" \
  --project="$PROJECT_ID"

# Backups (prod only): write-only objectCreator
if [[ "$ENV" == "prod" ]]; then
  gcloud storage buckets add-iam-policy-binding "$BACKUP_BUCKET" \
    --member="serviceAccount:backup-writer@${PROJECT_ID}.iam.gserviceaccount.com" \
    --role="roles/storage.objectCreator" --project="$PROJECT_ID"
fi

# Deployer (GitHub Actions via WIF)
gcloud projects add-iam-policy-binding "$PROJECT_ID" \
  --member="serviceAccount:${SA_DEPLOYER}" --role="roles/run.developer"
gcloud artifacts repositories add-iam-policy-binding mechonehub --location="$REGION" \
  --member="serviceAccount:${SA_DEPLOYER}" --role="roles/artifactregistry.writer" --project="$PROJECT_ID"
for SA in "$SA_WEB" "$SA_WORKER"; do
  gcloud iam service-accounts add-iam-policy-binding "$SA" \
    --member="serviceAccount:${SA_DEPLOYER}" --role="roles/iam.serviceAccountUser" --project="$PROJECT_ID"
done

# 6. Pub/Sub Topics & Dead-Letter Permissions
echo "==> Configuring Pub/Sub topics and dead-letter IAM..."
for TOPIC in cad-analysis-jobs cad-analysis-deadletter; do
  if ! gcloud pubsub topics describe "$TOPIC" --project="$PROJECT_ID" >/dev/null 2>&1; then
    gcloud pubsub topics create "$TOPIC" --project="$PROJECT_ID"
  fi
done

if ! gcloud pubsub subscriptions describe cad-analysis-deadletter-sub --project="$PROJECT_ID" >/dev/null 2>&1; then
  gcloud pubsub subscriptions create cad-analysis-deadletter-sub \
    --topic=cad-analysis-deadletter \
    --project="$PROJECT_ID"
fi

gcloud pubsub topics add-iam-policy-binding cad-analysis-jobs \
  --member="serviceAccount:${SA_WEB}" --role="roles/pubsub.publisher" --project="$PROJECT_ID"
gcloud pubsub topics add-iam-policy-binding cad-analysis-deadletter \
  --member="serviceAccount:service-${PROJECT_NUM}@gcp-sa-pubsub.iam.gserviceaccount.com" \
  --role="roles/pubsub.publisher" --project="$PROJECT_ID"
gcloud iam service-accounts add-iam-policy-binding "$SA_INVOKER" \
  --member="serviceAccount:service-${PROJECT_NUM}@gcp-sa-pubsub.iam.gserviceaccount.com" \
  --role="roles/iam.serviceAccountTokenCreator" --project="$PROJECT_ID"

# 7. Secret Manager (pinned to asia-south1) + per-secret IAM
echo "==> Creating Secret Manager secrets pinned to ${REGION}..."
WEB_SECRETS=(
  ORIGIN_VERIFY_SECRET
  SUPABASE_SERVICE_ROLE_KEY
  KYC_ENCRYPTION_KEY
  CAD_CALLBACK_SECRET
  UPSTASH_REDIS_REST_TOKEN
  SENTRY_DSN
  RAZORPAY_KEY_ID
  RAZORPAY_KEY_SECRET
  RAZORPAY_WEBHOOK_SECRET
)
WORKER_SECRETS=(
  CAD_CALLBACK_SECRET
  SENTRY_DSN
)

for SEC in "${WEB_SECRETS[@]}"; do
  if ! gcloud secrets describe "$SEC" --project="$PROJECT_ID" >/dev/null 2>&1; then
    if [[ "$SEC" == "ORIGIN_VERIFY_SECRET" || "$SEC" == "CAD_CALLBACK_SECRET" ]]; then
      printf '%s' "$(openssl rand -hex 32)" | gcloud secrets create "$SEC" \
        --data-file=- --replication-policy=user-managed --locations="$REGION" --project="$PROJECT_ID"
    else
      printf '%s' "REPLACE_WITH_REAL_VALUE" | gcloud secrets create "$SEC" \
        --data-file=- --replication-policy=user-managed --locations="$REGION" --project="$PROJECT_ID"
    fi
  fi
  gcloud secrets add-iam-policy-binding "$SEC" \
    --member="serviceAccount:${SA_WEB}" --role="roles/secretmanager.secretAccessor" --project="$PROJECT_ID"
done

for SEC in "${WORKER_SECRETS[@]}"; do
  gcloud secrets add-iam-policy-binding "$SEC" \
    --member="serviceAccount:${SA_WORKER}" --role="roles/secretmanager.secretAccessor" --project="$PROJECT_ID"
done

# 8. Initial Placeholder Cloud Run Services + Authenticated Pub/Sub Push Subscription
echo "==> Deploying initial placeholder Cloud Run services..."
gcloud run deploy mechonehub-cad-worker \
  --project="$PROJECT_ID" \
  --image="us-docker.pkg.dev/cloudrun/container/hello" \
  --region="$REGION" \
  --service-account="$SA_WORKER" \
  --memory=2Gi \
  --cpu=2 \
  --min-instances=0 \
  --max-instances=5 \
  --concurrency=1 \
  --timeout=300s \
  --set-env-vars="GCS_CAD_BUCKET=mechonehub-${ENV}-cad-files,SMARTQUOTE_MAX_MB=50,WEB_CALLBACK_URL=https://placeholder.invalid" \
  --set-secrets="CAD_CALLBACK_SECRET=CAD_CALLBACK_SECRET:latest,SENTRY_DSN=SENTRY_DSN:latest" \
  --no-allow-unauthenticated

gcloud run deploy mechonehub-web \
  --project="$PROJECT_ID" \
  --image="us-docker.pkg.dev/cloudrun/container/hello" \
  --region="$REGION" \
  --service-account="$SA_WEB" \
  --memory=512Mi \
  --cpu=1 \
  --min-instances=0 \
  --max-instances=10 \
  --concurrency=80 \
  --timeout=60s \
  --set-env-vars="PAYMENTS_MODE=test,NEXT_PUBLIC_SITE_URL=${SITE_URL},GCS_CAD_BUCKET=mechonehub-${ENV}-cad-files,PUBSUB_CAD_TOPIC=cad-analysis-jobs,UPSTASH_REDIS_REST_URL=${UPSTASH_REDIS_REST_URL:-https://replace-me.upstash.io}" \
  --set-secrets="ORIGIN_VERIFY_SECRET=ORIGIN_VERIFY_SECRET:latest,SUPABASE_SERVICE_ROLE_KEY=SUPABASE_SERVICE_ROLE_KEY:latest,KYC_ENCRYPTION_KEY=KYC_ENCRYPTION_KEY:latest,CAD_CALLBACK_SECRET=CAD_CALLBACK_SECRET:latest,UPSTASH_REDIS_REST_TOKEN=UPSTASH_REDIS_REST_TOKEN:latest,SENTRY_DSN=SENTRY_DSN:latest,RAZORPAY_KEY_ID=RAZORPAY_KEY_ID:latest,RAZORPAY_KEY_SECRET=RAZORPAY_KEY_SECRET:latest,RAZORPAY_WEBHOOK_SECRET=RAZORPAY_WEBHOOK_SECRET:latest" \
  --allow-unauthenticated

WORKER_URL="$(gcloud run services describe mechonehub-cad-worker --project="$PROJECT_ID" --region="$REGION" --format="value(status.url)")"
WEB_URL="$(gcloud run services describe mechonehub-web --project="$PROJECT_ID" --region="$REGION" --format="value(status.url)")"

gcloud run services update mechonehub-cad-worker \
  --project="$PROJECT_ID" --region="$REGION" \
  --update-env-vars="WEB_CALLBACK_URL=${WEB_URL}"

gcloud run services add-iam-policy-binding mechonehub-cad-worker \
  --project="$PROJECT_ID" --region="$REGION" \
  --member="serviceAccount:${SA_INVOKER}" \
  --role="roles/run.invoker"

if ! gcloud pubsub subscriptions describe cad-analysis-push-sub --project="$PROJECT_ID" >/dev/null 2>&1; then
  gcloud pubsub subscriptions create cad-analysis-push-sub \
    --project="$PROJECT_ID" \
    --topic=cad-analysis-jobs \
    --push-endpoint="${WORKER_URL}/pubsub/analyze" \
    --push-auth-service-account="$SA_INVOKER" \
    --ack-deadline=300 \
    --dead-letter-topic=cad-analysis-deadletter \
    --max-delivery-attempts=5
fi

gcloud pubsub subscriptions add-iam-policy-binding cad-analysis-push-sub \
  --project="$PROJECT_ID" \
  --member="serviceAccount:service-${PROJECT_NUM}@gcp-sa-pubsub.iam.gserviceaccount.com" \
  --role="roles/pubsub.subscriber"

# 9. Keyless Workload Identity Federation (scoped to numeric repo ID + GitHub Environment)
echo "==> Configuring Workload Identity Federation for GitHub Actions..."
REPO_ID="${GITHUB_REPO_ID:-1468384222}"
if [[ -z "$REPO_ID" ]] && command -v gh >/dev/null 2>&1; then
  REPO_ID="$(gh api "repos/${GITHUB_REPO}" --jq .id || true)"
fi
if [[ -z "$REPO_ID" ]]; then
  echo "WARNING: GITHUB_REPO_ID not provided and 'gh' CLI unavailable. Set GITHUB_REPO_ID=<numeric_id> to finish WIF provider condition."
else
  if ! gcloud iam workload-identity-pools describe github --location=global --project="$PROJECT_ID" >/dev/null 2>&1; then
    gcloud iam workload-identity-pools create github --project="$PROJECT_ID" --location=global
  fi
  if ! gcloud iam workload-identity-pools providers describe github-actions --workload-identity-pool=github --location=global --project="$PROJECT_ID" >/dev/null 2>&1; then
    gcloud iam workload-identity-pools providers create-oidc github-actions \
      --project="$PROJECT_ID" \
      --location=global \
      --workload-identity-pool=github \
      --issuer-uri="https://token.actions.githubusercontent.com" \
      --attribute-mapping="google.subject=assertion.sub,attribute.repository_id=assertion.repository_id,attribute.environment=assertion.environment,attribute.ref=assertion.ref" \
      --attribute-condition="assertion.repository_id=='${REPO_ID}'"
  fi

  gcloud iam service-accounts add-iam-policy-binding "$SA_DEPLOYER" \
    --project="$PROJECT_ID" \
    --role="roles/iam.workloadIdentityUser" \
    --member="principalSet://iam.googleapis.com/projects/${PROJECT_NUM}/locations/global/workloadIdentityPools/github/attribute.environment/${GH_ENV_NAME}"

  if [[ "$ENV" == "prod" ]]; then
    gcloud iam service-accounts add-iam-policy-binding "backup-writer@${PROJECT_ID}.iam.gserviceaccount.com" \
      --project="$PROJECT_ID" \
      --role="roles/iam.workloadIdentityUser" \
      --member="principalSet://iam.googleapis.com/projects/${PROJECT_NUM}/locations/global/workloadIdentityPools/github/attribute.environment/backups"
  fi
fi

echo "=============================================================================="
echo "Provisioning complete for ENV=${ENV} (${PROJECT_ID})"
echo "  Web Cloud Run URL:    ${WEB_URL}"
echo "  Worker Cloud Run URL: ${WORKER_URL}"
echo "  WIF Provider:         projects/${PROJECT_NUM}/locations/global/workloadIdentityPools/github/providers/github-actions"
echo "=============================================================================="
