# Workspace

## Overview

pnpm workspace monorepo using TypeScript. This is a full-featured Textile ERP SaaS system for managing fabric rolls, production orders, quality control, dyeing, warehouse, and sales.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)
- **Frontend**: React + Vite + Tailwind CSS + Recharts + Wouter

## Artifacts

1. **API Server** (`artifacts/api-server`) — Express backend, port 8080, prefix `/api`
2. **Textile ERP** (`artifacts/textile-erp`) — React+Vite frontend, served at `/`

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally

## DB Tables

- `tenants` — multi-tenant companies
- `users` — per-tenant users with roles (admin, production, qc, warehouse, sales)
- `production_orders` — production jobs, auto-generate fabric rolls
- `fabric_rolls` — rolls with status lifecycle (CREATED → QC_PENDING → QC_PASSED/QC_FAILED → SENT_TO_DYEING → IN_DYEING → FINISHED → IN_STOCK → RESERVED → SOLD)
- `qc_reports` — quality control inspections, auto-updates roll status
- `dyeing_orders` — dyehouse jobs referencing multiple rolls
- `warehouses` — physical storage locations
- `warehouse_movements` — roll movement history
- `customers` — sales customers
- `sales_orders` — sales orders referencing rolls
- `audit_logs` — all create/update actions tracked

## Frontend Pages

- `/login` — JWT login (Arabic RTL default, EN toggle)
- `/register` — Create new tenant + admin user
- `/dashboard` — KPI cards + donut chart + bar chart + recent activity
- `/fabric-rolls` — List/search/filter by status; detail page with QR code
- `/production-orders` — Create (auto-generates N rolls); detail with roll list
- `/qc` — QC reports; create for QC_PENDING rolls
- `/dyeing` — Dyeing orders; assign QC_PASSED rolls
- `/warehouses` — Warehouse CRUD + move rolls between warehouses
- `/sales` — Customers + Sales orders (tab switcher)
- `/users` — Admin only: user management
- `/audit-logs` — Admin only: full audit trail

## Auth

- JWT stored in `localStorage` key `textile_erp_token`
- Language stored in `localStorage` key `textile_erp_lang` (ar/en)
- Arabic is default (RTL layout); English toggle available everywhere
