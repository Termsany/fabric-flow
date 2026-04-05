import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import path from "node:path";

const [, , modulePath, ...args] = process.argv;

if (!modulePath) {
  console.error("Usage: node scripts/run-package-bin.mjs <module-path> [...args]");
  process.exit(1);
}

const require = createRequire(new URL("../package.json", import.meta.url));

function splitPackagePath(value) {
  const segments = value.split("/");

  if (value.startsWith("@")) {
    return {
      packageName: segments.slice(0, 2).join("/"),
      internalPath: segments.slice(2).join("/"),
    };
  }

  return {
    packageName: segments[0],
    internalPath: segments.slice(1).join("/"),
  };
}

function resolveModulePath(value) {
  try {
    return require.resolve(value);
  } catch (error) {
    if (error && error.code !== "ERR_PACKAGE_PATH_NOT_EXPORTED") {
      throw error;
    }

    const { packageName, internalPath } = splitPackagePath(value);
    if (!internalPath) {
      throw error;
    }

    const packageEntry = require.resolve(packageName);
    return path.join(path.dirname(packageEntry), internalPath);
  }
}

const resolved = resolveModulePath(modulePath);

const child = spawn(process.execPath, [resolved, ...args], {
  stdio: "inherit",
  env: process.env,
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exit(code ?? 1);
});

child.on("error", (error) => {
  console.error(error);
  process.exit(1);
});
