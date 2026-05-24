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
   ROLE ACCESS GATE (GLOBAL)
─────────────────────── */
const allowedRoles = ["HRTL", "~~~staff~~~"];

function hasModAccess(member) {
  return member.roles.cache.some(role =>
    allowedRoles.includes(role.name)
  );
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
    .setDescription("Warn a user and apply an automatic escalating timeout")
    .addUserOption(o => o.setName("user").setDescription("User to warn").setRequired(true))
    .addStringOption(o => o.setName("reason").setDescription("Reason").setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

  async execute(i) {
    if (!hasModAccess(i.member)) return silentFail(i);

    const u = i.options.getUser("user");
    const r = i.options.getString("reason");

    const member = await i.guild.members.fetch(u.id);
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

    const embed = new EmbedBuilder()
      .setColor(0xffcc00)
      .setTitle("⚠️ USER WARNED")
      .setThumbnail(u.displayAvatarURL())
      .addFields(
        { name: "User", value: `${u} (${u.tag})`, inline: true },
        { name: "Moderator", value: `${i.user}`, inline: true },
        { name: "Case", value: `#${caseId}`, inline: true },
        { name: "Total Warnings", value: `${count}`, inline: true },
        { name: "Timeout", value: `${mins} minutes`, inline: true },
        { name: "Reason", value: r }
      )
      .setTimestamp();

    await logTo(i.guild, "logsChannel", embed);
    await i.reply({ embeds: [embed] });
  }
});

/* ───────────────────────
   AD-WARN
─────────────────────── */
moderationCommands.push({
  data: new SlashCommandBuilder()
    .setName("ad-warn")
    .setDescription("Issue an advertisement violation warning (5-min timeout)")
    .addUserOption(o => o.setName("user").setDescription("User").setRequired(true))
    .addStringOption(o => o.setName("reason").setDescription("Reason").setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

  async execute(i) {
    if (!hasModAccess(i.member)) return silentFail(i);

    const u = i.options.getUser("user");
    const r = i.options.getString("reason");

    const member = await i.guild.members.fetch(u.id);

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

    const embed = new EmbedBuilder()
      .setColor(0xff5500)
      .setTitle("📢 AD VIOLATION WARNING")
      .setThumbnail(u.displayAvatarURL())
      .addFields(
        { name: "User", value: `${u} (${u.tag})`, inline: true },
        { name: "Moderator", value: `${i.user}`, inline: true },
        { name: "Case", value: `#${caseId}`, inline: true },
        { name: "Timeout", value: "5 minutes", inline: true },
        { name: "Reason", value: r }
      )
      .setTimestamp();

    await logTo(i.guild, "adsChannel", embed);
    await logTo(i.guild, "logsChannel", embed);
    await i.reply({ embeds: [embed] });
  }
});

/* ───────────────────────
   KICK
─────────────────────── */
moderationCommands.push({
  data: new SlashCommandBuilder()
    .setName("kick")
    .setDescription("Kick a member from the server")
    .addUserOption(o => o.setName("user").setDescription("User").setRequired(true))
    .addStringOption(o => o.setName("reason").setDescription("Reason").setRequired(false))
    .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers),

  async execute(i) {
    if (!hasModAccess(i.member)) return silentFail(i);

    const u = i.options.getUser("user");
    const r = i.options.getString("reason") ?? "No reason provided";

    const member = await i.guild.members.fetch(u.id).catch(() => null);
    if (!member) return i.reply({ content: "❌ User not found.", ephemeral: true });

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

    const embed = new EmbedBuilder()
      .setColor(0xe67e22)
      .setTitle("👢 MEMBER KICKED")
      .setThumbnail(u.displayAvatarURL())
      .addFields(
        { name: "User", value: `${u} (${u.tag})`, inline: true },
        { name: "Moderator", value: `${i.user}`, inline: true },
        { name: "Case", value: `#${caseId}`, inline: true },
        { name: "Reason", value: r }
      )
      .setTimestamp();

    await logTo(i.guild, "logsChannel", embed);
    await i.reply({ embeds: [embed] });
  }
});

