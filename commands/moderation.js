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
   ACCESS CONTROL
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
   SAFE TARGET CHECKS
─────────────────────── */
function safeTargetCheck(i, u, action) {
  if (u.id === i.user.id) {
    return i.reply({
      content: `❌ You cannot ${action} yourself.`,
      ephemeral: true,
    });
  }

  if (u.bot) {
    return i.reply({
      content: `❌ You cannot ${action} bots.`,
      ephemeral: true,
    });
  }

  return null;
}

/* ───────────────────────
   WARN
─────────────────────── */
moderationCommands.push({
  data: new SlashCommandBuilder()
    .setName("warn")
    .setDescription("Warn a user")
    .addUserOption(o => o.setName("user").setDescription("User").setRequired(true))
    .addStringOption(o => o.setName("reason").setDescription("Reason").setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

  async execute(i) {
    if (!hasModAccess(i.member)) return silentFail(i);

    const u = i.options.getUser("user");
    const r = i.options.getString("reason");

    const fail = safeTargetCheck(i, u, "warn");
    if (fail) return fail;

    const member = await i.guild.members.fetch(u.id).catch(() => null);
    if (!member) return i.reply({ content: "❌ User not found.", ephemeral: true });

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
      .addFields(
        { name: "User", value: `${u} (${u.tag})`, inline: true },
        { name: "Moderator", value: `${i.user}`, inline: true },
        { name: "Case", value: `#${caseId}`, inline: true },
        { name: "Warnings", value: `${count}`, inline: true },
        { name: "Timeout", value: `${mins} min`, inline: true },
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
    .setDescription("Advertisement warning (5 min timeout)")
    .addUserOption(o => o.setName("user").setRequired(true))
    .addStringOption(o => o.setName("reason").setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

  async execute(i) {
    if (!hasModAccess(i.member)) return silentFail(i);

    const u = i.options.getUser("user");
    const r = i.options.getString("reason");

    const fail = safeTargetCheck(i, u, "warn");
    if (fail) return fail;

    const member = await i.guild.members.fetch(u.id).catch(() => null);
    if (!member) return i.reply({ content: "❌ User not found.", ephemeral: true });

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
      .addFields(
        { name: "User", value: `${u} (${u.tag})`, inline: true },
        { name: "Moderator", value: `${i.user}`, inline: true },
        { name: "Case", value: `#${caseId}`, inline: true },
        { name: "Timeout", value: "5 min", inline: true },
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
    .setDescription("Kick a member")
    .addUserOption(o => o.setName("user").setRequired(true))
    .addStringOption(o => o.setName("reason"))
    .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers),

  async execute(i) {
    if (!hasModAccess(i.member)) return silentFail(i);

    const u = i.options.getUser("user");
    const r = i.options.getString("reason") ?? "No reason";

    const fail = safeTargetCheck(i, u, "kick");
    if (fail) return fail;

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
      .setTitle("👢 KICKED")
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
    .setDescription("Timeout a user")
    .addUserOption(o => o.setName("user").setRequired(true))
    .addIntegerOption(o => o.setName("minutes").setMinValue(1).setMaxValue(10080).setRequired(true))
    .addStringOption(o => o.setName("reason"))
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

  async execute(i) {
    if (!hasModAccess(i.member)) return silentFail(i);

    const u = i.options.getUser("user");
    const mins = i.options.getInteger("minutes");
    const r = i.options.getString("reason") ?? "No reason";

    const fail = safeTargetCheck(i, u, "mute");
    if (fail) return fail;

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
      .setTitle("🔇 MUTED")
      .addFields(
        { name: "User", value: `${u} (${u.tag})`, inline: true },
        { name: "Moderator", value: `${i.user}`, inline: true },
        { name: "Case", value: `#${caseId}`, inline: true },
        { name: "Duration", value: `${mins} min`, inline: true },
        { name: "Reason", value: r }
      )
      .setTimestamp();

    await logTo(i.guild, "logsChannel", embed);
    await i.reply({ embeds: [embed] });
  }
});