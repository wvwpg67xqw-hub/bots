import { DatabaseSync } from "node:sqlite";
import path from "node:path";
import fs from "node:fs";
import { logger } from "../lib/logger";

const dataDir = path.resolve(process.cwd(), "data");
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const db = new DatabaseSync(path.join(dataDir, "bot.db"));

export function initDb() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS guild_config (
      guild_id TEXT PRIMARY KEY,
      log_channel TEXT,
      mod_log_channel TEXT,
      jail_role TEXT,
      mute_role TEXT,
      admin_role TEXT,
      mod_role TEXT,
      staff_role TEXT,
      junior_mod_role TEXT,
      trial_mod_role TEXT,
      partner_role TEXT,
      break_role TEXT,
      setup_done INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS command_permissions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      guild_id TEXT NOT NULL,
      command_name TEXT NOT NULL,
      role_id TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS warnings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      guild_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      moderator_id TEXT NOT NULL,
      reason TEXT NOT NULL,
      timestamp INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS ad_warnings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      guild_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      moderator_id TEXT NOT NULL,
      reason TEXT NOT NULL,
      timestamp INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS strikes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      guild_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      moderator_id TEXT NOT NULL,
      reason TEXT NOT NULL,
      timestamp INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS mod_cases (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      guild_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      moderator_id TEXT NOT NULL,
      action TEXT NOT NULL,
      reason TEXT NOT NULL,
      duration TEXT,
      timestamp INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS message_counts (
      guild_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      count INTEGER DEFAULT 0,
      PRIMARY KEY (guild_id, user_id)
    );

    CREATE TABLE IF NOT EXISTS balances (
      guild_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      amount INTEGER DEFAULT 0,
      PRIMARY KEY (guild_id, user_id)
    );

    CREATE TABLE IF NOT EXISTS snipe_cache (
      guild_id TEXT NOT NULL,
      channel_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      username TEXT NOT NULL,
      content TEXT NOT NULL,
      timestamp INTEGER NOT NULL,
      PRIMARY KEY (guild_id, channel_id)
    );

    CREATE TABLE IF NOT EXISTS breaks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      guild_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      reason TEXT NOT NULL,
      started_at INTEGER NOT NULL,
      ended_at INTEGER
    );

    CREATE TABLE IF NOT EXISTS jailed_users (
      guild_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      roles TEXT NOT NULL,
      moderator_id TEXT NOT NULL,
      reason TEXT NOT NULL,
      timestamp INTEGER NOT NULL,
      PRIMARY KEY (guild_id, user_id)
    );

    CREATE TABLE IF NOT EXISTS referral_codes (
      guild_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      code TEXT NOT NULL UNIQUE,
      invite_url TEXT,
      created_at INTEGER NOT NULL,
      PRIMARY KEY (guild_id, user_id)
    );

    CREATE TABLE IF NOT EXISTS referrals (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      guild_id TEXT NOT NULL,
      referrer_id TEXT NOT NULL,
      referred_name TEXT NOT NULL,
      code TEXT NOT NULL,
      joined_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS dashboard_admins (
      user_id TEXT PRIMARY KEY,
      username TEXT NOT NULL,
      granted_by TEXT NOT NULL,
      granted_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS application_forms (
      id TEXT PRIMARY KEY,
      guild_id TEXT NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      questions TEXT NOT NULL,
      channel_id TEXT,
      accept_role TEXT,
      deny_role TEXT,
      created_at INTEGER NOT NULL,
      active INTEGER DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS applications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      form_id TEXT NOT NULL,
      guild_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      username TEXT NOT NULL,
      answers TEXT NOT NULL,
      status TEXT DEFAULT 'pending',
      message_id TEXT,
      submitted_at INTEGER NOT NULL,
      reviewed_at INTEGER,
      reviewer_id TEXT
    );

    CREATE TABLE IF NOT EXISTS application_blacklist (
      user_id TEXT PRIMARY KEY,
      username TEXT NOT NULL,
      reason TEXT NOT NULL DEFAULT '',
      blacklisted_by TEXT NOT NULL,
      blacklisted_at INTEGER NOT NULL
    );
  `);

  logger.info("Database initialized");
}

export function getGuildConfig(guildId: string) {
  const stmt = db.prepare("SELECT * FROM guild_config WHERE guild_id = ?");
  return stmt.get(guildId) as Record<string, string | number> | undefined;
}

export function setGuildConfig(guildId: string, key: string, value: string) {
  const existing = getGuildConfig(guildId);
  if (existing) {
    db.prepare(`UPDATE guild_config SET ${key} = ? WHERE guild_id = ?`).run(value, guildId);
  } else {
    db.prepare(`INSERT INTO guild_config (guild_id, ${key}) VALUES (?, ?)`).run(guildId, value);
  }
}

export function setGuildConfigMulti(guildId: string, fields: Record<string, string | number>) {
  const existing = getGuildConfig(guildId);
  const keys = Object.keys(fields);
  const values = Object.values(fields);
  if (existing) {
    const setClauses = keys.map(k => `${k} = ?`).join(", ");
    db.prepare(`UPDATE guild_config SET ${setClauses} WHERE guild_id = ?`).run(...values, guildId);
  } else {
    const cols = ["guild_id", ...keys].join(", ");
    const placeholders = ["?", ...keys.map(() => "?")].join(", ");
    db.prepare(`INSERT INTO guild_config (${cols}) VALUES (${placeholders})`).run(guildId, ...values);
  }
}

export function getCommandPermissions(guildId: string, commandName: string): string[] {
  const rows = db.prepare(
    "SELECT role_id FROM command_permissions WHERE guild_id = ? AND command_name = ?"
  ).all(guildId, commandName) as { role_id: string }[];
  return rows.map(r => r.role_id);
}

export function setCommandPermission(guildId: string, commandName: string, roleId: string) {
  const exists = db.prepare(
    "SELECT 1 FROM command_permissions WHERE guild_id = ? AND command_name = ? AND role_id = ?"
  ).get(guildId, commandName, roleId);
  if (!exists) {
    db.prepare(
      "INSERT INTO command_permissions (guild_id, command_name, role_id) VALUES (?, ?, ?)"
    ).run(guildId, commandName, roleId);
  }
}

export function removeCommandPermission(guildId: string, commandName: string, roleId: string) {
  db.prepare(
    "DELETE FROM command_permissions WHERE guild_id = ? AND command_name = ? AND role_id = ?"
  ).run(guildId, commandName, roleId);
}

export function addWarning(guildId: string, userId: string, modId: string, reason: string): number {
  const result = db.prepare(
    "INSERT INTO warnings (guild_id, user_id, moderator_id, reason, timestamp) VALUES (?, ?, ?, ?, ?)"
  ).run(guildId, userId, modId, reason, Date.now());
  addModCase(guildId, userId, modId, "warn", reason);
  return result.lastInsertRowid as number;
}

export function getWarnings(guildId: string, userId: string) {
  return db.prepare(
    "SELECT * FROM warnings WHERE guild_id = ? AND user_id = ? ORDER BY timestamp DESC"
  ).all(guildId, userId) as any[];
}

export function getTopWarnedUsers(guildId: string, limit = 10) {
  return db.prepare(
    "SELECT user_id, COUNT(*) as count FROM warnings WHERE guild_id = ? GROUP BY user_id ORDER BY count DESC LIMIT ?"
  ).all(guildId, limit) as any[];
}

export function addAdWarning(guildId: string, userId: string, modId: string, reason: string): number {
  const result = db.prepare(
    "INSERT INTO ad_warnings (guild_id, user_id, moderator_id, reason, timestamp) VALUES (?, ?, ?, ?, ?)"
  ).run(guildId, userId, modId, reason, Date.now());
  addModCase(guildId, userId, modId, "ad-warn", reason);
  return result.lastInsertRowid as number;
}

export function removeAdWarning(guildId: string, adWarnId: number) {
  db.prepare("DELETE FROM ad_warnings WHERE id = ? AND guild_id = ?").run(adWarnId, guildId);
}

export function getAdWarnings(guildId: string, userId: string) {
  return db.prepare(
    "SELECT * FROM ad_warnings WHERE guild_id = ? AND user_id = ? ORDER BY timestamp DESC"
  ).all(guildId, userId) as any[];
}

export function addStrike(guildId: string, userId: string, modId: string, reason: string): number {
  const result = db.prepare(
    "INSERT INTO strikes (guild_id, user_id, moderator_id, reason, timestamp) VALUES (?, ?, ?, ?, ?)"
  ).run(guildId, userId, modId, reason, Date.now());
  addModCase(guildId, userId, modId, "strike", reason);
  return result.lastInsertRowid as number;
}

export function removeStrike(guildId: string, strikeId: number) {
  db.prepare("DELETE FROM strikes WHERE id = ? AND guild_id = ?").run(strikeId, guildId);
}

export function getStrikes(guildId: string, userId: string) {
  return db.prepare(
    "SELECT * FROM strikes WHERE guild_id = ? AND user_id = ? ORDER BY timestamp DESC"
  ).all(guildId, userId) as any[];
}

export function addModCase(guildId: string, userId: string, modId: string, action: string, reason: string, duration?: string) {
  db.prepare(
    "INSERT INTO mod_cases (guild_id, user_id, moderator_id, action, reason, duration, timestamp) VALUES (?, ?, ?, ?, ?, ?, ?)"
  ).run(guildId, userId, modId, action, reason, duration ?? null, Date.now());
}

export function getModCase(guildId: string, caseId: number) {
  return db.prepare(
    "SELECT * FROM mod_cases WHERE id = ? AND guild_id = ?"
  ).get(guildId, caseId) as any;
}

export function getRecentCases(guildId: string, limit = 10) {
  return db.prepare(
    "SELECT * FROM mod_cases WHERE guild_id = ? ORDER BY timestamp DESC LIMIT ?"
  ).all(guildId, limit) as any[];
}

export function incrementMessages(guildId: string, userId: string) {
  db.prepare(`
    INSERT INTO message_counts (guild_id, user_id, count) VALUES (?, ?, 1)
    ON CONFLICT(guild_id, user_id) DO UPDATE SET count = count + 1
  `).run(guildId, userId);
}

export function getMessageCount(guildId: string, userId: string): number {
  const row = db.prepare(
    "SELECT count FROM message_counts WHERE guild_id = ? AND user_id = ?"
  ).get(guildId, userId) as { count: number } | undefined;
  return row?.count ?? 0;
}

export function resetMessageCount(guildId: string, userId: string) {
  db.prepare("DELETE FROM message_counts WHERE guild_id = ? AND user_id = ?").run(guildId, userId);
}

export function resetAllMessageCounts(guildId: string) {
  db.prepare("DELETE FROM message_counts WHERE guild_id = ?").run(guildId);
}

export function getTopMessageUsers(guildId: string, limit = 10) {
  return db.prepare(
    "SELECT user_id, count FROM message_counts WHERE guild_id = ? ORDER BY count DESC LIMIT ?"
  ).all(guildId, limit) as any[];
}

export function getBalance(guildId: string, userId: string): number {
  const row = db.prepare(
    "SELECT amount FROM balances WHERE guild_id = ? AND user_id = ?"
  ).get(guildId, userId) as { amount: number } | undefined;
  return row?.amount ?? 0;
}

export function setBalance(guildId: string, userId: string, amount: number) {
  db.prepare(`
    INSERT INTO balances (guild_id, user_id, amount) VALUES (?, ?, ?)
    ON CONFLICT(guild_id, user_id) DO UPDATE SET amount = ?
  `).run(guildId, userId, amount, amount);
}

export function setSnipe(guildId: string, channelId: string, userId: string, username: string, content: string) {
  db.prepare(`
    INSERT INTO snipe_cache (guild_id, channel_id, user_id, username, content, timestamp)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(guild_id, channel_id) DO UPDATE SET user_id=?, username=?, content=?, timestamp=?
  `).run(guildId, channelId, userId, username, content, Date.now(), userId, username, content, Date.now());
}

export function getSnipe(guildId: string, channelId: string) {
  return db.prepare(
    "SELECT * FROM snipe_cache WHERE guild_id = ? AND channel_id = ?"
  ).get(guildId, channelId) as any;
}

export function startBreak(guildId: string, userId: string, reason: string): number {
  const existing = db.prepare(
    "SELECT id FROM breaks WHERE guild_id = ? AND user_id = ? AND ended_at IS NULL"
  ).get(guildId, userId);
  if (existing) throw new Error("User already on break");
  const result = db.prepare(
    "INSERT INTO breaks (guild_id, user_id, reason, started_at) VALUES (?, ?, ?, ?)"
  ).run(guildId, userId, reason, Date.now());
  return result.lastInsertRowid as number;
}

export function endBreak(guildId: string, userId: string) {
  db.prepare(
    "UPDATE breaks SET ended_at = ? WHERE guild_id = ? AND user_id = ? AND ended_at IS NULL"
  ).run(Date.now(), guildId, userId);
}

export function getCurrentBreaks(guildId: string) {
  return db.prepare(
    "SELECT * FROM breaks WHERE guild_id = ? AND ended_at IS NULL ORDER BY started_at ASC"
  ).all(guildId) as any[];
}

export function jailUser(guildId: string, userId: string, roles: string[], modId: string, reason: string) {
  db.prepare(`
    INSERT OR REPLACE INTO jailed_users (guild_id, user_id, roles, moderator_id, reason, timestamp)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(guildId, userId, JSON.stringify(roles), modId, reason, Date.now());
}

export function unjailUser(guildId: string, userId: string) {
  const row = db.prepare(
    "SELECT roles FROM jailed_users WHERE guild_id = ? AND user_id = ?"
  ).get(guildId, userId) as { roles: string } | undefined;
  if (!row) return null;
  db.prepare("DELETE FROM jailed_users WHERE guild_id = ? AND user_id = ?").run(guildId, userId);
  return JSON.parse(row.roles) as string[];
}

export function isJailed(guildId: string, userId: string): boolean {
  return !!db.prepare(
    "SELECT 1 FROM jailed_users WHERE guild_id = ? AND user_id = ?"
  ).get(guildId, userId);
}

// Referrals
export function getOrCreateReferralCode(guildId: string, userId: string, inviteUrl?: string): string {
  const existing = db.prepare(
    "SELECT code FROM referral_codes WHERE guild_id = ? AND user_id = ?"
  ).get(guildId, userId) as { code: string } | undefined;
  if (existing) {
    if (inviteUrl) db.prepare("UPDATE referral_codes SET invite_url = ? WHERE guild_id = ? AND user_id = ?").run(inviteUrl, guildId, userId);
    return existing.code;
  }
  const code = userId.slice(-6) + Math.random().toString(36).slice(2, 5);
  db.prepare(
    "INSERT INTO referral_codes (guild_id, user_id, code, invite_url, created_at) VALUES (?, ?, ?, ?, ?)"
  ).run(guildId, userId, code, inviteUrl ?? null, Date.now());
  return code;
}

export function getReferralCode(code: string) {
  return db.prepare("SELECT * FROM referral_codes WHERE code = ?").get(code) as {
    guild_id: string; user_id: string; code: string; invite_url: string | null; created_at: number;
  } | undefined;
}

export function getUserReferralCode(guildId: string, userId: string) {
  return db.prepare("SELECT * FROM referral_codes WHERE guild_id = ? AND user_id = ?").get(guildId, userId) as {
    guild_id: string; user_id: string; code: string; invite_url: string | null;
  } | undefined;
}

export function recordReferral(guildId: string, referrerId: string, referredName: string, code: string) {
  db.prepare(
    "INSERT INTO referrals (guild_id, referrer_id, referred_name, code, joined_at) VALUES (?, ?, ?, ?, ?)"
  ).run(guildId, referrerId, referredName, code, Date.now());
}

export function getReferralStats(guildId: string, userId: string) {
  const total = (db.prepare("SELECT COUNT(*) as c FROM referrals WHERE guild_id = ? AND referrer_id = ?").get(guildId, userId) as { c: number }).c;
  const recent = db.prepare(
    "SELECT * FROM referrals WHERE guild_id = ? AND referrer_id = ? ORDER BY joined_at DESC LIMIT 10"
  ).all(guildId, userId) as { id: number; referred_name: string; joined_at: number }[];
  return { total, recent };
}

export function getReferralLeaderboard(guildId: string, limit = 10) {
  return db.prepare(
    "SELECT referrer_id, COUNT(*) as count FROM referrals WHERE guild_id = ? GROUP BY referrer_id ORDER BY count DESC LIMIT ?"
  ).all(guildId, limit) as { referrer_id: string; count: number }[];
}

export function setGuildInviteUrl(guildId: string, inviteUrl: string) {
  setGuildConfigMulti(guildId, { invite_url: inviteUrl } as any);
}

// Dashboard admins
export function addDashboardAdmin(userId: string, username: string, grantedBy: string) {
  db.prepare(`
    INSERT OR REPLACE INTO dashboard_admins (user_id, username, granted_by, granted_at)
    VALUES (?, ?, ?, ?)
  `).run(userId, username, grantedBy, Date.now());
}

export function removeDashboardAdmin(userId: string) {
  db.prepare("DELETE FROM dashboard_admins WHERE user_id = ?").run(userId);
}

export function isDashboardAdmin(userId: string): boolean {
  return !!db.prepare("SELECT 1 FROM dashboard_admins WHERE user_id = ?").get(userId);
}

export function getDashboardAdmins() {
  return db.prepare("SELECT * FROM dashboard_admins ORDER BY granted_at DESC").all() as {
    user_id: string; username: string; granted_by: string; granted_at: number;
  }[];
}

// Application forms
export function createForm(id: string, guildId: string, name: string, description: string, questions: string[], channelId?: string, acceptRole?: string, denyRole?: string) {
  db.prepare(`
    INSERT INTO application_forms (id, guild_id, name, description, questions, channel_id, accept_role, deny_role, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, guildId, name, description, JSON.stringify(questions), channelId ?? null, acceptRole ?? null, denyRole ?? null, Date.now());
}

export function updateForm(id: string, fields: Partial<{ name: string; description: string; questions: string[]; channel_id: string; accept_role: string; deny_role: string; active: number }>) {
  const updates = Object.entries(fields).map(([k, v]) => `${k} = ?`).join(", ");
  const values = Object.values(fields).map(v => Array.isArray(v) ? JSON.stringify(v) : v);
  db.prepare(`UPDATE application_forms SET ${updates} WHERE id = ?`).run(...values, id);
}

export function deleteForm(id: string) {
  db.prepare("DELETE FROM application_forms WHERE id = ?").run(id);
}

export function getForm(id: string) {
  const row = db.prepare("SELECT * FROM application_forms WHERE id = ?").get(id) as any;
  if (!row) return null;
  row.questions = JSON.parse(row.questions);
  return row;
}

export function getGuildForms(guildId: string) {
  const rows = db.prepare(
    "SELECT * FROM application_forms WHERE guild_id = ? ORDER BY created_at DESC"
  ).all(guildId) as any[];
  return rows.map(r => ({ ...r, questions: JSON.parse(r.questions) }));
}

export function submitApplication(formId: string, guildId: string, userId: string, username: string, answers: Record<string, string>): number {
  const result = db.prepare(`
    INSERT INTO applications (form_id, guild_id, user_id, username, answers, submitted_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(formId, guildId, userId, username, JSON.stringify(answers), Date.now());
  return result.lastInsertRowid as number;
}

export function updateApplicationStatus(id: number, status: "accepted" | "denied", reviewerId: string, messageId?: string) {
  db.prepare(`
    UPDATE applications SET status = ?, reviewer_id = ?, reviewed_at = ?, message_id = COALESCE(?, message_id)
    WHERE id = ?
  `).run(status, reviewerId, Date.now(), messageId ?? null, id);
}

export function setApplicationMessageId(id: number, messageId: string) {
  db.prepare("UPDATE applications SET message_id = ? WHERE id = ?").run(messageId, id);
}

export function getApplication(id: number) {
  const row = db.prepare("SELECT * FROM applications WHERE id = ?").get(id) as any;
  if (!row) return null;
  row.answers = JSON.parse(row.answers);
  return row;
}

export function getFormApplications(formId: string) {
  const rows = db.prepare(
    "SELECT * FROM applications WHERE form_id = ? ORDER BY submitted_at DESC"
  ).all(formId) as any[];
  return rows.map(r => ({ ...r, answers: JSON.parse(r.answers) }));
}

export function getAllApplications(guildId: string) {
  const rows = db.prepare(
    "SELECT a.*, f.name as form_name FROM applications a JOIN application_forms f ON a.form_id = f.id WHERE a.guild_id = ? ORDER BY a.submitted_at DESC"
  ).all(guildId) as any[];
  return rows.map(r => ({ ...r, answers: JSON.parse(r.answers) }));
}

export function getUserApplications(userId: string) {
  const rows = db.prepare(
    "SELECT a.*, f.name as form_name FROM applications a JOIN application_forms f ON a.form_id = f.id WHERE a.user_id = ? ORDER BY a.submitted_at DESC"
  ).all(userId) as any[];
  return rows.map(r => ({ ...r, answers: JSON.parse(r.answers) }));
}

export function getAllActiveForms() {
  const rows = db.prepare(
    "SELECT * FROM application_forms WHERE active = 1 ORDER BY created_at DESC"
  ).all() as any[];
  return rows.map(r => ({ ...r, questions: JSON.parse(r.questions) }));
}

export function blacklistUser(userId: string, username: string, reason: string, blacklistedBy: string) {
  db.prepare(
    "INSERT INTO application_blacklist (user_id, username, reason, blacklisted_by, blacklisted_at) VALUES (?, ?, ?, ?, ?) ON CONFLICT(user_id) DO UPDATE SET username=excluded.username, reason=excluded.reason, blacklisted_by=excluded.blacklisted_by, blacklisted_at=excluded.blacklisted_at"
  ).run(userId, username, reason, blacklistedBy, Date.now());
}

export function unblacklistUser(userId: string) {
  db.prepare("DELETE FROM application_blacklist WHERE user_id = ?").run(userId);
}

export function isBlacklisted(userId: string): boolean {
  return !!(db.prepare("SELECT 1 FROM application_blacklist WHERE user_id = ?").get(userId));
}

export function getBlacklist() {
  return db.prepare("SELECT * FROM application_blacklist ORDER BY blacklisted_at DESC").all() as {
    user_id: string; username: string; reason: string; blacklisted_by: string; blacklisted_at: number;
  }[];
}

export default db;
