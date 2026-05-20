import {
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
  EmbedBuilder,
  Colors,
  type GuildMember,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} from "discord.js";
import {
  addWarning, getWarnings, getTopWarnedUsers,
  addAdWarning, removeAdWarning, getAdWarnings,
  addStrike, removeStrike, getStrikes,
  addModCase, getModCase, getRecentCases,
  getMessageCount, resetMessageCount, resetAllMessageCounts, getTopMessageUsers,
  getBalance, setBalance,
  getSnipe,
  startBreak, endBreak, getCurrentBreaks,
  jailUser, unjailUser, isJailed,
  getGuildConfig,
  getOrCreateReferralCode, getReferralStats, getReferralLeaderboard,
} from "./database";
import {
  successEmbed, errorEmbed, infoEmbed, warnEmbed,
  formatTimestamp, formatDuration, parseDuration, checkPermissions,
} from "./utils";
import { logger } from "../lib/logger";

export interface BotCommand {
  data: { toJSON: () => unknown; name: string };
  execute: (interaction: ChatInputCommandInteraction) => Promise<void>;
}

// ── /warn ──────────────────────────────────────────────────────────────────
const warnCmd: BotCommand = {
  data: new SlashCommandBuilder()
    .setName("warn")
    .setDescription("Warn a user")
    .addUserOption(o => o.setName("user").setDescription("User to warn").setRequired(true))
    .addStringOption(o => o.setName("reason").setDescription("Reason for warning").setRequired(true)) as any,
  async execute(interaction) {
    if (!await checkPermissions(interaction, "warn")) {
      return void interaction.reply({ embeds: [errorEmbed("You don't have permission to use this command.")], flags: 64 });
    }
    const user = interaction.options.getUser("user", true);
    const reason = interaction.options.getString("reason", true);
    const id = addWarning(interaction.guildId!, user.id, interaction.user.id, reason);
    const warns = getWarnings(interaction.guildId!, user.id);
    await interaction.reply({
      embeds: [successEmbed(`**${user.tag}** has been warned.\n**Reason:** ${reason}\n**Total warnings:** ${warns.length}\n**Case ID:** #${id}`, "⚠️ Warning Issued")]
    });
    // DM the user
    try {
      await user.send({ embeds: [warnEmbed(`You have been warned in **${interaction.guild!.name}**.\n**Reason:** ${reason}\n**Total warnings:** ${warns.length}`, "⚠️ Warning")] });
    } catch { /* user has DMs disabled */ }
    // Log to mod log
    await sendModLog(interaction, "warn", user, reason, undefined, id);
  }
};

// ── /warns ─────────────────────────────────────────────────────────────────
const warnsCmd: BotCommand = {
  data: new SlashCommandBuilder()
    .setName("warns")
    .setDescription("View warnings for a user")
    .addUserOption(o => o.setName("user").setDescription("User to check").setRequired(true)) as any,
  async execute(interaction) {
    const user = interaction.options.getUser("user", true);
    const warns = getWarnings(interaction.guildId!, user.id);
    if (warns.length === 0) {
      return void interaction.reply({ embeds: [infoEmbed(`${user.tag} has no warnings.`)] });
    }
    const lines = warns.slice(0, 10).map((w, i) =>
      `**#${w.id}** — ${w.reason} (by <@${w.moderator_id}> ${formatTimestamp(w.timestamp)})`
    ).join("\n");
    await interaction.reply({
      embeds: [new EmbedBuilder()
        .setColor(Colors.Yellow)
        .setTitle(`⚠️ Warnings for ${user.tag}`)
        .setDescription(lines)
        .setFooter({ text: `Total: ${warns.length}` })
        .setThumbnail(user.displayAvatarURL())]
    });
  }
};

// ── /warn-leaderboard ──────────────────────────────────────────────────────
const warnLeaderboardCmd: BotCommand = {
  data: new SlashCommandBuilder()
    .setName("warn-leaderboard")
    .setDescription("Show top warned users") as any,
  async execute(interaction) {
    const top = getTopWarnedUsers(interaction.guildId!);
    if (top.length === 0) return void interaction.reply({ embeds: [infoEmbed("No warnings on record.")] });
    const lines = top.map((r, i) => `**${i + 1}.** <@${r.user_id}> — ${r.count} warning${r.count !== 1 ? "s" : ""}`).join("\n");
    await interaction.reply({ embeds: [infoEmbed(lines, "⚠️ Warning Leaderboard")] });
  }
};

