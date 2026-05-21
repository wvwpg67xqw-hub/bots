import { Router } from "express";
import type { Client } from "discord.js";
import {
  getGuildForms,
  getForm,
  createForm,
  updateForm,
  deleteForm,
  getFormApplications,
  getApplication,
  updateApplicationStatus,
  submitApplication,
  getUserApplications,
  getAllActiveForms,
  isDashboardAdmin,
  getDashboardAdmins,
  getReferralLeaderboard,
  getReferralCode,
  recordReferral,
} from "./database";

import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  Colors,
} from "discord.js";

import { generateId } from "./utils";

const DISCORD_API = "https://discord.com/api/v10";

/* ────────────────────────────────
   Helpers
──────────────────────────────── */

function escapeHtml(str: string): string {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function getRedirectUri(req: any): string {
  const domains = process.env["REPLIT_DOMAINS"];
  const domain = domains ? domains.split(",")[0].trim() : req.hostname;
  return `https://${domain}/dashboard/auth/callback`;
}

function isOwner(userId: string): boolean {
  return userId === process.env["OWNER_ID"];
}

/* ────────────────────────────────
   Router Factory
──────────────────────────────── */

export function createDashboardRouter(client: Client): Router {
  const router = Router();

  /* ────────────────────────────────
     Middleware
  ─────────────────────────────── */

  function requireLogin(req: any, res: any, next: any) {
    if (!req.session?.userId) {
      req.session.returnTo = req.originalUrl;
      return res.redirect("/dashboard/auth/login");
    }
    next();
  }

  function requireAdmin(req: any, res: any, next: any) {
    if (!req.session?.userId) {
      req.session.returnTo = req.originalUrl;
      return res.redirect("/dashboard/auth/login");
    }

    if (!isOwner(req.session.userId) && !isDashboardAdmin(req.session.userId)) {
      return res.status(403).send(
        renderPage(
          "Access Denied",
          accessDeniedPage(req.session.username)
        )
      );
    }

    next();
  }

  /* ────────────────────────────────
     AUTH
  ─────────────────────────────── */

  router.get("/auth/login", (req, res) => {
    const error = req.query.error
      ? `<div class="bg-red-900/40 p-3 text-red-300 rounded mb-4">Login failed</div>`
      : "";

    res.send(
      renderPage(
        "Login",
        `
        <div class="min-h-screen flex items-center justify-center">
          <div class="bg-gray-800 p-8 rounded-xl border border-gray-700 w-full max-w-sm text-center">
            <h1 class="text-white text-2xl font-bold mb-2">Dashboard Login</h1>
            <p class="text-gray-400 text-sm mb-6">Sign in with Discord</p>
            ${error}
            <a class="bg-indigo-600 px-4 py-2 rounded text-white block"
              href="/dashboard/auth/login/go">Login</a>
          </div>
        </div>
        `
      )
    );
  });

  router.get("/auth/login/go", (req, res) => {
    const clientId = process.env["CLIENT_ID"]!;
    const redirectUri = encodeURIComponent(getRedirectUri(req));

    res.redirect(
      `https://discord.com/oauth2/authorize?client_id=${clientId}&redirect_uri=${redirectUri}&response_type=code&scope=identify`
    );
  });

  router.get("/auth/callback", async (req, res) => {
    const { code } = req.query;

    try {
      const params = new URLSearchParams({
        client_id: process.env["CLIENT_ID"]!,
        client_secret: process.env["DISCORD_CLIENT_SECRET"]!,
        grant_type: "authorization_code",
        code: code as string,
        redirect_uri: getRedirectUri(req),
      });

      const tokenRes = await fetch(`${DISCORD_API}/oauth2/token`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: params,
      });

      const tokens = (await tokenRes.json()) as any;

      const userRes = await fetch(`${DISCORD_API}/users/@me`, {
        headers: { Authorization: `Bearer ${tokens.access_token}` },
      });

      const user = (await userRes.json()) as any;

      req.session.userId = user.id;
      req.session.username = user.username;
      req.session.avatar = user.avatar;

      res.redirect("/dashboard");
    } catch {
      res.redirect("/dashboard/auth/login?error=1");
    }
  });

  router.get("/auth/logout", (req, res) => {
    req.session.destroy(() => res.redirect("/dashboard/auth/login"));
  });

  /* ────────────────────────────────
     ROOT ROUTING
  ─────────────────────────────── */

  router.get("/", requireLogin, (req, res) => {
    if (isDashboardAdmin(req.session.userId)) {
      return res.redirect("/dashboard/admin");
    }
    return res.redirect("/dashboard/portal");
  });

  /* ────────────────────────────────
     ADMIN PANEL
  ─────────────────────────────── */

  router.get("/admin", requireAdmin, (req, res) => {
    const guilds = client.guilds.cache;

    const cards = [...guilds.values()]
      .map(
        (g) => `
      <a href="/dashboard/admin/guild/${g.id}" 
        class="block bg-gray-800 p-4 rounded border border-gray-700 hover:bg-gray-700">
        <div class="font-bold text-white">${escapeHtml(g.name)}</div>
        <div class="text-gray-400 text-sm">${g.memberCount} members</div>
      </a>
    `
      )
      .join("");

    res.send(
      renderPage(
        "Admin Panel",
        `
        <div class="max-w-5xl mx-auto p-6">
          <h1 class="text-white text-2xl font-bold mb-4">Admin Panel</h1>
          <div class="grid gap-3">${cards}</div>
        </div>
        `
      )
    );
  });

  router.get("/admin/guild/:guildId", requireAdmin, (req, res) => {
    const guild = client.guilds.cache.get(req.params.guildId);
    if (!guild) return res.redirect("/dashboard/admin");

    const forms = getGuildForms(guild.id);

    const cards = forms
      .map(
        (f) => `
      <div class="bg-gray-800 p-4 rounded border border-gray-700">
        <div class="text-white font-semibold">${escapeHtml(f.name)}</div>
        <div class="text-gray-400 text-sm mb-2">${escapeHtml(
          f.description || ""
        )}</div>

        <a href="/dashboard/admin/guild/${guild.id}/form/${f.id}/submissions"
           class="text-indigo-400 text-sm">View submissions</a>
      </div>
    `
      )
      .join("");

    res.send(
      renderPage(
        "Guild Admin",
        `
        <div class="max-w-5xl mx-auto p-6">
          <h1 class="text-white text-xl font-bold">${escapeHtml(
            guild.name
          )}</h1>
          <div class="grid gap-3 mt-4">${cards}</div>
        </div>
        `
      )
    );
  });

  router.get(
    "/admin/guild/:guildId/form/:formId/submissions",
    requireAdmin,
    (req, res) => {
      renderSubmissions(req, res, "admin");
    }
  );

  router.get(
    "/admin/guild/:guildId/application/:appId",
    requireAdmin,
    (req, res) => {
      renderApplication(req, res, "admin");
    }
  );

  router.post(
    "/admin/guild/:guildId/application/:appId/accept",
    requireAdmin,
    async (req, res) => {
      await handleAppDecision(req, res, "accepted", client);
    }
  );

  router.post(
    "/admin/guild/:guildId/application/:appId/deny",
    requireAdmin,
    async (req, res) => {
      await handleAppDecision(req, res, "denied", client);
    }
  );

  /* ────────────────────────────────
     STAFF PORTAL
  ─────────────────────────────── */

  router.get("/portal", requireLogin, (req, res) => {
    const forms = getAllActiveForms();
    const apps = getUserApplications(req.session.userId);

    const cards = forms
      .map((f: any) => {
        const userApp = apps.find((a: any) => a.form_id === f.id);

        return `
        <div class="bg-gray-800 p-4 rounded border border-gray-700">
          <div class="text-white font-bold">${escapeHtml(f.name)}</div>
          <div class="text-gray-400 text-sm mb-2">${escapeHtml(
            f.description || ""
          )}</div>

          ${
            userApp
              ? `<span class="text-xs text-yellow-400">Already applied</span>`
              : `<a class="text-indigo-400 text-sm"
                  href="/dashboard/portal/apply/${f.id}">Apply</a>`
          }
        </div>`;
      })
      .join("");

    res.send(
      renderPage(
        "Portal",
        `
        <div class="max-w-5xl mx-auto p-6">
          <h1 class="text-white text-2xl font-bold mb-4">Open Positions</h1>
          <div class="grid gap-3">${cards}</div>
        </div>
        `
      )
    );
  });

  router.get("/portal/apply/:formId", requireLogin, (req, res) => {
    const form = getForm(req.params.formId);
    if (!form) return res.redirect("/dashboard/portal");

    const questions = form.questions
      .map(
        (q: string, i: number) => `
      <textarea name="q_${i}" class="w-full bg-gray-700 p-2 rounded mb-2">${escapeHtml(
          q
        )}</textarea>`
      )
      .join("");

    res.send(
      renderPage(
        "Apply",
        `
        <form method="POST">
          <h1 class="text-white text-xl">${escapeHtml(form.name)}</h1>
          ${questions}
          <button class="bg-indigo-600 px-4 py-2 text-white rounded mt-3">
            Submit
          </button>
        </form>
        `
      )
    );
  });

  router.post("/portal/apply/:formId", requireLogin, async (req, res) => {
    const form = getForm(req.params.formId);
    if (!form) return res.redirect("/dashboard/portal");

    const answers: Record<string, string> = {};
    form.questions.forEach((q: string, i: number) => {
      answers[q] = req.body[`q_${i}`] || "";
    });

    submitApplication(
      form.id,
      form.guild_id,
      req.session.userId,
      req.session.username,
      answers
    );

    res.send(renderPage("Submitted", `<h1 class="text-white">Done</h1>`));
  });

  /* ────────────────────────────────
     SUBMISSIONS HELPERS
  ─────────────────────────────── */

  function renderSubmissions(req: any, res: any, role: string) {
    const form = getForm(req.params.formId);
    if (!form) return res.redirect("/dashboard/admin");

    const apps = getFormApplications(form.id);

    const rows = apps
      .map(
        (a) => `
      <div class="bg-gray-800 p-3 mb-2 rounded">
        <div class="text-white">${escapeHtml(a.username)}</div>
        <a class="text-indigo-400 text-sm"
          href="/dashboard/${role}/guild/${req.params.guildId}/application/${a.id}">
          View
        </a>
      </div>`
      )
      .join("");

    res.send(renderPage("Submissions", `<div>${rows}</div>`));
  }

  function renderApplication(req: any, res: any, role: string) {
    const app = getApplication(parseInt(req.params.appId));
    if (!app) return res.redirect("/dashboard/admin");

    const form = getForm(app.form_id);

    const answers = Object.entries(app.answers).map(
      ([q, a]) => `
      <div class="bg-gray-700 p-2 rounded mb-2">
        <div class="text-gray-300 text-sm">${escapeHtml(q)}</div>
        <div class="text-white">${escapeHtml(a as string)}</div>
      </div>`
    );

    res.send(renderPage("Application", answers.join("")));
  }

  /* ────────────────────────────────
     DECISIONS
  ─────────────────────────────── */

  async function handleAppDecision(
    req: any,
    res: any,
    status: "accepted" | "denied",
    client: Client
  ) {
    const app = getApplication(parseInt(req.params.appId));
    if (!app) return res.redirect("/dashboard/admin");

    updateApplicationStatus(app.id, status, req.session.userId);

    const form = getForm(app.form_id);
    const guild = client.guilds.cache.get(req.params.guildId);

    const member = await guild?.members.fetch(app.user_id).catch(() => null);

    const roleId =
      status === "accepted" ? form?.accept_role : form?.deny_role;

    if (member && roleId) {
      await member.roles.add(roleId).catch(() => {});
    }

    res.redirect(req.originalUrl);
  }

  /* ────────────────────────────────
     UTIL
  ─────────────────────────────── */

  function renderPage(title: string, content: string) {
    return `
    <html>
    <head>
      <title>${escapeHtml(title)}</title>
      <script src="https://cdn.tailwindcss.com"></script>
    </head>
    <body class="bg-gray-900 text-white">
      ${content}
    </body>
    </html>`;
  }

  return router;
}