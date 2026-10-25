#!/usr/bin/env bash
#
# Fills the Supabase values in deploy/cloudrun.env from what the dashboard shows you.
#
#   ./deploy/configure-supabase.sh
#
# Secrets are read with the terminal echo off and written straight to the file, so they
# never land in your shell history. Everything else in cloudrun.env is left alone.
set -euo pipefail

cd "$(dirname "$0")/.."
ENV_FILE="deploy/cloudrun.env"

[[ -f "$ENV_FILE" ]] || cp deploy/cloudrun.env.example "$ENV_FILE"
chmod 600 "$ENV_FILE"

echo "Supabase dashboard -> Connect -> Session pooler tab."
echo

read -rp "Project ref (the string in the dashboard URL): " REF
[[ "$REF" =~ ^[a-z0-9]{16,}$ ]] || { echo "That does not look like a project ref." >&2; exit 1; }

# aws-0 vs aws-1 is not guessable: Supabase has been moving projects between them, and
# the wrong one fails as 'ENOTFOUND tenant/user' minutes into the deploy.
read -rp "Pooler HOST, copied exactly (e.g. aws-1-eu-west-1.pooler.supabase.com): " HOST
[[ "$HOST" == *.pooler.supabase.com ]] || { echo "That is not a pooler host — use the Session pooler tab, not Direct connection." >&2; exit 1; }

read -rsp "Database password: " DB_PASS; echo
[[ -n "$DB_PASS" ]] || { echo "Empty password." >&2; exit 1; }

read -rsp "Service key (Project Settings -> API Keys -> secret): " SVC_KEY; echo
[[ -n "$SVC_KEY" ]] || { echo "Empty service key." >&2; exit 1; }

REF="$REF" HOST="$HOST" DB_PASS="$DB_PASS" SVC_KEY="$SVC_KEY" python3 - "$ENV_FILE" <<'PY'
import os, sys, re

path = sys.argv[1]
ref, host = os.environ["REF"], os.environ["HOST"]

values = {
    "SUPABASE_DB_URL": '"jdbc:postgresql://%s:5432/postgres?sslmode=require&prepareThreshold=0"' % host,
    "SUPABASE_DB_USER": "postgres.%s" % ref,
    "SUPABASE_DB_PASSWORD": os.environ["DB_PASS"],
    "SUPABASE_URL": "https://%s.supabase.co" % ref,
    "SUPABASE_ISSUER_URI": "https://%s.supabase.co/auth/v1" % ref,
    "SUPABASE_JWKS_URI": "https://%s.supabase.co/auth/v1/.well-known/jwks.json" % ref,
    "SUPABASE_SERVICE_KEY": os.environ["SVC_KEY"],
}

lines = open(path).read().splitlines(keepends=True)
seen = set()
out = []
for line in lines:
    m = re.match(r'^([A-Z_]+)=', line)
    if m and m.group(1) in values:
        key = m.group(1)
        seen.add(key)
        out.append("%s=%s\n" % (key, values[key]))
    else:
        out.append(line)

# A key the template never had still has to reach the container.
for key, value in values.items():
    if key not in seen:
        out.append("%s=%s\n" % (key, value))

open(path, "w").writelines(out)
print("Updated %d Supabase values." % len(values))
PY

echo
echo "Checking the JWKS endpoint is live..."
if curl -fsS --max-time 15 "https://${REF}.supabase.co/auth/v1/.well-known/jwks.json" \
     | grep -q '"keys"'; then
  echo "  OK — auth will validate customer tokens."
else
  echo "  WARNING: no JWKS returned. The project may still be provisioning; re-check before deploying." >&2
fi

echo
echo "Next:"
echo "  1. Storage -> New bucket -> 'menu-images', Public."
echo "  2. ./deploy/deploy-cloudrun.sh"
