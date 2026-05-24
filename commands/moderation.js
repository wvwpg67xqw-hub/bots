import {
  SlashCommandBuilder,
  EmbedBuilder,
  PermissionFlagsBits,
  ChannelType,
} from "discord.js";

import { loadJSON, saveJSON } from "../storage.js";
import { addCase, getCasesForUser, getRecentCases } from "../modlog.js";
import {
  addWarn,
  warnTime,
  logTo,
  setupFile,
  warnFile,
  jailFile,
} from "./helpers.js";

export const moderationCommands = [];

/* ───────────────────────
   ROLE ACCESS
─────────────────────── */
const allowedRoles = ["HRTL", "~~~staff~~~"];

function hasModAccess(member) {
  return member?.roles?.cache?.some(r => allowedRoles.includes(r.name));
}

function silentFail(i) {
  return i.reply({
    content: "❌ You do not have permission to use this command.",
    ephemeral: true,
  });
}

function blockSelf(i, u) {
  if (i.user.id === u.id) {
    i.reply({ content: "❌ You cannot moderate yourself.", ephemeral: true });
    return true;
  }
  return false;
}

function canTarget(mod, target) {
  return mod.roles.highest.position > target.roles.highest.position;
}

/* ───────────────────────
   WARN
─────────────────────── */
moderationCommands.push({
  data: new SlashCommandBuilder()
    .setName("warn")
    .setDescription("Warn a user")
    .addUserOption(o =>
      o.setName("user")
        .setDescription("User to warn")
        .setRequired(true)
    )
    .addStringOption(o =>
      o.setName("reason")
        .setDescription("Reason for warning")
        .setRequired(true)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

  async execute(i) {
    const u = i.options.getUser("user");
    const r = i.options.getString("reason");

    if (!hasModAccess(i.member)) return silentFail(i);
    if (blockSelf(i, u)) return;

    const member = await i.guild.members.fetch(u.id).catch(() => null);
    if (!member) return i.reply({ content: "User not found", ephemeral: true });
    if (!canTarget(i.member, member))
      return i.reply({ content: "❌ Cannot target this user", ephemeral: true });

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

    await logTo(
      i.guild,
      "logsChannel",
      new EmbedBuilder()
        .setColor(0xffcc00)
        .setTitle("⚠️ WARN")
        .addFields(
          { name: "User", value: u.tag, inline: true },
          { name: "Case", value: `#${caseId}`, inline: true },
          { name: "Warnings", value: `${count}`, inline: true },
          { name: "Reason", value: r }
        )
    );

    await i.reply({ content: `Warned ${u.tag} (#${caseId})`, ephemeral: true });
  },
});

/* ───────────────────────
   AD-WARN (SAFE)
─────────────────────── */
moderationCommands.push({
  data: new SlashCommandBuilder()
    .setName("ad-warn")
    .setDescription("Ad moderation via message or thread")
    .addStringOption(o =>
      o.setName("reason")
        .setDescription("Violation type")
        .setRequired(true)
        .addChoices(
          { name: "NSFW", value: "NSFW" },
          { name: "Scam Link", value: "SCAM_LINK" },
          { name: "Wrong Channel", value: "WRONG_CHANNEL" },
          { name: "Advertising in Chat", value: "AD_IN_CHAT" },
          { name: "Other", value: "OTHER" }
        )
    )
    .addStringOption(o =>
      o.setName("message_id")
        .setDescription("Message ID to target")
    )
    .addStringOption(o =>
      o.setName("thread_id")
        .setDescription("Thread ID to target")
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

  async execute(i) {
    const reason = i.options.getString("reason");
    const messageId = i.options.getString("message_id");
    const threadId = i.options.getString("thread_id");

    if (!hasModAccess(i.member)) return silentFail(i);

    if (messageId) {
      const msg = await i.channel.messages.fetch(messageId).catch(() => null);
      if (!msg)
        return i.reply({ content: "❌ Invalid message ID", ephemeral: true });

      const caseId = addCase({
        guildId: i.guild.id,
        type: "AD-WARN",
        userId: msg.author.id,
        userTag: msg.author.tag,
        modId: i.user.id,
        modTag: i.user.tag,
        reason: `[${reason}] Message ID: ${messageId}`,
      });

      return i.reply({
        content: `Ad warned message (#${caseId})`,
        ephemeral: true,
      });
    }

    if (threadId) {
      const thread = await i.guild.channels.fetch(threadId).catch(() => null);

      if (!thread || thread.type !== ChannelType.PublicThread)
        return i.reply({ content: "❌ Invalid thread ID", ephemeral: true });

      const caseId = addCase({
        guildId: i.guild.id,
        type: "AD-WARN",
        userId: thread.ownerId ?? "UNKNOWN",
        userTag: "THREAD",
        modId: i.user.id,
        modTag: i.user.tag,
        reason: `[${reason}] Thread ID: ${threadId}`,
      });

      return i.reply({
        content: `Ad warned thread (#${caseId})`,
        ephemeral: true,
      });
    }

    return i.reply({
      content: "❌ Provide message_id or thread_id",
      ephemeral: true,
    });
  },
});

/* ───────────────────────
   MUTE / UNMUTE (FIXED)
─────────────────────── */
moderationCommands.push({
  data: new SlashCommandBuilder()
    .setName("mute")
    .setDescription("Mute user")
    .addUserOption(o =>
      o.setName("user")
        .setDescription("User to mute")
        .setRequired(true)
    )
    .addIntegerOption(o =>
      o.setName("minutes")
        .setDescription("Duration in minutes")
        .setRequired(true)
    )
    .addStringOption(o =>
      o.setName("reason")
        .setDescription("Reason")
    ),

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
      reason: `${m} min - ${r}`,
    });

    await i.reply({ content: `Muted ${u.tag} (#${caseId})`, ephemeral: true });
  },
});

/* ───────────────────────
   UNMUTE
─────────────────────── */
moderationCommands.push({
  data: new SlashCommandBuilder()
    .setName("unmute")
    .setDescription("Unmute user")
    .addUserOption(o =>
      o.setName("user")
        .setDescription("User to unmute")
        .setRequired(true)
    ),

  async execute(i) {
    if (!hasModAccess(i.member)) return silentFail(i);

    const u = i.options.getUser("user");
    const member = await i.guild.members.fetch(u.id).catch(() => null);

    if (!member) return i.reply({ content: "User not found", ephemeral: true });

    await member.timeout(null);

    await i.reply({ content: `Unmuted ${u.tag}`, ephemeral: true });
  },
});