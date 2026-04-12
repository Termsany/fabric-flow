# API Error Conventions

This document records the current safe conventions used by operational API endpoints in `artifacts/api-server`. It is intentionally incremental and does not redefine every legacy route.

## Scope

These conventions are now applied consistently across the controller-driven operational modules:

- `auth`
- `sales`
- `warehouses`

Direct route files such as `production-orders`, `fabric-rolls`, and `qc-reports` already follow the same lightweight error shape for most cases and should continue to converge toward the same pattern over time.

## Success responses

- `GET` list endpoints return raw arrays validated against response schemas.
- `GET` item endpoints return raw objects validated against response schemas.
- `POST` create endpoints return `201` with the created resource body.
- `PATCH` update endpoints return `200` with the updated resource body.
- `DELETE` or logout-style endpoints may return `204` with no body where already established.

## Error responses

For operational endpoints, the default error body should remain:

```json
{ "error": "Human-readable message" }
```

This shape is intentionally preserved for client compatibility.

### Recommended status mapping

- `400` for validation and malformed input
- `401` for unauthenticated requests
- `403` for authorization or subscription/plan limits
- `404` for tenant-scoped records that do not exist
- `409` only where a real conflict already exists in the current API
- `500` for unhandled server-side failures

## Validation conventions

- Use endpoint-specific parsers where lightweight normalization is helpful.
- Normalize predictable enum input safely, for example trimming and uppercasing workflow statuses.
- Trim optional text input where this does not change business meaning.
- Keep validation failures mapped to a single `error` string for existing operational clients.

## Controller conventions

- Controllers should validate request params/query/body first.
- Controllers should map service failures through a small responder helper rather than inlining status/body logic repeatedly.
- Success payloads should be schema-parsed before returning when a response schema already exists.

## Current intentional exceptions

- `plans` still returns validation errors as:

```json
{ "message": "Validation failed", "errors": { "...": ["..."] } }
```

This appears to be an established contract for those admin/billing-style flows, so it was not changed in the operational consistency pass.

- Some legacy route files still perform inline response mapping instead of using shared controller helpers. They should be aligned gradually rather than rewritten in one pass.
