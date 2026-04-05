import { logger } from "./logger";

export async function sendAlert(event: {
  level: "error" | "warning";
  message: string;
  source: string;
  details?: unknown;
}): Promise<void> {
  const webhook = process.env.ALERT_WEBHOOK_URL?.trim();
  if (!webhook) {
    return;
  }

  try {
    const response = await fetch(webhook, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        timestamp: new Date().toISOString(),
        app: "roll-manager-api",
        ...event,
      }),
    });

    if (!response.ok) {
      logger.warn({ status: response.status, source: event.source }, "Alert webhook rejected the request");
    }
  } catch (err) {
    logger.warn({ err, source: event.source }, "Failed to send alert webhook");
  }
}

