import { Router } from "express";
import type { Client } from "discord.js";
import {
  getGuildForms, getForm, createForm, updateForm, deleteForm,
  getFormApplications, getApplication, updateApplicationStatus,
  getAllApplications, submitApplication,
} from "./database";
import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, Colors } from "discord.js";
import { generateId } from "./utils";

const DISCORD_API = "https://discord.com/api/v10";

function getRedirectUri(req: any): string {
  const domains = process.env["REPLIT_DOMAINS"];
  const domain = domains ? domains.split(",")[0].trim() : req.hostname;
  return `https://${domain}/dashboard/auth/callback`;
}

export function createDashboardRouter(client: Client): Router {
  const router = Router();

  // ── Auth middleware ────────────────────────────────────────────────────
  function requireAuth(req: any, res: any, next: any) {
    if (!req.session?.userId) return res.redirect("/dashboard/auth/login");
    if (req.session.userId !== process.env["OWNER_ID"]) {
      return res.status(403).send(renderPage("Access Denied", "<p class='text-red-400 text-center text-xl mt-20'>Access denied. This dashboard is owner-only.</p>"));
    }
    next();
  }

  // ── Discord OAuth2 ─────────────────────────────────────────────────────
  router.get("/auth/login", (req: any, res) => {
    const clientId = process.env["CLIENT_ID"]!;
    const redirectUri = encodeURIComponent(getRedirectUri(req));
    const url = `https://discord.com/oauth2/authorize?client_id=${clientId}&redirect_uri=${redirectUri}&response_type=code&scope=identify`;
    res.redirect(url);
  });

  router.get("/auth/callback", async (req: any, res) => {
    const { code } = req.query;
    if (!code) return res.redirect("/dashboard/auth/login");
    try {
      const redirectUri = getRedirectUri(req);
      const params = new URLSearchParams({
        client_id: process.env["CLIENT_ID"]!,
        client_secret: process.env["DISCORD_CLIENT_SECRET"]!,
        grant_type: "authorization_code",
        code: code as string,
        redirect_uri: redirectUri,
      });
      const tokenRes = await fetch(`${DISCORD_API}/oauth2/token`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: params,
      });
      const tokens = await tokenRes.json() as any;
      if (!tokens.access_token) throw new Error("No access token");
      const userRes = await fetch(`${DISCORD_API}/users/@me`, {
        headers: { Authorization: `Bearer ${tokens.access_token}` },
      });
      const user = await userRes.json() as any;
      if (user.id !== process.env["OWNER_ID"]) {
        return res.status(403).send(renderPage("Access Denied", `
          <div class="max-w-md mx-auto mt-32 text-center">
            <div class="text-6xl mb-4">🚫</div>
            <h1 class="text-2xl font-bold text-white mb-2">Access Denied</h1>
            <p class="text-gray-400">This dashboard is only accessible to the bot owner.</p>
            <a href="/dashboard" class="mt-6 inline-block px-6 py-2 bg-indigo-600 rounded-lg text-white hover:bg-indigo-500">Go Back</a>
          </div>
        `));
      }
      req.session.userId = user.id;
      req.session.username = user.username;
      req.session.avatar = user.avatar;
      res.redirect("/dashboard");
    } catch (e) {
      res.redirect("/dashboard/auth/login?error=1");
    }
  });

  router.get("/auth/logout", (req: any, res) => {
    req.session.destroy(() => res.redirect("/dashboard"));
  });

  // ── Dashboard home ─────────────────────────────────────────────────────
  router.get("/", requireAuth, (req: any, res) => {
    const guilds = client.guilds.cache;
    const guildCards = guilds.map(g => `
      <a href="/dashboard/guild/${g.id}" class="block bg-gray-800 rounded-xl p-5 hover:bg-gray-700 transition border border-gray-700 hover:border-indigo-500">
        <div class="flex items-center gap-4">
          ${g.iconURL() ? `<img src="${g.iconURL()}" class="w-12 h-12 rounded-full">` : `<div class="w-12 h-12 rounded-full bg-indigo-600 flex items-center justify-center text-white font-bold text-lg">${g.name[0]}</div>`}
          <div>
            <div class="font-semibold text-white">${escapeHtml(g.name)}</div>
            <div class="text-sm text-gray-400">${g.memberCount.toLocaleString()} members</div>
          </div>
        </div>
      </a>
    `).join("");

    res.send(renderPage("Dashboard", `
      <div class="max-w-5xl mx-auto px-4 py-8">
        <div class="flex items-center justify-between mb-8">
          <h1 class="text-3xl font-bold text-white">🤖 Bot Dashboard</h1>
          <div class="flex items-center gap-4">
            <span class="text-gray-400 text-sm">Logged in as <span class="text-white font-medium">${escapeHtml(req.session.username)}</span></span>
            <a href="/dashboard/auth/logout" class="px-4 py-2 bg-gray-700 rounded-lg text-sm text-gray-300 hover:bg-gray-600">Logout</a>
          </div>
        </div>
        <div class="grid grid-cols-1 gap-4 mb-8">
          <div class="bg-gray-800 rounded-xl p-5 border border-gray-700">
            <div class="text-gray-400 text-sm mb-1">Servers</div>
            <div class="text-3xl font-bold text-white">${guilds.size}</div>
          </div>
        </div>
        <h2 class="text-xl font-semibold text-white mb-4">Select a Server</h2>
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          ${guildCards || '<p class="text-gray-400 col-span-3">No servers found.</p>'}
        </div>
      </div>
    `));
  });

  // ── Guild dashboard ────────────────────────────────────────────────────
  router.get("/guild/:guildId", requireAuth, (req: any, res): void => {
    const { guildId } = req.params;
    const guild = client.guilds.cache.get(guildId);
    if (!guild) { res.status(404).send(renderPage("Not Found", "<p class='text-center text-gray-400 mt-20'>Guild not found.</p>")); return; }
    const forms = getGuildForms(guildId);
    const formCards = forms.map(f => `
      <div class="bg-gray-800 rounded-xl p-5 border border-gray-700">
        <div class="flex items-start justify-between mb-3">
          <div>
            <h3 class="font-semibold text-white">${escapeHtml(f.name)}</h3>
            <p class="text-sm text-gray-400">${escapeHtml(f.description || "")}</p>
          </div>
          <span class="px-2 py-1 rounded text-xs ${f.active ? "bg-green-900 text-green-300" : "bg-gray-700 text-gray-400"}">${f.active ? "Active" : "Inactive"}</span>
        </div>
        <div class="text-sm text-gray-400 mb-4">${f.questions.length} question${f.questions.length !== 1 ? "s" : ""}</div>
        <div class="flex gap-2 flex-wrap">
          <a href="/dashboard/guild/${guildId}/form/${f.id}/edit" class="px-3 py-1 bg-indigo-600 rounded text-sm text-white hover:bg-indigo-500">Edit</a>
          <a href="/dashboard/guild/${guildId}/form/${f.id}/submissions" class="px-3 py-1 bg-blue-600 rounded text-sm text-white hover:bg-blue-500">Submissions</a>
          <a href="/apply/${f.id}" target="_blank" class="px-3 py-1 bg-gray-600 rounded text-sm text-white hover:bg-gray-500">Apply Link</a>
          <form method="POST" action="/dashboard/guild/${guildId}/form/${f.id}/delete" class="inline" onsubmit="return confirm('Delete this form?')">
            <button class="px-3 py-1 bg-red-700 rounded text-sm text-white hover:bg-red-600">Delete</button>
          </form>
        </div>
      </div>
    `).join("");

    res.send(renderPage(`${guild.name} — Dashboard`, `
      <div class="max-w-5xl mx-auto px-4 py-8">
        <div class="flex items-center gap-4 mb-8">
          <a href="/dashboard" class="text-gray-400 hover:text-white">← Back</a>
          <div class="flex items-center gap-3">
            ${guild.iconURL() ? `<img src="${guild.iconURL()}" class="w-10 h-10 rounded-full">` : ""}
            <h1 class="text-2xl font-bold text-white">${escapeHtml(guild.name)}</h1>
          </div>
        </div>
        <div class="flex items-center justify-between mb-6">
          <h2 class="text-xl font-semibold text-white">Application Forms</h2>
          <a href="/dashboard/guild/${guildId}/form/new" class="px-4 py-2 bg-indigo-600 rounded-lg text-white text-sm hover:bg-indigo-500">+ New Form</a>
        </div>
        ${forms.length === 0
          ? `<div class="bg-gray-800 rounded-xl p-10 text-center border border-gray-700 border-dashed">
               <div class="text-4xl mb-3">📋</div>
               <p class="text-gray-400">No application forms yet.</p>
               <a href="/dashboard/guild/${guildId}/form/new" class="mt-4 inline-block px-5 py-2 bg-indigo-600 rounded-lg text-white hover:bg-indigo-500">Create your first form</a>
             </div>`
          : `<div class="grid grid-cols-1 sm:grid-cols-2 gap-4">${formCards}</div>`
        }
      </div>
    `));
  });

  // ── New form ───────────────────────────────────────────────────────────
  router.get("/guild/:guildId/form/new", requireAuth, (req: any, res) => {
    const { guildId } = req.params;
    const guild = client.guilds.cache.get(guildId);
    if (!guild) return res.redirect("/dashboard");
    const channels = guild.channels.cache.filter(c => c.isTextBased()).map(c => `<option value="${c.id}">#${escapeHtml(c.name)}</option>`).join("");
    const roles = guild.roles.cache.filter(r => r.id !== guild.id).sort((a, b) => b.position - a.position).map(r => `<option value="${r.id}">${escapeHtml(r.name)}</option>`).join("");
    res.send(renderPage("New Form", formEditor(guildId, null, channels, roles)));
  });

  router.post("/guild/:guildId/form/new", requireAuth, (req: any, res) => {
    const { guildId } = req.params;
    const { name, description, questions, channel_id, accept_role, deny_role } = req.body;
    const qs = Array.isArray(questions) ? questions.filter(Boolean) : (questions ? [questions] : []);
    const id = generateId();
    createForm(id, guildId, name, description, qs, channel_id || undefined, accept_role || undefined, deny_role || undefined);
    res.redirect(`/dashboard/guild/${guildId}`);
  });

  // ── Edit form ──────────────────────────────────────────────────────────
  router.get("/guild/:guildId/form/:formId/edit", requireAuth, (req: any, res) => {
    const { guildId, formId } = req.params;
    const guild = client.guilds.cache.get(guildId);
    const form = getForm(formId);
    if (!guild || !form) return res.redirect(`/dashboard/guild/${guildId}`);
    const channels = guild.channels.cache.filter(c => c.isTextBased()).map(c => `<option value="${c.id}" ${c.id === form.channel_id ? "selected" : ""}>#${escapeHtml(c.name)}</option>`).join("");
    const roles = guild.roles.cache.filter(r => r.id !== guild.id).sort((a, b) => b.position - a.position).map(r =>
      `<option value="${r.id}" ${r.id === form.accept_role ? "selected" : ""}>${escapeHtml(r.name)}</option>`
    ).join("");
    const denyRoles = guild.roles.cache.filter(r => r.id !== guild.id).sort((a, b) => b.position - a.position).map(r =>
      `<option value="${r.id}" ${r.id === form.deny_role ? "selected" : ""}>${escapeHtml(r.name)}</option>`
    ).join("");
    res.send(renderPage("Edit Form", formEditor(guildId, form, channels, roles, denyRoles)));
  });

  router.post("/guild/:guildId/form/:formId/edit", requireAuth, (req: any, res) => {
    const { guildId, formId } = req.params;
    const { name, description, questions, channel_id, accept_role, deny_role, active } = req.body;
    const qs = Array.isArray(questions) ? questions.filter(Boolean) : (questions ? [questions] : []);
    updateForm(formId, { name, description, questions: qs, channel_id: channel_id || "", accept_role: accept_role || "", deny_role: deny_role || "", active: active === "on" ? 1 : 0 });
    res.redirect(`/dashboard/guild/${guildId}`);
  });

  // ── Delete form ────────────────────────────────────────────────────────
  router.post("/guild/:guildId/form/:formId/delete", requireAuth, (req: any, res) => {
    const { guildId, formId } = req.params;
    deleteForm(formId);
    res.redirect(`/dashboard/guild/${guildId}`);
  });

  // ── Submissions ────────────────────────────────────────────────────────
  router.get("/guild/:guildId/form/:formId/submissions", requireAuth, (req: any, res) => {
    const { guildId, formId } = req.params;
    const form = getForm(formId);
    if (!form) return res.redirect(`/dashboard/guild/${guildId}`);
    const apps = getFormApplications(formId);
    const rows = apps.map(a => `
      <tr class="border-t border-gray-700">
        <td class="py-3 px-4 text-gray-300">${escapeHtml(a.username)}</td>
        <td class="py-3 px-4">
          <span class="px-2 py-1 rounded text-xs ${a.status === "accepted" ? "bg-green-900 text-green-300" : a.status === "denied" ? "bg-red-900 text-red-300" : "bg-yellow-900 text-yellow-300"}">${a.status}</span>
        </td>
        <td class="py-3 px-4 text-gray-400 text-sm">${new Date(a.submitted_at).toLocaleDateString()}</td>
        <td class="py-3 px-4">
          <a href="/dashboard/guild/${guildId}/application/${a.id}" class="text-indigo-400 hover:text-indigo-300 text-sm">View</a>
        </td>
      </tr>
    `).join("");

    res.send(renderPage(`${form.name} — Submissions`, `
      <div class="max-w-5xl mx-auto px-4 py-8">
        <div class="flex items-center gap-4 mb-8">
          <a href="/dashboard/guild/${guildId}" class="text-gray-400 hover:text-white">← Back</a>
          <h1 class="text-2xl font-bold text-white">${escapeHtml(form.name)} — Submissions</h1>
        </div>
        ${apps.length === 0
          ? `<div class="bg-gray-800 rounded-xl p-10 text-center border border-gray-700 border-dashed"><p class="text-gray-400">No submissions yet.</p></div>`
          : `<div class="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
              <table class="w-full">
                <thead><tr class="text-left text-gray-400 text-sm">
                  <th class="py-3 px-4">Applicant</th>
                  <th class="py-3 px-4">Status</th>
                  <th class="py-3 px-4">Submitted</th>
                  <th class="py-3 px-4">Actions</th>
                </tr></thead>
                <tbody>${rows}</tbody>
              </table>
             </div>`
        }
      </div>
    `));
  });

  // ── View application ───────────────────────────────────────────────────
  router.get("/guild/:guildId/application/:appId", requireAuth, (req: any, res) => {
    const { guildId, appId } = req.params;
    const app = getApplication(parseInt(appId));
    if (!app) return res.redirect(`/dashboard/guild/${guildId}`);
    const answerHtml = Object.entries(app.answers as Record<string, string>).map(([q, a]) => `
      <div class="mb-4">
        <div class="text-sm text-gray-400 mb-1">${escapeHtml(q)}</div>
        <div class="bg-gray-700 rounded-lg p-3 text-gray-200">${escapeHtml(a)}</div>
      </div>
    `).join("");
    res.send(renderPage("Application", `
      <div class="max-w-2xl mx-auto px-4 py-8">
        <a href="/dashboard/guild/${guildId}/form/${app.form_id}/submissions" class="text-gray-400 hover:text-white mb-6 block">← Back to Submissions</a>
        <div class="bg-gray-800 rounded-xl p-6 border border-gray-700">
          <div class="flex justify-between items-start mb-6">
            <div>
              <h1 class="text-xl font-bold text-white">${escapeHtml(app.username)}</h1>
              <div class="text-sm text-gray-400">${new Date(app.submitted_at).toLocaleString()}</div>
            </div>
            <span class="px-3 py-1 rounded text-sm ${app.status === "accepted" ? "bg-green-900 text-green-300" : app.status === "denied" ? "bg-red-900 text-red-300" : "bg-yellow-900 text-yellow-300"}">${app.status}</span>
          </div>
          ${answerHtml}
          ${app.status === "pending" ? `
            <div class="flex gap-3 mt-6 pt-6 border-t border-gray-700">
              <form method="POST" action="/dashboard/guild/${guildId}/application/${appId}/accept">
                <button class="px-5 py-2 bg-green-600 rounded-lg text-white hover:bg-green-500 font-medium">✅ Accept</button>
              </form>
              <form method="POST" action="/dashboard/guild/${guildId}/application/${appId}/deny">
                <button class="px-5 py-2 bg-red-600 rounded-lg text-white hover:bg-red-500 font-medium">❌ Deny</button>
              </form>
            </div>
          ` : ""}
        </div>
      </div>
    `));
  });

  router.post("/guild/:guildId/application/:appId/accept", requireAuth, async (req: any, res) => {
    const { guildId, appId } = req.params;
    const app = getApplication(parseInt(appId));
    if (!app) return res.redirect(`/dashboard/guild/${guildId}`);
    updateApplicationStatus(parseInt(appId), "accepted", req.session.userId);
    const form = getForm(app.form_id);
    if (form?.accept_role) {
      try {
        const guild = client.guilds.cache.get(guildId);
        const member = await guild?.members.fetch(app.user_id);
        await member?.roles.add(form.accept_role);
      } catch { }
    }
    res.redirect(`/dashboard/guild/${guildId}/application/${appId}`);
  });

  router.post("/guild/:guildId/application/:appId/deny", requireAuth, async (req: any, res) => {
    const { guildId, appId } = req.params;
    const app = getApplication(parseInt(appId));
    if (!app) return res.redirect(`/dashboard/guild/${guildId}`);
    updateApplicationStatus(parseInt(appId), "denied", req.session.userId);
    const form = getForm(app.form_id);
    if (form?.deny_role) {
      try {
        const guild = client.guilds.cache.get(guildId);
        const member = await guild?.members.fetch(app.user_id);
        await member?.roles.add(form.deny_role);
      } catch { }
    }
    res.redirect(`/dashboard/guild/${guildId}/application/${appId}`);
  });

  return router;
}

