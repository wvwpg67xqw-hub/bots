import {
  EmbedBuilder,
  type GuildMember,
  type ChatInputCommandInteraction,
  Colors,
} from "discord.js";
import { getGuildConfig, getCommandPermissions } from "./database";

export function parseDuration(str: string): number | null {
  const match = str.match(/^(\d+)(s|m|h|d|w)$/);
  if (!match) return null;
  const num = parseInt(match[1]);
  const unit = match[2];
  const multipliers: Record<string, number> = { s: 1000, m: 60000, h: 3600000, d: 86400000, w: 604800000 };
  return num * multipliers[unit];
}

export function formatDuration(ms: number): string {
  if (ms < 60000) return `${Math.floor(ms / 1000)}s`;
  if (ms < 3600000) return `${Math.floor(ms / 60000)}m`;
  if (ms < 86400000) return `${Math.floor(ms / 3600000)}h`;
  if (ms < 604800000) return `${Math.floor(ms / 86400000)}d`;
  return `${Math.floor(ms / 604800000)}w`;
}

export function formatTimestamp(ts: number): string {
  return `<t:${Math.floor(ts / 1000)}:R>`;
}

export function successEmbed(description: string, title?: string) {
  const e = new EmbedBuilder().setColor(Colors.Green).setDescription(description);
  if (title) e.setTitle(title);
  return e;
}

export function errorEmbed(description: string) {
  return new EmbedBuilder().setColor(Colors.Red).setDescription(`❌ ${description}`);
}

export function infoEmbed(description: string, title?: string) {
  const e = new EmbedBuilder().setColor(Colors.Blurple).setDescription(description);
  if (title) e.setTitle(title);
  return e;
}

export function warnEmbed(description: string, title?: string) {
  const e = new EmbedBuilder().setColor(Colors.Yellow).setDescription(description);
  if (title) e.setTitle(title);
  return e;
}

export async function checkPermissions(
  interaction: ChatInputCommandInteraction,
  commandName: string
): Promise<boolean> {
  if (!interaction.guild || !interaction.member) return false;
  const member = interaction.member as GuildMember;

  // Admins bypass all checks
  if (member.permissions.has("Administrator")) return true;

  // Check admin role from config
  const config = getGuildConfig(interaction.guild.id);
  if (config?.admin_role && member.roles.cache.has(config.admin_role as string)) return true;

  // Open commands - no permission check
  const openCommands = ["warns", "messages", "balance", "snipe", "warn-leaderboard", "message-leaderboard", "current-breaks", "case-info"];
  if (openCommands.includes(commandName)) return true;

  // Check command-specific role permissions
  const allowedRoles = getCommandPermissions(interaction.guild.id, commandName);
  if (allowedRoles.length > 0) {
    return allowedRoles.some(roleId => member.roles.cache.has(roleId));
  }

  // Default: check mod/staff roles from config
  const modRoles = [
    config?.mod_role,
    config?.staff_role,
    config?.junior_mod_role,
    config?.trial_mod_role,
  ].filter(Boolean) as string[];

  return modRoles.some(roleId => member.roles.cache.has(roleId));
}

export function generateId(): string {
  return Math.random().toString(36).substring(2, 10) + Date.now().toString(36);
}
