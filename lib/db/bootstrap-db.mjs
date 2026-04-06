import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import pg from "pg";

const { Client } = pg;

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const migration0008Path = path.join(rootDir, "lib", "db", "migrations", "0008_payment_methods_management.sql");

function run(command, args) {
  const result = spawnSync(command, args, {
    stdio: "inherit",
    env: process.env,
    cwd: rootDir,
  });

  if (result.error) {
    throw result.error;
  }

  if ((result.status ?? 1) !== 0) {
    process.exit(result.status ?? 1);
  }
}

async function getColumnNames(client, tableName) {
  const result = await client.query(
    `
      select column_name
      from information_schema.columns
      where table_schema = 'public' and table_name = $1
    `,
    [tableName],
  );

  return new Set(result.rows.map((row) => row.column_name));
}

async function tableExists(client, tableName) {
  const result = await client.query(
    `
      select exists (
        select 1
        from information_schema.tables
        where table_schema = 'public' and table_name = $1
      ) as exists
    `,
    [tableName],
  );

  return Boolean(result.rows[0]?.exists);
}

async function applyLegacyPaymentMethodMigrationIfNeeded() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required");
  }

  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  try {
    const hasDefinitionsTable = await tableExists(client, "payment_method_definitions");
    const hasTenantMethodsTable = await tableExists(client, "tenant_payment_methods");
    const hasTenantsTable = await tableExists(client, "tenants");
    const hasUsersTable = await tableExists(client, "users");

    if (!hasDefinitionsTable || !hasTenantMethodsTable) {
      return { shouldRunPush: true };
    }

    const definitionColumns = await getColumnNames(client, "payment_method_definitions");
    const tenantMethodColumns = await getColumnNames(client, "tenant_payment_methods");

    const needsMigration =
      definitionColumns.has("method") ||
      !definitionColumns.has("code") ||
      tenantMethodColumns.has("method") ||
      !tenantMethodColumns.has("payment_method_code");

    if (!needsMigration) {
      return { shouldRunPush: !(hasTenantsTable && hasUsersTable) };
    }

    const migrationSql = fs.readFileSync(migration0008Path, "utf8");
    await client.query(migrationSql);
    console.log("Applied legacy payment methods migration bootstrap.");
    return { shouldRunPush: true };
  } finally {
    await client.end();
  }
}

const result = await applyLegacyPaymentMethodMigrationIfNeeded();
if (result?.shouldRunPush) {
  run(process.execPath, ["./lib/db/run-drizzle.mjs", "push", "--config", "./drizzle.config.ts"]);
} else {
  console.log("Detected existing database schema, skipping automatic drizzle push on startup.");
}
