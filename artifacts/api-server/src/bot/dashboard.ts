import { Router } from "express";
import type { Client } from "discord.js";
import {
  getGuildForms, getForm, createForm, updateForm, deleteForm,
  getFormApplications, getApplication, updateApplicationStatus,
  submitApplication,
  addDashboardAdmin, removeDashboardAdmin, isDashboardAdmin, getDashboardAdmins,
  getReferralCode, recordReferral, getReferralLeaderboard, getUserReferralCode,
  getOrCreateReferralCode,
} from "./database";
import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, Colors } from "discord.js";
import { generateId } from "./utils";

const DISCORD_API = "https://discord.com/api/v10";

function getRedirectUri(req: any): string {
  const domains = process.env["REPLIT_DOMAINS"];
  const domain = domains ? domains.split(",")[0].trim() : req.hostname;
  return `https://${domain}/dashboard/auth/callback`;
}

function getSiteBase(req: any): string {
  const domains = process.env["REPLIT_DOMAINS"];
  const domain = domains ? domains.split(",")[0].trim() : req.hostname;
  return `https://${domain}`;
}

function isOwner(userId: string): boolean {
  return userId === process.env["OWNER_ID"];
}

export function createDashboardRouter(client: Client): Router {
  const router = Router();

  // ── Middleware ─────────────────────────────────────────────────────────

  function requireLogin(req: any, res: any, next: any) {
    if (!req.session?.userId) {
      req.session.returnTo = req.originalUrl;
      return res.redirect("/dashboard/auth/login");
    }
    next();
  }

  function requireOwner(req: any, res: any, next: any) {
    if (!req.session?.userId) { req.session.returnTo = req.originalUrl; return res.redirect("/dashboard/auth/login"); }
    if (!isOwner(req.session.userId)) return res.status(403).send(renderPage("Access Denied", accessDeniedPage(req.session.username)));
    next();
  }

  function requireAdmin(req: any, res: any, next: any) {
    if (!req.session?.userId) { req.session.returnTo = req.originalUrl; return res.redirect("/dashboard/auth/login"); }
    if (!isOwner(req.session.userId) && !isDashboardAdmin(req.session.userId)) {
      return res.status(403).send(renderPage("Access Denied", accessDeniedPage(req.session.username)));
    }
    next();
  }

  // ── Auth ───────────────────────────────────────────────────────────────

  router.get("/auth/login", (req: any, res) => {
    if (req.session?.userId) return res.redirect("/dashboard");
    const error = req.query.error ? `<div class="mb-4 bg-red-900/50 border border-red-700 rounded-lg p-3 text-red-300 text-sm">Login failed. Please try again.</div>` : "";
    res.send(renderPage("Login", `
      <div class="min-h-screen flex items-center justify-center px-4">
        <div class="bg-gray-800 rounded-2xl p-8 border border-gray-700 w-full max-w-sm text-center">
          <div class="text-5xl mb-4">🤖</div>
          <h1 class="text-2xl font-bold text-white mb-2">Bot Dashboard</h1>
          <p class="text-gray-400 text-sm mb-6">Sign in with your Discord account to continue.</p>
          ${error}
          <a href="/dashboard/auth/login/go" class="flex items-center justify-center gap-3 w-full py-3 bg-indigo-600 hover:bg-indigo-500 rounded-xl text-white font-semibold transition">
            <svg class="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057c.002.022.015.043.033.055a19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z"/></svg>
            Sign in with Discord
          </a>
          <p class="text-xs text-gray-500 mt-4">Access is restricted to authorised users only.</p>
        </div>
      </div>
    `));
  });

  router.get("/auth/login/go", (req: any, res) => {
    const clientId = process.env["CLIENT_ID"]!;
    const redirectUri = encodeURIComponent(getRedirectUri(req));
    res.redirect(`https://discord.com/oauth2/authorize?client_id=${clientId}&redirect_uri=${redirectUri}&response_type=code&scope=identify`);
  });

  router.get("/auth/callback", async (req: any, res) => {
    const { code } = req.query;
    if (!code) return res.redirect("/dashboard/auth/login?error=1");
    try {
      const params = new URLSearchParams({
        client_id: process.env["CLIENT_ID"]!,
        client_secret: process.env["DISCORD_CLIENT_SECRET"]!,
        grant_type: "authorization_code",
        code: code as string,
        redirect_uri: getRedirectUri(req),
      });
      const tokenRes = await fetch(`${DISCORD_API}/oauth2/token`, {
        method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: params,
      });
      const tokens = await tokenRes.json() as any;
      if (!tokens.access_token) throw new Error("No token");
      const userRes = await fetch(`${DISCORD_API}/users/@me`, { headers: { Authorization: `Bearer ${tokens.access_token}` } });
      const user = await userRes.json() as any;
      req.session.userId = user.id;
      req.session.username = user.username;
      req.session.avatar = user.avatar;
      const returnTo = req.session.returnTo as string | undefined;
      delete req.session.returnTo;
      res.redirect(returnTo ?? "/dashboard");
    } catch {
      res.redirect("/dashboard/auth/login?error=1");
    }
  });

  router.get("/auth/logout", (req: any, res) => {
    req.session.destroy(() => res.redirect("/dashboard/auth/login"));
  });

  // ── Root — route by role ───────────────────────────────────────────────

  router.get("/", requireLogin, (req: any, res) => {
    if (isOwner(req.session.userId)) return res.redirect("/dashboard/owner");
    if (isDashboardAdmin(req.session.userId)) return res.redirect("/dashboard/admin");
    res.status(403).send(renderPage("Access Denied", accessDeniedPage(req.session.username)));
  });

  // ═══════════════════════════════════════════════════════════════════════
  // OWNER PANEL
  // ═══════════════════════════════════════════════════════════════════════

  router.get("/owner", requireOwner, (req: any, res) => {
    const guilds = client.guilds.cache;
    const admins = getDashboardAdmins();
    const guildCards = [...guilds.values()].map(g => `
      <a href="/dashboard/owner/guild/${g.id}" class="block bg-gray-800 rounded-xl p-5 hover:bg-gray-700 transition border border-gray-700 hover:border-indigo-500">
        <div class="flex items-center gap-4">
          ${g.iconURL() ? `<img src="${g.iconURL()}" class="w-12 h-12 rounded-full">` : `<div class="w-12 h-12 rounded-full bg-indigo-600 flex items-center justify-center text-white font-bold text-xl">${g.name[0]}</div>`}
          <div><div class="font-semibold text-white">${escapeHtml(g.name)}</div><div class="text-sm text-gray-400">${g.memberCount.toLocaleString()} members</div></div>
        </div>
      </a>`).join("");

    res.send(renderPage("Owner Panel", navBar(req.session.username, req.session.avatar, "owner") + `
      <div class="max-w-5xl mx-auto px-4 py-8">
        <div class="mb-8">
          <h1 class="text-3xl font-bold text-white">🔑 Owner Panel</h1>
          <p class="text-gray-400 mt-1">Full control over all servers and dashboard access.</p>
        </div>
        <div class="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-10">
          ${statCard("Servers", guilds.size.toString(), "🌐")}
          ${statCard("Admins", admins.length.toString(), "🛡️")}
        </div>
        <div class="flex items-center justify-between mb-4">
          <h2 class="text-xl font-semibold text-white">Dashboard Admins</h2>
          <a href="/dashboard/owner/admins" class="px-4 py-2 bg-indigo-600 rounded-lg text-white text-sm hover:bg-indigo-500">Manage Admins</a>
        </div>
        ${admins.length === 0
          ? `<div class="bg-gray-800 rounded-xl p-6 text-center border border-gray-700 border-dashed text-gray-400 mb-10">No admins granted yet. <a href="/dashboard/owner/admins" class="text-indigo-400 hover:underline">Add one</a></div>`
          : `<div class="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden mb-10">
              <table class="w-full text-sm"><thead><tr class="text-left text-gray-400 border-b border-gray-700"><th class="py-3 px-4">Username</th><th class="py-3 px-4">User ID</th><th class="py-3 px-4">Granted</th></tr></thead>
              <tbody>${admins.map(a => `<tr class="border-t border-gray-700"><td class="py-3 px-4 text-white">${escapeHtml(a.username)}</td><td class="py-3 px-4 text-gray-400 font-mono text-xs">${a.user_id}</td><td class="py-3 px-4 text-gray-400">${new Date(a.granted_at).toLocaleDateString()}</td></tr>`).join("")}
              </tbody></table></div>`
        }
        <h2 class="text-xl font-semibold text-white mb-4">Servers</h2>
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          ${guildCards || '<p class="text-gray-400 col-span-3">No servers found.</p>'}
        </div>
      </div>`));
  });

  // ── Admin management ───────────────────────────────────────────────────

  router.get("/owner/admins", requireOwner, (req: any, res) => {
    const admins = getDashboardAdmins();
    const rows = admins.map(a => `
      <tr class="border-t border-gray-700">
        <td class="py-3 px-4 text-white">${escapeHtml(a.username)}</td>
        <td class="py-3 px-4 text-gray-400 font-mono text-xs">${a.user_id}</td>
        <td class="py-3 px-4 text-gray-400 text-sm">${new Date(a.granted_at).toLocaleDateString()}</td>
        <td class="py-3 px-4">
          <form method="POST" action="/dashboard/owner/admins/${a.user_id}/remove" onsubmit="return confirm('Revoke admin access for ${escapeHtml(a.username)}?')">
            <button class="px-3 py-1 bg-red-700 hover:bg-red-600 rounded text-xs text-white">Revoke</button>
          </form>
        </td>
      </tr>`).join("");

    res.send(renderPage("Manage Admins", navBar(req.session.username, req.session.avatar, "owner") + `
      <div class="max-w-3xl mx-auto px-4 py-8">
        <div class="flex items-center gap-4 mb-8">
          <a href="/dashboard/owner" class="text-gray-400 hover:text-white text-sm">← Back</a>
          <h1 class="text-2xl font-bold text-white">🛡️ Manage Dashboard Admins</h1>
        </div>
        <div class="bg-gray-800 rounded-xl p-6 border border-gray-700 mb-8">
          <h2 class="text-base font-semibold text-white mb-4">Grant Admin Access</h2>
          <form method="POST" action="/dashboard/owner/admins/add" class="flex flex-col sm:flex-row gap-3">
            <input type="text" name="user_id" required placeholder="Discord User ID"
              class="flex-1 bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 text-gray-200 focus:outline-none focus:border-indigo-500 font-mono text-sm" />
            <input type="text" name="username" required placeholder="Username (display only)"
              class="flex-1 bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 text-gray-200 focus:outline-none focus:border-indigo-500 text-sm" />
            <button type="submit" class="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-white text-sm font-medium whitespace-nowrap">Grant Access</button>
          </form>
          <p class="text-xs text-gray-500 mt-2">Admins can view and review submissions but cannot create/delete forms or manage other admins.</p>
        </div>
        <div class="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
          <div class="px-6 py-4 border-b border-gray-700 flex items-center justify-between">
            <h2 class="font-semibold text-white">Current Admins</h2>
            <span class="bg-gray-700 text-gray-300 text-xs px-2 py-1 rounded-full">${admins.length}</span>
          </div>
          ${admins.length === 0
            ? `<div class="p-10 text-center text-gray-400">No admins granted yet.</div>`
            : `<table class="w-full text-sm"><thead><tr class="text-left text-gray-400 border-b border-gray-700"><th class="py-3 px-4">Username</th><th class="py-3 px-4">User ID</th><th class="py-3 px-4">Granted</th><th class="py-3 px-4"></th></tr></thead><tbody>${rows}</tbody></table>`}
        </div>
      </div>`));
  });

  router.post("/owner/admins/add", requireOwner, (req: any, res) => {
    const { user_id, username } = req.body;
    if (user_id?.trim() && username?.trim()) {
      addDashboardAdmin(user_id.trim(), username.trim(), req.session.userId);
    }
    res.redirect("/dashboard/owner/admins");
  });

  router.post("/owner/admins/:userId/remove", requireOwner, (req: any, res) => {
    removeDashboardAdmin(req.params.userId);
    res.redirect("/dashboard/owner/admins");
  });

  // ── Owner guild management ─────────────────────────────────────────────

  router.get("/owner/guild/:guildId", requireOwner, (req: any, res): void => {
    const { guildId } = req.params;
    const guild = client.guilds.cache.get(guildId);
    if (!guild) { res.redirect("/dashboard/owner"); return; }
    const forms = getGuildForms(guildId);
    const lb = getReferralLeaderboard(guildId, 5);
    const formCards = forms.map(f => `
      <div class="bg-gray-800 rounded-xl p-5 border border-gray-700">
        <div class="flex items-start justify-between mb-3">
          <div><h3 class="font-semibold text-white">${escapeHtml(f.name)}</h3><p class="text-sm text-gray-400">${escapeHtml(f.description || "")}</p></div>
          <span class="px-2 py-1 rounded text-xs ${f.active ? "bg-green-900 text-green-300" : "bg-gray-700 text-gray-400"}">${f.active ? "Active" : "Inactive"}</span>
        </div>
        <div class="text-xs text-gray-500 mb-4">${f.questions.length} question${f.questions.length !== 1 ? "s" : ""}</div>
        <div class="flex gap-2 flex-wrap">
          <a href="/dashboard/owner/guild/${guildId}/form/${f.id}/edit" class="px-3 py-1 bg-indigo-600 rounded text-xs text-white hover:bg-indigo-500">Edit</a>
          <a href="/dashboard/owner/guild/${guildId}/form/${f.id}/submissions" class="px-3 py-1 bg-blue-600 rounded text-xs text-white hover:bg-blue-500">Submissions</a>
          <a href="/apply/${f.id}" target="_blank" class="px-3 py-1 bg-gray-600 rounded text-xs text-white hover:bg-gray-500">Apply Link ↗</a>
          <form method="POST" action="/dashboard/owner/guild/${guildId}/form/${f.id}/delete" class="inline" onsubmit="return confirm('Delete this form?')">
            <button class="px-3 py-1 bg-red-700 rounded text-xs text-white hover:bg-red-600">Delete</button>
          </form>
        </div>
      </div>`).join("");

    const lbRows = lb.length === 0 ? `<p class="text-gray-400 text-sm p-4">No referrals recorded yet.</p>` :
      lb.map((r, i) => `<div class="flex items-center justify-between py-2 px-4 border-t border-gray-700 text-sm"><span class="text-gray-400">${i + 1}. <span class="text-white"><@${r.referrer_id}></span></span><span class="bg-indigo-900 text-indigo-300 px-2 py-0.5 rounded text-xs">${r.count} referral${r.count !== 1 ? "s" : ""}</span></div>`).join("");

    res.send(renderPage(`${guild.name}`, navBar(req.session.username, req.session.avatar, "owner") + `
      <div class="max-w-5xl mx-auto px-4 py-8">
        <div class="flex items-center gap-4 mb-8">
          <a href="/dashboard/owner" class="text-gray-400 hover:text-white text-sm">← Back</a>
          <div class="flex items-center gap-3">
            ${guild.iconURL() ? `<img src="${guild.iconURL()}" class="w-9 h-9 rounded-full">` : ""}
            <h1 class="text-2xl font-bold text-white">${escapeHtml(guild.name)}</h1>
          </div>
        </div>
        <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div class="lg:col-span-2">
            <div class="flex items-center justify-between mb-4">
              <h2 class="text-lg font-semibold text-white">Application Forms</h2>
              <a href="/dashboard/owner/guild/${guildId}/form/new" class="px-4 py-2 bg-indigo-600 rounded-lg text-white text-sm hover:bg-indigo-500">+ New Form</a>
            </div>
            ${forms.length === 0
              ? `<div class="bg-gray-800 rounded-xl p-10 text-center border border-gray-700 border-dashed"><div class="text-3xl mb-2">📋</div><p class="text-gray-400 text-sm mb-3">No application forms yet.</p><a href="/dashboard/owner/guild/${guildId}/form/new" class="px-4 py-2 bg-indigo-600 rounded-lg text-white text-sm hover:bg-indigo-500">Create one</a></div>`
              : `<div class="grid grid-cols-1 sm:grid-cols-2 gap-4">${formCards}</div>`}
          </div>
          <div>
            <h2 class="text-lg font-semibold text-white mb-4">🔗 Referral Leaderboard</h2>
            <div class="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">${lbRows}</div>
          </div>
        </div>
      </div>`));
  });

  // ── Owner forms CRUD ───────────────────────────────────────────────────

  router.get("/owner/guild/:guildId/form/new", requireOwner, (req: any, res) => {
    const { guildId } = req.params;
    const guild = client.guilds.cache.get(guildId);
    if (!guild) return res.redirect("/dashboard/owner");
    const channels = guildChannelOptions(guild, null);
    const roles = guildRoleOptions(guild, null);
    res.send(renderPage("New Form", navBar(req.session.username, req.session.avatar, "owner") + formEditor(`/dashboard/owner/guild/${guildId}`, `/dashboard/owner/guild/${guildId}/form/new`, null, channels, roles)));
  });

  router.post("/owner/guild/:guildId/form/new", requireOwner, (req: any, res) => {
    const { guildId } = req.params;
    const { name, description, questions, channel_id, accept_role, deny_role } = req.body;
    const qs = Array.isArray(questions) ? questions.filter(Boolean) : (questions ? [questions] : []);
    createForm(generateId(), guildId, name, description, qs, channel_id || undefined, accept_role || undefined, deny_role || undefined);
    res.redirect(`/dashboard/owner/guild/${guildId}`);
  });

  router.get("/owner/guild/:guildId/form/:formId/edit", requireOwner, (req: any, res) => {
    const { guildId, formId } = req.params;
    const guild = client.guilds.cache.get(guildId);
    const form = getForm(formId);
    if (!guild || !form) return res.redirect(`/dashboard/owner/guild/${guildId}`);
    const channels = guildChannelOptions(guild, form.channel_id);
    const roles = guildRoleOptions(guild, null);
    res.send(renderPage("Edit Form", navBar(req.session.username, req.session.avatar, "owner") + formEditor(`/dashboard/owner/guild/${guildId}`, `/dashboard/owner/guild/${guildId}/form/${formId}/edit`, form, channels, roles)));
  });

  router.post("/owner/guild/:guildId/form/:formId/edit", requireOwner, (req: any, res) => {
    const { guildId, formId } = req.params;
    const { name, description, questions, channel_id, accept_role, deny_role, active } = req.body;
    const qs = Array.isArray(questions) ? questions.filter(Boolean) : (questions ? [questions] : []);
    updateForm(formId, { name, description, questions: qs, channel_id: channel_id || "", accept_role: accept_role || "", deny_role: deny_role || "", active: active === "on" ? 1 : 0 });
    res.redirect(`/dashboard/owner/guild/${guildId}`);
  });

  router.post("/owner/guild/:guildId/form/:formId/delete", requireOwner, (req: any, res) => {
    deleteForm(req.params.formId);
    res.redirect(`/dashboard/owner/guild/${req.params.guildId}`);
  });

  router.get("/owner/guild/:guildId/form/:formId/submissions", requireOwner, (req: any, res) => {
    renderSubmissions(req, res, req.params.guildId, req.params.formId, "owner");
  });

  router.get("/owner/guild/:guildId/application/:appId", requireOwner, (req: any, res) => {
    renderApplication(req, res, req.params.guildId, req.params.appId, "owner");
  });

  router.post("/owner/guild/:guildId/application/:appId/accept", requireOwner, async (req: any, res) => {
    await handleAppDecision(req, res, "accepted", client);
  });

  router.post("/owner/guild/:guildId/application/:appId/deny", requireOwner, async (req: any, res) => {
    await handleAppDecision(req, res, "denied", client);
  });

  // ═══════════════════════════════════════════════════════════════════════
  // ADMIN PANEL
  // ═══════════════════════════════════════════════════════════════════════

  router.get("/admin", requireAdmin, (req: any, res) => {
    const guilds = client.guilds.cache;
    const guildCards = [...guilds.values()].map(g => `
      <a href="/dashboard/admin/guild/${g.id}" class="block bg-gray-800 rounded-xl p-5 hover:bg-gray-700 transition border border-gray-700 hover:border-blue-500">
        <div class="flex items-center gap-4">
          ${g.iconURL() ? `<img src="${g.iconURL()}" class="w-12 h-12 rounded-full">` : `<div class="w-12 h-12 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold text-xl">${g.name[0]}</div>`}
          <div><div class="font-semibold text-white">${escapeHtml(g.name)}</div><div class="text-sm text-gray-400">${g.memberCount.toLocaleString()} members</div></div>
        </div>
      </a>`).join("");

    res.send(renderPage("Admin Panel", navBar(req.session.username, req.session.avatar, "admin") + `
      <div class="max-w-5xl mx-auto px-4 py-8">
        <div class="mb-8">
          <h1 class="text-3xl font-bold text-white">🛡️ Admin Panel</h1>
          <p class="text-gray-400 mt-1">View and review application submissions.</p>
        </div>
        <h2 class="text-xl font-semibold text-white mb-4">Servers</h2>
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          ${guildCards || '<p class="text-gray-400">No servers found.</p>'}
        </div>
      </div>`));
  });

  router.get("/admin/guild/:guildId", requireAdmin, (req: any, res): void => {
    const { guildId } = req.params;
    const guild = client.guilds.cache.get(guildId);
    if (!guild) { res.redirect("/dashboard/admin"); return; }
    const forms = getGuildForms(guildId);
    const cards = forms.map(f => `
      <div class="bg-gray-800 rounded-xl p-5 border border-gray-700">
        <div class="flex items-start justify-between mb-3">
          <div><h3 class="font-semibold text-white">${escapeHtml(f.name)}</h3><p class="text-sm text-gray-400">${escapeHtml(f.description || "")}</p></div>
          <span class="px-2 py-1 rounded text-xs ${f.active ? "bg-green-900 text-green-300" : "bg-gray-700 text-gray-400"}">${f.active ? "Active" : "Inactive"}</span>
        </div>
        <a href="/dashboard/admin/guild/${guildId}/form/${f.id}/submissions" class="px-3 py-1 bg-blue-600 rounded text-xs text-white hover:bg-blue-500">View Submissions</a>
      </div>`).join("");
    res.send(renderPage(`${guild.name} — Admin`, navBar(req.session.username, req.session.avatar, "admin") + `
      <div class="max-w-5xl mx-auto px-4 py-8">
        <div class="flex items-center gap-4 mb-8">
          <a href="/dashboard/admin" class="text-gray-400 hover:text-white text-sm">← Back</a>
          <div class="flex items-center gap-3">
            ${guild.iconURL() ? `<img src="${guild.iconURL()}" class="w-9 h-9 rounded-full">` : ""}
            <h1 class="text-2xl font-bold text-white">${escapeHtml(guild.name)}</h1>
          </div>
        </div>
        ${forms.length === 0
          ? `<div class="bg-gray-800 rounded-xl p-10 text-center border border-gray-700 border-dashed text-gray-400">No application forms found.</div>`
          : `<div class="grid grid-cols-1 sm:grid-cols-2 gap-4">${cards}</div>`}
      </div>`));
  });

  router.get("/admin/guild/:guildId/form/:formId/submissions", requireAdmin, (req: any, res) => {
    renderSubmissions(req, res, req.params.guildId, req.params.formId, "admin");
  });

  router.get("/admin/guild/:guildId/application/:appId", requireAdmin, (req: any, res) => {
    renderApplication(req, res, req.params.guildId, req.params.appId, "admin");
  });

  router.post("/admin/guild/:guildId/application/:appId/accept", requireAdmin, async (req: any, res) => {
    await handleAppDecision(req, res, "accepted", client);
  });

  router.post("/admin/guild/:guildId/application/:appId/deny", requireAdmin, async (req: any, res) => {
    await handleAppDecision(req, res, "denied", client);
  });

  // ── Shared helpers ─────────────────────────────────────────────────────

  function renderSubmissions(req: any, res: any, guildId: string, formId: string, role: "owner" | "admin") {
    const form = getForm(formId);
    if (!form) return res.redirect(`/dashboard/${role}/guild/${guildId}`);
    const apps = getFormApplications(formId);
    const rows = apps.map(a => `
      <tr class="border-t border-gray-700 hover:bg-gray-750">
        <td class="py-3 px-4 text-gray-200 text-sm">${escapeHtml(a.username)}</td>
        <td class="py-3 px-4"><span class="px-2 py-1 rounded text-xs ${a.status === "accepted" ? "bg-green-900 text-green-300" : a.status === "denied" ? "bg-red-900 text-red-300" : "bg-yellow-900 text-yellow-300"}">${a.status}</span></td>
        <td class="py-3 px-4 text-gray-400 text-xs">${new Date(a.submitted_at).toLocaleDateString()}</td>
        <td class="py-3 px-4"><a href="/dashboard/${role}/guild/${guildId}/application/${a.id}" class="text-indigo-400 hover:text-indigo-300 text-xs">View →</a></td>
      </tr>`).join("");

    const pending = apps.filter((a: any) => a.status === "pending").length;
    res.send(renderPage(`${form.name} — Submissions`, navBar(req.session.username, req.session.avatar, role) + `
      <div class="max-w-5xl mx-auto px-4 py-8">
        <div class="flex items-center gap-4 mb-8">
          <a href="/dashboard/${role}/guild/${guildId}" class="text-gray-400 hover:text-white text-sm">← Back</a>
          <div>
            <h1 class="text-2xl font-bold text-white">${escapeHtml(form.name)}</h1>
            <p class="text-sm text-gray-400">${apps.length} total · <span class="text-yellow-400">${pending} pending</span></p>
          </div>
        </div>
        ${apps.length === 0
          ? `<div class="bg-gray-800 rounded-xl p-10 text-center border border-gray-700 border-dashed"><p class="text-gray-400">No submissions yet.</p></div>`
          : `<div class="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
              <table class="w-full"><thead><tr class="text-left text-gray-400 text-xs border-b border-gray-700">
                <th class="py-3 px-4">Applicant</th><th class="py-3 px-4">Status</th><th class="py-3 px-4">Date</th><th class="py-3 px-4"></th>
              </tr></thead><tbody>${rows}</tbody></table></div>`}
      </div>`));
  }

  function renderApplication(req: any, res: any, guildId: string, appId: string, role: "owner" | "admin") {
    const app = getApplication(parseInt(appId));
    if (!app) return res.redirect(`/dashboard/${role}/guild/${guildId}`);
    const answerHtml = Object.entries(app.answers as Record<string, string>).map(([q, a]) => `
      <div class="mb-4">
        <div class="text-xs font-medium text-gray-400 uppercase tracking-wide mb-1">${escapeHtml(q)}</div>
        <div class="bg-gray-700/50 rounded-lg p-3 text-gray-200 text-sm">${escapeHtml(a || "—")}</div>
      </div>`).join("");

    res.send(renderPage("Application", navBar(req.session.username, req.session.avatar, role) + `
      <div class="max-w-2xl mx-auto px-4 py-8">
        <a href="/dashboard/${role}/guild/${guildId}/form/${app.form_id}/submissions" class="text-gray-400 hover:text-white text-sm mb-6 block">← Back to Submissions</a>
        <div class="bg-gray-800 rounded-xl p-6 border border-gray-700">
          <div class="flex justify-between items-start mb-6">
            <div>
              <h1 class="text-xl font-bold text-white">${escapeHtml(app.username)}</h1>
              <div class="text-xs text-gray-400 mt-1">${new Date(app.submitted_at).toLocaleString()}</div>
            </div>
            <span class="px-3 py-1 rounded-full text-sm font-medium ${app.status === "accepted" ? "bg-green-900 text-green-300" : app.status === "denied" ? "bg-red-900 text-red-300" : "bg-yellow-900 text-yellow-300"}">${app.status}</span>
          </div>
          ${answerHtml}
          ${app.status === "pending" ? `
            <div class="flex gap-3 mt-6 pt-6 border-t border-gray-700">
              <form method="POST" action="/dashboard/${role}/guild/${guildId}/application/${appId}/accept">
                <button class="px-5 py-2 bg-green-600 rounded-lg text-white hover:bg-green-500 font-medium text-sm">✅ Accept</button>
              </form>
              <form method="POST" action="/dashboard/${role}/guild/${guildId}/application/${appId}/deny">
                <button class="px-5 py-2 bg-red-600 rounded-lg text-white hover:bg-red-500 font-medium text-sm">❌ Deny</button>
              </form>
            </div>` : `<p class="text-xs text-gray-500 mt-4 pt-4 border-t border-gray-700">Reviewed ${app.reviewed_at ? new Date(app.reviewed_at).toLocaleString() : ""}</p>`}
        </div>
      </div>`));
  }

  return router;
}

