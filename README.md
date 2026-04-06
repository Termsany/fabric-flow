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
pnpm run build
pnpm run typecheck
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
