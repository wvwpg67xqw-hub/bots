import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import session from "express-session";

import router from "./routes";
import { logger } from "./lib/logger";

import { startBot } from "./bot/index";

// 👇 FIXED IMPORTS (because dashboard is split into files now)
import { createDashboardRouter } from "./bot/dashboard/dashboard";
import { createApplyRouter } from "./bot/dashboard/apply";
import { createReferRouter } from "./bot/dashboard/refer";

const app: Express = express();

/* ─────────────────────────────────────────────
   Logging
──────────────────────────────────────────── */
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
        return { statusCode: res.statusCode };
      },
    },
  })
);

/* ─────────────────────────────────────────────
   Middleware
──────────────────────────────────────────── */
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

/* ─────────────────────────────────────────────
   Sessions
──────────────────────────────────────────── */
app.use(
  session({
    secret: process.env["SESSION_SECRET"] ?? "discord-bot-secret-change-me",
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: false, // set true in production (HTTPS)
      maxAge: 7 * 24 * 60 * 60 * 1000,
    },
  })
);

/* ─────────────────────────────────────────────
   Start Discord bot
──────────────────────────────────────────── */
const client = startBot();

/* ─────────────────────────────────────────────
   API routes (always available)
──────────────────────────────────────────── */
app.use("/api", router);

/* ─────────────────────────────────────────────
   BOOT STRAP SEQUENCE (IMPORTANT FIX)
   Only mount dashboard AFTER bot is ready
──────────────────────────────────────────── */
client.once("ready", () => {
  logger.info(`Bot logged in as ${client.user?.tag}`);

  // Dashboard routes (need guild cache / roles / channels)
  app.use("/dashboard", createDashboardRouter(client));
  app.use("/apply", createApplyRouter(client));
  app.use("/refer", createReferRouter());

  // Root redirect
  app.get("/", (_req, res) => {
    res.redirect("/dashboard");
  });

  // Start web server ONLY after bot is ready
  const PORT = process.env.PORT || 3000;

  app.listen(PORT, () => {
    logger.info(`Web server running on port ${PORT}`);
  });
});

export default app;