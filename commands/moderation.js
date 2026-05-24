import {
  SlashCommandBuilder,
  EmbedBuilder,
  PermissionFlagsBits,
} from "discord.js";

import { loadJSON, saveJSON } from "../storage.js";
import { addCase } from "../modlog.js";
import {
  addWarn,
  warnTime,
  logTo,
  setupFile,
  warnFile,
  jailFile
} from "./helpers.js";

export const moderationCommands = [];

/* ───────────────────────
   ROLE ACCESS CONTROL
─────────────────────── */
const allowedRoles = ["HRTL", "~~~staff~~~"];

function hasModAccess(member) {
  return member?.roles?.cache?.some(r => allowedRoles.includes(r.name));
}

function silentFail(i) {
  return i.reply({
    content: "This application did not respond.",
    ephemeral: true,
  });
}

/* ───────────────────────
   WARN
─────────────────────── */
moderationCommands.push({
  data: new SlashCommandBuilder()
    .setName("warn")
    .setDescription("Warn a user")
    .addUserOption(o => o.setName("user").setDescription("User").setRequired(true))
    .addStringOption(o => o.setName("reason").setDescription("Reason").setRequired(true)),

  async execute(i) {
    if (!hasModAccess(i.member)) return silentFail(i);

    const u = i.options.getUser("user");
    const r = i.options.getString("reason");

    const member = await i.guild.members.fetch(u.id).catch(() => null);
    if (!member) return i.reply({ content: "User not found", ephemeral: true });

    const count = addWarn(u.id);
    const mins = warnTime(count);

    await member.timeout(mins * 60000, r);

    const caseId = addCase({
      guildId: i.guild.id,
      type: "WARN",
      userId: u.id,
      userTag: u.tag,
      modId: i.user.id,
      modTag: i.user.tag,
      reason: r,
    });

    await logTo(i.guild, "logsChannel", new EmbedBuilder()
      .setColor(0xffcc00)
      .setTitle("WARN")
      .addFields(
        { name: "User", value: u.tag, inline: true },
        { name: "Case", value: `#${caseId}`, inline: true },
        { name: "Warnings", value: `${count}`, inline: true },
        { name: "Reason", value: r }
      )
    );

    await i.reply({ content: `Warned ${u.tag} (#${caseId})`, ephemeral: true });
  }
});

/* ───────────────────────
   AD-WARN
─────────────────────── */
moderationCommands.push({
  data: new SlashCommandBuilder()
    .setName("ad-warn")
    .setDescription("Ad warning (5 min timeout)")
    .addUserOption(o => o.setName("user").setDescription("User").setRequired(true))
    .addStringOption(o => o.setName("reason").setDescription("Reason").setRequired(true)),

  async execute(i) {
    if (!hasModAccess(i.member)) return silentFail(i);

    const u = i.options.getUser("user");
    const r = i.options.getString("reason");

    const member = await i.guild.members.fetch(u.id).catch(() => null);
    if (!member) return i.reply({ content: "User not found", ephemeral: true });

    await member.timeout(5 * 60000, r);

    const caseId = addCase({
      guildId: i.guild.id,
      type: "AD-WARN",
      userId: u.id,
      userTag: u.tag,
      modId: i.user.id,
      modTag: i.user.tag,
      reason: r,
    });

    await logTo(i.guild, "logsChannel", new EmbedBuilder()
      .setColor(0xff5500)
      .setTitle("AD WARN")
      .addFields(
        { name: "User", value: u.tag, inline: true },
        { name: "Case", value: `#${caseId}`, inline: true },
        { name: "Reason", value: r }
      )
    );

    await i.reply({ content: `Ad warned ${u.tag}`, ephemeral: true });
  }
});

/* ───────────────────────
   MUTE
─────────────────────── */
moderationCommands.push({
  data: new SlashCommandBuilder()
    .setName("mute")
    .setDescription("Mute a user")
    .addUserOption(o => o.setName("user").setDescription("User").setRequired(true))
    .addIntegerOption(o => o.setName("minutes").setDescription("Minutes").setRequired(true))
    .addStringOption(o => o.setName("reason").setDescription("Reason")),

  async execute(i) {
    if (!hasModAccess(i.member)) return silentFail(i);

    const u = i.options.getUser("user");
    const m = i.options.getInteger("minutes");
    const r = i.options.getString("reason") ?? "No reason";

    const member = await i.guild.members.fetch(u.id).catch(() => null);
    if (!member) return i.reply({ content: "User not found", ephemeral: true });

    await member.timeout(m * 60000, r);

    const caseId = addCase({
      guildId: i.guild.id,
      type: "MUTE",
      userId: u.id,
      userTag: u.tag,
      modId: i.user.id,
      modTag: i.user.tag,
      reason: `${m}m - ${r}`,
    });

    await i.reply({ content: `Muted ${u.tag} (#${caseId})`, ephemeral: true });
  }
});

/* ───────────────────────
   UNMUTE
─────────────────────── */
moderationCommands.push({
  data: new SlashCommandBuilder()
    .setName("unmute")
    .setDescription("Unmute a user")
    .addUserOption(o => o.setName("user").setDescription("User").setRequired(true)),

  async execute(i) {
    if (!hasModAccess(i.member)) return silentFail(i);

    const u = i.options.getUser("user");
    const member = await i.guild.members.fetch(u.id).catch(() => null);
    if (!member) return i.reply({ content: "User not found", ephemeral: true });

    await member.timeout(null);

    addCase({
      guildId: i.guild.id,
      type: "UNMUTE",
      userId: u.id,
      userTag: u.tag,
      modId: i.user.id,
      modTag: i.user.tag,
      reason: "Unmuted",
    });

    await i.reply({ content: `Unmuted ${u.tag}`, ephemeral: true });
  }
});

