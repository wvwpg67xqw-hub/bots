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
  return member.roles.cache.some(r => allowedRoles.includes(r.name));
}

function silentFail(i) {
  return i.reply({
    content: "This application did not respond.",
    ephemeral: true,
  });
}

function safeCheck(i, u, action) {
  if (u.id === i.user.id) {
    return i.reply({ content: `❌ You cannot ${action} yourself.`, ephemeral: true });
  }
  if (u.bot) {
    return i.reply({ content: `❌ You cannot ${action} bots.`, ephemeral: true });
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
    .addUserOption(o => o.setName("user").setRequired(true))
    .addStringOption(o => o.setName("reason").setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

  async execute(i) {
    if (!hasModAccess(i.member)) return silentFail(i);

    const u = i.options.getUser("user");
    const r = i.options.getString("reason");

    const fail = safeCheck(i, u, "warn");
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

    await logTo(i.guild, "logsChannel",
      new EmbedBuilder()
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
        .setTimestamp()
    );

    return i.reply({ content: `⚠️ Warned ${u.tag}`, ephemeral: true });
  }
});

/* ───────────────────────
   AD-WARN
─────────────────────── */
moderationCommands.push({
  data: new SlashCommandBuilder()
    .setName("ad-warn")
    .setDescription("Ad violation warning (5 min timeout)")
    .addUserOption(o => o.setName("user").setRequired(true))
    .addStringOption(o => o.setName("reason").setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

  async execute(i) {
    if (!hasModAccess(i.member)) return silentFail(i);

    const u = i.options.getUser("user");
    const r = i.options.getString("reason");

    const fail = safeCheck(i, u, "warn");
    if (fail) return fail;

    const member = await i.guild.members.fetch(u.id).catch(() => null);
    if (!member) return i.reply({ content: "❌ User not found.", ephemeral: true });

    await member.timeout(5 * 60000, r);

    addCase({
      guildId: i.guild.id,
      type: "AD-WARN",
      userId: u.id,
      userTag: u.tag,
      modId: i.user.id,
      modTag: i.user.tag,
      reason: r,
    });

    await logTo(i.guild, "logsChannel",
      new EmbedBuilder()
        .setColor(0xff5500)
        .setTitle("📢 AD WARN")
        .addFields(
          { name: "User", value: `${u}` },
          { name: "Moderator", value: `${i.user}` },
          { name: "Reason", value: r }
        )
        .setTimestamp()
    );

    await i.reply({ content: `📢 Ad-warned ${u.tag}`, ephemeral: true });
  }
});

/* ───────────────────────
   KICK
─────────────────────── */
moderationCommands.push({
  data: new SlashCommandBuilder()
    .setName("kick")
    .setDescription("Kick user")
    .addUserOption(o => o.setRequired(true))
    .addStringOption(o => o.setName("reason"))
    .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers),

  async execute(i) {
    if (!hasModAccess(i.member)) return silentFail(i);

    const u = i.options.getUser("user");
    const r = i.options.getString("reason") ?? "No reason";

    const fail = safeCheck(i, u, "kick");
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

    await logTo(i.guild, "logsChannel",
      new EmbedBuilder()
        .setColor(0xe67e22)
        .setTitle("👢 KICKED")
        .addFields(
          { name: "User", value: `${u}` },
          { name: "Case", value: `#${caseId}` },
          { name: "Reason", value: r }
        )
        .setTimestamp()
    );

    return i.reply({ content: `👢 Kicked ${u.tag}`, ephemeral: true });
  }
});

/* ───────────────────────
   MUTE / UNMUTE
─────────────────────── */
moderationCommands.push({
  data: new SlashCommandBuilder()
    .setName("mute")
    .setDescription("Timeout user")
    .addUserOption(o => o.setRequired(true))
    .addIntegerOption(o => o.setMinValue(1).setMaxValue(10080).setRequired(true))
    .addStringOption(o => o.setName("reason"))
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

  async execute(i) {
    if (!hasModAccess(i.member)) return silentFail(i);

    const u = i.options.getUser("user");
    const mins = i.options.getInteger("minutes");
    const r = i.options.getString("reason") ?? "No reason";

    const fail = safeCheck(i, u, "mute");
    if (fail) return fail;

    const member = await i.guild.members.fetch(u.id).catch(() => null);
    if (!member) return i.reply({ content: "❌ User not found.", ephemeral: true });

    await member.timeout(mins * 60000, r);

    await i.reply({ content: `🔇 Muted ${u.tag}`, ephemeral: true });
  }
});

moderationCommands.push({
  data: new SlashCommandBuilder()
    .setName("unmute")
    .setDescription("Remove timeout")
    .addUserOption(o => o.setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

  async execute(i) {
    if (!hasModAccess(i.member)) return silentFail(i);

    const u = i.options.getUser("user");

    const member = await i.guild.members.fetch(u.id).catch(() => null);
    if (!member) return i.reply({ content: "❌ User not found.", ephemeral: true });

    await member.timeout(null);

    return i.reply({ content: `🔊 Unmuted ${u.tag}`, ephemeral: true });
  }
});

/* ───────────────────────
   BAN / UNBAN
─────────────────────── */
moderationCommands.push({
  data: new SlashCommandBuilder()
    .setName("ban")
    .setDescription("Ban user")
    .addUserOption(o => o.setRequired(true))
    .addStringOption(o => o.setName("reason"))
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers),

  async execute(i) {
    if (!hasModAccess(i.member)) return silentFail(i);

    const u = i.options.getUser("user");
    const r = i.options.getString("reason") ?? "No reason";

    const fail = safeCheck(i, u, "ban");
    if (fail) return fail;

    await i.guild.members.ban(u.id, { reason: r });

    return i.reply({ content: `🔨 Banned ${u.tag}`, ephemeral: true });
  }
});

moderationCommands.push({
  data: new SlashCommandBuilder()
    .setName("unban")
    .setDescription("Unban user")
    .addStringOption(o => o.setName("userid").setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers),

  async execute(i) {
    if (!hasModAccess(i.member)) return silentFail(i);

    const uid = i.options.getString("userid");

    await i.guild.bans.remove(uid).catch(() => null);

    return i.reply({ content: `✅ Unbanned ${uid}`, ephemeral: true });
  }
});

/* ───────────────────────
   JAIL / UNJAIL
─────────────────────── */
moderationCommands.push({
  data: new SlashCommandBuilder()
    .setName("jail")
    .setDescription("Jail user")
    .addUserOption(o => o.setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

  async execute(i) {
    if (!hasModAccess(i.member)) return silentFail(i);

    const u = i.options.getUser("user");

    const fail = safeCheck(i, u, "jail");
    if (fail) return fail;

    const cfg = loadJSON(setupFile);
    const member = await i.guild.members.fetch(u.id).catch(() => null);

    if (!cfg.jailRole) return i.reply({ content: "⚠️ Jail role missing", ephemeral: true });

    await member.roles.add(cfg.jailRole);

    const jailData = loadJSON(jailFile);
    jailData[u.id] = { by: i.user.id, time: Date.now() };
    saveJSON(jailFile, jailData);

    return i.reply({ content: `🔒 Jailed ${u.tag}`, ephemeral: true });
  }
});

moderationCommands.push({
  data: new SlashCommandBuilder()
    .setName("unjail")
    .setDescription("Unjail user")
    .addUserOption(o => o.setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

  async execute(i) {
    if (!hasModAccess(i.member)) return silentFail(i);

    const u = i.options.getUser("user");

    const cfg = loadJSON(setupFile);
    const member = await i.guild.members.fetch(u.id).catch(() => null);

    if (!cfg.jailRole) return i.reply({ content: "⚠️ Jail role missing", ephemeral: true });

    await member.roles.remove(cfg.jailRole);

    return i.reply({ content: `🔓 Unjailed ${u.tag}`, ephemeral: true });
  }
});

/* ───────────────────────
   WARN CHECKS
─────────────────────── */
moderationCommands.push({
  data: new SlashCommandBuilder()
    .setName("warnings")
    .setDescription("Check warnings")
    .addUserOption(o => o.setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

  async execute(i) {
    if (!hasModAccess(i.member)) return silentFail(i);

    const u = i.options.getUser("user");
    const count = loadJSON(warnFile)[u.id] ?? 0;

    return i.reply({
      embeds: [
        new EmbedBuilder()
          .setTitle("Warnings")
          .addFields({ name: "User", value: `${u}` }, { name: "Count", value: `${count}` })
      ],
      ephemeral: true
    });
  }
});