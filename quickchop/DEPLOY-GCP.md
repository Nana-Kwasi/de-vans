# Deploying the QuickChop backend to Google Cloud Run

The Spring Boot API runs on Cloud Run; the database, auth and image storage stay on
Supabase. There is nothing stateful in the container, so the ephemeral filesystem costs
us nothing.

```
Mobile app (Expo) ──┐
                    ├──►  Cloud Run  ──┬──►  Supabase Postgres  (session pooler, JDBC)
Admin web (Vite) ───┘     Spring Boot  ├──►  Supabase Auth      (JWKS, customer JWTs)
                                       ├──►  Supabase Storage   (menu images)
                                       └──►  Paystack           (payments)
```

**Live as of 23 September 2026** — service `quickchop-backend`, region `europe-west2`:
https://quickchop-backend-g4kiqgy27q-nw.a.run.app

Project `project-e45edf99-8cdd-4e55-a7d` — the same one the Mama Africa backend runs in,
and the only one of the five with billing enabled. The two services sit side by side and
share the `containers` Artifact Registry repository and the Cloud Build IAM grants.

Supabase project `xksrntgvwjeccooqcdwk` lives in **eu-central-1 (Frankfurt)**, so the
pooler host is `aws-0-eu-central-1.pooler.supabase.com`. All eleven Flyway migrations
applied cleanly against Postgres 17.6 on first boot. Its JWKS signing key is ES256,
which `application.yml` already lists under `jws-algorithms` — RS256 alone would reject
every customer token.

## Why the runtime image is not Alpine

Nothing here loads an ONNX model the way the Mama Africa backend does, so the glibc
constraint that ruled Alpine out there does not strictly apply. It is still
`eclipse-temurin:21-jre` (Ubuntu): `firebase-admin` brings gRPC, which has optional
native epoll and tcnative paths, and on musl any of those turns into Cloud Run's
generic "container failed to start and listen on PORT" with the real cause buried in
the revision logs. Roughly 100MB to not debug that.

## Why the Supabase *pooler* host, not the direct one

`db.<project-ref>.supabase.co` resolves over IPv6 only. Cloud Run egresses over IPv4,
so a direct connection string times out during Flyway's first migration with nothing
useful in the logs. Use the **session pooler** (port 5432 on
`aws-0-<region>.pooler.supabase.com`), and note the username is `postgres.<project-ref>`,
not `postgres`.

Port 6543 is the *transaction* pooler and breaks JDBC prepared statements unless
`prepareThreshold=0` is appended — it already is in our URL, but session mode is the
right fit for a Hikari pool anyway.

## Two things that were missing before the first deploy

**`/actuator/health` did not exist.** `SecurityConfig` had already whitelisted the path,
but `spring-boot-starter-actuator` was not a dependency, so it returned 404 — Cloud Run
would have had nothing to probe and the deploy script nothing to verify. The starter is
now in `pom.xml`, with `management.endpoints.web.exposure.include: health` so that only
the health endpoint is reachable; `env`, `beans` and `configprops` would otherwise be
public on an internet-facing service.

**CORS was hardcoded to reflect any origin.** `corsConfigurationSource` now reads
`CORS_ALLOWED_ORIGINS` (comma separated) and falls back to the old any-origin behaviour
when it is blank, which is what local development wants. It is deliberately left blank
on Cloud Run for now — see "Still to do" below.

## "Container failed to start" is almost never the port

Cloud Run reports every startup failure as:

```
The user-provided container failed to start and listen on the port defined
provided by the PORT=8080 environment variable within the allocated timeout.
```

That message is the same whatever went wrong, and the real cause is only in the
revision logs, not the deploy output:

```bash
gcloud logging read \
  'resource.type="cloud_run_revision" AND resource.labels.service_name="quickchop-backend"' \
  --limit=60 --format='value(textPayload)' --freshness=20m
```

The first deploy failed this way, and the log said:

```
FATAL: (ENOTFOUND) tenant/user postgres.<project-ref> not found
```

