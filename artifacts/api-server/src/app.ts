import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import session from "express-session";

import router from "./routes";
import { logger } from "./lib/logger";
import { startBot } from "./bot/index";
import {
  createDashboardRouter,
  createApplyRouter,
  createReferRouter,
} from "./bot/dashboard";

const app: Express = express();

// =======================
// Logging
// =======================
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
  })
);

// =======================
// Middleware
// =======================
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(
  session({
    secret: process.env["SESSION_SECRET"] ?? "discord-bot-secret-change-me",
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: false,
      maxAge: 7 * 24 * 60 * 60 * 1000,
    },
  })
);

// =======================
// HEALTH CHECK (UptimeRobot)
// =======================
app.get("/healthz", (_req, res) => {
  res.status(200).json({
    status: "ok",
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

// Optional root route
app.get("/", (_req, res) => {
  res.send("ONLINE");
});

// =======================
// Bot startup
// =======================
const client = startBot();

// =======================
// API routes
// =======================
app.use("/api", router);

// Dashboard routes (after bot ready)
client.once("ready", () => {
  logger.info(`Bot logged in as ${client.user?.tag}`);

  app.use("/dashboard", createDashboardRouter(client));
  app.use("/apply", createApplyRouter(client));
  app.use("/refer", createReferRouter());
});

export default app;