// ── /ad-warn ───────────────────────────────────────────────────────────────
const adWarnCmd: BotCommand = {
  data: new SlashCommandBuilder()
    .setName("ad-warn")
    .setDescription("Issue an advertisement warning")
    .addUserOption(o => o.setName("user").setDescription("User to warn").setRequired(true))
    .addStringOption(o => o.setName("reason").setDescription("Reason").setRequired(true)) as any,
  async execute(interaction) {
    if (!await checkPermissions(interaction, "ad-warn")) {
      return void interaction.reply({ embeds: [errorEmbed("You don't have permission.")], flags: 64 });
    }
    const user = interaction.options.getUser("user", true);
    const reason = interaction.options.getString("reason", true);
    const id = addAdWarning(interaction.guildId!, user.id, interaction.user.id, reason);
    const warns = getAdWarnings(interaction.guildId!, user.id);
    await interaction.reply({ embeds: [successEmbed(`**${user.tag}** received an ad warning.\n**Reason:** ${reason}\n**Total ad warnings:** ${warns.length}`, "📢 Ad Warning")] });
    await sendModLog(interaction, "ad-warn", user, reason, undefined, id);
  }
};

// ── /remove-ad-warn ────────────────────────────────────────────────────────
const removeAdWarnCmd: BotCommand = {
  data: new SlashCommandBuilder()
    .setName("remove-ad-warn")
    .setDescription("Remove an advertisement warning")
    .addIntegerOption(o => o.setName("id").setDescription("Ad warning ID to remove").setRequired(true)) as any,
  async execute(interaction) {
    if (!await checkPermissions(interaction, "remove-ad-warn")) {
      return void interaction.reply({ embeds: [errorEmbed("You don't have permission.")], flags: 64 });
    }
    const id = interaction.options.getInteger("id", true);
    removeAdWarning(interaction.guildId!, id);
    await interaction.reply({ embeds: [successEmbed(`Ad warning **#${id}** has been removed.`)] });
  }
};

// ── /mute ──────────────────────────────────────────────────────────────────
const muteCmd: BotCommand = {
  data: new SlashCommandBuilder()
    .setName("mute")
    .setDescription("Mute (timeout) a user")
    .addUserOption(o => o.setName("user").setDescription("User to mute").setRequired(true))
    .addStringOption(o => o.setName("duration").setDescription("Duration (e.g. 10m, 1h, 1d)").setRequired(true))
    .addStringOption(o => o.setName("reason").setDescription("Reason").setRequired(false)) as any,
  async execute(interaction) {
    if (!await checkPermissions(interaction, "mute")) {
      return void interaction.reply({ embeds: [errorEmbed("You don't have permission.")], flags: 64 });
    }
    const user = interaction.options.getUser("user", true);
    const durationStr = interaction.options.getString("duration", true);
    const reason = interaction.options.getString("reason") ?? "No reason provided";
    const ms = parseDuration(durationStr);
    if (!ms) return void interaction.reply({ embeds: [errorEmbed("Invalid duration. Use format: 10m, 1h, 1d, 1w")] });
    if (ms > 2419200000) return void interaction.reply({ embeds: [errorEmbed("Duration cannot exceed 28 days.")] });
    try {
      const member = await interaction.guild!.members.fetch(user.id);
      await member.timeout(ms, reason);
      addModCase(interaction.guildId!, user.id, interaction.user.id, "mute", reason, durationStr);
      await interaction.reply({ embeds: [successEmbed(`**${user.tag}** has been muted for **${durationStr}**.\n**Reason:** ${reason}`, "🔇 User Muted")] });
      await sendModLog(interaction, "mute", user, reason, durationStr);
    } catch (e) {
      logger.error({ e }, "Mute failed");
      await interaction.reply({ embeds: [errorEmbed("Failed to mute user. Check bot permissions.")] });
    }
  }
};

// ── /unmute ────────────────────────────────────────────────────────────────
const unmuteCmd: BotCommand = {
  data: new SlashCommandBuilder()
    .setName("unmute")
    .setDescription("Unmute a user")
    .addUserOption(o => o.setName("user").setDescription("User to unmute").setRequired(true))
    .addStringOption(o => o.setName("reason").setDescription("Reason").setRequired(false)) as any,
  async execute(interaction) {
    if (!await checkPermissions(interaction, "unmute")) {
      return void interaction.reply({ embeds: [errorEmbed("You don't have permission.")], flags: 64 });
    }
    const user = interaction.options.getUser("user", true);
    const reason = interaction.options.getString("reason") ?? "No reason provided";
    try {
      const member = await interaction.guild!.members.fetch(user.id);
      await member.timeout(null, reason);
      addModCase(interaction.guildId!, user.id, interaction.user.id, "unmute", reason);
      await interaction.reply({ embeds: [successEmbed(`**${user.tag}** has been unmuted.\n**Reason:** ${reason}`, "🔊 User Unmuted")] });
    } catch (e) {
      await interaction.reply({ embeds: [errorEmbed("Failed to unmute user.")] });
    }
  }
};

