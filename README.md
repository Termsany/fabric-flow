# Roll Manager Local Development

## Project Structure

- `artifacts/textile-erp`: React + Tailwind frontend
- `artifacts/api-server`: Express API server
- `lib/db`: Drizzle + PostgreSQL schema and migration tooling
- `lib/api-spec`, `lib/api-client-react`, `lib/api-zod`: shared API contract packages

## One-Time Setup

1. Install dependencies:

   ```bash
   pnpm install
   ```

2. Copy environment files:

   ```bash
   cp .env.example .env
   cp artifacts/api-server/.env.example artifacts/api-server/.env
   cp artifacts/textile-erp/.env.example artifacts/textile-erp/.env
   ```

3. Start PostgreSQL:

   ```bash
   docker compose up -d postgres
   ```

4. Apply the database schema:

   ```bash
   pnpm run db:push
   ```

## Start The App

Run both frontend and backend together:

```bash
pnpm run dev
```

The app will be available at:

- Frontend: `http://localhost:3000`
- API: `http://localhost:8080`
- API health check: `http://localhost:8080/api/health`

## Run Individually

Backend:

```bash
cd artifacts/api-server
cp .env.example .env
pnpm run dev
```

Frontend:

```bash
cd artifacts/textile-erp
cp .env.example .env
pnpm run dev
```

## Useful Commands

```bash
pnpm run db:push
pnpm run db:push:prod
pnpm run build
pnpm run typecheck
pnpm run test
pnpm run test:auth
pnpm run verify:api
```

## Backend Refactor Notes

The backend is being standardized gradually around a small feature-module pattern:

- `routes`: route wiring only
- `controller`: request parsing + HTTP mapping
- `service` or focused use-case files: business logic
- `repository`: DB access
- `validation`: request parsing helpers

Current reference modules:

- `auth`
- `sales`
- `warehouses`

More detail:

- [docs/auth-module.md](/home/mustafa/Roll-Manager/docs/auth-module.md)
- [docs/backend-module-pattern.md](/home/mustafa/Roll-Manager/docs/backend-module-pattern.md)

Additional docs:

- [docs/api-error-conventions.md](/home/mustafa/Roll-Manager/docs/api-error-conventions.md)
- [docs/identifier-rules.md](/home/mustafa/Roll-Manager/docs/identifier-rules.md)
- [docs/domain-model.md](/home/mustafa/Roll-Manager/docs/domain-model.md)
- [docs/module-alignment-plan.md](/home/mustafa/Roll-Manager/docs/module-alignment-plan.md)
- [docs/stabilization-notes.md](/home/mustafa/Roll-Manager/docs/stabilization-notes.md)

## Auth Module Notes

The auth flow currently supports:

- bearer sessions
- cookie sessions
- hybrid sessions

This is intentional to keep production behavior stable while reducing coupling between backend and frontend auth handling.

Cookie session deployment notes:

- If `AUTH_SESSION_MODE` is `cookie` or `hybrid`, set `CORS_ALLOWED_ORIGINS` to your frontend origin(s).
- For cross-site auth (separate app and API domains), set `AUTH_COOKIE_SAMESITE=none` and ensure HTTPS.
- Optionally scope cookies with `AUTH_COOKIE_DOMAIN` and `AUTH_COOKIE_PATH` if needed.

For quick auth-focused verification during refactors:

```bash
pnpm run test:auth
```

For a small backend safety pass before pushing:

```bash
pnpm run verify:api
```

## Optional Full Docker Dev Stack

If you want to run the frontend, backend, and database in Docker:

```bash
docker compose --profile fullstack up --build
```

## Notes

- The frontend uses `VITE_API_URL` and a Vite dev proxy so `/api/*` works locally.
- Stripe variables are only required when testing billing flows.
- Admin registration creates the initial tenant and user for local testing.

## Fly.io Production Deploy

Deploy this project to Fly.io as two apps:

- `textile-erp-api`
- `textile-erp-web`

### 1. Create the apps

```bash
fly apps create textile-erp-api
fly apps create textile-erp-web
```

### 2. Set API secrets

```bash
fly secrets set -a textile-erp-api \
  DATABASE_URL=postgresql://... \
  JWT_SECRET=replace-me \
  APP_URL=https://textile-erp-web.fly.dev \
  CORS_ALLOWED_ORIGINS=https://textile-erp-web.fly.dev \
  SUPER_ADMIN_EMAIL=superadmin@your-domain.example \
  SUPER_ADMIN_PASSWORD=replace-me \
  STORAGE_PROVIDER=s3 \
  S3_ENDPOINT=https://your-r2-or-s3-endpoint \
  S3_BUCKET=roll-manager \
  S3_ACCESS_KEY_ID=replace-me \
  S3_SECRET_ACCESS_KEY=replace-me
```

### 3. Deploy the API

```bash
fly deploy -c fly.api.toml
```

### 4. Deploy the web app

If your API app name is different, update `VITE_API_URL` in [fly.web.toml](/home/mustafa/Roll-Manager/fly.web.toml) first.

```bash
fly deploy -c fly.web.toml
```

### 5. Smoke test

```bash
APP_URL=https://textile-erp-web.fly.dev pnpm run smoke:test
```

## AWS ECS Deployment

The repository also includes AWS deployment starter files:

- [/.env.aws.example](/home/mustafa/Roll-Manager/.env.aws.example)
- [backend-task-definition.json](/home/mustafa/Roll-Manager/deploy/aws/backend-task-definition.json)
- [frontend-task-definition.json](/home/mustafa/Roll-Manager/deploy/aws/frontend-task-definition.json)
- [ecs-mapping.md](/home/mustafa/Roll-Manager/deploy/aws/ecs-mapping.md)
- [deploy-aws.yml](/home/mustafa/Roll-Manager/.github/workflows/deploy-aws.yml)

Use this stack on AWS:

- ECR for Docker images
- ECS Fargate for `backend` and `frontend`
- RDS PostgreSQL instead of Docker `postgres`
- S3 for uploads
- ALB + ACM for HTTPS and routing

GitHub Actions expects these repository variables:

- `AWS_REGION`
- `ECR_BACKEND_REPOSITORY`
- `ECR_FRONTEND_REPOSITORY`
- `ECS_BACKEND_CLUSTER`
- `ECS_FRONTEND_CLUSTER`
- `ECS_BACKEND_SERVICE`
- `ECS_FRONTEND_SERVICE`
- `VITE_API_URL`

And this repository secret:

- `AWS_ROLE_TO_ASSUME`

## Production DB Release Order (Safe Path)

Use this order to reduce risk during a first production launch:

1. Provision the database (RDS/Fly Postgres).
2. Configure secrets (especially `DATABASE_URL`, `JWT_SECRET`, `APP_URL`).
3. Apply schema using a one-off release step:
   - `pnpm run db:push:prod`
4. Deploy the API service.
5. Deploy the frontend (after `VITE_API_URL` is correct).

Notes:
- `pnpm run db:push` is intended for local dev only (it reads from `.env`).
- For ECS, prefer a one-off task or a CI step that runs `pnpm run db:push:prod` before switching traffic.
