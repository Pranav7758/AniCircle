import "dotenv/config";
import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "../server/routes";

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }
      if (logLine.length > 80) logLine = logLine.slice(0, 79) + "…";
      console.log(logLine);
    }
  });

  next();
});

let initialized = false;
let initPromise: Promise<void> | null = null;

async function ensureInitialized(): Promise<void> {
  if (initialized) return;
  if (initPromise) return initPromise;
  initPromise = registerRoutes(app).then(() => {
    app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
      const status = err.status || err.statusCode || 500;
      const message = err.message || "Internal Server Error";
      res.status(status).json({ message });
    });
    initialized = true;
  }).catch((err) => {
    console.error("[vercel] registerRoutes failed:", err?.message || err);
    initPromise = null;
    throw err;
  });
  return initPromise;
}

export default async function handler(req: any, res: any) {
  try {
    await ensureInitialized();
  } catch (err: any) {
    return res.status(500).json({ error: "Server initialization failed", detail: err?.message });
  }

  // Vercel strips the /api prefix from req.url before calling the handler.
  // Express routes are registered as /api/*, so we must restore the prefix.
  if (req.url && !req.url.startsWith("/api")) {
    req.url = "/api" + req.url;
  }

  return app(req, res);
}