// ── /ban ───────────────────────────────────────────────────────────────────
const banCmd: BotCommand = {
  data: new SlashCommandBuilder()
    .setName("ban")
    .setDescription("Ban a user from the server")
    .addUserOption(o => o.setName("user").setDescription("User to ban").setRequired(true))
    .addStringOption(o => o.setName("reason").setDescription("Reason").setRequired(false))
    .addIntegerOption(o => o.setName("delete_days").setDescription("Days of messages to delete (0-7)").setMinValue(0).setMaxValue(7)) as any,
  async execute(interaction) {
    if (!await checkPermissions(interaction, "ban")) {
      return void interaction.reply({ embeds: [errorEmbed("You don't have permission.")], flags: 64 });
    }
    const user = interaction.options.getUser("user", true);
    const reason = interaction.options.getString("reason") ?? "No reason provided";
    const deleteDays = interaction.options.getInteger("delete_days") ?? 0;
    try {
      await interaction.guild!.members.ban(user, { reason, deleteMessageDays: deleteDays as 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 });
      addModCase(interaction.guildId!, user.id, interaction.user.id, "ban", reason);
      await interaction.reply({ embeds: [successEmbed(`**${user.tag}** has been banned.\n**Reason:** ${reason}`, "🔨 User Banned")] });
      await sendModLog(interaction, "ban", user, reason);
    } catch (e) {
      await interaction.reply({ embeds: [errorEmbed("Failed to ban user.")] });
    }
  }
};

// ── /fire ──────────────────────────────────────────────────────────────────
const fireCmd: BotCommand = {
  data: new SlashCommandBuilder()
    .setName("fire")
    .setDescription("Remove all staff roles from a user (fire them)")
    .addUserOption(o => o.setName("user").setDescription("User to fire").setRequired(true))
    .addStringOption(o => o.setName("reason").setDescription("Reason").setRequired(true)) as any,
  async execute(interaction) {
    if (!await checkPermissions(interaction, "fire")) {
      return void interaction.reply({ embeds: [errorEmbed("You don't have permission.")], flags: 64 });
    }
    const user = interaction.options.getUser("user", true);
    const reason = interaction.options.getString("reason", true);
    const config = getGuildConfig(interaction.guildId!);
    const staffRoles = [config?.mod_role, config?.staff_role, config?.junior_mod_role, config?.trial_mod_role].filter(Boolean) as string[];
    try {
      const member = await interaction.guild!.members.fetch(user.id);
      const rolesToRemove = member.roles.cache.filter(r => staffRoles.includes(r.id));
      await member.roles.remove(rolesToRemove, reason);
      addModCase(interaction.guildId!, user.id, interaction.user.id, "fire", reason);
      await interaction.reply({ embeds: [successEmbed(`**${user.tag}** has been fired.\n**Roles removed:** ${rolesToRemove.size}\n**Reason:** ${reason}`, "🔥 User Fired")] });
      await sendModLog(interaction, "fire", user, reason);
    } catch (e) {
      await interaction.reply({ embeds: [errorEmbed("Failed to fire user.")] });
    }
  }
};

// ── /promote ───────────────────────────────────────────────────────────────
const promoteCmd: BotCommand = {
  data: new SlashCommandBuilder()
    .setName("promote")
    .setDescription("Promote a user to a higher role")
    .addUserOption(o => o.setName("user").setDescription("User to promote").setRequired(true))
    .addRoleOption(o => o.setName("role").setDescription("Role to assign").setRequired(true))
    .addStringOption(o => o.setName("reason").setDescription("Reason").setRequired(false)) as any,
  async execute(interaction) {
    if (!await checkPermissions(interaction, "promote")) {
      return void interaction.reply({ embeds: [errorEmbed("You don't have permission.")], flags: 64 });
    }
    const user = interaction.options.getUser("user", true);
    const role = interaction.options.getRole("role", true);
    const reason = interaction.options.getString("reason") ?? "No reason provided";
    try {
      const member = await interaction.guild!.members.fetch(user.id);
      await member.roles.add(role.id, reason);
      addModCase(interaction.guildId!, user.id, interaction.user.id, "promote", reason);
      await interaction.reply({ embeds: [successEmbed(`**${user.tag}** has been promoted to **${role.name}**.\n**Reason:** ${reason}`, "📈 User Promoted")] });
    } catch (e) {
      await interaction.reply({ embeds: [errorEmbed("Failed to promote user.")] });
    }
  }
};

// ── /demote-user ───────────────────────────────────────────────────────────
const demoteCmd: BotCommand = {
  data: new SlashCommandBuilder()
    .setName("demote-user")
    .setDescription("Demote a user by removing a role")
    .addUserOption(o => o.setName("user").setDescription("User to demote").setRequired(true))
    .addRoleOption(o => o.setName("role").setDescription("Role to remove").setRequired(true))
    .addStringOption(o => o.setName("reason").setDescription("Reason").setRequired(false)) as any,
  async execute(interaction) {
    if (!await checkPermissions(interaction, "demote-user")) {
      return void interaction.reply({ embeds: [errorEmbed("You don't have permission.")], flags: 64 });
    }
    const user = interaction.options.getUser("user", true);
    const role = interaction.options.getRole("role", true);
    const reason = interaction.options.getString("reason") ?? "No reason provided";
    try {
      const member = await interaction.guild!.members.fetch(user.id);
      await member.roles.remove(role.id, reason);
      addModCase(interaction.guildId!, user.id, interaction.user.id, "demote", reason);
      await interaction.reply({ embeds: [successEmbed(`**${user.tag}** has been demoted (removed **${role.name}**).\n**Reason:** ${reason}`, "📉 User Demoted")] });
    } catch (e) {
      await interaction.reply({ embeds: [errorEmbed("Failed to demote user.")] });
    }
  }
};

