import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const cwd = path.dirname(fileURLToPath(import.meta.url));

function run(command, args) {
  return spawnSync(command, args, {
    stdio: "inherit",
    env: process.env,
    cwd,
  });
}

const command = process.platform === "win32" ? "pnpm.cmd" : "pnpm";
let result = run(command, ["exec", "drizzle-kit", ...process.argv.slice(2)]);

if (result.error && result.error.code === "ENOENT") {
  const require = createRequire(import.meta.url);
  const drizzleKitEntry = require.resolve("drizzle-kit");
  const drizzleKitBin = path.join(path.dirname(drizzleKitEntry), "bin.cjs");
  result = run(process.execPath, [drizzleKitBin, ...process.argv.slice(2)]);
}

if (result.error) {
  throw result.error;
}

process.exit(result.status ?? 1);
