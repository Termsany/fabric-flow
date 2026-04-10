# Auth Module Notes

The auth module now follows a small feature-oriented structure under:

- `artifacts/api-server/src/modules/auth`

## Main Files

- `auth.routes.ts`
  - route wiring only
- `auth.controller.ts`
  - validation + HTTP response mapping
- `auth.service.ts`
  - small facade that composes auth use-cases
- `auth.login.ts`
  - login path selection
- `auth.register.ts`
  - registration orchestration
- `auth.current-user.ts`
  - current user resolution
- `auth.change-password.ts`
  - password change branching
- `auth.repository.ts`
  - DB access
- `auth.validation.ts`
  - controller-level request parsing

## Auth Session Model

The codebase currently supports:

- `bearer`
- `cookie`
- `hybrid`

This is controlled by:

- backend: `AUTH_SESSION_MODE`
- frontend: `VITE_AUTH_SESSION_MODE`

The current web app is designed to remain compatible with hybrid operation.
This is intentional to avoid a risky auth migration.

## Register Flow Boundaries

`register()` is intentionally split into:

1. email availability check
2. atomic core creation
   - tenant
   - admin user
3. post-creation provisioning
   - payment methods
   - subscription bootstrap

Provisioning is still outside the core DB transaction by design.
If provisioning fails, the system now fails clearly, but does not yet compensate automatically.

## Auth Tests

High-value tests currently cover:

- login path selection
- register success and failure boundaries
- password change branching
- controller mapping for login failures

Run only auth-focused checks with:

```bash
pnpm run test:auth
```