// ── Public apply page ──────────────────────────────────────────────────────
export function createApplyRouter(client: Client): Router {
  const router = Router();

  router.get("/:formId", (req, res) => {
    const form = getForm(req.params.formId);
    if (!form || !form.active) {
      return void res.status(404).send(renderPage("Not Found", `
        <div class="max-w-md mx-auto mt-32 text-center">
          <div class="text-6xl mb-4">📋</div>
          <h1 class="text-2xl font-bold text-white mb-2">Form Not Found</h1>
          <p class="text-gray-400">This application form doesn't exist or is no longer active.</p>
        </div>
      `));
    }
    const questions = form.questions.map((q: string, i: number) => `
      <div class="mb-6">
        <label class="block text-sm font-medium text-gray-300 mb-2">${escapeHtml(q)}</label>
        <textarea name="q_${i}" rows="3" required
          class="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-3 text-gray-200 placeholder-gray-500 focus:outline-none focus:border-indigo-500 resize-none"
          placeholder="Your answer..."></textarea>
      </div>
    `).join("");
    res.send(renderPage(`Apply — ${form.name}`, `
      <div class="max-w-2xl mx-auto px-4 py-12">
        <div class="bg-gray-800 rounded-2xl p-8 border border-gray-700">
          <h1 class="text-2xl font-bold text-white mb-2">${escapeHtml(form.name)}</h1>
          ${form.description ? `<p class="text-gray-400 mb-8">${escapeHtml(form.description)}</p>` : ""}
          <form method="POST" action="/apply/${form.id}">
            <div class="mb-6">
              <label class="block text-sm font-medium text-gray-300 mb-2">Discord Username</label>
              <input type="text" name="username" required placeholder="username#0000"
                class="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-3 text-gray-200 focus:outline-none focus:border-indigo-500" />
            </div>
            <div class="mb-6">
              <label class="block text-sm font-medium text-gray-300 mb-2">Discord User ID</label>
              <input type="text" name="user_id" required placeholder="123456789"
                class="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-3 text-gray-200 focus:outline-none focus:border-indigo-500" />
            </div>
            ${questions}
            <button type="submit" class="w-full py-3 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-white font-semibold transition">Submit Application</button>
          </form>
        </div>
      </div>
    `));
  });

  router.post("/:formId", async (req, res): Promise<void> => {
    const form = getForm(req.params.formId);
    if (!form || !form.active) { res.status(404).send("Form not found"); return; }
    const { username, user_id, ...rest } = req.body;
    const answers: Record<string, string> = {};
    form.questions.forEach((q: string, i: number) => {
      answers[q] = rest[`q_${i}`] || "";
    });
    const id = submitApplication(form.id, form.guild_id, user_id || "unknown", username || "unknown", answers);

    // Post to Discord channel
    if (form.channel_id) {
      try {
        const guild = client.guilds.cache.get(form.guild_id);
        const channel = guild?.channels.cache.get(form.channel_id);
        if (channel?.isTextBased()) {
          const embed = new EmbedBuilder()
            .setColor(Colors.Blurple)
            .setTitle(`📋 New Application — ${form.name}`)
            .setDescription(`**Applicant:** ${username}\n**User ID:** ${user_id}`)
            .addFields(Object.entries(answers).map(([q, a]) => ({ name: q, value: a || "No answer" })))
            .setTimestamp()
            .setFooter({ text: `Application ID: ${id}` });
          const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder().setCustomId(`app_accept_${id}`).setLabel("Accept").setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId(`app_deny_${id}`).setLabel("Deny").setStyle(ButtonStyle.Danger),
          );
          await channel.send({ embeds: [embed], components: [row] });
        }
      } catch { }
    }

    res.send(renderPage("Application Submitted", `
      <div class="max-w-md mx-auto mt-32 text-center">
        <div class="text-6xl mb-4">✅</div>
        <h1 class="text-2xl font-bold text-white mb-2">Application Submitted!</h1>
        <p class="text-gray-400">Your application for <strong class="text-white">${escapeHtml(form.name)}</strong> has been received. You'll be notified of the decision.</p>
      </div>
    `));
  });

  return router;
}