// ── /strike ────────────────────────────────────────────────────────────────
const strikeCmd: BotCommand = {
  data: new SlashCommandBuilder()
    .setName("strike")
    .setDescription("Issue a strike to a staff member")
    .addUserOption(o => o.setName("user").setDescription("User to strike").setRequired(true))
    .addStringOption(o => o.setName("reason").setDescription("Reason").setRequired(true)) as any,
  async execute(interaction) {
    if (!await checkPermissions(interaction, "strike")) {
      return void interaction.reply({ embeds: [errorEmbed("You don't have permission.")], flags: 64 });
    }
    const user = interaction.options.getUser("user", true);
    const reason = interaction.options.getString("reason", true);
    const id = addStrike(interaction.guildId!, user.id, interaction.user.id, reason);
    const strikes = getStrikes(interaction.guildId!, user.id);
    await interaction.reply({ embeds: [successEmbed(`**${user.tag}** has received a strike.\n**Reason:** ${reason}\n**Total strikes:** ${strikes.length}\n**Case ID:** #${id}`, "⚡ Strike Issued")] });
    try { await user.send({ embeds: [warnEmbed(`You have received a strike in **${interaction.guild!.name}**.\n**Reason:** ${reason}\n**Total strikes:** ${strikes.length}`, "⚡ Strike")] }); } catch { }
    await sendModLog(interaction, "strike", user, reason, undefined, id);
  }
};

// ── /strike-remove ─────────────────────────────────────────────────────────
const strikeRemoveCmd: BotCommand = {
  data: new SlashCommandBuilder()
    .setName("strike-remove")
    .setDescription("Remove a strike")
    .addIntegerOption(o => o.setName("id").setDescription("Strike ID to remove").setRequired(true)) as any,
  async execute(interaction) {
    if (!await checkPermissions(interaction, "strike-remove")) {
      return void interaction.reply({ embeds: [errorEmbed("You don't have permission.")], flags: 64 });
    }
    const id = interaction.options.getInteger("id", true);
    removeStrike(interaction.guildId!, id);
    await interaction.reply({ embeds: [successEmbed(`Strike **#${id}** has been removed.`)] });
  }
};

// ── /jail ──────────────────────────────────────────────────────────────────
const jailCmd: BotCommand = {
  data: new SlashCommandBuilder()
    .setName("jail")
    .setDescription("Jail a user (remove their roles and assign jail role)")
    .addUserOption(o => o.setName("user").setDescription("User to jail").setRequired(true))
    .addStringOption(o => o.setName("reason").setDescription("Reason").setRequired(true)) as any,
  async execute(interaction) {
    if (!await checkPermissions(interaction, "jail")) {
      return void interaction.reply({ embeds: [errorEmbed("You don't have permission.")], flags: 64 });
    }
    const user = interaction.options.getUser("user", true);
    const reason = interaction.options.getString("reason", true);
    const config = getGuildConfig(interaction.guildId!);
    if (!config?.jail_role) return void interaction.reply({ embeds: [errorEmbed("Jail role not configured. Run `/setup`.")] });
    if (isJailed(interaction.guildId!, user.id)) return void interaction.reply({ embeds: [errorEmbed("User is already jailed.")] });
    try {
      const member = await interaction.guild!.members.fetch(user.id);
      const roles = member.roles.cache.filter(r => r.id !== interaction.guild!.id).map(r => r.id);
      await member.roles.set([config.jail_role as string], reason);
      jailUser(interaction.guildId!, user.id, roles, interaction.user.id, reason);
      addModCase(interaction.guildId!, user.id, interaction.user.id, "jail", reason);
      await interaction.reply({ embeds: [successEmbed(`**${user.tag}** has been jailed.\n**Reason:** ${reason}`, "🔒 User Jailed")] });
      await sendModLog(interaction, "jail", user, reason);
    } catch (e) {
      await interaction.reply({ embeds: [errorEmbed("Failed to jail user.")] });
    }
  }
};

