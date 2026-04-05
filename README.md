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