/* ───────────────────────
   KICK
─────────────────────── */
moderationCommands.push({
  data: new SlashCommandBuilder()
    .setName("kick")
    .setDescription("Kick user")
    .addUserOption(o => o.setName("user").setDescription("User").setRequired(true))
    .addStringOption(o => o.setName("reason").setDescription("Reason")),

  async execute(i) {
    if (!hasModAccess(i.member)) return silentFail(i);

    const u = i.options.getUser("user");
    const r = i.options.getString("reason") ?? "No reason";

    const member = await i.guild.members.fetch(u.id).catch(() => null);
    if (!member) return i.reply({ content: "User not found", ephemeral: true });

    await member.kick(r);

    const caseId = addCase({
      guildId: i.guild.id,
      type: "KICK",
      userId: u.id,
      userTag: u.tag,
      modId: i.user.id,
      modTag: i.user.tag,
      reason: r,
    });

    await i.reply({ content: `Kicked ${u.tag} (#${caseId})`, ephemeral: true });
  }
});

/* ───────────────────────
   BAN
─────────────────────── */
moderationCommands.push({
  data: new SlashCommandBuilder()
    .setName("ban")
    .setDescription("Ban user")
    .addUserOption(o => o.setName("user").setDescription("User").setRequired(true))
    .addStringOption(o => o.setName("reason").setDescription("Reason").setRequired(true)),

  async execute(i) {
    if (!hasModAccess(i.member)) return silentFail(i);

    const u = i.options.getUser("user");
    const r = i.options.getString("reason");

    await i.guild.members.ban(u.id, { reason: r });

    const caseId = addCase({
      guildId: i.guild.id,
      type: "BAN",
      userId: u.id,
      userTag: u.tag,
      modId: i.user.id,
      modTag: i.user.tag,
      reason: r,
    });

    await i.reply({ content: `Banned ${u.tag} (#${caseId})`, ephemeral: true });
  }
});

/* ───────────────────────
   UNBAN
─────────────────────── */
moderationCommands.push({
  data: new SlashCommandBuilder()
    .setName("unban")
    .setDescription("Unban user")
    .addStringOption(o => o.setName("userid").setDescription("User ID").setRequired(true)),

  async execute(i) {
    if (!hasModAccess(i.member)) return silentFail(i);

    const id = i.options.getString("userid");

    const removed = await i.guild.bans.remove(id).catch(() => null);
    if (!removed) return i.reply({ content: "Invalid ID or not banned", ephemeral: true });

    addCase({
      guildId: i.guild.id,
      type: "UNBAN",
      userId: id,
      userTag: id,
      modId: i.user.id,
      modTag: i.user.tag,
      reason: "Unbanned",
    });

    await i.reply({ content: `Unbanned ${id}`, ephemeral: true });
  }
});

/* ───────────────────────
   JAIL
─────────────────────── */
moderationCommands.push({
  data: new SlashCommandBuilder()
    .setName("jail")
    .setDescription("Jail user")
    .addUserOption(o => o.setName("user").setDescription("User").setRequired(true))
    .addStringOption(o => o.setName("reason").setDescription("Reason")),

  async execute(i) {
    if (!hasModAccess(i.member)) return silentFail(i);

    const cfg = loadJSON(setupFile);
    const u = i.options.getUser("user");
    const r = i.options.getString("reason") ?? "No reason";

    const member = await i.guild.members.fetch(u.id).catch(() => null);
    if (!member) return i.reply({ content: "User not found", ephemeral: true });

    if (!cfg.jailRole) return i.reply({ content: "Jail role not set", ephemeral: true });

    await member.roles.add(cfg.jailRole);

    const jailData = loadJSON(jailFile);
    jailData[u.id] = { reason: r };
    saveJSON(jailFile, jailData);

    const caseId = addCase({
      guildId: i.guild.id,
      type: "JAIL",
      userId: u.id,
      userTag: u.tag,
      modId: i.user.id,
      modTag: i.user.tag,
      reason: r,
    });

    await i.reply({ content: `Jailed ${u.tag} (#${caseId})`, ephemeral: true });
  }
});

/* ───────────────────────
   UNJAIL
─────────────────────── */
moderationCommands.push({
  data: new SlashCommandBuilder()
    .setName("unjail")
    .setDescription("Unjail user")
    .addUserOption(o => o.setName("user").setDescription("User").setRequired(true)),

  async execute(i) {
    if (!hasModAccess(i.member)) return silentFail(i);

    const cfg = loadJSON(setupFile);
    const u = i.options.getUser("user");

    const member = await i.guild.members.fetch(u.id).catch(() => null);
    if (!member) return i.reply({ content: "User not found", ephemeral: true });

    if (!cfg.jailRole) return i.reply({ content: "Jail role not set", ephemeral: true });

    await member.roles.remove(cfg.jailRole);

    const jailData = loadJSON(jailFile);
    delete jailData[u.id];
    saveJSON(jailFile, jailData);

    await i.reply({ content: `Unjailed ${u.tag}`, ephemeral: true });
  }
});