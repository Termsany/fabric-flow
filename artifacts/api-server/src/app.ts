import express, { type Express, type NextFunction, type Request, type Response } from "express";
import cors from "cors";
import multer from "multer";
import pinoHttp from "pino-http";
import path from "node:path";
import router from "./routes";
import { logger } from "./lib/logger";
import { sendAlert } from "./lib/alerts";
import { isLocalStorage } from "./lib/object-storage";

const app: Express = express();

app.disable("x-powered-by");
if (process.env.TRUST_PROXY === "true") {
  app.set("trust proxy", 1);
}

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
const allowedOrigins = (process.env.CORS_ALLOWED_ORIGINS || process.env.APP_URL || "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.length === 0 || allowedOrigins.includes(origin)) {
      callback(null, true);
      return;
    }

    callback(new Error("Origin is not allowed by CORS"));
  },
  credentials: false,
}));
app.use((req, res, next) => {
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Cross-Origin-Resource-Policy", "same-site");
  if (process.env.NODE_ENV === "production") {
    res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  }
  next();
});
app.use("/api/billing/webhook", express.raw({ type: "application/json" }));
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true, limit: "1mb" }));
if (isLocalStorage()) {
  app.use("/uploads", express.static(path.resolve(process.cwd(), process.env.UPLOADS_DIR || "uploads"), {
    fallthrough: false,
    maxAge: process.env.NODE_ENV === "production" ? "7d" : 0,
  }));
}

app.use("/api", router);

app.use("/api", (_req: Request, res: Response) => {
  res.status(404).json({ error: "API route not found" });
});

app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof multer.MulterError) {
    const message = err.code === "LIMIT_FILE_SIZE"
      ? "Image is too large. Maximum size is 4MB"
      : err.message;
    res.status(400).json({ error: message });
    return;
  }

  if (err instanceof Error && (err.message.includes("Only JPG") || err.message.includes("WEBP"))) {
    res.status(400).json({ error: err.message });
    return;
  }

  logger.error({ err }, "Unhandled API error");
  void sendAlert({
    level: "error",
    source: "express",
    message: "Unhandled API error",
    details: err instanceof Error ? { message: err.message, stack: err.stack } : err,
  });
  res.status(500).json({ error: "Internal server error" });
});

export default app;