// ── /unjail ────────────────────────────────────────────────────────────────
const unjailCmd: BotCommand = {
  data: new SlashCommandBuilder()
    .setName("unjail")
    .setDescription("Release a user from jail and restore their roles")
    .addUserOption(o => o.setName("user").setDescription("User to unjail").setRequired(true))
    .addStringOption(o => o.setName("reason").setDescription("Reason").setRequired(false)) as any,
  async execute(interaction) {
    if (!await checkPermissions(interaction, "unjail")) {
      return void interaction.reply({ embeds: [errorEmbed("You don't have permission.")], flags: 64 });
    }
    const user = interaction.options.getUser("user", true);
    const reason = interaction.options.getString("reason") ?? "No reason provided";
    if (!isJailed(interaction.guildId!, user.id)) return void interaction.reply({ embeds: [errorEmbed("User is not jailed.")] });
    try {
      const member = await interaction.guild!.members.fetch(user.id);
      const roles = unjailUser(interaction.guildId!, user.id);
      if (roles) await member.roles.set(roles, reason);
      addModCase(interaction.guildId!, user.id, interaction.user.id, "unjail", reason);
      await interaction.reply({ embeds: [successEmbed(`**${user.tag}** has been released from jail.\n**Reason:** ${reason}`, "🔓 User Unjailed")] });
    } catch (e) {
      await interaction.reply({ embeds: [errorEmbed("Failed to unjail user.")] });
    }
  }
};

// ── /messages ──────────────────────────────────────────────────────────────
const messagesCmd: BotCommand = {
  data: new SlashCommandBuilder()
    .setName("messages")
    .setDescription("View message count for a user")
    .addUserOption(o => o.setName("user").setDescription("User to check (defaults to yourself)")) as any,
  async execute(interaction) {
    const user = interaction.options.getUser("user") ?? interaction.user;
    const count = getMessageCount(interaction.guildId!, user.id);
    await interaction.reply({ embeds: [infoEmbed(`**${user.tag}** has sent **${count.toLocaleString()}** messages in this server.`, "💬 Message Count")] });
  }
};

// ── /message-leaderboard ───────────────────────────────────────────────────
const messageLBCmd: BotCommand = {
  data: new SlashCommandBuilder()
    .setName("message-leaderboard")
    .setDescription("Show the top message senders") as any,
  async execute(interaction) {
    const top = getTopMessageUsers(interaction.guildId!);
    if (top.length === 0) return void interaction.reply({ embeds: [infoEmbed("No messages recorded yet.")] });
    const lines = top.map((r, i) => `**${i + 1}.** <@${r.user_id}> — ${r.count.toLocaleString()} messages`).join("\n");
    await interaction.reply({ embeds: [infoEmbed(lines, "💬 Message Leaderboard")] });
  }
};

// ── /case-info ─────────────────────────────────────────────────────────────
const caseInfoCmd: BotCommand = {
  data: new SlashCommandBuilder()
    .setName("case-info")
    .setDescription("View information about a moderation case")
    .addIntegerOption(o => o.setName("id").setDescription("Case ID").setRequired(true)) as any,
  async execute(interaction) {
    const id = interaction.options.getInteger("id", true);
    const c = getModCase(interaction.guildId!, id);
    if (!c) return void interaction.reply({ embeds: [errorEmbed(`Case **#${id}** not found.`)] });
    const embed = new EmbedBuilder()
      .setColor(Colors.Blurple)
      .setTitle(`📋 Case #${c.id}`)
      .addFields(
        { name: "Action", value: c.action, inline: true },
        { name: "User", value: `<@${c.user_id}>`, inline: true },
        { name: "Moderator", value: `<@${c.moderator_id}>`, inline: true },
        { name: "Reason", value: c.reason },
        { name: "Date", value: formatTimestamp(c.timestamp), inline: true },
      );
    if (c.duration) embed.addFields({ name: "Duration", value: c.duration, inline: true });
    await interaction.reply({ embeds: [embed] });
  }
};

// ── /balance ───────────────────────────────────────────────────────────────
const balanceCmd: BotCommand = {
  data: new SlashCommandBuilder()
    .setName("balance")
    .setDescription("Check your server balance")
    .addUserOption(o => o.setName("user").setDescription("User to check (defaults to yourself)")) as any,
  async execute(interaction) {
    const user = interaction.options.getUser("user") ?? interaction.user;
    const amount = getBalance(interaction.guildId!, user.id);
    await interaction.reply({ embeds: [infoEmbed(`**${user.tag}**'s balance: **${amount.toLocaleString()} coins**`, "💰 Balance")] });
  }
};

// ── /snipe ─────────────────────────────────────────────────────────────────
const snipeCmd: BotCommand = {
  data: new SlashCommandBuilder()
    .setName("snipe")
    .setDescription("Show the last deleted message in this channel") as any,
  async execute(interaction) {
    const snipe = getSnipe(interaction.guildId!, interaction.channelId!);
    if (!snipe) return void interaction.reply({ embeds: [infoEmbed("No deleted message found in this channel.")] });
    const embed = new EmbedBuilder()
      .setColor(Colors.DarkGrey)
      .setTitle("🎯 Sniped Message")
      .setDescription(snipe.content)
      .setFooter({ text: `Sent by ${snipe.username}` })
      .setTimestamp(snipe.timestamp);
    await interaction.reply({ embeds: [embed] });
  }
};

