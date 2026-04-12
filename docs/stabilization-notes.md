# Stabilization Notes

## Summary
- Ran repository typechecks and full API test suite.
- Fixed a failing smoke test introduced by recent auth/controller contract changes and sales validation requirements.
- Verified auth-focused tests and API verification script.

## Fixes Applied
1. `artifacts/api-server/test/main-flow.smoke.test.ts`
   - Updated auth service mocks to match the current controller contract (`{ ok, status, data }`).
   - Added the missing `getSalesReport` dependency required by the sales controller.
   - Adjusted the sales order payload and mock to satisfy the `rollIds` minimum requirement.

## Commands Executed
- `pnpm run typecheck`
- `pnpm run test`
- `pnpm run test:auth`
- `pnpm run verify:api`

## Notes
- The test suite reports warnings about missing JWT secret; this is expected in local/dev runs with fallback configuration.