// ── HTML helpers ───────────────────────────────────────────────────────────
function escapeHtml(str: string): string {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formEditor(guildId: string, form: any, channels: string, acceptRoles: string, denyRoles?: string): string {
  const isEdit = !!form;
  const action = isEdit ? `/dashboard/guild/${guildId}/form/${form.id}/edit` : `/dashboard/guild/${guildId}/form/new`;
  const existingQuestions = form?.questions ?? [""];
  const questionFields = existingQuestions.map((q: string, i: number) => `
    <div class="flex gap-2 mb-2">
      <input type="text" name="questions" value="${escapeHtml(q)}" placeholder="Question ${i + 1}"
        class="flex-1 bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 text-gray-200 focus:outline-none focus:border-indigo-500" />
      <button type="button" onclick="this.parentElement.remove()" class="px-3 py-2 bg-red-700 rounded-lg text-white hover:bg-red-600">×</button>
    </div>
  `).join("");
  return `
    <div class="max-w-2xl mx-auto px-4 py-8">
      <a href="/dashboard/guild/${guildId}" class="text-gray-400 hover:text-white mb-6 block">← Back</a>
      <h1 class="text-2xl font-bold text-white mb-6">${isEdit ? "Edit Form" : "New Application Form"}</h1>
      <form method="POST" action="${action}" class="bg-gray-800 rounded-xl p-6 border border-gray-700 space-y-5">
        <div>
          <label class="block text-sm font-medium text-gray-300 mb-1">Form Name *</label>
          <input type="text" name="name" required value="${escapeHtml(form?.name ?? "")}"
            class="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 text-gray-200 focus:outline-none focus:border-indigo-500" />
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-300 mb-1">Description</label>
          <input type="text" name="description" value="${escapeHtml(form?.description ?? "")}"
            class="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 text-gray-200 focus:outline-none focus:border-indigo-500" />
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-300 mb-2">Questions</label>
          <div id="questions">${questionFields}</div>
          <button type="button" onclick="addQuestion()" class="mt-2 px-4 py-2 bg-gray-700 rounded-lg text-sm text-gray-300 hover:bg-gray-600">+ Add Question</button>
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-300 mb-1">Submission Channel</label>
          <select name="channel_id" class="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 text-gray-200 focus:outline-none focus:border-indigo-500">
            <option value="">— None —</option>
            ${channels}
          </select>
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-300 mb-1">Accept Role</label>
          <select name="accept_role" class="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 text-gray-200 focus:outline-none focus:border-indigo-500">
            <option value="">— None —</option>
            ${acceptRoles}
          </select>
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-300 mb-1">Deny Role</label>
          <select name="deny_role" class="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 text-gray-200 focus:outline-none focus:border-indigo-500">
            <option value="">— None —</option>
            ${denyRoles ?? acceptRoles}
          </select>
        </div>
        ${isEdit ? `
          <div class="flex items-center gap-2">
            <input type="checkbox" name="active" id="active" ${form.active ? "checked" : ""} class="w-4 h-4" />
            <label for="active" class="text-sm text-gray-300">Form is active</label>
          </div>
        ` : ""}
        <button type="submit" class="w-full py-3 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-white font-semibold">${isEdit ? "Save Changes" : "Create Form"}</button>
      </form>
    </div>
    <script>
      function addQuestion() {
        const container = document.getElementById('questions');
        const count = container.children.length + 1;
        const div = document.createElement('div');
        div.className = 'flex gap-2 mb-2';
        div.innerHTML = '<input type="text" name="questions" placeholder="Question ' + count + '" class="flex-1 bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 text-gray-200 focus:outline-none focus:border-indigo-500" /><button type="button" onclick="this.parentElement.remove()" class="px-3 py-2 bg-red-700 rounded-lg text-white hover:bg-red-600">×</button>';
        container.appendChild(div);
      }
    </script>
  `;
}

function renderPage(title: string, content: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(title)} — Bot Dashboard</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <style>body { background: #111827; }</style>
</head>
<body class="min-h-screen bg-gray-900 text-gray-100">
  ${content}
</body>
</html>`;
}