// ── /current-breaks ────────────────────────────────────────────────────────
const currentBreaksCmd: BotCommand = {
  data: new SlashCommandBuilder()
    .setName("current-breaks")
    .setDescription("Show all staff members currently on break") as any,
  async execute(interaction) {
    const breaks = getCurrentBreaks(interaction.guildId!);
    if (breaks.length === 0) return void interaction.reply({ embeds: [infoEmbed("No staff members are currently on break.")] });
    const lines = breaks.map(b => `<@${b.user_id}> — *${b.reason}* (${formatTimestamp(b.started_at)})`).join("\n");
    await interaction.reply({ embeds: [infoEmbed(lines, "☕ Staff on Break")] });
  }
};

// ── /break ─────────────────────────────────────────────────────────────────
const breakCmd: BotCommand = {
  data: new SlashCommandBuilder()
    .setName("break")
    .setDescription("Start a break")
    .addStringOption(o => o.setName("reason").setDescription("Reason for break").setRequired(true)) as any,
  async execute(interaction) {
    if (!await checkPermissions(interaction, "break")) {
      return void interaction.reply({ embeds: [errorEmbed("You don't have permission.")], flags: 64 });
    }
    const reason = interaction.options.getString("reason", true);
    const config = getGuildConfig(interaction.guildId!);
    try {
      startBreak(interaction.guildId!, interaction.user.id, reason);
      if (config?.break_role) {
        const member = await interaction.guild!.members.fetch(interaction.user.id);
        await member.roles.add(config.break_role as string).catch(() => {});
      }
      await interaction.reply({ embeds: [successEmbed(`**${interaction.user.tag}** is now on break.\n**Reason:** ${reason}`, "☕ Break Started")] });
    } catch (e: any) {
      if (e.message === "User already on break") {
        await interaction.reply({ embeds: [errorEmbed("You are already on break.")] });
      } else {
        await interaction.reply({ embeds: [errorEmbed("Failed to start break.")] });
      }
    }
  }
};

// ── /break-end ─────────────────────────────────────────────────────────────
const breakEndCmd: BotCommand = {
  data: new SlashCommandBuilder()
    .setName("break-end")
    .setDescription("End your current break") as any,
  async execute(interaction) {
    if (!await checkPermissions(interaction, "break-end")) {
      return void interaction.reply({ embeds: [errorEmbed("You don't have permission.")], flags: 64 });
    }
    const config = getGuildConfig(interaction.guildId!);
    endBreak(interaction.guildId!, interaction.user.id);
    if (config?.break_role) {
      const member = await interaction.guild!.members.fetch(interaction.user.id);
      await member.roles.remove(config.break_role as string).catch(() => {});
    }
    await interaction.reply({ embeds: [successEmbed(`**${interaction.user.tag}**'s break has ended. Welcome back!`, "👋 Break Ended")] });
  }
};

// ── /reset-messages ────────────────────────────────────────────────────────
const resetMessagesCmd: BotCommand = {
  data: new SlashCommandBuilder()
    .setName("reset-messages")
    .setDescription("Reset message count for a user")
    .addUserOption(o => o.setName("user").setDescription("User to reset").setRequired(true)) as any,
  async execute(interaction) {
    if (!await checkPermissions(interaction, "reset-messages")) {
      return void interaction.reply({ embeds: [errorEmbed("You don't have permission.")], flags: 64 });
    }
    const user = interaction.options.getUser("user", true);
    resetMessageCount(interaction.guildId!, user.id);
    await interaction.reply({ embeds: [successEmbed(`Message count for **${user.tag}** has been reset.`)] });
  }
};

// ── /reset-messages-all ────────────────────────────────────────────────────
const resetMessagesAllCmd: BotCommand = {
  data: new SlashCommandBuilder()
    .setName("reset-messages-all")
    .setDescription("Reset all message counts for the server") as any,
  async execute(interaction) {
    if (!await checkPermissions(interaction, "reset-messages-all")) {
      return void interaction.reply({ embeds: [errorEmbed("You don't have permission.")], flags: 64 });
    }
    resetAllMessageCounts(interaction.guildId!);
    await interaction.reply({ embeds: [successEmbed("All message counts have been reset for this server.")] });
  }
};

// ── /ban-request ───────────────────────────────────────────────────────────
const banRequestCmd: BotCommand = {
  data: new SlashCommandBuilder()
    .setName("ban-request")
    .setDescription("Submit a ban request")
    .addUserOption(o => o.setName("user").setDescription("User to request ban for").setRequired(true))
    .addStringOption(o => o.setName("reason").setDescription("Reason").setRequired(true)) as any,
  async execute(interaction) {
    if (!await checkPermissions(interaction, "ban-request")) {
      return void interaction.reply({ embeds: [errorEmbed("You don't have permission.")], flags: 64 });
    }
    const user = interaction.options.getUser("user", true);
    const reason = interaction.options.getString("reason", true);
    const config = getGuildConfig(interaction.guildId!);
    const embed = new EmbedBuilder()
      .setColor(Colors.Red)
      .setTitle("🔨 Ban Request")
      .addFields(
        { name: "User", value: `${user.tag} (${user.id})`, inline: true },
        { name: "Requested by", value: `<@${interaction.user.id}>`, inline: true },
        { name: "Reason", value: reason },
      )
      .setTimestamp();
    await interaction.reply({ embeds: [embed] });
    if (config?.mod_log_channel) {
      const ch = interaction.guild!.channels.cache.get(config.mod_log_channel as string);
      if (ch?.isTextBased()) await ch.send({ embeds: [embed] });
    }
  }
};

