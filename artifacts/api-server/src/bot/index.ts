import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import session from "express-session";

import router from "./routes";
import { logger } from "./lib/logger";
import { startBot } from "./bot/index";

const app: Express = express();

// Logging
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
  }),
);

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Session (for future dashboard/auth use)
app.use(
  session({
    secret: process.env["SESSION_SECRET"] ?? "discord-bot-secret-change-me",
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: false, // set true in production with HTTPS
      maxAge: 7 * 24 * 60 * 60 * 1000,
    },
  }),
);

// Start Discord bot
const client = startBot();

// API routes only (dashboard removed since it no longer exists)
app.use("/api", router);

// Root redirect (optional)
app.get("/", (_req, res) => {
  res.send("Bot API is running. Dashboard is currently disabled.");
});

export default app;