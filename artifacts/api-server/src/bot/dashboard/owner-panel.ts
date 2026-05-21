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
  getDashboardAdmins,
  addDashboardAdmin,
  removeDashboardAdmin,
} from "../database";

import { generateId } from "../utils";

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

export function createOwnerPanelRouter(client: Client): Router {
  const router = Router();

  /* ────────────────────────────────
     Middleware
  ─────────────────────────────── */

  function requireOwner(req: any, res: any, next: any) {
    if (!req.session?.userId) {
      return res.redirect("/dashboard/auth/login");
    }

    if (!isOwner(req.session.userId)) {
      return res.status(403).send("Access Denied");
    }

    next();
  }

  /* ────────────────────────────────
     OWNER HOME
  ─────────────────────────────── */

  router.get("/", requireOwner, (req, res) => {
    const guilds = client.guilds.cache;

    const cards = [...guilds.values()]
      .map(
        (g) => `
      <a href="/dashboard/owner/guild/${g.id}"
        class="block bg-gray-800 p-4 rounded border border-gray-700 hover:bg-gray-700">
        <div class="text-white font-bold">${escapeHtml(g.name)}</div>
        <div class="text-gray-400 text-sm">${g.memberCount} members</div>
      </a>`
      )
      .join("");

    res.send(
      page(
        "Owner Panel",
        `
        <div class="max-w-5xl mx-auto p-6">
          <h1 class="text-2xl font-bold text-white mb-4">Owner Panel</h1>
          <div class="grid gap-3">${cards}</div>

          <div class="mt-10">
            <a href="/dashboard/owner/admins"
              class="text-indigo-400 text-sm">Manage Admins →</a>
          </div>
        </div>
        `
      )
    );
  });

  /* ────────────────────────────────
     GUILD VIEW
  ─────────────────────────────── */

  router.get("/guild/:guildId", requireOwner, (req, res) => {
    const guild = client.guilds.cache.get(req.params.guildId);
    if (!guild) return res.redirect("/dashboard/owner");

    const forms = getGuildForms(guild.id);

    const cards = forms
      .map(
        (f) => `
      <div class="bg-gray-800 p-4 rounded border border-gray-700">
        <div class="text-white font-semibold">${escapeHtml(f.name)}</div>
        <div class="text-gray-400 text-sm mb-2">${escapeHtml(
          f.description || ""
        )}</div>

        <div class="flex gap-3 text-sm">
          <a class="text-indigo-400"
             href="/dashboard/owner/guild/${guild.id}/form/${f.id}/edit">
             Edit
          </a>

          <a class="text-blue-400"
             href="/dashboard/owner/guild/${guild.id}/form/${f.id}/submissions">
             Submissions
          </a>

          <form method="POST"
            action="/dashboard/owner/guild/${guild.id}/form/${f.id}/delete"
            onsubmit="return confirm('Delete this form?')">
            <button class="text-red-400">Delete</button>
          </form>
        </div>
      </div>`
      )
      .join("");

    res.send(
      page(
        "Guild",
        `
        <div class="max-w-5xl mx-auto p-6">
          <h1 class="text-xl font-bold text-white">${escapeHtml(
            guild.name
          )}</h1>

          <a class="text-indigo-400 text-sm"
             href="/dashboard/owner/guild/${guild.id}/form/new">
             + Create Form
          </a>

          <div class="grid gap-3 mt-4">${cards}</div>
        </div>
        `
      )
    );
  });

  /* ────────────────────────────────
     CREATE FORM
  ─────────────────────────────── */

  router.get("/guild/:guildId/form/new", requireOwner, (req, res) => {
    const guild = client.guilds.cache.get(req.params.guildId);
    if (!guild) return res.redirect("/dashboard/owner");

    res.send(
      page(
        "New Form",
        `
        <form method="POST" class="max-w-xl mx-auto p-6">
          <h1 class="text-white text-xl mb-4">Create Form</h1>

          <input name="name" placeholder="Form Name"
            class="w-full p-2 mb-2 bg-gray-700 rounded"/>

          <input name="description" placeholder="Description"
            class="w-full p-2 mb-2 bg-gray-700 rounded"/>

          <textarea name="questions" placeholder="Questions (one per line)"
            class="w-full p-2 mb-2 bg-gray-700 rounded"></textarea>

          <button class="bg-indigo-600 px-4 py-2 rounded text-white">
            Create
          </button>
        </form>
        `
      )
    );
  });

  router.post("/guild/:guildId/form/new", requireOwner, (req, res) => {
    const { name, description, questions } = req.body;

    const qs = (questions || "")
      .split("\n")
      .map((q: string) => q.trim())
      .filter(Boolean);

    createForm(
      generateId(),
      req.params.guildId,
      name,
      description,
      qs,
      undefined,
      undefined,
      undefined
    );

    res.redirect(`/dashboard/owner/guild/${req.params.guildId}`);
  });

  /* ────────────────────────────────
     EDIT FORM
  ─────────────────────────────── */

  router.get("/guild/:guildId/form/:formId/edit", requireOwner, (req, res) => {
    const form = getForm(req.params.formId);
    if (!form) return res.redirect("/dashboard/owner");

    res.send(
      page(
        "Edit Form",
        `
        <form method="POST" class="max-w-xl mx-auto p-6">
          <h1 class="text-white text-xl mb-4">Edit Form</h1>

          <input name="name" value="${escapeHtml(form.name)}"
            class="w-full p-2 mb-2 bg-gray-700 rounded"/>

          <input name="description" value="${escapeHtml(
            form.description || ""
          )}"
            class="w-full p-2 mb-2 bg-gray-700 rounded"/>

          <textarea name="questions"
            class="w-full p-2 mb-2 bg-gray-700 rounded">${form.questions.join(
              "\n"
            )}</textarea>

          <label class="text-sm text-gray-300">
            <input type="checkbox" name="active" ${
              form.active ? "checked" : ""
            }>
            Active
          </label>

          <button class="bg-indigo-600 px-4 py-2 rounded text-white mt-3">
            Save
          </button>
        </form>
        `
      )
    );
  });

  router.post("/guild/:guildId/form/:formId/edit", requireOwner, (req, res) => {
    const { name, description, questions, active } = req.body;

    const qs = (questions || "")
      .split("\n")
      .map((q: string) => q.trim())
      .filter(Boolean);

    updateForm(req.params.formId, {
      name,
      description,
      questions: qs,
      active: active === "on" ? 1 : 0,
    });

    res.redirect(`/dashboard/owner/guild/${req.params.guildId}`);
  });

  /* ────────────────────────────────
     DELETE FORM
  ─────────────────────────────── */

  router.post(
    "/guild/:guildId/form/:formId/delete",
    requireOwner,
    (req, res) => {
      deleteForm(req.params.formId);
      res.redirect(`/dashboard/owner/guild/${req.params.guildId}`);
    }
  );

  /* ────────────────────────────────
     SUBMISSIONS
  ─────────────────────────────── */

  router.get(
    "/guild/:guildId/form/:formId/submissions",
    requireOwner,
    (req, res) => {
      const apps = getFormApplications(req.params.formId);

      const rows = apps
        .map(
          (a) => `
        <div class="bg-gray-800 p-3 rounded mb-2">
          <div class="text-white">${escapeHtml(a.username)}</div>
          <a class="text-indigo-400 text-sm"
             href="/dashboard/owner/guild/${req.params.guildId}/application/${a.id}">
             View
          </a>
        </div>`
        )
        .join("");

      res.send(page("Submissions", `<div class="max-w-2xl mx-auto">${rows}</div>`));
    }
  );

  router.get(
    "/guild/:guildId/application/:appId",
    requireOwner,
    (req, res) => {
      const app = getApplication(parseInt(req.params.appId));
      if (!app) return res.redirect("/dashboard/owner");

      const answers = Object.entries(app.answers)
        .map(
          ([q, a]) => `
        <div class="bg-gray-700 p-2 rounded mb-2">
          <div class="text-gray-300">${escapeHtml(q)}</div>
          <div class="text-white">${escapeHtml(a as string)}</div>
        </div>`
        )
        .join("");

      res.send(page("Application", answers));
    }
  );

  /* ────────────────────────────────
     ADMIN MANAGEMENT
  ─────────────────────────────── */

  router.get("/admins", requireOwner, (req, res) => {
    const admins = getDashboardAdmins();

    const rows = admins
      .map(
        (a) => `
      <div class="bg-gray-800 p-3 rounded mb-2">
        <div class="text-white">${escapeHtml(a.username)}</div>

        <form method="POST"
          action="/dashboard/owner/admins/${a.user_id}/remove">
          <button class="text-red-400 text-sm">Remove</button>
        </form>
      </div>`
      )
      .join("");

    res.send(page("Admins", rows));
  });

  router.post("/admins/add", requireOwner, (req, res) => {
    const { user_id, username } = req.body;
    addDashboardAdmin(user_id, username, req.session.userId);
    res.redirect("/dashboard/owner/admins");
  });

  router.post("/admins/:id/remove", requireOwner, (req, res) => {
    removeDashboardAdmin(req.params.id);
    res.redirect("/dashboard/owner/admins");
  });

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