// ── /blacklist-request ─────────────────────────────────────────────────────
const blacklistRequestCmd: BotCommand = {
  data: new SlashCommandBuilder()
    .setName("blacklist-request")
    .setDescription("Submit a blacklist request")
    .addUserOption(o => o.setName("user").setDescription("User to blacklist").setRequired(true))
    .addStringOption(o => o.setName("reason").setDescription("Reason").setRequired(true)) as any,
  async execute(interaction) {
    if (!await checkPermissions(interaction, "blacklist-request")) {
      return void interaction.reply({ embeds: [errorEmbed("You don't have permission.")], flags: 64 });
    }
    const user = interaction.options.getUser("user", true);
    const reason = interaction.options.getString("reason", true);
    const embed = new EmbedBuilder()
      .setColor(Colors.DarkRed)
      .setTitle("🚫 Blacklist Request")
      .addFields(
        { name: "User", value: `${user.tag} (${user.id})`, inline: true },
        { name: "Requested by", value: `<@${interaction.user.id}>`, inline: true },
        { name: "Reason", value: reason },
      ).setTimestamp();
    await interaction.reply({ embeds: [embed] });
  }
};

// ── /network-ban-request ───────────────────────────────────────────────────
const networkBanCmd: BotCommand = {
  data: new SlashCommandBuilder()
    .setName("network-ban-request")
    .setDescription("Submit a network-wide ban request")
    .addUserOption(o => o.setName("user").setDescription("User").setRequired(true))
    .addStringOption(o => o.setName("reason").setDescription("Reason").setRequired(true)) as any,
  async execute(interaction) {
    if (!await checkPermissions(interaction, "network-ban-request")) {
      return void interaction.reply({ embeds: [errorEmbed("You don't have permission.")], flags: 64 });
    }
    const user = interaction.options.getUser("user", true);
    const reason = interaction.options.getString("reason", true);
    const embed = new EmbedBuilder()
      .setColor(Colors.DarkRed)
      .setTitle("🌐 Network Ban Request")
      .addFields(
        { name: "User", value: `${user.tag} (${user.id})`, inline: true },
        { name: "Requested by", value: `<@${interaction.user.id}>`, inline: true },
        { name: "Reason", value: reason },
      ).setTimestamp();
    await interaction.reply({ embeds: [embed] });
  }
};

// ── /partnership-request ───────────────────────────────────────────────────
const partnershipCmd: BotCommand = {
  data: new SlashCommandBuilder()
    .setName("partnership-request")
    .setDescription("Submit a partnership request")
    .addStringOption(o => o.setName("server").setDescription("Server name").setRequired(true))
    .addStringOption(o => o.setName("invite").setDescription("Invite link").setRequired(true))
    .addStringOption(o => o.setName("description").setDescription("Description").setRequired(true)) as any,
  async execute(interaction) {
    if (!await checkPermissions(interaction, "partnership-request")) {
      return void interaction.reply({ embeds: [errorEmbed("You don't have permission.")], flags: 64 });
    }
    const server = interaction.options.getString("server", true);
    const invite = interaction.options.getString("invite", true);
    const description = interaction.options.getString("description", true);
    const embed = new EmbedBuilder()
      .setColor(Colors.Green)
      .setTitle("🤝 Partnership Request")
      .addFields(
        { name: "Server", value: server, inline: true },
        { name: "Invite", value: invite, inline: true },
        { name: "Requested by", value: `<@${interaction.user.id}>`, inline: true },
        { name: "Description", value: description },
      ).setTimestamp();
    await interaction.reply({ embeds: [embed] });
  }
};