async function handleAppDecision(req: any, res: any, status: "accepted" | "denied", client: Client) {
  const { guildId, appId } = req.params;
  const role = req.path.startsWith("/owner") || req.baseUrl.includes("owner") ? "owner" : "admin";
  const app = getApplication(parseInt(appId));
  if (!app) return res.redirect(`/dashboard/${role}/guild/${guildId}`);
  updateApplicationStatus(parseInt(appId), status, req.session.userId);
  const form = getForm(app.form_id);
  const roleId = status === "accepted" ? form?.accept_role : form?.deny_role;
  if (roleId) {
    try {
      const guild = client.guilds.cache.get(guildId);
      const member = await guild?.members.fetch(app.user_id);
      await member?.roles.add(roleId);
    } catch { }
  }
  res.redirect(`/dashboard/${role}/guild/${guildId}/application/${appId}`);
}

// ── Public apply page ──────────────────────────────────────────────────────
export function createApplyRouter(client: Client): Router {
  const router = Router();

  router.get("/:formId", (req, res) => {
    const form = getForm(req.params.formId);
    if (!form || !form.active) {
      return void res.status(404).send(renderPage("Not Found", `
        <div class="min-h-screen flex items-center justify-center">
          <div class="text-center"><div class="text-5xl mb-4">📋</div>
          <h1 class="text-2xl font-bold text-white mb-2">Form Not Found</h1>
          <p class="text-gray-400">This form doesn't exist or is no longer active.</p></div>
        </div>`));
    }
    const questions = form.questions.map((q: string, i: number) => `
      <div class="mb-5">
        <label class="block text-sm font-medium text-gray-300 mb-2">${escapeHtml(q)} <span class="text-red-400">*</span></label>
        <textarea name="q_${i}" rows="3" required class="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-3 text-gray-200 placeholder-gray-500 focus:outline-none focus:border-indigo-500 resize-none text-sm" placeholder="Your answer..."></textarea>
      </div>`).join("");
    res.send(renderPage(`Apply — ${form.name}`, `
      <div class="max-w-2xl mx-auto px-4 py-12">
        <div class="bg-gray-800 rounded-2xl p-8 border border-gray-700">
          <div class="mb-6"><h1 class="text-2xl font-bold text-white">${escapeHtml(form.name)}</h1>
          ${form.description ? `<p class="text-gray-400 mt-1 text-sm">${escapeHtml(form.description)}</p>` : ""}</div>
          <form method="POST" action="/apply/${form.id}">
            <div class="mb-5">
              <label class="block text-sm font-medium text-gray-300 mb-2">Discord Username <span class="text-red-400">*</span></label>
              <input type="text" name="username" required placeholder="e.g. cooluser"
                class="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-3 text-gray-200 focus:outline-none focus:border-indigo-500 text-sm" />
            </div>
            <div class="mb-5">
              <label class="block text-sm font-medium text-gray-300 mb-2">Discord User ID <span class="text-red-400">*</span></label>
              <input type="text" name="user_id" required placeholder="e.g. 123456789012345678"
                class="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-3 text-gray-200 focus:outline-none focus:border-indigo-500 text-sm font-mono" />
            </div>
            ${questions}
            <button type="submit" class="w-full py-3 bg-indigo-600 hover:bg-indigo-500 rounded-xl text-white font-semibold transition text-sm">Submit Application</button>
          </form>
        </div>
      </div>`));
  });

  router.post("/:formId", async (req, res): Promise<void> => {
    const form = getForm(req.params.formId);
    if (!form || !form.active) { res.status(404).send("Form not found"); return; }
    const { username, user_id, ...rest } = req.body;
    const answers: Record<string, string> = {};
    form.questions.forEach((q: string, i: number) => { answers[q] = rest[`q_${i}`] || ""; });
    const id = submitApplication(form.id, form.guild_id, user_id || "unknown", username || "unknown", answers);
    if (form.channel_id) {
      try {
        const guild = client.guilds.cache.get(form.guild_id);
        const channel = guild?.channels.cache.get(form.channel_id);
        if (channel?.isTextBased()) {
          const embed = new EmbedBuilder().setColor(Colors.Blurple)
            .setTitle(`📋 New Application — ${form.name}`)
            .setDescription(`**Applicant:** ${username}\n**User ID:** \`${user_id}\``)
            .addFields(Object.entries(answers).map(([q, a]) => ({ name: q, value: (a || "No answer").slice(0, 1024) })))
            .setTimestamp().setFooter({ text: `Application ID: ${id}` });
          const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder().setCustomId(`app_accept_${id}`).setLabel("Accept").setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId(`app_deny_${id}`).setLabel("Deny").setStyle(ButtonStyle.Danger),
          );
          await channel.send({ embeds: [embed], components: [row] });
        }
      } catch { }
    }
    res.send(renderPage("Submitted!", `
      <div class="min-h-screen flex items-center justify-center">
        <div class="text-center max-w-sm">
          <div class="text-5xl mb-4">✅</div>
          <h1 class="text-2xl font-bold text-white mb-2">Application Submitted!</h1>
          <p class="text-gray-400 text-sm">Your application for <strong class="text-white">${escapeHtml(form.name)}</strong> has been received. You'll be notified of the decision.</p>
        </div>
      </div>`));
  });

  return router;
}

