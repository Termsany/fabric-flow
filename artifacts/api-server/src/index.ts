import app from "./app";
import { sendAlert } from "./lib/alerts";
import { logger } from "./lib/logger";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");
});

process.on("unhandledRejection", (reason) => {
  logger.error({ err: reason }, "Unhandled promise rejection");
  void sendAlert({
    level: "error",
    source: "process",
    message: "Unhandled promise rejection",
    details: reason,
  });
});

process.on("uncaughtException", (error) => {
  logger.error({ err: error }, "Uncaught exception");
  void sendAlert({
    level: "error",
    source: "process",
    message: "Uncaught exception",
    details: { message: error.message, stack: error.stack },
  });
});
