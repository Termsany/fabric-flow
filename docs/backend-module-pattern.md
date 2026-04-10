# Backend Module Pattern

This repository is moving toward a small, repeatable backend module pattern:

1. `*.routes.ts`
- Express route wiring only
- middleware attachment only

2. `*.controller.ts`
- request parsing
- HTTP status selection
- response shaping

3. `*.service.ts` or focused use-case files
- business logic
- orchestration across repositories/services

4. `*.repository.ts`
- database access only
- no HTTP concerns

5. `*.validation.ts`
- request parsing helpers
- controller-level structural validation only

## Current Reference Modules

- `auth`
- `sales`
- `warehouses`

## Preferred Refactor Direction

When touching a route-heavy feature, prefer:

1. move DB calls into a repository
2. move orchestration into a service
3. keep route/controller response contracts unchanged
4. split only one feature at a time

## Review Heuristic

A backend feature is in a good state when:

- routes are thin
- controllers are short
- services hold the business rules
- repositories stay free of business decisions
- validation is explicit and local
