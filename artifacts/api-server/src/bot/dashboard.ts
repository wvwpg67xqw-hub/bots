import { Router } from "express";
import type { Client } from "discord.js";
import {
  getGuildForms, getForm, createForm, updateForm, deleteForm,
  getFormApplications, getApplication, updateApplicationStatus,
  submitApplication, getUserApplications, getAllActiveForms,
  addDashboardAdmin, removeDashboardAdmin, isDashboardAdmin, getDashboardAdmins,
  getReferralCode, recordReferral, getReferralLeaderboard,
  blacklistUser, unblacklistUser, isBlacklisted, getBlacklist,
} from "./database";
import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, Colors } from "discord.js";
import { generateId } from "./utils";

declare module "express-session" {
  interface SessionData {
    userId: string;
    username: string;
    avatar: string | null;
    returnTo?: string;
  }
}

const DISCORD_API = "https://discord.com/api/v10";

// ── Shared HTML helpers ───────────────────────────────────────────────────────

function escapeHtml(str: string): string {
  return String(str ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function getRedirectUri(req: any): string {
  const domains = process.env["REPLIT_DOMAINS"];
  const domain = domains ? domains.split(",")[0].trim() : req.hostname;
  return `https://${domain}/dashboard/auth/callback`;
}

function isOwner(userId: string): boolean {
  return userId === process.env["OWNER_ID"];
}

function renderPage(title: string, content: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
  <meta name="mobile-web-app-capable" content="yes" />
  <meta name="apple-mobile-web-app-capable" content="yes" />
  <title>${escapeHtml(title)} — Dashboard</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <style>
    body{background:#111827}
    ::-webkit-scrollbar{width:6px}
    ::-webkit-scrollbar-track{background:#1f2937}
    ::-webkit-scrollbar-thumb{background:#4b5563;border-radius:3px}
    * { -webkit-tap-highlight-color: transparent; }
    input, select, textarea, button { font-size: 16px !important; }
    @media (min-width: 640px) { input, select, textarea, button { font-size: 0.875rem !important; } }
  </style>
</head>
<body class="min-h-screen bg-gray-900 text-gray-100 antialiased">
  ${content}
</body>
</html>`;
}

function ownerNav(username: string, avatar: string | null): string {
  const avatarUrl = avatar ? `https://cdn.discordapp.com/avatars/0/${avatar}.png` : null;
  return `<nav class="bg-gray-900 border-b border-gray-800 sticky top-0 z-10">
    <div class="max-w-5xl mx-auto px-4">
      <div class="h-14 flex items-center justify-between gap-2">
        <div class="flex items-center gap-2 min-w-0">
          <a href="/dashboard/owner" class="text-white font-bold text-sm sm:text-base whitespace-nowrap">🤖 Owner Panel</a>
          <a href="/dashboard/owner/admins" class="hidden sm:block text-gray-400 hover:text-white text-sm px-2 py-1 rounded hover:bg-gray-800 transition">Admins</a>
          <a href="/dashboard/owner/blacklist" class="hidden sm:block text-gray-400 hover:text-white text-sm px-2 py-1 rounded hover:bg-gray-800 transition">Blacklist</a>
        </div>
        <div class="flex items-center gap-2 sm:gap-3 shrink-0">
          <span class="bg-amber-500/20 text-amber-300 border border-amber-500/30 text-xs px-2 py-0.5 rounded-full font-medium hidden sm:inline">Owner</span>
          <div class="flex items-center gap-1.5">
            ${avatarUrl ? `<img src="${avatarUrl}" class="w-7 h-7 rounded-full" onerror="this.style.display='none'">` : `<div class="w-7 h-7 rounded-full bg-amber-600 flex items-center justify-center text-white text-xs font-bold">${escapeHtml((username || "?")[0]).toUpperCase()}</div>`}
            <span class="text-gray-300 text-sm hidden sm:inline max-w-[120px] truncate">${escapeHtml(username)}</span>
          </div>
          <a href="/dashboard/auth/logout" class="text-gray-500 hover:text-gray-300 text-xs px-2 py-1 rounded hover:bg-gray-800 transition whitespace-nowrap">Logout</a>
        </div>
      </div>
      <div class="sm:hidden flex gap-3 pb-2 -mt-1 border-t border-gray-800 pt-2">
        <a href="/dashboard/owner/admins" class="text-gray-400 hover:text-white text-xs px-3 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 transition">Admins</a>
        <a href="/dashboard/owner/blacklist" class="text-gray-400 hover:text-white text-xs px-3 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 transition">Blacklist</a>
      </div>
    </div>
  </nav>`;
}

function adminNav(username: string, avatar: string | null): string {
  const avatarUrl = avatar ? `https://cdn.discordapp.com/avatars/0/${avatar}.png` : null;
  return `<nav class="bg-gray-900 border-b border-gray-800 sticky top-0 z-10">
    <div class="max-w-5xl mx-auto px-4">
      <div class="h-14 flex items-center justify-between gap-2">
        <a href="/dashboard/admin" class="text-white font-bold text-sm sm:text-base whitespace-nowrap">🤖 Admin Panel</a>
        <div class="flex items-center gap-2 sm:gap-3 shrink-0">
          <span class="bg-blue-500/20 text-blue-300 border border-blue-500/30 text-xs px-2 py-0.5 rounded-full font-medium hidden sm:inline">Admin</span>
          <div class="flex items-center gap-1.5">
            ${avatarUrl ? `<img src="${avatarUrl}" class="w-7 h-7 rounded-full" onerror="this.style.display='none'">` : `<div class="w-7 h-7 rounded-full bg-blue-600 flex items-center justify-center text-white text-xs font-bold">${escapeHtml((username || "?")[0]).toUpperCase()}</div>`}
            <span class="text-gray-300 text-sm hidden sm:inline max-w-[120px] truncate">${escapeHtml(username)}</span>
          </div>
          <a href="/dashboard/auth/logout" class="text-gray-500 hover:text-gray-300 text-xs px-2 py-1 rounded hover:bg-gray-800 transition whitespace-nowrap">Logout</a>
        </div>
      </div>
    </div>
  </nav>`;
}

function portalNav(username: string, avatar: string | null): string {
  const avatarUrl = avatar ? `https://cdn.discordapp.com/avatars/0/${avatar}.png` : null;
  return `<nav class="bg-gray-900 border-b border-gray-800 sticky top-0 z-10">
    <div class="max-w-5xl mx-auto px-4">
      <div class="h-14 flex items-center justify-between gap-2">
        <div class="flex items-center gap-2 min-w-0">
          <span class="text-white font-bold text-sm sm:text-base whitespace-nowrap">🤖 Staff Portal</span>
          <a href="/dashboard/portal" class="hidden sm:block text-gray-400 hover:text-white text-sm px-2 py-1 rounded hover:bg-gray-800 transition">Positions</a>
          <a href="/dashboard/portal/my-apps" class="hidden sm:block text-gray-400 hover:text-white text-sm px-2 py-1 rounded hover:bg-gray-800 transition">My Apps</a>
        </div>
        <div class="flex items-center gap-2 sm:gap-3 shrink-0">
          <div class="flex items-center gap-1.5">
            ${avatarUrl ? `<img src="${avatarUrl}" class="w-7 h-7 rounded-full" onerror="this.style.display='none'">` : `<div class="w-7 h-7 rounded-full bg-indigo-600 flex items-center justify-center text-white text-xs font-bold">${escapeHtml((username || "?")[0]).toUpperCase()}</div>`}
            <span class="text-gray-300 text-sm hidden sm:inline max-w-[120px] truncate">${escapeHtml(username)}</span>
          </div>
          <a href="/dashboard/auth/logout" class="text-gray-500 hover:text-gray-300 text-xs px-2 py-1 rounded hover:bg-gray-800 transition whitespace-nowrap">Logout</a>
        </div>
      </div>
      <div class="sm:hidden flex gap-3 pb-2 -mt-1 border-t border-gray-800 pt-2">
        <a href="/dashboard/portal" class="text-gray-400 hover:text-white text-xs px-3 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 transition">Open Positions</a>
        <a href="/dashboard/portal/my-apps" class="text-gray-400 hover:text-white text-xs px-3 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 transition">My Applications</a>
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
      <p class="text-gray-400 text-sm mb-6">Hi <strong class="text-white">${escapeHtml(username)}</strong>, you don't have permission to access this page.</p>
      <a href="/dashboard/auth/logout" class="px-5 py-2 bg-gray-700 rounded-lg text-gray-300 hover:bg-gray-600 text-sm">Sign out</a>
    </div>
  </div>`;
}

function guildChannelOptions(guild: any, selected: string | null): string {
  return [...guild.channels.cache.values()]
    .filter((c: any) => c.isTextBased())
    .map((c: any) => `<option value="${c.id}" ${c.id === selected ? "selected" : ""}>#${escapeHtml(c.name)}</option>`)
    .join("");
}

function guildRoleOptions(guild: any, selected: string | null): string {
  return [...guild.roles.cache.values()]
    .filter((r: any) => r.id !== guild.id)
    .sort((a: any, b: any) => b.position - a.position)
    .map((r: any) => `<option value="${r.id}" ${r.id === selected ? "selected" : ""}>${escapeHtml(r.name)}</option>`)
    .join("");
}

function formEditor(backUrl: string, action: string, form: any, channels: string, roles: string): string {
  const isEdit = !!form;
  const existing = form?.questions ?? [""];
  const questionFields = existing.map((q: string, i: number) => `
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
          <label class="block text-sm font-medium text-gray-300 mb-1">Position / Form Name <span class="text-red-400">*</span></label>
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
          <label class="block text-sm font-medium text-gray-300 mb-1">Submission Channel <span class="text-xs text-gray-500">(where applications get posted)</span></label>
          <select name="channel_id" class="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 text-gray-200 focus:outline-none focus:border-indigo-500 text-sm">
            <option value="">— None —</option>${channels}
          </select>
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-300 mb-1">Role to grant on Accept</label>
          <select name="accept_role" class="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 text-gray-200 focus:outline-none focus:border-indigo-500 text-sm">
            <option value="">— None —</option>${roles}
          </select>
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-300 mb-1">Role to grant on Deny <span class="text-xs text-gray-500">(optional)</span></label>
          <select name="deny_role" class="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 text-gray-200 focus:outline-none focus:border-indigo-500 text-sm">
            <option value="">— None —</option>${roles}
          </select>
        </div>
        ${isEdit ? `<div class="flex items-center gap-2"><input type="checkbox" name="active" id="active" ${form.active ? "checked" : ""} class="w-4 h-4 accent-indigo-500" /><label for="active" class="text-sm text-gray-300">Form is active (visible to applicants)</label></div>` : ""}
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

// ─────────────────────────────────────────────────────────────────────────────
// MAIN DASHBOARD ROUTER
// ─────────────────────────────────────────────────────────────────────────────

export function createDashboardRouter(client: Client): Router {
  const router = Router();

  // ── Middleware ──────────────────────────────────────────────────────────────

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

  // ── Auth ────────────────────────────────────────────────────────────────────

  router.get("/auth/login", (req: any, res) => {
    const error = req.query.error ? `<div class="bg-red-900/40 border border-red-700 p-3 text-red-300 rounded-lg mb-4 text-sm">Login failed. Please try again.</div>` : "";
    res.send(renderPage("Login", `
      <div class="min-h-screen flex items-center justify-center px-4">
        <div class="bg-gray-800 p-8 rounded-2xl border border-gray-700 w-full max-w-sm text-center">
          <div class="text-4xl mb-4">🤖</div>
          <h1 class="text-white text-2xl font-bold mb-1">Dashboard</h1>
          <p class="text-gray-400 text-sm mb-6">Sign in with Discord to continue</p>
          ${error}
          <a href="/dashboard/auth/login/go" class="block w-full py-3 bg-indigo-600 hover:bg-indigo-500 rounded-xl text-white font-semibold transition">
            Login with Discord
          </a>
        </div>
      </div>`));
  });

  router.get("/auth/login/go", (req: any, res) => {
    const clientId = process.env["CLIENT_ID"]!;
    const redirectUri = encodeURIComponent(getRedirectUri(req));
    res.redirect(`https://discord.com/oauth2/authorize?client_id=${clientId}&redirect_uri=${redirectUri}&response_type=code&scope=identify`);
  });

  router.get("/auth/callback", async (req: any, res) => {
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
      const tokens = await tokenRes.json() as any;
      const userRes = await fetch(`${DISCORD_API}/users/@me`, {
        headers: { Authorization: `Bearer ${tokens.access_token}` },
      });
      const user = await userRes.json() as any;
      req.session.userId = user.id;
      req.session.username = user.username;
      req.session.avatar = user.avatar;
      const returnTo = req.session.returnTo || "/dashboard";
      delete req.session.returnTo;
      res.redirect(returnTo);
    } catch {
      res.redirect("/dashboard/auth/login?error=1");
    }
  });

  router.get("/auth/logout", (req: any, res) => {
    req.session.destroy(() => res.redirect("/dashboard/auth/login"));
  });

  // ── Root routing ────────────────────────────────────────────────────────────

  router.get("/", requireLogin, (req: any, res) => {
    if (isOwner(req.session.userId)) return res.redirect("/dashboard/owner");
    if (isDashboardAdmin(req.session.userId)) return res.redirect("/dashboard/admin");
    res.redirect("/dashboard/portal");
  });

  // ══════════════════════════════════════════════════════════════════════════════
  // OWNER PANEL
  // ══════════════════════════════════════════════════════════════════════════════

  router.get("/owner", requireOwner, (req: any, res) => {
    const guilds = client.guilds.cache;
    const admins = getDashboardAdmins();
    const guildCards = [...guilds.values()].map(g => `
      <div class="bg-gray-800 rounded-xl p-5 border border-gray-700">
        <div class="flex items-center gap-4 mb-3">
          ${g.iconURL() ? `<img src="${g.iconURL()}" class="w-12 h-12 rounded-full">` : `<div class="w-12 h-12 rounded-full bg-indigo-600 flex items-center justify-center text-white font-bold text-xl">${g.name[0]}</div>`}
          <div>
            <div class="font-semibold text-white">${escapeHtml(g.name)}</div>
            <div class="text-sm text-gray-400">${g.memberCount.toLocaleString()} members</div>
          </div>
        </div>
        <div class="flex gap-2">
          <a href="/dashboard/owner/guild/${g.id}" class="flex-1 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 rounded text-xs text-white text-center transition">Manage</a>
          <form method="POST" action="/dashboard/owner/guild/${g.id}/leave" onsubmit="return confirm('Remove bot from ${escapeHtml(g.name)}?')">
            <button class="px-3 py-1.5 bg-gray-700 hover:bg-red-700 rounded text-xs text-gray-300 hover:text-white transition">Leave</button>
          </form>
        </div>
      </div>`).join("");

    res.send(renderPage("Owner Panel", ownerNav(req.session.username, req.session.avatar) + `
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
              <div class="overflow-x-auto">
              <table class="w-full text-sm min-w-[480px]"><thead><tr class="text-left text-gray-400 border-b border-gray-700"><th class="py-3 px-4">Username</th><th class="py-3 px-4">User ID</th><th class="py-3 px-4">Granted</th></tr></thead>
              <tbody>${admins.map(a => `<tr class="border-t border-gray-700"><td class="py-3 px-4 text-white">${escapeHtml(a.username)}</td><td class="py-3 px-4 text-gray-400 font-mono text-xs">${a.user_id}</td><td class="py-3 px-4 text-gray-400">${new Date(a.granted_at).toLocaleDateString()}</td></tr>`).join("")}
              </tbody></table></div></div>`
        }
        <h2 class="text-xl font-semibold text-white mb-4">Servers</h2>
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          ${guildCards || '<p class="text-gray-400 col-span-3">No servers found.</p>'}
        </div>
      </div>`));
  });

  // Admin management
  router.get("/owner/admins", requireOwner, (req: any, res) => {
    const admins = getDashboardAdmins();
    const rows = admins.map(a => `
      <tr class="border-t border-gray-700">
        <td class="py-3 px-4 text-white">${escapeHtml(a.username)}</td>
        <td class="py-3 px-4 text-gray-400 font-mono text-xs">${a.user_id}</td>
        <td class="py-3 px-4 text-gray-400 text-sm">${new Date(a.granted_at).toLocaleDateString()}</td>
        <td class="py-3 px-4">
          <form method="POST" action="/dashboard/owner/admins/${a.user_id}/remove" onsubmit="return confirm('Revoke admin for ${escapeHtml(a.username)}?')">
            <button class="px-3 py-1 bg-red-700 hover:bg-red-600 rounded text-xs text-white">Revoke</button>
          </form>
        </td>
      </tr>`).join("");

    res.send(renderPage("Manage Admins", ownerNav(req.session.username, req.session.avatar) + `
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
            <input type="text" name="username" required placeholder="Display name"
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
            ? `<div class="p-10 text-center text-gray-400">No admins yet.</div>`
            : `<div class="overflow-x-auto"><table class="w-full text-sm min-w-[520px]"><thead><tr class="text-left text-gray-400 border-b border-gray-700"><th class="py-3 px-4">Username</th><th class="py-3 px-4">User ID</th><th class="py-3 px-4">Granted</th><th class="py-3 px-4"></th></tr></thead><tbody>${rows}</tbody></table></div>`}
        </div>
      </div>`));
  });

  router.post("/owner/admins/add", requireOwner, (req: any, res) => {
    const { user_id, username } = req.body;
    if (user_id?.trim() && username?.trim()) addDashboardAdmin(user_id.trim(), username.trim(), req.session.userId);
    res.redirect("/dashboard/owner/admins");
  });

  router.post("/owner/admins/:userId/remove", requireOwner, (req: any, res) => {
    removeDashboardAdmin(req.params.userId);
    res.redirect("/dashboard/owner/admins");
  });

  // Guild management
  router.get("/owner/guild/:guildId", requireOwner, (req: any, res): void => {
    const { guildId } = req.params;
    const guild = client.guilds.cache.get(guildId);
    if (!guild) { res.redirect("/dashboard/owner"); return; }
    const forms = getGuildForms(guildId);
    const lb = getReferralLeaderboard(guildId, 5);

    const formCards = forms.map(f => `
      <div class="bg-gray-800 rounded-xl p-5 border border-gray-700">
        <div class="flex items-start justify-between mb-3">
          <div>
            <h3 class="font-semibold text-white">${escapeHtml(f.name)}</h3>
            <p class="text-sm text-gray-400">${escapeHtml(f.description || "")}</p>
          </div>
          <span class="px-2 py-1 rounded text-xs ${f.active ? "bg-green-900 text-green-300" : "bg-gray-700 text-gray-400"}">${f.active ? "Active" : "Inactive"}</span>
        </div>
        <div class="text-xs text-gray-500 mb-3">${f.questions.length} question${f.questions.length !== 1 ? "s" : ""}</div>
        <div class="flex gap-2 flex-wrap">
          <a href="/dashboard/owner/guild/${guildId}/form/${f.id}/edit" class="px-3 py-1 bg-indigo-600 rounded text-xs text-white hover:bg-indigo-500">Edit</a>
          <a href="/dashboard/owner/guild/${guildId}/form/${f.id}/submissions" class="px-3 py-1 bg-blue-600 rounded text-xs text-white hover:bg-blue-500">Submissions</a>
          <form method="POST" action="/dashboard/owner/guild/${guildId}/form/${f.id}/delete" class="inline" onsubmit="return confirm('Delete this form?')">
            <button class="px-3 py-1 bg-red-700 rounded text-xs text-white hover:bg-red-600">Delete</button>
          </form>
        </div>
      </div>`).join("");

    const lbRows = lb.length === 0
      ? `<p class="text-gray-400 text-sm p-4">No referrals recorded yet.</p>`
      : lb.map((r, i) => `<div class="flex items-center justify-between py-2 px-4 border-t border-gray-700 text-sm"><span class="text-gray-400">${i + 1}. <span class="text-white font-mono text-xs">${r.referrer_id}</span></span><span class="bg-indigo-900 text-indigo-300 px-2 py-0.5 rounded text-xs">${r.count} referral${r.count !== 1 ? "s" : ""}</span></div>`).join("");

    res.send(renderPage(guild.name, ownerNav(req.session.username, req.session.avatar) + `
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

  router.post("/owner/guild/:guildId/leave", requireOwner, async (req: any, res) => {
    const guild = client.guilds.cache.get(req.params.guildId);
    if (guild) { try { await guild.leave(); } catch { } }
    res.redirect("/dashboard/owner");
  });

  // Form CRUD
  router.get("/owner/guild/:guildId/form/new", requireOwner, (req: any, res) => {
    const { guildId } = req.params;
    const guild = client.guilds.cache.get(guildId);
    if (!guild) return res.redirect("/dashboard/owner");
    res.send(renderPage("New Form", ownerNav(req.session.username, req.session.avatar) + formEditor(`/dashboard/owner/guild/${guildId}`, `/dashboard/owner/guild/${guildId}/form/new`, null, guildChannelOptions(guild, null), guildRoleOptions(guild, null))));
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
    res.send(renderPage("Edit Form", ownerNav(req.session.username, req.session.avatar) + formEditor(`/dashboard/owner/guild/${guildId}`, `/dashboard/owner/guild/${guildId}/form/${formId}/edit`, form, guildChannelOptions(guild, form.channel_id), guildRoleOptions(guild, null))));
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

  // Owner submissions + application review
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

  router.post("/owner/guild/:guildId/application/:appId/blacklist", requireOwner, (req: any, res) => {
    const app = getApplication(parseInt(req.params.appId));
    if (app) blacklistUser(app.user_id, app.username, req.body.reason || "", req.session.userId);
    res.redirect(`/dashboard/owner/guild/${req.params.guildId}/application/${req.params.appId}`);
  });

  router.post("/owner/guild/:guildId/application/:appId/unblacklist", requireOwner, (req: any, res) => {
    const app = getApplication(parseInt(req.params.appId));
    if (app) unblacklistUser(app.user_id);
    res.redirect(`/dashboard/owner/guild/${req.params.guildId}/application/${req.params.appId}`);
  });

  // Blacklist management page
  router.get("/owner/blacklist", requireOwner, (req: any, res) => {
    const list = getBlacklist();
    const rows = list.map(entry => `
      <tr class="border-t border-gray-700">
        <td class="py-3 px-4">
          <div class="text-white text-sm font-medium">${escapeHtml(entry.username)}</div>
          <div class="text-gray-500 text-xs font-mono">${entry.user_id}</div>
        </td>
        <td class="py-3 px-4 text-gray-400 text-sm">${escapeHtml(entry.reason || "—")}</td>
        <td class="py-3 px-4 text-gray-400 text-xs">${new Date(entry.blacklisted_at).toLocaleDateString()}</td>
        <td class="py-3 px-4">
          <form method="POST" action="/dashboard/owner/blacklist/${entry.user_id}/remove" onsubmit="return confirm('Unblacklist ${escapeHtml(entry.username)}?')">
            <button class="px-3 py-1 bg-gray-700 hover:bg-green-700 rounded text-xs text-gray-300 hover:text-white transition">✅ Remove</button>
          </form>
        </td>
      </tr>`).join("");

    res.send(renderPage("Application Blacklist", ownerNav(req.session.username, req.session.avatar) + `
      <div class="max-w-4xl mx-auto px-4 py-8">
        <div class="flex items-center gap-4 mb-8">
          <a href="/dashboard/owner" class="text-gray-400 hover:text-white text-sm">← Back</a>
          <h1 class="text-2xl font-bold text-white">🚫 Application Blacklist</h1>
          <span class="bg-gray-700 text-gray-300 text-xs px-2 py-1 rounded-full">${list.length}</span>
        </div>
        <div class="bg-gray-800 rounded-xl p-6 border border-gray-700 mb-6">
          <h2 class="text-sm font-semibold text-white mb-3">Blacklist by User ID</h2>
          <form method="POST" action="/dashboard/owner/blacklist/add" class="flex flex-col sm:flex-row gap-3">
            <input type="text" name="user_id" required placeholder="Discord User ID" class="flex-1 bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 text-gray-200 focus:outline-none focus:border-red-500 font-mono text-sm" />
            <input type="text" name="username" required placeholder="Display name" class="flex-1 bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 text-gray-200 focus:outline-none focus:border-red-500 text-sm" />
            <input type="text" name="reason" placeholder="Reason (optional)" class="flex-1 bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 text-gray-200 focus:outline-none focus:border-red-500 text-sm" />
            <button type="submit" class="px-5 py-2 bg-red-700 hover:bg-red-600 rounded-lg text-white text-sm font-medium whitespace-nowrap">🚫 Blacklist</button>
          </form>
        </div>
        <div class="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
          <div class="px-6 py-4 border-b border-gray-700">
            <h2 class="font-semibold text-white">Blacklisted Users</h2>
          </div>
          ${list.length === 0
            ? `<div class="p-10 text-center text-gray-400">No users are blacklisted.</div>`
            : `<div class="overflow-x-auto"><table class="w-full min-w-[520px]">
                <thead><tr class="text-left text-gray-400 text-xs border-b border-gray-700">
                  <th class="py-3 px-4">User</th><th class="py-3 px-4">Reason</th><th class="py-3 px-4">Date</th><th class="py-3 px-4"></th>
                </tr></thead>
                <tbody>${rows}</tbody>
              </table></div>`}
        </div>
      </div>`));
  });

  router.post("/owner/blacklist/add", requireOwner, (req: any, res) => {
    const { user_id, username, reason } = req.body;
    if (user_id?.trim() && username?.trim()) blacklistUser(user_id.trim(), username.trim(), reason || "", req.session.userId);
    res.redirect("/dashboard/owner/blacklist");
  });

  router.post("/owner/blacklist/:userId/remove", requireOwner, (req: any, res) => {
    unblacklistUser(req.params.userId);
    res.redirect("/dashboard/owner/blacklist");
  });

  // ══════════════════════════════════════════════════════════════════════════════
  // ADMIN PANEL
  // ══════════════════════════════════════════════════════════════════════════════

  router.get("/admin", requireAdmin, (req: any, res) => {
    const guilds = client.guilds.cache;
    const guildCards = [...guilds.values()].map(g => `
      <a href="/dashboard/admin/guild/${g.id}" class="block bg-gray-800 rounded-xl p-5 hover:bg-gray-700 transition border border-gray-700 hover:border-blue-500">
        <div class="flex items-center gap-4">
          ${g.iconURL() ? `<img src="${g.iconURL()}" class="w-12 h-12 rounded-full">` : `<div class="w-12 h-12 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold text-xl">${g.name[0]}</div>`}
          <div>
            <div class="font-semibold text-white">${escapeHtml(g.name)}</div>
            <div class="text-sm text-gray-400">${g.memberCount.toLocaleString()} members</div>
          </div>
        </div>
      </a>`).join("");

    res.send(renderPage("Admin Panel", adminNav(req.session.username, req.session.avatar) + `
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
          <div>
            <h3 class="font-semibold text-white">${escapeHtml(f.name)}</h3>
            <p class="text-sm text-gray-400">${escapeHtml(f.description || "")}</p>
          </div>
          <span class="px-2 py-1 rounded text-xs ${f.active ? "bg-green-900 text-green-300" : "bg-gray-700 text-gray-400"}">${f.active ? "Active" : "Inactive"}</span>
        </div>
        <a href="/dashboard/admin/guild/${guildId}/form/${f.id}/submissions" class="px-3 py-1 bg-blue-600 rounded text-xs text-white hover:bg-blue-500">View Submissions</a>
      </div>`).join("");

    res.send(renderPage(`${guild.name} — Admin`, adminNav(req.session.username, req.session.avatar) + `
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

  router.post("/admin/guild/:guildId/application/:appId/blacklist", requireAdmin, (req: any, res) => {
    const app = getApplication(parseInt(req.params.appId));
    if (app) blacklistUser(app.user_id, app.username, req.body.reason || "", req.session.userId);
    res.redirect(`/dashboard/admin/guild/${req.params.guildId}/application/${req.params.appId}`);
  });

  router.post("/admin/guild/:guildId/application/:appId/unblacklist", requireAdmin, (req: any, res) => {
    const app = getApplication(parseInt(req.params.appId));
    if (app) unblacklistUser(app.user_id);
    res.redirect(`/dashboard/admin/guild/${req.params.guildId}/application/${req.params.appId}`);
  });

  // ══════════════════════════════════════════════════════════════════════════════
  // STAFF PORTAL — regular logged-in users
  // ══════════════════════════════════════════════════════════════════════════════

  router.get("/portal", requireLogin, (req: any, res) => {
    if (isOwner(req.session.userId)) return res.redirect("/dashboard/owner");
    if (isDashboardAdmin(req.session.userId)) return res.redirect("/dashboard/admin");
    const forms = getAllActiveForms();
    const userApps = getUserApplications(req.session.userId);
    const formCards = forms.map((f: any) => {
      const guild = client.guilds.cache.get(f.guild_id);
      const userApp = userApps.find((a: any) => a.form_id === f.id);
      const badge = userApp
        ? `<span class="px-2 py-1 rounded text-xs ${userApp.status === "accepted" ? "bg-green-900 text-green-300" : userApp.status === "denied" ? "bg-red-900 text-red-300" : "bg-yellow-900 text-yellow-300"}">${userApp.status === "pending" ? "⏳ Pending" : userApp.status === "accepted" ? "✅ Accepted" : "❌ Denied"}</span>`
        : "";
      return `
        <div class="bg-gray-800 rounded-xl p-6 border border-gray-700 flex flex-col gap-3">
          <div class="flex items-start justify-between">
            <div>
              <h3 class="font-semibold text-white text-base">${escapeHtml(f.name)}</h3>
              ${f.description ? `<p class="text-sm text-gray-400 mt-0.5">${escapeHtml(f.description)}</p>` : ""}
              ${guild ? `<p class="text-xs text-gray-500 mt-1">📍 ${escapeHtml(guild.name)}</p>` : ""}
            </div>
            ${badge}
          </div>
          <div class="text-xs text-gray-500">${f.questions.length} question${f.questions.length !== 1 ? "s" : ""}</div>
          ${userApp
            ? `<div class="text-xs text-gray-400 italic">You already applied to this position.</div>`
            : `<a href="/dashboard/portal/apply/${f.id}" class="inline-block px-4 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-white text-sm font-medium text-center transition">Apply Now →</a>`}
        </div>`;
    }).join("");

    res.send(renderPage("Staff Portal", portalNav(req.session.username, req.session.avatar) + `
      <div class="max-w-5xl mx-auto px-4 py-8">
        <div class="mb-8">
          <h1 class="text-3xl font-bold text-white">👋 Welcome, ${escapeHtml(req.session.username)}</h1>
          <p class="text-gray-400 mt-1">Browse open positions and submit your application.</p>
        </div>
        ${forms.length === 0
          ? `<div class="bg-gray-800 rounded-xl p-16 text-center border border-gray-700 border-dashed"><div class="text-4xl mb-3">📋</div><p class="text-gray-400">No open positions right now. Check back later!</p></div>`
          : `<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">${formCards}</div>`}
      </div>`));
  });

  router.get("/portal/apply/:formId", requireLogin, (req: any, res) => {
    if (isOwner(req.session.userId)) return res.redirect("/dashboard/owner");
    if (isDashboardAdmin(req.session.userId)) return res.redirect("/dashboard/admin");
    if (isBlacklisted(req.session.userId)) {
      return void res.status(403).send(renderPage("Blacklisted", portalNav(req.session.username, req.session.avatar) + `
        <div class="max-w-lg mx-auto px-4 py-16 text-center">
          <div class="text-5xl mb-4">🚫</div>
          <h1 class="text-2xl font-bold text-white mb-2">You're Blacklisted</h1>
          <p class="text-gray-400 text-sm mb-6">You have been blacklisted from submitting applications. If you believe this is a mistake, please contact a staff member.</p>
          <a href="/dashboard/portal" class="px-5 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-gray-300 text-sm">← Back to Portal</a>
        </div>`));
    }
    const form = getForm(req.params.formId);
    if (!form || !form.active) return void res.redirect("/dashboard/portal");
    const guild = client.guilds.cache.get(form.guild_id);
    const avatarUrl = req.session.avatar ? `https://cdn.discordapp.com/avatars/${req.session.userId}/${req.session.avatar}.png` : null;
    const questions = form.questions.map((q: string, i: number) => `
      <div class="mb-5">
        <label class="block text-sm font-medium text-gray-300 mb-2">${escapeHtml(q)} <span class="text-red-400">*</span></label>
        <textarea name="q_${i}" rows="3" required class="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-3 text-gray-200 placeholder-gray-500 focus:outline-none focus:border-indigo-500 resize-none text-sm" placeholder="Your answer..."></textarea>
      </div>`).join("");

    res.send(renderPage(`Apply — ${form.name}`, portalNav(req.session.username, req.session.avatar) + `
      <div class="max-w-2xl mx-auto px-4 py-8">
        <a href="/dashboard/portal" class="text-gray-400 hover:text-white text-sm mb-6 block">← Back to Portal</a>
        <div class="bg-gray-800 rounded-2xl p-8 border border-gray-700">
          <div class="mb-4">
            <h1 class="text-2xl font-bold text-white">${escapeHtml(form.name)}</h1>
            ${form.description ? `<p class="text-gray-400 mt-1 text-sm">${escapeHtml(form.description)}</p>` : ""}
            ${guild ? `<p class="text-xs text-gray-500 mt-1">📍 ${escapeHtml(guild.name)}</p>` : ""}
          </div>
          <div class="flex items-center gap-3 bg-gray-700/50 rounded-lg px-4 py-3 mb-6">
            ${avatarUrl ? `<img src="${avatarUrl}" class="w-8 h-8 rounded-full" onerror="this.style.display='none'">` : `<div class="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center text-white text-xs font-bold">${escapeHtml((req.session.username || "?")[0])}</div>`}
            <div>
              <div class="text-white text-sm font-medium">${escapeHtml(req.session.username)}</div>
              <div class="text-gray-400 text-xs">Submitting as this Discord account</div>
            </div>
          </div>
          <form method="POST" action="/dashboard/portal/apply/${form.id}">
            ${questions}
            <button type="submit" class="w-full py-3 bg-indigo-600 hover:bg-indigo-500 rounded-xl text-white font-semibold transition text-sm">Submit Application</button>
          </form>
        </div>
      </div>`));
  });

  router.post("/portal/apply/:formId", requireLogin, async (req: any, res): Promise<void> => {
    if (isOwner(req.session.userId)) { res.redirect("/dashboard/owner"); return; }
    if (isDashboardAdmin(req.session.userId)) { res.redirect("/dashboard/admin"); return; }
    if (isBlacklisted(req.session.userId)) { res.redirect("/dashboard/portal"); return; }
    const form = getForm(req.params.formId);
    if (!form || !form.active) { res.redirect("/dashboard/portal"); return; }
    const answers: Record<string, string> = {};
    form.questions.forEach((q: string, i: number) => { answers[q] = req.body[`q_${i}`] || ""; });
    const appId = submitApplication(form.id, form.guild_id, req.session.userId, req.session.username, answers);
    if (form.channel_id) {
      try {
        const guild = client.guilds.cache.get(form.guild_id);
        const channel = guild?.channels.cache.get(form.channel_id);
        if (channel?.isTextBased()) {
          const embed = new EmbedBuilder().setColor(Colors.Blurple)
            .setTitle(`📋 New Application — ${form.name}`)
            .setDescription(`**Applicant:** ${req.session.username}\n**User ID:** \`${req.session.userId}\``)
            .addFields(Object.entries(answers).map(([q, a]) => ({ name: q, value: (a || "No answer").slice(0, 1024) })))
            .setTimestamp().setFooter({ text: `Application ID: ${appId}` });
          const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder().setCustomId(`app_accept_${appId}`).setLabel("Accept").setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId(`app_deny_${appId}`).setLabel("Deny").setStyle(ButtonStyle.Danger),
          );
          await channel.send({ embeds: [embed], components: [row] });
        }
      } catch { }
    }
    res.send(renderPage("Submitted!", portalNav(req.session.username, req.session.avatar) + `
      <div class="max-w-lg mx-auto px-4 py-16 text-center">
        <div class="text-5xl mb-4">✅</div>
        <h1 class="text-2xl font-bold text-white mb-2">Application Submitted!</h1>
        <p class="text-gray-400 text-sm mb-6">Your application for <strong class="text-white">${escapeHtml(form.name)}</strong> has been received.</p>
        <a href="/dashboard/portal/my-apps" class="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-white text-sm font-medium">View My Applications →</a>
      </div>`));
  });

  router.get("/portal/my-apps", requireLogin, (req: any, res) => {
    if (isOwner(req.session.userId)) return res.redirect("/dashboard/owner");
    if (isDashboardAdmin(req.session.userId)) return res.redirect("/dashboard/admin");
    const apps = getUserApplications(req.session.userId);
    const cards = apps.map((a: any) => `
      <div class="bg-gray-800 rounded-xl p-5 border border-gray-700">
        <div class="flex items-start justify-between mb-2">
          <div>
            <div class="font-semibold text-white">${escapeHtml(a.form_name)}</div>
            <div class="text-xs text-gray-400 mt-0.5">${new Date(a.submitted_at).toLocaleDateString()}</div>
          </div>
          <span class="px-2 py-1 rounded text-xs ${a.status === "accepted" ? "bg-green-900 text-green-300" : a.status === "denied" ? "bg-red-900 text-red-300" : "bg-yellow-900 text-yellow-300"}">
            ${a.status === "pending" ? "⏳ Pending" : a.status === "accepted" ? "✅ Accepted" : "❌ Denied"}
          </span>
        </div>
        ${a.status !== "pending" ? `<div class="text-xs text-gray-500">Reviewed ${a.reviewed_at ? new Date(a.reviewed_at).toLocaleDateString() : ""}</div>` : ""}
      </div>`).join("");

    res.send(renderPage("My Applications", portalNav(req.session.username, req.session.avatar) + `
      <div class="max-w-3xl mx-auto px-4 py-8">
        <div class="mb-8">
          <h1 class="text-2xl font-bold text-white">My Applications</h1>
          <p class="text-gray-400 mt-1">Track the status of your submitted applications.</p>
        </div>
        ${apps.length === 0
          ? `<div class="bg-gray-800 rounded-xl p-16 text-center border border-gray-700 border-dashed"><div class="text-4xl mb-3">📭</div><p class="text-gray-400 mb-4">You haven't applied to anything yet.</p><a href="/dashboard/portal" class="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-white text-sm font-medium">Browse Open Positions</a></div>`
          : `<div class="grid grid-cols-1 sm:grid-cols-2 gap-4">${cards}</div>`}
      </div>`));
  });

  // ── Shared helpers ──────────────────────────────────────────────────────────

  function renderSubmissions(req: any, res: any, guildId: string, formId: string, role: "owner" | "admin") {
    const form = getForm(formId);
    if (!form) return res.redirect(`/dashboard/${role}`);
    const apps = getFormApplications(formId);
    const pending = apps.filter((a: any) => a.status === "pending").length;
    const rows = apps.map((a: any) => `
      <tr class="border-t border-gray-700 hover:bg-gray-800/50">
        <td class="py-3 px-4 text-gray-200 text-sm">${escapeHtml(a.username)}</td>
        <td class="py-3 px-4"><span class="px-2 py-1 rounded text-xs ${a.status === "accepted" ? "bg-green-900 text-green-300" : a.status === "denied" ? "bg-red-900 text-red-300" : "bg-yellow-900 text-yellow-300"}">${a.status}</span></td>
        <td class="py-3 px-4 text-gray-400 text-xs">${new Date(a.submitted_at).toLocaleDateString()}</td>
        <td class="py-3 px-4"><a href="/dashboard/${role}/guild/${guildId}/application/${a.id}" class="text-indigo-400 hover:text-indigo-300 text-xs">View →</a></td>
      </tr>`).join("");

    const nav = role === "owner" ? ownerNav(req.session.username, req.session.avatar) : adminNav(req.session.username, req.session.avatar);
    res.send(renderPage(`${form.name} — Submissions`, nav + `
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
              <div class="overflow-x-auto">
              <table class="w-full min-w-[420px]"><thead><tr class="text-left text-gray-400 text-xs border-b border-gray-700">
                <th class="py-3 px-4">Applicant</th><th class="py-3 px-4">Status</th><th class="py-3 px-4">Date</th><th class="py-3 px-4"></th>
              </tr></thead><tbody>${rows}</tbody></table></div></div>`}
      </div>`));
  }

  function renderApplication(req: any, res: any, guildId: string, appId: string, role: "owner" | "admin") {
    const app = getApplication(parseInt(appId));
    if (!app) return res.redirect(`/dashboard/${role}`);
    const answerHtml = Object.entries(app.answers as Record<string, string>).map(([q, a]) => `
      <div class="mb-4">
        <div class="text-xs font-medium text-gray-400 uppercase tracking-wide mb-1">${escapeHtml(q)}</div>
        <div class="bg-gray-700/50 rounded-lg p-3 text-gray-200 text-sm">${escapeHtml(a || "—")}</div>
      </div>`).join("");

    const nav = role === "owner" ? ownerNav(req.session.username, req.session.avatar) : adminNav(req.session.username, req.session.avatar);
    res.send(renderPage("Application", nav + `
      <div class="max-w-2xl mx-auto px-4 py-8">
        <a href="/dashboard/${role}/guild/${guildId}/form/${app.form_id}/submissions" class="text-gray-400 hover:text-white text-sm mb-6 block">← Back to Submissions</a>
        <div class="bg-gray-800 rounded-xl p-6 border border-gray-700">
          <div class="flex justify-between items-start mb-6">
            <div>
              <h1 class="text-xl font-bold text-white">${escapeHtml(app.username)}</h1>
              <div class="text-xs text-gray-400 mt-1 font-mono">${app.user_id}</div>
              <div class="text-xs text-gray-400">${new Date(app.submitted_at).toLocaleString()}</div>
            </div>
            <span class="px-3 py-1 rounded-full text-sm font-medium ${app.status === "accepted" ? "bg-green-900 text-green-300" : app.status === "denied" ? "bg-red-900 text-red-300" : "bg-yellow-900 text-yellow-300"}">${app.status}</span>
          </div>
          ${answerHtml}
          <div class="mt-6 pt-6 border-t border-gray-700 space-y-3">
            ${app.status === "pending" ? `
              <div class="flex flex-wrap gap-3">
                <form method="POST" action="/dashboard/${role}/guild/${guildId}/application/${appId}/accept">
                  <button class="px-5 py-2 bg-green-600 rounded-lg text-white hover:bg-green-500 font-medium text-sm">✅ Accept</button>
                </form>
                <form method="POST" action="/dashboard/${role}/guild/${guildId}/application/${appId}/deny">
                  <button class="px-5 py-2 bg-red-600 rounded-lg text-white hover:bg-red-500 font-medium text-sm">❌ Deny</button>
                </form>
              </div>` : `<p class="text-xs text-gray-500">Reviewed ${app.reviewed_at ? new Date(app.reviewed_at).toLocaleString() : ""}</p>`}
            ${isBlacklisted(app.user_id)
              ? `<form method="POST" action="/dashboard/${role}/guild/${guildId}/application/${appId}/unblacklist" onsubmit="return confirm('Remove ${escapeHtml(app.username)} from the application blacklist?')">
                  <button class="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-gray-300 text-sm font-medium border border-gray-600">✅ Remove from Blacklist</button>
                </form>`
              : `<form method="POST" action="/dashboard/${role}/guild/${guildId}/application/${appId}/blacklist" onsubmit="return confirm('Blacklist ${escapeHtml(app.username)} from all future applications?')">
                  <div class="flex flex-wrap gap-2 items-center">
                    <input type="text" name="reason" placeholder="Reason (optional)" class="flex-1 min-w-0 bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-red-500" />
                    <button class="px-4 py-2 bg-red-800 hover:bg-red-700 rounded-lg text-red-200 text-sm font-medium border border-red-700 whitespace-nowrap">🚫 Blacklist User</button>
                  </div>
                </form>`}
          </div>
        </div>
      </div>`));
  }

  async function handleAppDecision(req: any, res: any, status: "accepted" | "denied", client: Client) {
    const { guildId, appId } = req.params;
    const role = req.originalUrl.includes("/owner/") ? "owner" : "admin";
    const app = getApplication(parseInt(appId));
    if (!app) return res.redirect(`/dashboard/${role}/guild/${guildId}`);

    updateApplicationStatus(parseInt(appId), status, req.session.userId);

    const form = getForm(app.form_id);
    const guild = client.guilds.cache.get(guildId);

    // Assign role
    const roleId = status === "accepted" ? form?.accept_role : form?.deny_role;
    if (roleId && guild) {
      try {
        const member = await guild.members.fetch(app.user_id);
        await member.roles.add(roleId);
      } catch { }
    }

    // DM the applicant
    try {
      const applicant = await client.users.fetch(app.user_id);
      const isAccepted = status === "accepted";
      const embed = new EmbedBuilder()
        .setColor(isAccepted ? Colors.Green : Colors.Red)
        .setTitle(isAccepted ? "✅ Application Accepted!" : "❌ Application Denied")
        .setDescription(
          isAccepted
            ? `Congratulations! Your application for **${form?.name ?? "the position"}** has been **accepted**.${guild ? `\n\n📍 **Server:** ${guild.name}` : ""}`
            : `Unfortunately, your application for **${form?.name ?? "the position"}** has been **denied**.${guild ? `\n\n📍 **Server:** ${guild.name}` : ""}`
        )
        .setFooter({ text: `Application ID: ${appId}` })
        .setTimestamp();

      if (isAccepted && roleId && guild) {
        const assignedRole = guild.roles.cache.get(roleId);
        if (assignedRole) embed.addFields({ name: "Role Assigned", value: `@${assignedRole.name}`, inline: true });
      }

      await applicant.send({ embeds: [embed] });
    } catch { /* user has DMs closed or blocked the bot */ }

    res.redirect(`/dashboard/${role}/guild/${guildId}/application/${appId}`);
  }

  return router;
}

// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC APPLY ROUTER  (/apply/:formId)
// ─────────────────────────────────────────────────────────────────────────────

export function createApplyRouter(client: Client): Router {
  const router = Router();

  router.get("/:formId", (req: any, res) => {
    if (req.session?.userId) return res.redirect(`/dashboard/portal/apply/${req.params.formId}`);
    const form = getForm(req.params.formId);
    if (!form || !form.active) {
      return void res.status(404).send(renderPage("Not Found", `
        <div class="min-h-screen flex items-center justify-center">
          <div class="text-center"><div class="text-5xl mb-4">📋</div>
          <h1 class="text-2xl font-bold text-white mb-2">Form Not Found</h1>
          <p class="text-gray-400">This form doesn't exist or is no longer active.</p></div>
        </div>`));
    }
    res.redirect(`/dashboard/auth/login`);
  });

  return router;
}

// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC REFER ROUTER  (/refer/:code)
// ─────────────────────────────────────────────────────────────────────────────

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
          <p class="text-gray-400 text-sm mb-4">Your referrer will get credit when you join. Ask them to configure the server invite via <code class="bg-gray-800 px-1 rounded">/setup-invite</code>.</p>
        </div>
      </div>`));
  });

  return router;
}
