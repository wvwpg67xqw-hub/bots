import { Router } from "express";
import type { Client } from "discord.js";

import {
  getGuildForms,
  getForm,
  getFormApplications,
  getApplication,
  updateApplicationStatus,
  isDashboardAdmin,
} from "../database";

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

function isOwner(userId: string): boolean {
  return userId === process.env["OWNER_ID"];
}

/* ────────────────────────────────
   Router
──────────────────────────────── */

export function createAdminPanelRouter(client: Client): Router {
  const router = Router();

  /* ────────────────────────────────
     AUTH MIDDLEWARE
  ─────────────────────────────── */

  function requireAdmin(req: any, res: any, next: any) {
    if (!req.session?.userId) {
      return res.redirect("/dashboard/auth/login");
    }

    if (!isOwner(req.session.userId) && !isDashboardAdmin(req.session.userId)) {
      return res.status(403).send(page("Denied", "Access Denied"));
    }

    next();
  }

  /* ────────────────────────────────
     ADMIN HOME
  ─────────────────────────────── */

  router.get("/", requireAdmin, (req, res) => {
    const guilds = client.guilds.cache;

    const cards = [...guilds.values()]
      .map(
        (g) => `
      <a href="/dashboard/admin/guild/${g.id}"
        class="block bg-gray-800 p-4 rounded border border-gray-700 hover:bg-gray-700">

        <div class="text-white font-bold">${escapeHtml(g.name)}</div>
        <div class="text-gray-400 text-sm">${g.memberCount} members</div>
      </a>`
      )
      .join("");

    res.send(
      page(
        "Admin Panel",
        `
        <div class="max-w-5xl mx-auto p-6">
          <h1 class="text-2xl font-bold text-white mb-4">Admin Panel</h1>
          <div class="grid gap-3">${cards}</div>
        </div>
        `
      )
    );
  });

  /* ────────────────────────────────
     GUILD VIEW
  ─────────────────────────────── */

  router.get("/guild/:guildId", requireAdmin, (req, res) => {
    const guild = client.guilds.cache.get(req.params.guildId);
    if (!guild) return res.redirect("/dashboard/admin");

    const forms = getGuildForms(guild.id);

    const cards = forms
      .map(
        (f) => `
      <div class="bg-gray-800 p-4 rounded border border-gray-700">
        <div class="text-white font-semibold">${escapeHtml(f.name)}</div>
        <div class="text-gray-400 text-sm">${escapeHtml(
          f.description || ""
        )}</div>

        <a class="text-indigo-400 text-sm"
           href="/dashboard/admin/guild/${guild.id}/form/${f.id}/submissions">
           View Submissions
        </a>
      </div>`
      )
      .join("");

    res.send(
      page(
        guild.name,
        `
        <div class="max-w-5xl mx-auto p-6">
          <h1 class="text-xl font-bold text-white">${escapeHtml(
            guild.name
          )}</h1>

          <div class="grid gap-3 mt-4">${cards}</div>
        </div>
        `
      )
    );
  });

  /* ────────────────────────────────
     SUBMISSIONS LIST
  ─────────────────────────────── */

  router.get(
    "/guild/:guildId/form/:formId/submissions",
    requireAdmin,
    (req, res) => {
      const form = getForm(req.params.formId);
      if (!form) return res.redirect("/dashboard/admin");

      const apps = getFormApplications(form.id);

      const rows = apps
        .map(
          (a) => `
        <div class="bg-gray-800 p-3 rounded mb-2">
          <div class="text-white font-semibold">${escapeHtml(
            a.username
          )}</div>

          <div class="text-xs text-gray-400">${a.status}</div>

          <a class="text-indigo-400 text-sm"
             href="/dashboard/admin/guild/${req.params.guildId}/application/${a.id}">
             View Application
          </a>
        </div>`
        )
        .join("");

      res.send(page("Submissions", `<div class="max-w-2xl mx-auto">${rows}</div>`));
    }
  );

  /* ────────────────────────────────
     APPLICATION VIEW
  ─────────────────────────────── */

  router.get(
    "/guild/:guildId/application/:appId",
    requireAdmin,
    (req, res) => {
      const app = getApplication(parseInt(req.params.appId));
      if (!app) return res.redirect("/dashboard/admin");

      const answers = Object.entries(app.answers)
        .map(
          ([q, a]) => `
        <div class="bg-gray-700 p-3 rounded mb-2">
          <div class="text-gray-300 text-sm">${escapeHtml(q)}</div>
          <div class="text-white">${escapeHtml(a as string)}</div>
        </div>`
        )
        .join("");

      const actions =
        app.status === "pending"
          ? `
        <div class="flex gap-3 mt-4">
          <form method="POST"
            action="/dashboard/admin/guild/${req.params.guildId}/application/${app.id}/accept">
            <button class="bg-green-600 px-4 py-2 rounded text-white">Accept</button>
          </form>

          <form method="POST"
            action="/dashboard/admin/guild/${req.params.guildId}/application/${app.id}/deny">
            <button class="bg-red-600 px-4 py-2 rounded text-white">Deny</button>
          </form>
        </div>`
          : `<div class="text-gray-400 text-sm mt-4">
              Reviewed: ${app.status}
            </div>`;

      res.send(page("Application", answers + actions));
    }
  );

  /* ────────────────────────────────
     ACCEPT / DENY
  ─────────────────────────────── */

  router.post(
    "/guild/:guildId/application/:appId/accept",
    requireAdmin,
    async (req, res) => {
      await handleDecision(req, res, "accepted");
    }
  );

  router.post(
    "/guild/:guildId/application/:appId/deny",
    requireAdmin,
    async (req, res) => {
      await handleDecision(req, res, "denied");
    }
  );

  /* ────────────────────────────────
     DECISION LOGIC
  ─────────────────────────────── */

  async function handleDecision(
    req: any,
    res: any,
    status: "accepted" | "denied"
  ) {
    const app = getApplication(parseInt(req.params.appId));
    if (!app) return res.redirect("/dashboard/admin");

    updateApplicationStatus(app.id, status, req.session.userId);

    res.redirect(
      `/dashboard/admin/guild/${req.params.guildId}/application/${app.id}`
    );
  }

  /* ────────────────────────────────
     PAGE WRAPPER
  ─────────────────────────────── */

  function page(title: string, content: string) {
    return `
    <html>
      <head>
        <title>${escapeHtml(title)}</title>
        <script src="https://cdn.tailwindcss.com"></script>
      </head>

      <body class="bg-gray-900 text-white p-6">
        ${content}
      </body>
    </html>`;
  }

  return router;
}