// ── Public referral landing page ───────────────────────────────────────────
export function createReferRouter(): Router {
  const router = Router();

  router.get("/:code", (req, res) => {
    const ref = getReferralCode(req.params.code);
    if (!ref) {
      return void res.status(404).send(renderPage("Invalid Link", `
        <div class="min-h-screen flex items-center justify-center">
          <div class="text-center"><div class="text-5xl mb-4">🔗</div>
          <h1 class="text-2xl font-bold text-white mb-2">Invalid Referral Link</h1>
          <p class="text-gray-400">This referral link doesn't exist or has expired.</p></div>
        </div>`));
    }

    if (ref.invite_url) {
      recordReferral(ref.guild_id, ref.user_id, "visitor", req.params.code);
      return void res.redirect(ref.invite_url);
    }

    res.send(renderPage("Join Us!", `
      <div class="min-h-screen flex items-center justify-center px-4">
        <div class="text-center max-w-sm">
          <div class="text-5xl mb-4">🎉</div>
          <h1 class="text-2xl font-bold text-white mb-2">You've been invited!</h1>
          <p class="text-gray-400 text-sm mb-6">Use this link to join our Discord server. Your referrer will get credit when you join.</p>
          <p class="text-yellow-400 text-sm">Ask the person who sent you this link to configure the server invite URL via <code class="bg-gray-800 px-1 rounded">/setup-invite</code>.</p>
        </div>
      </div>`));
  });

  return router;
}