That is the Supabase pooler rejecting the tenant, thrown while Flyway opens its
connection — so Spring never finishes its context refresh and never binds the port.
Startup is all-or-nothing here: `ddl-auto: validate` plus Flyway on boot means an
unreachable database is a failed deploy, not a degraded service.

`ENOTFOUND tenant/user` has three causes worth checking in order:

1. **The Supabase project is paused or deleted.** Free projects pause after a week of
   inactivity. Check `nslookup <project-ref>.supabase.co` — `NXDOMAIN` means the project
   is gone, not merely asleep, and no connection string will fix it.
2. **Wrong pooler host.** Supabase has been moving projects from `aws-0-<region>` to
   `aws-1-<region>`; both resolve, but only the one your project sits behind knows the
   tenant. Copy the host from Supabase → Connect → Session pooler rather than assuming.
3. **Username is plain `postgres`.** Against the pooler it must be
   `postgres.<project-ref>`.

## Connection budget

`DB_POOL_SIZE=5` per instance against `--max-instances 4` caps the service at 20
Postgres connections, comfortably inside what the Supabase session pooler allows.
Raising max-instances without lowering the pool size is the way to exhaust it.

## One-time setup

```bash
brew install --cask google-cloud-sdk
gcloud auth login
gcloud config set project project-e45edf99-8cdd-4e55-a7d
```

Docker Desktop is not needed — images are built by Cloud Build.

Cloud Build runs as the project's default compute service account (new projects no
longer get a dedicated Cloud Build one, and a build with no identity fails as
`PERMISSION_DENIED`). It needs `logging.logWriter`, `artifactregistry.writer`,
`storage.objectUser` and — at **project** level, because the precondition check reads
the project policy and ignores a bucket-scoped grant — `storage.admin`. All four are
already granted on this project from the Mama Africa deploy.

## Deploying

```bash
cp deploy/cloudrun.env.example deploy/cloudrun.env   # first time only
$EDITOR deploy/cloudrun.env
./deploy/deploy-cloudrun.sh
```

`deploy/cloudrun.env` is git-ignored and holds live secrets. The script refuses to
deploy while any `<placeholder>` remains, because that would otherwise surface minutes
later as an opaque revision error. Roughly five minutes the first time, two after that.

| Setting | Value | Reason |
|---|---|---|
| `--memory` | 1Gi | plain Spring Boot + JPA + Flyway; nothing large in the heap |
| `--cpu` | 1 | no CPU-bound work; Paystack and Supabase calls are all I/O |
| `--min-instances` | 1 | Spring Boot cold-starts in 20–40s; no customer waits that long |
| `--cpu-boost` | on | full CPU during startup, so the first boot finishes inside the probe window |
| `--timeout` | 60s | well above any Paystack or Supabase round-trip |
| `--concurrency` | 40 | with pool size 5 and 4 instances, stays inside the Supabase pooler's budget |

`--min-instances 1` is the one line with a standing cost — roughly $15–25/month for an
always-warm instance. Drop it to 0 and the service is nearly free, but every request
after an idle period eats the cold start.

## After the first deploy

1. **Verify**: `curl https://<service-url>/actuator/health` returns `{"status":"UP"}`,
   and `curl https://<service-url>/api/menu` returns the seeded menu (which also proves
   Flyway ran all eleven migrations against Supabase).

2. **Point the admin dashboard at it.** `VITE_API_BASE_URL` is inlined by Vite at build
   time, so the dashboard must be rebuilt, not just reconfigured.

   ```bash
   echo 'VITE_API_BASE_URL=https://<service-url>' > web/.env.production
   cd web && npm run build
   ```

3. **Point the mobile app at it.** Same idea — the Expo app reads the API base URL from
   its own config, and a native build has to be rebuilt to pick it up.

4. **Change the seeded admin password.** `V2__seed_admin.sql` inserts the default admin;
   sign in and change it before the service sees real traffic.

## Email: Gmail SMTP behind Supabase Auth