// ── Helper: send mod log ───────────────────────────────────────────────────
async function sendModLog(
  interaction: ChatInputCommandInteraction,
  action: string,
  user: any,
  reason: string,
  duration?: string,
  caseId?: number
) {
  const config = getGuildConfig(interaction.guildId!);
  const logChannelId = config?.mod_log_channel || config?.log_channel;
  if (!logChannelId) return;
  const ch = interaction.guild?.channels.cache.get(logChannelId as string);
  if (!ch?.isTextBased()) return;
  const actionColors: Record<string, number> = {
    warn: Colors.Yellow, ban: Colors.Red, mute: Colors.Orange, jail: Colors.DarkOrange,
    strike: Colors.Orange, fire: Colors.Red, "ad-warn": Colors.Yellow,
  };
  const embed = new EmbedBuilder()
    .setColor(actionColors[action] ?? Colors.Blurple)
    .setTitle(`📋 ${action.toUpperCase()}${caseId ? ` | Case #${caseId}` : ""}`)
    .addFields(
      { name: "User", value: `${user.tag} (${user.id})`, inline: true },
      { name: "Moderator", value: `<@${interaction.user.id}>`, inline: true },
      { name: "Reason", value: reason },
    )
    .setTimestamp();
  if (duration) embed.addFields({ name: "Duration", value: duration, inline: true });
  await ch.send({ embeds: [embed] }).catch(() => {});
}

// ── /referral ──────────────────────────────────────────────────────────────
const referralCmd: BotCommand = {
  data: new SlashCommandBuilder()
    .setName("referral")
    .setDescription("View your referral link and stats")
    .addUserOption(o => o.setName("user").setDescription("Check another user's stats (mod only)")) as any,
  async execute(interaction) {
    const target = interaction.options.getUser("user");
    const isCheckingOther = !!target && target.id !== interaction.user.id;
    if (isCheckingOther && !await checkPermissions(interaction, "referral")) {
      return void interaction.reply({ embeds: [errorEmbed("You need mod permissions to check other users' referral stats.")], flags: 64 });
    }
    const user = target ?? interaction.user;
    const guildId = interaction.guildId!;
    const domains = process.env["REPLIT_DOMAINS"];
    const domain = domains ? domains.split(",")[0].trim() : "your-domain";
    const code = getOrCreateReferralCode(guildId, user.id);
    const stats = getReferralStats(guildId, user.id);
    const referralLink = `https://${domain}/refer/${code}`;
    const recentList = stats.recent.length > 0
      ? stats.recent.map(r => `• ${r.referred_name} — <t:${Math.floor(r.joined_at / 1000)}:R>`).join("\n")
      : "No referrals yet.";
    const embed = new EmbedBuilder()
      .setColor(Colors.Green)
      .setTitle(`🔗 Referral Stats — ${user.username}`)
      .setThumbnail(user.displayAvatarURL())
      .addFields(
        { name: "Your Referral Link", value: `\`${referralLink}\`` },
        { name: "Total Referrals", value: stats.total.toString(), inline: true },
        { name: "Referral Code", value: `\`${code}\``, inline: true },
        { name: "Recent Referrals", value: recentList },
      )
      .setFooter({ text: "Share your link to earn referral credit!" });
    await interaction.reply({ embeds: [embed] });
  }
};

// ── /referral-leaderboard ──────────────────────────────────────────────────
const referralLBCmd: BotCommand = {
  data: new SlashCommandBuilder()
    .setName("referral-leaderboard")
    .setDescription("Show the top referrers in this server") as any,
  async execute(interaction) {
    const top = getReferralLeaderboard(interaction.guildId!);
    if (top.length === 0) {
      return void interaction.reply({ embeds: [infoEmbed("No referrals recorded yet. Share your `/referral` link to get started!")] });
    }
    const lines = top.map((r, i) =>
      `**${i + 1}.** <@${r.referrer_id}> — **${r.count}** referral${r.count !== 1 ? "s" : ""}`
    ).join("\n");
    await interaction.reply({ embeds: [infoEmbed(lines, "🔗 Referral Leaderboard")] });
  }
};

// ── /setup-invite ──────────────────────────────────────────────────────────
const setupInviteCmd: BotCommand = {
  data: new SlashCommandBuilder()
    .setName("setup-invite")
    .setDescription("Set the server invite URL used in referral links")
    .addStringOption(o => o.setName("invite").setDescription("Discord invite URL (e.g. https://discord.gg/abc)").setRequired(true)) as any,
  async execute(interaction) {
    if (!(interaction.member as any)?.permissions?.has("Administrator")) {
      return void interaction.reply({ embeds: [errorEmbed("You need Administrator permission.")], flags: 64 });
    }
    const invite = interaction.options.getString("invite", true);
    if (!invite.startsWith("https://discord.gg/") && !invite.startsWith("https://discord.com/invite/")) {
      return void interaction.reply({ embeds: [errorEmbed("Please provide a valid Discord invite URL (starting with `https://discord.gg/`).")] });
    }
    const { setGuildConfigMulti } = await import("./database");
    setGuildConfigMulti(interaction.guildId!, { invite_url: invite } as any);
    await interaction.reply({ embeds: [successEmbed(`Server invite URL set to: ${invite}\n\nAll referral links will now redirect here.`, "✅ Invite URL Configured")] });
  }
};

export const allCommands: BotCommand[] = [
  warnCmd, warnsCmd, warnLeaderboardCmd,
  adWarnCmd, removeAdWarnCmd,
  muteCmd, unmuteCmd,
  banCmd, fireCmd, promoteCmd, demoteCmd,
  strikeCmd, strikeRemoveCmd,
  jailCmd, unjailCmd,
  messagesCmd, messageLBCmd,
  caseInfoCmd,
  balanceCmd,
  snipeCmd,
  currentBreaksCmd, breakCmd, breakEndCmd,
  resetMessagesCmd, resetMessagesAllCmd,
  banRequestCmd, blacklistRequestCmd, networkBanCmd, partnershipCmd,
  referralCmd, referralLBCmd, setupInviteCmd,
];
