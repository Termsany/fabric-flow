# ECS Mapping

This project maps cleanly from `docker-compose.prod.yml` to AWS ECS services:

## Services

- `backend` -> ECS Fargate service `textile-erp-backend`
- `frontend` -> ECS Fargate service `textile-erp-frontend`
- `postgres` -> AWS RDS PostgreSQL
- `postgres-backup` -> optional ECS scheduled task or AWS Backup
- `gateway` -> AWS Application Load Balancer + ACM

## Recommended AWS Layout

- VPC with public + private subnets
- `frontend` in private subnets behind ALB
- `backend` in private subnets behind ALB
- RDS PostgreSQL in private subnets
- S3 for payment proof uploads
- Secrets Manager for all production secrets
- CloudWatch Logs for both ECS services

## Routing

- `app.example.com` -> ALB target group -> `frontend:3000`
- `api.example.com` -> ALB target group -> `backend:8080`
- `cdn.example.com` -> S3/CloudFront for uploads

## Environment Ownership

- Backend runtime secrets come from AWS Secrets Manager
- Frontend API endpoint is baked at build time through:
  - `VITE_API_URL=https://api.example.com`

## Database Migrations

- Run schema deployment before switching traffic:
  - `pnpm run db:push:prod`

For ECS, prefer a one-off release task or CI step rather than running bootstrap on every container start.

## Safe Release Order

1. Provision RDS (or managed Postgres).
2. Configure Secrets Manager values (especially `DATABASE_URL`, `JWT_SECRET`, `APP_URL`).
3. Run `pnpm run db:push:prod` as a one-off task.
4. Deploy `backend`, wait for health.
5. Deploy `frontend` after `VITE_API_URL` is correct.