Customer signup confirmation and password reset are sent by **Supabase Auth**, not by
this backend — the backend has no mail capability at all (no `spring-boot-starter-mail`,
no `JavaMailSender`). So SMTP is configured in the Supabase dashboard, under
Project Settings → Authentication → SMTP Settings:

| Field | Value |
|---|---|
| Host | `smtp.gmail.com` |
| Port | `587` (STARTTLS) |
| Username | `qookacooks@gmail.com` |
| Password | the 16-character Google **app password** (not the account password) |
| Sender email | `qookacooks@gmail.com` |
| Sender name | `QOOKA` |

Verified working: authenticated against `smtp.gmail.com:587` and delivered a test
message on 23 September 2026.

Three things that bite with Gmail as a relay:

- **The sender address must be the authenticated account.** Gmail rewrites or rejects a
  `From` it does not own, which shows up as mail that sends "successfully" but fails
  DMARC at the recipient and lands in spam.
- **Raise the auth rate limit.** Supabase caps auth emails at 30/hour by default, which
  applies even with custom SMTP until changed under Auth → Rate Limits. Gmail itself
  allows roughly 500/day, less on a young account.
- **Deliverability is not transactional-grade.** Gmail is fine for launch volume, but
  confirmation emails will sometimes land in spam. A dedicated sender (Resend, SendGrid,
  SES) is the upgrade once signups matter.

`mailer_autoconfirm` is currently off, meaning customers *must* click a confirmation
link. That only became workable once real SMTP was attached — on the built-in Supabase
mailer it silently throttles to a handful of messages an hour.

## Still to do

- **The seeded admin password is `0000000000`**, in plain sight in
  `V2__seed_admin.sql`, and the API is now public. Anyone who reads this repository can
  sign in as the owner. Change it first:

  ```bash
  TOKEN=$(curl -s -X POST "$URL/api/admin/login" -H 'Content-Type: application/json' \
    -d '{"email":"franciskontoh4@gmail.com","password":"0000000000"}' \
    | python3 -c 'import sys,json; print(json.load(sys.stdin)["token"])')

  curl -X PATCH "$URL/api/admin/change-password" \
    -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
    -d '{"currentPassword":"0000000000","newPassword":"<a real password>"}'
  ```

- **Swagger is public.** `/swagger-ui.html` and `/v3/api-docs` are reachable without a
  token, because `SecurityConfig` permits them and there is no `prod` profile to switch
  them off the way the Mama Africa backend does. It publishes the full API surface,
  including admin routes.

- **Rotating the Supabase password needs a redeploy.** It is baked into the Cloud Run
  revision's environment, so changing it in Supabase without re-running
  `./deploy/deploy-cloudrun.sh` breaks the running service at its next connection.

- **Paystack is on a test key.** `PAYSTACK_SECRET_KEY` is `sk_test_…`, so checkout runs
  end to end but no money moves. Swap it for the live key and redeploy when you are
  ready to take orders.
- **CORS is open.** `CORS_ALLOWED_ORIGINS` is blank, so the API reflects any browser
  origin — and `allowCredentials` is on. The mobile app is unaffected either way (native
  clients send no `Origin` header), so set this to the dashboard's real origin as soon
  as it has one.
- **Secrets are plain environment variables on the revision.** Anyone with Cloud Run
  viewer access can read `SUPABASE_DB_PASSWORD`, `SUPABASE_SERVICE_KEY`,
  `ADMIN_JWT_SECRET` and `PAYSTACK_SECRET_KEY`. Moving them into Secret Manager and
  referencing them with `--set-secrets` is the next hardening step.
- **Push notifications are logged, not sent.** `FCM_CREDENTIALS_PATH` points at a file
  that does not exist in the container, so `NotificationService` degrades to logging by
  design. Mounting the service-account JSON from Secret Manager enables it.
- **`/uploads/**` is dead weight.** `WebConfig` still serves a local upload directory,
  but `FileStorageService` writes to Supabase Storage and nothing reads that path any
  more. Harmless on Cloud Run — the directory is simply empty — but worth deleting.
