#!/usr/bin/env bash
#
# Builds the backend image with Cloud Build and deploys it to Cloud Run.
#
#   ./deploy/deploy-cloudrun.sh
#
# Configuration lives in deploy/cloudrun.env (copy deploy/cloudrun.env.example). Keys
# prefixed GCP_, plus SERVICE_NAME, steer the deploy; every other key is passed to the
# container as an environment variable.
#
# The build runs on Cloud Build, not on this machine, so a local Docker daemon is not
# needed.
set -euo pipefail

cd "$(dirname "$0")/.."
ENV_FILE="deploy/cloudrun.env"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Missing $ENV_FILE. Copy deploy/cloudrun.env.example to it and fill it in." >&2
  exit 1
fi

# This runs BEFORE sourcing, not after: a placeholder like <openssl rand -base64 48> is
# a redirection as far as the shell is concerned, so `source` dies on it with a parse
# error pointing at a line number. Checking first turns that into the message below.
# (A placeholder that did survive would deploy a service that cannot start, and surface
# as an opaque Cloud Run revision error minutes later.)
if grep -qE '^[A-Z_]+=<' "$ENV_FILE"; then
  echo "These values are still placeholders in $ENV_FILE:" >&2
  grep -nE '^[A-Z_]+=<' "$ENV_FILE" | sed 's/^/  /' >&2
  exit 1
fi

# shellcheck disable=SC1090
set -a; source "$ENV_FILE"; set +a

: "${GCP_PROJECT:?set GCP_PROJECT in $ENV_FILE}"
: "${GCP_REGION:?set GCP_REGION in $ENV_FILE}"
: "${SERVICE_NAME:?set SERVICE_NAME in $ENV_FILE}"

REPO="containers"
IMAGE="${GCP_REGION}-docker.pkg.dev/${GCP_PROJECT}/${REPO}/${SERVICE_NAME}"
TAG="$(date +%Y%m%d-%H%M%S)"

echo "==> Project ${GCP_PROJECT}, region ${GCP_REGION}, service ${SERVICE_NAME}"
gcloud config set project "$GCP_PROJECT" --quiet

echo "==> Enabling required APIs (no-op once they are on)"
gcloud services enable \
  run.googleapis.com \
  cloudbuild.googleapis.com \
  artifactregistry.googleapis.com \
  --quiet

if ! gcloud artifacts repositories describe "$REPO" --location "$GCP_REGION" &>/dev/null; then
  echo "==> Creating Artifact Registry repository '${REPO}'"
  gcloud artifacts repositories create "$REPO" \
    --repository-format=docker \
    --location="$GCP_REGION" \
    --description="Container images" \
    --quiet
fi

# New projects no longer get the legacy <project-number>@cloudbuild.gserviceaccount.com
# account, and a build with no identity fails as PERMISSION_DENIED. The compute default
# account stands in; it needs logWriter, artifactregistry.writer, storage.objectUser and
# — at PROJECT level — storage.admin. See deploy/grant-build-iam.sh.
PROJECT_NUMBER="$(gcloud projects describe "$GCP_PROJECT" --format='value(projectNumber)')"
BUILD_SA="${PROJECT_NUMBER}-compute@developer.gserviceaccount.com"

# Cloud Build otherwise logs to a global bucket it creates on demand. Owning the bucket
# keeps build logs in the same region as everything else.
LOG_BUCKET="gs://${GCP_PROJECT}-build-logs"
if ! gcloud storage buckets describe "$LOG_BUCKET" &>/dev/null; then
  echo "==> Creating build log bucket ${LOG_BUCKET}"
  gcloud storage buckets create "$LOG_BUCKET" \
    --location="$GCP_REGION" \
    --uniform-bucket-level-access \
    --quiet
fi

echo "==> Building ${IMAGE}:${TAG}"
gcloud builds submit backend \
  --tag "${IMAGE}:${TAG}" \
  --service-account="projects/${GCP_PROJECT}/serviceAccounts/${BUILD_SA}" \
  --default-buckets-behavior=regional-user-owned-bucket \
  --gcs-log-dir="${LOG_BUCKET}/logs" \
  --quiet

# --set-env-vars splits on commas, and CORS_ALLOWED_ORIGINS is a comma-separated list.
# A YAML file sidesteps the escaping entirely. It holds secrets, so it is written with
# tight permissions and removed on exit.
ENV_YAML="$(mktemp -t cloudrun-env)"
trap 'rm -f "$ENV_YAML"' EXIT
chmod 600 "$ENV_YAML"

python3 - "$ENV_FILE" "$ENV_YAML" <<'PY'
import sys

src, dest = sys.argv[1], sys.argv[2]
skip = {"SERVICE_NAME"}
out = {}

for line in open(src):
    line = line.strip()
    if not line or line.startswith("#") or "=" not in line:
        continue
    key, value = line.split("=", 1)
    key, value = key.strip(), value.strip()
    # Deploy settings configure gcloud; they are not application configuration.
    if key.startswith("GCP_") or key in skip:
        continue
    # A value quoted for the benefit of `source` would otherwise reach Cloud Run with
    # the quotes still attached. SUPABASE_DB_URL in particular must be quoted in the
    # file so the shell does not choke on the '&' in its query string.
    if len(value) >= 2 and value[0] == value[-1] and value[0] in "\"'":
        value = value[1:-1]
    out[key] = value

with open(dest, "w") as fh:
    for key, value in out.items():
        # Quote everything: YAML would otherwise read 720, true, or a bare 8080 as a
        # non-string, and Cloud Run rejects a non-string environment value.
        fh.write('%s: "%s"\n' % (key, value.replace('\\', '\\\\').replace('"', '\\"')))

print("    %d environment variables" % len(out), file=sys.stderr)
PY

echo "==> Deploying to Cloud Run"
# --memory 1Gi / --cpu 1: plain Spring Boot + JPA + Flyway, no model in the heap.
# --min-instances 1: a Spring Boot cold start is 20-40s, which no customer should wait for.
# --cpu-boost: full CPU during startup, so the first boot lands inside the probe window.
# --concurrency 40 with --max-instances 4 and DB_POOL_SIZE=5 caps the service at 20
#   Postgres connections, well inside what the Supabase session pooler allows.
gcloud run deploy "$SERVICE_NAME" \
  --image "${IMAGE}:${TAG}" \
  --region "$GCP_REGION" \
  --platform managed \
  --allow-unauthenticated \
  --port 8080 \
  --memory 1Gi \
  --cpu 1 \
  --min-instances 1 \
  --max-instances 4 \
  --timeout 60s \
  --concurrency 40 \
  --cpu-boost \
  --env-vars-file "$ENV_YAML" \
  --quiet

URL="$(gcloud run services describe "$SERVICE_NAME" --region "$GCP_REGION" --format='value(status.url)')"
echo
echo "==> Deployed: ${URL}"
echo "    Health:   ${URL}/actuator/health"
echo "    Menu:     ${URL}/api/menu"
echo
echo "Next: point the admin dashboard at it —"
echo "  echo 'VITE_API_BASE_URL=${URL}' > web/.env.production"
echo "  (cd web && npm run build)"