// ── HTML helpers ───────────────────────────────────────────────────────────

function escapeHtml(str: string): string {
  return String(str ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function navBar(username: string, avatar: string | null, role: "owner" | "admin"): string {
  const home = role === "owner" ? "/dashboard/owner" : "/dashboard/admin";
  const badge = role === "owner"
    ? `<span class="bg-amber-500/20 text-amber-300 border border-amber-500/30 text-xs px-2 py-0.5 rounded-full font-medium">Owner</span>`
    : `<span class="bg-blue-500/20 text-blue-300 border border-blue-500/30 text-xs px-2 py-0.5 rounded-full font-medium">Admin</span>`;
  const avatarUrl = avatar ? `https://cdn.discordapp.com/avatars/0/${avatar}.png` : null;

  return `<nav class="bg-gray-900 border-b border-gray-800 sticky top-0 z-10">
    <div class="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
      <div class="flex items-center gap-3">
        <a href="${home}" class="text-white font-bold text-base">🤖 Dashboard</a>
        ${role === "owner" ? `<span class="text-gray-600">|</span><a href="/dashboard/owner/admins" class="text-gray-400 hover:text-white text-sm">Admins</a>` : ""}
      </div>
      <div class="flex items-center gap-3">
        ${badge}
        <div class="flex items-center gap-2">
          ${avatarUrl ? `<img src="${avatarUrl}" class="w-7 h-7 rounded-full" onerror="this.style.display='none'">` : ""}
          <span class="text-gray-300 text-sm">${escapeHtml(username)}</span>
        </div>
        <a href="/dashboard/auth/logout" class="text-gray-500 hover:text-gray-300 text-xs">Logout</a>
      </div>
    </div>
  </nav>`;
}

function statCard(label: string, value: string, icon: string): string {
  return `<div class="bg-gray-800 rounded-xl p-5 border border-gray-700">
    <div class="text-2xl mb-1">${icon}</div>
    <div class="text-2xl font-bold text-white">${value}</div>
    <div class="text-xs text-gray-400 mt-0.5">${label}</div>
  </div>`;
}

function accessDeniedPage(username: string): string {
  return `<div class="min-h-screen flex items-center justify-center px-4">
    <div class="text-center max-w-sm">
      <div class="text-5xl mb-4">🚫</div>
      <h1 class="text-2xl font-bold text-white mb-2">Access Denied</h1>
      <p class="text-gray-400 text-sm mb-6">Hi <strong class="text-white">${escapeHtml(username)}</strong>, you don't have permission to access this page. Contact the bot owner to request access.</p>
      <a href="/dashboard/auth/logout" class="px-5 py-2 bg-gray-700 rounded-lg text-gray-300 hover:bg-gray-600 text-sm">Sign out</a>
    </div>
  </div>`;
}

function guildChannelOptions(guild: any, selected: string | null): string {
  return guild.channels.cache.filter((c: any) => c.isTextBased())
    .map((c: any) => `<option value="${c.id}" ${c.id === selected ? "selected" : ""}>#${escapeHtml(c.name)}</option>`).join("");
}

function guildRoleOptions(guild: any, selected: string | null): string {
  return [...guild.roles.cache.values()]
    .filter((r: any) => r.id !== guild.id)
    .sort((a: any, b: any) => b.position - a.position)
    .map((r: any) => `<option value="${r.id}" ${r.id === selected ? "selected" : ""}>${escapeHtml(r.name)}</option>`).join("");
}

function formEditor(backUrl: string, action: string, form: any, channels: string, roles: string): string {
  const isEdit = !!form;
  const existingQuestions = form?.questions ?? [""];
  const questionFields = existingQuestions.map((q: string, i: number) => `
    <div class="flex gap-2 mb-2">
      <input type="text" name="questions" value="${escapeHtml(q)}" placeholder="Question ${i + 1}"
        class="flex-1 bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 text-gray-200 focus:outline-none focus:border-indigo-500 text-sm" />
      <button type="button" onclick="this.parentElement.remove()" class="px-3 py-2 bg-red-700 rounded-lg text-white hover:bg-red-600 text-sm">×</button>
    </div>`).join("");
  return `
    <div class="max-w-2xl mx-auto px-4 py-8">
      <a href="${backUrl}" class="text-gray-400 hover:text-white text-sm mb-6 block">← Back</a>
      <h1 class="text-2xl font-bold text-white mb-6">${isEdit ? "Edit Form" : "New Application Form"}</h1>
      <form method="POST" action="${action}" class="bg-gray-800 rounded-xl p-6 border border-gray-700 space-y-5">
        <div>
          <label class="block text-sm font-medium text-gray-300 mb-1">Form Name <span class="text-red-400">*</span></label>
          <input type="text" name="name" required value="${escapeHtml(form?.name ?? "")}"
            class="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 text-gray-200 focus:outline-none focus:border-indigo-500 text-sm" />
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-300 mb-1">Description</label>
          <input type="text" name="description" value="${escapeHtml(form?.description ?? "")}"
            class="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 text-gray-200 focus:outline-none focus:border-indigo-500 text-sm" />
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-300 mb-2">Questions</label>
          <div id="questions">${questionFields}</div>
          <button type="button" onclick="addQ()" class="mt-2 px-4 py-2 bg-gray-700 rounded-lg text-xs text-gray-300 hover:bg-gray-600">+ Add Question</button>
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-300 mb-1">Submission Channel</label>
          <select name="channel_id" class="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 text-gray-200 focus:outline-none focus:border-indigo-500 text-sm">
            <option value="">— None —</option>${channels}
          </select>
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-300 mb-1">Accept Role</label>
          <select name="accept_role" class="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 text-gray-200 focus:outline-none focus:border-indigo-500 text-sm">
            <option value="">— None —</option>${roles}
          </select>
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-300 mb-1">Deny Role</label>
          <select name="deny_role" class="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 text-gray-200 focus:outline-none focus:border-indigo-500 text-sm">
            <option value="">— None —</option>${roles}
          </select>
        </div>
        ${isEdit ? `<div class="flex items-center gap-2"><input type="checkbox" name="active" id="active" ${form.active ? "checked" : ""} class="w-4 h-4 accent-indigo-500" /><label for="active" class="text-sm text-gray-300">Form is active</label></div>` : ""}
        <button type="submit" class="w-full py-3 bg-indigo-600 hover:bg-indigo-500 rounded-xl text-white font-semibold text-sm transition">${isEdit ? "Save Changes" : "Create Form"}</button>
      </form>
    </div>
    <script>
      function addQ() {
        const c = document.getElementById('questions'), n = c.children.length + 1, d = document.createElement('div');
        d.className = 'flex gap-2 mb-2';
        d.innerHTML = '<input type="text" name="questions" placeholder="Question ' + n + '" class="flex-1 bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 text-gray-200 focus:outline-none focus:border-indigo-500 text-sm" /><button type="button" onclick="this.parentElement.remove()" class="px-3 py-2 bg-red-700 rounded-lg text-white hover:bg-red-600 text-sm">×</button>';
        c.appendChild(d);
      }
    </script>`;
}

function renderPage(title: string, content: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(title)} — Bot Dashboard</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <style>body{background:#111827}::-webkit-scrollbar{width:6px}::-webkit-scrollbar-track{background:#1f2937}::-webkit-scrollbar-thumb{background:#4b5563;border-radius:3px}</style>
</head>
<body class="min-h-screen bg-gray-900 text-gray-100 antialiased">
  ${content}
</body>
</html>`;
}