/* ───────────────────────
   MUTE
─────────────────────── */
moderationCommands.push({
  data: new SlashCommandBuilder()
    .setName("mute")
    .setDescription("Timeout a user for a specified duration")
    .addUserOption(o => o.setName("user").setDescription("User").setRequired(true))
    .addIntegerOption(o => o.setName("minutes").setDescription("Duration").setMinValue(1).setMaxValue(10080).setRequired(true))
    .addStringOption(o => o.setName("reason").setDescription("Reason"))
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

  async execute(i) {
    if (!hasModAccess(i.member)) return silentFail(i);

    const u = i.options.getUser("user");
    const mins = i.options.getInteger("minutes");
    const r = i.options.getString("reason") ?? "No reason provided";

    const member = await i.guild.members.fetch(u.id).catch(() => null);
    if (!member) return i.reply({ content: "❌ User not found.", ephemeral: true });

    await member.timeout(mins * 60000, r);

    const caseId = addCase({
      guildId: i.guild.id,
      type: "MUTE",
      userId: u.id,
      userTag: u.tag,
      modId: i.user.id,
      modTag: i.user.tag,
      reason: `${mins} min — ${r}`,
    });

    const embed = new EmbedBuilder()
      .setColor(0xe74c3c)
      .setTitle("🔇 USER MUTED")
      .addFields(
        { name: "User", value: `${u} (${u.tag})`, inline: true },
        { name: "Moderator", value: `${i.user}`, inline: true },
        { name: "Case", value: `#${caseId}`, inline: true },
        { name: "Duration", value: `${mins} minute(s)`, inline: true },
        { name: "Reason", value: r }
      )
      .setTimestamp();

    await logTo(i.guild, "logsChannel", embed);
    await i.reply({ embeds: [embed] });
  }
});

/* ───────────────────────
   UNMUTE
─────────────────────── */
moderationCommands.push({
  data: new SlashCommandBuilder()
    .setName("unmute")
    .setDescription("Remove timeout")
    .addUserOption(o => o.setName("user").setDescription("User").setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

  async execute(i) {
    if (!hasModAccess(i.member)) return silentFail(i);

    const u = i.options.getUser("user");

    const member = await i.guild.members.fetch(u.id).catch(() => null);
    if (!member) return i.reply({ content: "❌ User not found.", ephemeral: true });

    await member.timeout(null);

    addCase({
      guildId: i.guild.id,
      type: "UNMUTE",
      userId: u.id,
      userTag: u.tag,
      modId: i.user.id,
      modTag: i.user.tag,
      reason: "Timeout removed",
    });

    const embed = new EmbedBuilder()
      .setColor(0x2ecc71)
      .setTitle("🔊 USER UNMUTED")
      .setThumbnail(u.displayAvatarURL())
      .addFields(
        { name: "User", value: `${u} (${u.tag})`, inline: true },
        { name: "Moderator", value: `${i.user}`, inline: true }
      )
      .setTimestamp();

    await logTo(i.guild, "logsChannel", embed);
    await i.reply({ embeds: [embed] });
  }
});

/* ───────────────────────
   BAN
─────────────────────── */
moderationCommands.push({
  data: new SlashCommandBuilder()
    .setName("ban")
    .setDescription("Ban a member from the server")
    .addUserOption(o => o.setName("user").setDescription("User").setRequired(true))
    .addStringOption(o => o.setName("reason").setDescription("Reason").setRequired(true))
    .addIntegerOption(o => o.setName("delete-days").setDescription("0-7").setMinValue(0).setMaxValue(7))
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers),

  async execute(i) {
    if (!hasModAccess(i.member)) return silentFail(i);

    const u = i.options.getUser("user");
    const r = i.options.getString("reason");
    const days = i.options.getInteger("delete-days") ?? 0;

    await i.guild.members.ban(u.id, { reason: r, deleteMessageDays: days });

    const caseId = addCase({
      guildId: i.guild.id,
      type: "BAN",
      userId: u.id,
      userTag: u.tag,
      modId: i.user.id,
      modTag: i.user.tag,
      reason: r,
    });

    const embed = new EmbedBuilder()
      .setColor(0xff0000)
      .setTitle("🔨 MEMBER BANNED")
      .addFields(
        { name: "User", value: `${u} (${u.tag})`, inline: true },
        { name: "Moderator", value: `${i.user}`, inline: true },
        { name: "Case", value: `#${caseId}`, inline: true },
        { name: "Reason", value: r }
      )
      .setTimestamp();

    await logTo(i.guild, "logsChannel", embed);
    await i.reply({ embeds: [embed] });
  }
});

export { moderationCommands };