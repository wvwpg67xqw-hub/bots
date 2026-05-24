import {
  SlashCommandBuilder,
  EmbedBuilder,
  PermissionFlagsBits,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  PermissionsBitField,
} from "discord.js";

import { loadJSON, saveJSON } from "./storage.js";
import { addCase, getCasesForUser, getRecentCases, getCaseById } from "./modlog.js";

const warnFile  = "./warnings.json";
const setupFile = "./setup.json";
const jailFile  = "./jaildata.json";

/* =======================
   WARN HELPERS
======================= */
function addWarn(id) {
  const data = loadJSON(warnFile);
  data[id] = (data[id] || 0) + 1;
  saveJSON(warnFile, data);
  return data[id];
}
function warnTime(count) { return 5 + count * 5; }

/* =======================
   LOG HELPER — posts embed to a configured channel key
======================= */
async function logTo(guild, channelKey, embed) {
  const cfg  = loadJSON(setupFile);
  const chId = cfg[channelKey];
  if (!chId) return;
  const ch = guild.channels.cache.get(chId);
  if (ch) await ch.send({ embeds: [embed] }).catch(() => {});
}

/* =======================
   TYPE → COLOUR MAP
======================= */
const typeColor = {
  WARN:           0xffcc00,
  "AD-WARN":      0xff5500,
  MUTE:           0xe74c3c,
  UNMUTE:         0x2ecc71,
  KICK:           0xe67e22,
  BAN:            0xff0000,
  "NETWORK-BAN":  0xff0000,
  UNBAN:          0x2ecc71,
  "NETWORK-UNBAN":0x2ecc71,
  JAIL:           0x95a5a6,
  UNJAIL:         0x2ecc71,
  LOCKDOWN:       0xe74c3c,
  UNLOCK:         0x2ecc71,
};

/* =======================
   COMMANDS
======================= */
export const commands = [

/* ───────────────────────
   WARN
─────────────────────── */
{
  data: new SlashCommandBuilder()
    .setName("warn")
    .setDescription("Warn a user and apply an automatic escalating timeout")
    .addUserOption(o => o.setName("user").setDescription("User to warn").setRequired(true))
    .addStringOption(o => o.setName("reason").setDescription("Reason").setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

  async execute(i) {
    const u      = i.options.getUser("user");
    const r      = i.options.getString("reason");
    const member = await i.guild.members.fetch(u.id);
    const count  = addWarn(u.id);
    const mins   = warnTime(count);

    await member.timeout(mins * 60000, r);

    const caseId = addCase({ guildId: i.guild.id, type: "WARN", userId: u.id, userTag: u.tag, modId: i.user.id, modTag: i.user.tag, reason: r });

    const embed = new EmbedBuilder()
      .setColor(0xffcc00).setTitle("⚠️ USER WARNED")
      .setThumbnail(u.displayAvatarURL())
      .addFields(
        { name: "User",           value: `${u} (${u.tag})`, inline: true },
        { name: "Moderator",      value: `${i.user}`,        inline: true },
        { name: "Case",           value: `#${caseId}`,       inline: true },
        { name: "Total Warnings", value: `${count}`,          inline: true },
        { name: "Timeout",        value: `${mins} minutes`,   inline: true },
        { name: "Reason",         value: r }
      ).setTimestamp();

    await logTo(i.guild, "logsChannel", embed);
    await i.reply({ embeds: [embed] });
  }
},

/* ───────────────────────
   AD-WARN
─────────────────────── */
{
  data: new SlashCommandBuilder()
    .setName("ad-warn")
    .setDescription("Issue an advertisement violation warning (5-min timeout)")
    .addUserOption(o => o.setName("user").setDescription("User who broke ad rules").setRequired(true))
    .addStringOption(o => o.setName("reason").setDescription("What rule was broken").setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

  async execute(i) {
    const u      = i.options.getUser("user");
    const r      = i.options.getString("reason");
    const member = await i.guild.members.fetch(u.id);
    await member.timeout(5 * 60000, r);

    const caseId = addCase({ guildId: i.guild.id, type: "AD-WARN", userId: u.id, userTag: u.tag, modId: i.user.id, modTag: i.user.tag, reason: r });

    const embed = new EmbedBuilder()
      .setColor(0xff5500).setTitle("📢 AD VIOLATION WARNING")
      .setThumbnail(u.displayAvatarURL())
      .addFields(
        { name: "User",      value: `${u} (${u.tag})`, inline: true },
        { name: "Moderator", value: `${i.user}`,        inline: true },
        { name: "Case",      value: `#${caseId}`,       inline: true },
        { name: "Timeout",   value: "5 minutes",        inline: true },
        { name: "Reason",    value: r }
      ).setTimestamp();

    await logTo(i.guild, "adsChannel",  embed);
    await logTo(i.guild, "logsChannel", embed);
    await i.reply({ embeds: [embed] });
  }
},

/* ───────────────────────
   KICK
─────────────────────── */
{
  data: new SlashCommandBuilder()
    .setName("kick")
    .setDescription("Kick a member from the server")
    .addUserOption(o => o.setName("user").setDescription("User to kick").setRequired(true))
    .addStringOption(o => o.setName("reason").setDescription("Reason").setRequired(false))
    .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers),

  async execute(i) {
    const u      = i.options.getUser("user");
    const r      = i.options.getString("reason") ?? "No reason provided";
    const member = await i.guild.members.fetch(u.id).catch(() => null);
    if (!member) return i.reply({ content: "❌ User not found.", ephemeral: true });

    await member.kick(r);
    const caseId = addCase({ guildId: i.guild.id, type: "KICK", userId: u.id, userTag: u.tag, modId: i.user.id, modTag: i.user.tag, reason: r });

    const embed = new EmbedBuilder()
      .setColor(0xe67e22).setTitle("👢 MEMBER KICKED")
      .setThumbnail(u.displayAvatarURL())
      .addFields(
        { name: "User",      value: `${u} (${u.tag})`, inline: true },
        { name: "Moderator", value: `${i.user}`,        inline: true },
        { name: "Case",      value: `#${caseId}`,       inline: true },
        { name: "Reason",    value: r }
      ).setTimestamp();

    await logTo(i.guild, "logsChannel", embed);
    await i.reply({ embeds: [embed] });
  }
},

/* ───────────────────────
   MUTE
─────────────────────── */
{
  data: new SlashCommandBuilder()
    .setName("mute")
    .setDescription("Timeout a user for a specified duration")
    .addUserOption(o => o.setName("user").setDescription("User to mute").setRequired(true))
    .addIntegerOption(o => o.setName("minutes").setDescription("Duration in minutes (1–10080)").setMinValue(1).setMaxValue(10080).setRequired(true))
    .addStringOption(o => o.setName("reason").setDescription("Reason").setRequired(false))
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

  async execute(i) {
    const u      = i.options.getUser("user");
    const mins   = i.options.getInteger("minutes");
    const r      = i.options.getString("reason") ?? "No reason provided";
    const member = await i.guild.members.fetch(u.id).catch(() => null);
    if (!member) return i.reply({ content: "❌ User not found.", ephemeral: true });

    await member.timeout(mins * 60000, r);
    const caseId = addCase({ guildId: i.guild.id, type: "MUTE", userId: u.id, userTag: u.tag, modId: i.user.id, modTag: i.user.tag, reason: `${mins} min — ${r}` });

    const embed = new EmbedBuilder()
      .setColor(0xe74c3c).setTitle("🔇 USER MUTED")
      .setThumbnail(u.displayAvatarURL())
      .addFields(
        { name: "User",      value: `${u} (${u.tag})`,  inline: true },
        { name: "Moderator", value: `${i.user}`,         inline: true },
        { name: "Case",      value: `#${caseId}`,        inline: true },
        { name: "Duration",  value: `${mins} minute(s)`, inline: true },
        { name: "Reason",    value: r }
      ).setTimestamp();

    await logTo(i.guild, "logsChannel", embed);
    await i.reply({ embeds: [embed] });
  }
},

/* ───────────────────────
   UNMUTE
─────────────────────── */
{
  data: new SlashCommandBuilder()
    .setName("unmute")
    .setDescription("Remove a timeout from a user")
    .addUserOption(o => o.setName("user").setDescription("User to unmute").setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

  async execute(i) {
    const u      = i.options.getUser("user");
    const member = await i.guild.members.fetch(u.id).catch(() => null);
    if (!member) return i.reply({ content: "❌ User not found.", ephemeral: true });

    await member.timeout(null);
    addCase({ guildId: i.guild.id, type: "UNMUTE", userId: u.id, userTag: u.tag, modId: i.user.id, modTag: i.user.tag, reason: "Timeout removed" });

    const embed = new EmbedBuilder()
      .setColor(0x2ecc71).setTitle("🔊 USER UNMUTED")
      .setThumbnail(u.displayAvatarURL())
      .addFields(
        { name: "User",      value: `${u} (${u.tag})`, inline: true },
        { name: "Moderator", value: `${i.user}`,        inline: true }
      ).setTimestamp();

    await logTo(i.guild, "logsChannel", embed);
    await i.reply({ embeds: [embed] });
  }
},

/* ───────────────────────
   BAN
─────────────────────── */
{
  data: new SlashCommandBuilder()
    .setName("ban")
    .setDescription("Ban a member from the server")
    .addUserOption(o => o.setName("user").setDescription("User to ban").setRequired(true))
    .addStringOption(o => o.setName("reason").setDescription("Reason").setRequired(true))
    .addIntegerOption(o => o.setName("delete-days").setDescription("Days of messages to delete (0–7)").setMinValue(0).setMaxValue(7).setRequired(false))
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers),

  async execute(i) {
    const u    = i.options.getUser("user");
    const r    = i.options.getString("reason");
    const days = i.options.getInteger("delete-days") ?? 0;

    await i.guild.members.ban(u.id, { reason: r, deleteMessageDays: days });
    const caseId = addCase({ guildId: i.guild.id, type: "BAN", userId: u.id, userTag: u.tag, modId: i.user.id, modTag: i.user.tag, reason: r });

    const embed = new EmbedBuilder()
      .setColor(0xff0000).setTitle("🔨 MEMBER BANNED")
      .setThumbnail(u.displayAvatarURL())
      .addFields(
        { name: "User",             value: `${u} (${u.tag})`, inline: true },
        { name: "Moderator",        value: `${i.user}`,        inline: true },
        { name: "Case",             value: `#${caseId}`,       inline: true },
        { name: "Messages Deleted", value: `${days} day(s)`,   inline: true },
        { name: "Reason",           value: r }
      ).setTimestamp();

    await logTo(i.guild, "logsChannel", embed);
    await i.reply({ embeds: [embed] });
  }
},

/* ───────────────────────
   UNBAN
─────────────────────── */
{
  data: new SlashCommandBuilder()
    .setName("unban")
    .setDescription("Unban a user by their Discord user ID")
    .addStringOption(o => o.setName("userid").setDescription("The user's Discord ID").setRequired(true))
    .addStringOption(o => o.setName("reason").setDescription("Reason").setRequired(false))
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers),

  async execute(i) {
    const uid     = i.options.getString("userid");
    const r       = i.options.getString("reason") ?? "No reason provided";
    const removed = await i.guild.bans.remove(uid, r).catch(() => null);
    if (!removed) return i.reply({ content: "❌ Could not unban — user may not be banned or the ID is invalid.", ephemeral: true });

    addCase({ guildId: i.guild.id, type: "UNBAN", userId: uid, userTag: removed.user?.tag ?? uid, modId: i.user.id, modTag: i.user.tag, reason: r });

    const embed = new EmbedBuilder()
      .setColor(0x2ecc71).setTitle("✅ USER UNBANNED")
      .addFields(
        { name: "User ID",   value: uid,        inline: true },
        { name: "Moderator", value: `${i.user}`, inline: true },
        { name: "Reason",    value: r }
      ).setTimestamp();

    await logTo(i.guild, "logsChannel", embed);
    await i.reply({ embeds: [embed] });
  }
},

/* ───────────────────────
   NETWORK BAN
─────────────────────── */
{
  data: new SlashCommandBuilder()
    .setName("network-ban")
    .setDescription("Globally ban a user and broadcast to the network log")
    .addUserOption(o => o.setName("user").setDescription("User to network-ban").setRequired(true))
    .addStringOption(o => o.setName("reason").setDescription("Reason").setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers),

  async execute(i) {
    const u = i.options.getUser("user");
    const r = i.options.getString("reason");

    const member = await i.guild.members.fetch(u.id).catch(() => null);
    if (member) await member.ban({ reason: r });

    const caseId = addCase({ guildId: i.guild.id, type: "NETWORK-BAN", userId: u.id, userTag: u.tag, modId: i.user.id, modTag: i.user.tag, reason: r });

    const embed = new EmbedBuilder()
      .setColor(0xff0000).setTitle("🚨 NETWORK BAN ISSUED")
      .setThumbnail(u.displayAvatarURL())
      .addFields(
        { name: "User",      value: `${u} (${u.tag})`, inline: true },
        { name: "Moderator", value: `${i.user}`,        inline: true },
        { name: "Case",      value: `#${caseId}`,       inline: true },
        { name: "Reason",    value: r }
      ).setTimestamp();

    await logTo(i.guild, "networkLog",  embed);
    await logTo(i.guild, "logsChannel", embed);
    await logTo(i.guild, "modsChannel", embed);
    await i.reply({ embeds: [embed] });
  }
},

/* ───────────────────────
   NETWORK UNBAN
─────────────────────── */
{
  data: new SlashCommandBuilder()
    .setName("network-unban")
    .setDescription("Remove a network ban and log the removal")
    .addStringOption(o => o.setName("userid").setDescription("The banned user's Discord ID").setRequired(true))
    .addStringOption(o => o.setName("reason").setDescription("Reason for lifting the network ban").setRequired(false))
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers),

  async execute(i) {
    const uid     = i.options.getString("userid");
    const r       = i.options.getString("reason") ?? "Network ban lifted";
    const removed = await i.guild.bans.remove(uid, r).catch(() => null);
    if (!removed) return i.reply({ content: "❌ Could not unban — user may not be network-banned or ID is invalid.", ephemeral: true });

    addCase({ guildId: i.guild.id, type: "NETWORK-UNBAN", userId: uid, userTag: removed.user?.tag ?? uid, modId: i.user.id, modTag: i.user.tag, reason: r });

    const embed = new EmbedBuilder()
      .setColor(0x2ecc71).setTitle("✅ NETWORK BAN REMOVED")
      .addFields(
        { name: "User ID",   value: uid,        inline: true },
        { name: "Moderator", value: `${i.user}`, inline: true },
        { name: "Reason",    value: r }
      ).setTimestamp();

    await logTo(i.guild, "networkLog",  embed);
    await logTo(i.guild, "logsChannel", embed);
    await i.reply({ embeds: [embed] });
  }
},

/* ───────────────────────
   NETWORK BAN REQUEST
─────────────────────── */
{
  data: new SlashCommandBuilder()
    .setName("network-ban-request")
    .setDescription("Submit a network ban request for admin approval")
    .addUserOption(o => o.setName("user").setDescription("User to request ban for").setRequired(true))
    .addStringOption(o => o.setName("reason").setDescription("Reason").setRequired(true)),

  async execute(i) {
    const u   = i.options.getUser("user");
    const r   = i.options.getString("reason");
    const cfg = loadJSON(setupFile);

    const embed = new EmbedBuilder()
      .setColor(0x3498db).setTitle("📩 NETWORK BAN REQUEST")
      .setThumbnail(u.displayAvatarURL())
      .addFields(
        { name: "User",         value: `${u} (${u.tag})`, inline: true },
        { name: "Requested by", value: `${i.user}`,        inline: true },
        { name: "Reason",       value: r }
      ).setTimestamp();

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`ban_accept:${u.id}`).setLabel("✅ Accept").setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId(`ban_reject:${u.id}`).setLabel("❌ Reject").setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId(`ban_force:${u.id}`).setLabel("🔨 Force Ban").setStyle(ButtonStyle.Secondary)
    );

    const targetChId = cfg.banRequestsChannel;
    const targetCh   = targetChId ? i.guild.channels.cache.get(targetChId) : i.channel;
    if (targetCh) await targetCh.send({ embeds: [embed], components: [row] });

    const sentTo = targetChId ? `<#${targetChId}>` : "this channel";
    await i.reply({ content: `📩 Ban request sent to ${sentTo}.`, ephemeral: true });
  }
},

/* ───────────────────────
   LOCKDOWN
─────────────────────── */
{
  data: new SlashCommandBuilder()
    .setName("lockdown")
    .setDescription("Lock a channel — prevents members from sending messages")
    .addChannelOption(o => o.setName("channel").setDescription("Channel to lock (defaults to current)").setRequired(false).addChannelTypes(ChannelType.GuildText))
    .addStringOption(o => o.setName("reason").setDescription("Reason for lockdown").setRequired(false))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),

  async execute(i) {
    const target = i.options.getChannel("channel") ?? i.channel;
    const r      = i.options.getString("reason") ?? "No reason provided";

    await target.permissionOverwrites.edit(i.guild.roles.everyone, {
      SendMessages: false,
    });

    addCase({ guildId: i.guild.id, type: "LOCKDOWN", userId: i.guild.id, userTag: `#${target.name}`, modId: i.user.id, modTag: i.user.tag, reason: r });

    const embed = new EmbedBuilder()
      .setColor(0xe74c3c).setTitle("🔒 CHANNEL LOCKED DOWN")
      .addFields(
        { name: "Channel",   value: `${target}`, inline: true },
        { name: "Locked by", value: `${i.user}`, inline: true },
        { name: "Reason",    value: r }
      ).setTimestamp();

    await target.send({ embeds: [embed] }).catch(() => {});
    await logTo(i.guild, "logsChannel", embed);
    await logTo(i.guild, "modsChannel", embed);
    await i.reply({ embeds: [embed] });
  }
},

/* ───────────────────────
   UNLOCK
─────────────────────── */
{
  data: new SlashCommandBuilder()
    .setName("unlock")
    .setDescription("Reopen a locked channel — restores member messaging")
    .addChannelOption(o => o.setName("channel").setDescription("Channel to unlock (defaults to current)").setRequired(false).addChannelTypes(ChannelType.GuildText))
    .addStringOption(o => o.setName("reason").setDescription("Reason").setRequired(false))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),

  async execute(i) {
    const target = i.options.getChannel("channel") ?? i.channel;
    const r      = i.options.getString("reason") ?? "Lockdown lifted";

    await target.permissionOverwrites.edit(i.guild.roles.everyone, {
      SendMessages: null,
    });

    const embed = new EmbedBuilder()
      .setColor(0x2ecc71).setTitle("🔓 CHANNEL UNLOCKED")
      .addFields(
        { name: "Channel",     value: `${target}`, inline: true },
        { name: "Unlocked by", value: `${i.user}`, inline: true },
        { name: "Reason",      value: r }
      ).setTimestamp();

    await target.send({ embeds: [embed] }).catch(() => {});
    await logTo(i.guild, "logsChannel", embed);
    await i.reply({ embeds: [embed] });
  }
},

/* ───────────────────────
   RAIDMODE
─────────────────────── */
{
  data: new SlashCommandBuilder()
    .setName("raidmode")
    .setDescription("Toggle raid protection — kicks all new joins while active")
    .addStringOption(o =>
      o.setName("action")
        .setDescription("Enable or disable raid mode")
        .setRequired(true)
        .addChoices(
          { name: "enable",  value: "enable"  },
          { name: "disable", value: "disable" }
        )
    )
    .addStringOption(o => o.setName("reason").setDescription("Reason").setRequired(false))
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(i) {
    const action = i.options.getString("action");
    const r      = i.options.getString("reason") ?? "No reason provided";
    const on     = action === "enable";

    // Store raidmode state on the client so the guildMemberAdd handler can read it
    if (!i.client.raidMode) i.client.raidMode = new Map();
    i.client.raidMode.set(i.guild.id, on);

    const embed = new EmbedBuilder()
      .setColor(on ? 0xff0000 : 0x2ecc71)
      .setTitle(on ? "🚨 RAID MODE ENABLED" : "✅ RAID MODE DISABLED")
      .setDescription(on
        ? "⚠️ All new members who join will be **automatically kicked** until raid mode is disabled."
        : "Raid mode is now off. New members can join normally."
      )
      .addFields(
        { name: on ? "Enabled by" : "Disabled by", value: `${i.user}`, inline: true },
        { name: "Reason", value: r }
      )
      .setTimestamp();

    await logTo(i.guild, "logsChannel", embed);
    await logTo(i.guild, "modsChannel", embed);
    await i.reply({ embeds: [embed] });
  }
},

/* ───────────────────────
   SLOWMODE
─────────────────────── */
{
  data: new SlashCommandBuilder()
    .setName("slowmode")
    .setDescription("Set the slowmode delay in this channel (0 = off, max 21600s = 6h)")
    .addIntegerOption(o => o.setName("seconds").setDescription("Delay in seconds").setMinValue(0).setMaxValue(21600).setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),

  async execute(i) {
    const secs = i.options.getInteger("seconds");
    await i.channel.setRateLimitPerUser(secs);

    const embed = new EmbedBuilder()
      .setColor(0x3498db).setTitle("🐢 SLOWMODE UPDATED")
      .addFields(
        { name: "Channel", value: `${i.channel}`,                    inline: true },
        { name: "Delay",   value: secs === 0 ? "Off" : `${secs}s`,  inline: true },
        { name: "Set by",  value: `${i.user}`,                       inline: true }
      ).setTimestamp();

    await logTo(i.guild, "logsChannel", embed);
    await i.reply({ embeds: [embed] });
  }
},

/* ───────────────────────
   PURGE
─────────────────────── */
{
  data: new SlashCommandBuilder()
    .setName("purge")
    .setDescription("Bulk-delete messages in this channel")
    .addIntegerOption(o => o.setName("amount").setDescription("Messages to delete (1–100)").setMinValue(1).setMaxValue(100).setRequired(true))
    .addUserOption(o => o.setName("user").setDescription("Only delete messages from this user (optional)").setRequired(false))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),

  async execute(i) {
    const amount     = i.options.getInteger("amount");
    const filterUser = i.options.getUser("user");

    await i.deferReply({ ephemeral: true });

    const fetched  = await i.channel.messages.fetch({ limit: 100 });
    let toDelete   = [...fetched.values()];
    if (filterUser) toDelete = toDelete.filter(m => m.author.id === filterUser.id);
    toDelete = toDelete.slice(0, amount);

    const deleted = await i.channel.bulkDelete(toDelete, true).catch(() => null);
    const count   = deleted ? deleted.size : 0;

    const logEmbed = new EmbedBuilder()
      .setColor(0xe74c3c).setTitle("🗑️ MESSAGES PURGED")
      .addFields(
        { name: "Channel",   value: `${i.channel}`,                       inline: true },
        { name: "Deleted",   value: `${count}`,                           inline: true },
        { name: "Moderator", value: `${i.user}`,                          inline: true },
        { name: "Filter",    value: filterUser ? filterUser.tag : "None", inline: true }
      ).setTimestamp();

    await logTo(i.guild, "logsChannel", logEmbed);
    await i.editReply({ content: `🗑️ Deleted **${count}** message(s).` });
  }
},

/* ───────────────────────
   JAIL
─────────────────────── */
{
  data: new SlashCommandBuilder()
    .setName("jail")
    .setDescription("Apply the jail role to a user")
    .addUserOption(o => o.setName("user").setDescription("User to jail").setRequired(true))
    .addStringOption(o => o.setName("reason").setDescription("Reason").setRequired(false))
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

  async execute(i) {
    const u   = i.options.getUser("user");
    const r   = i.options.getString("reason") ?? "No reason provided";
    const cfg = loadJSON(setupFile);

    if (!cfg.jailRole) return i.reply({ content: "⚠️ Jail role not configured. Run `/setup roles jail` first.", ephemeral: true });

    const member = await i.guild.members.fetch(u.id).catch(() => null);
    if (!member) return i.reply({ content: "❌ User not found.", ephemeral: true });

    await member.roles.add(cfg.jailRole, r);

    const jailData = loadJSON(jailFile);
    jailData[u.id] = { reason: r, jailedBy: i.user.id, timestamp: Date.now() };
    saveJSON(jailFile, jailData);

    const caseId = addCase({ guildId: i.guild.id, type: "JAIL", userId: u.id, userTag: u.tag, modId: i.user.id, modTag: i.user.tag, reason: r });

    const embed = new EmbedBuilder()
      .setColor(0x95a5a6).setTitle("🔒 USER JAILED")
      .setThumbnail(u.displayAvatarURL())
      .addFields(
        { name: "User",      value: `${u} (${u.tag})`, inline: true },
        { name: "Moderator", value: `${i.user}`,        inline: true },
        { name: "Case",      value: `#${caseId}`,       inline: true },
        { name: "Reason",    value: r }
      ).setTimestamp();

    await logTo(i.guild, "logsChannel", embed);
    await i.reply({ embeds: [embed] });
  }
},

/* ───────────────────────
   UNJAIL
─────────────────────── */
{
  data: new SlashCommandBuilder()
    .setName("unjail")
    .setDescription("Remove the jail role from a user")
    .addUserOption(o => o.setName("user").setDescription("User to unjail").setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

  async execute(i) {
    const u   = i.options.getUser("user");
    const cfg = loadJSON(setupFile);

    if (!cfg.jailRole) return i.reply({ content: "⚠️ Jail role not configured. Run `/setup roles jail` first.", ephemeral: true });

    const member = await i.guild.members.fetch(u.id).catch(() => null);
    if (!member) return i.reply({ content: "❌ User not found.", ephemeral: true });

    await member.roles.remove(cfg.jailRole);

    const jailData = loadJSON(jailFile);
    delete jailData[u.id];
    saveJSON(jailFile, jailData);

    addCase({ guildId: i.guild.id, type: "UNJAIL", userId: u.id, userTag: u.tag, modId: i.user.id, modTag: i.user.tag, reason: "Released from jail" });

    const embed = new EmbedBuilder()
      .setColor(0x2ecc71).setTitle("🔓 USER UNJAILED")
      .setThumbnail(u.displayAvatarURL())
      .addFields(
        { name: "User",      value: `${u} (${u.tag})`, inline: true },
        { name: "Moderator", value: `${i.user}`,        inline: true }
      ).setTimestamp();

    await logTo(i.guild, "logsChannel", embed);
    await i.reply({ embeds: [embed] });
  }
},

/* ───────────────────────
   WARNINGS CHECK
─────────────────────── */
{
  data: new SlashCommandBuilder()
    .setName("warnings")
    .setDescription("Check how many warnings a user has")
    .addUserOption(o => o.setName("user").setDescription("User to check").setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

  async execute(i) {
    const u     = i.options.getUser("user");
    const count = loadJSON(warnFile)[u.id] ?? 0;

    const embed = new EmbedBuilder()
      .setColor(0x9b59b6).setTitle("📋 WARNING RECORD")
      .setThumbnail(u.displayAvatarURL())
      .addFields(
        { name: "User",           value: `${u} (${u.tag})`, inline: true },
        { name: "Total Warnings", value: `${count}`,         inline: true }
      ).setTimestamp();

    await i.reply({ embeds: [embed], ephemeral: true });
  }
},

/* ───────────────────────
   CLEAR WARNINGS
─────────────────────── */
{
  data: new SlashCommandBuilder()
    .setName("clearwarnings")
    .setDescription("Clear all warnings for a user")
    .addUserOption(o => o.setName("user").setDescription("User to clear").setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

  async execute(i) {
    const u    = i.options.getUser("user");
    const data = loadJSON(warnFile);
    const prev = data[u.id] ?? 0;
    delete data[u.id];
    saveJSON(warnFile, data);

    const embed = new EmbedBuilder()
      .setColor(0x1abc9c).setTitle("🧹 WARNINGS CLEARED")
      .setThumbnail(u.displayAvatarURL())
      .addFields(
        { name: "User",             value: `${u} (${u.tag})`, inline: true },
        { name: "Warnings Removed", value: `${prev}`,          inline: true },
        { name: "Cleared by",       value: `${i.user}`,         inline: true }
      ).setTimestamp();

    await logTo(i.guild, "logsChannel", embed);
    await i.reply({ embeds: [embed] });
  }
},

/* ───────────────────────
   PING
─────────────────────── */
{
  data: new SlashCommandBuilder()
    .setName("ping")
    .setDescription("Check the bot's connection latency"),

  async execute(i) {
    const sent = await i.reply({ content: "🏓 Pinging…", fetchReply: true });
    const roundtrip = sent.createdTimestamp - i.createdTimestamp;
    const ws        = i.client.ws.ping;

    const embed = new EmbedBuilder()
      .setColor(roundtrip < 150 ? 0x2ecc71 : roundtrip < 300 ? 0xffcc00 : 0xe74c3c)
      .setTitle("🏓 Pong!")
      .addFields(
        { name: "Roundtrip",    value: `${roundtrip}ms`, inline: true },
        { name: "WebSocket",    value: `${ws}ms`,         inline: true }
      )
      .setTimestamp();

    await i.editReply({ content: null, embeds: [embed] });
  }
},

/* ───────────────────────
   SNIPE
─────────────────────── */
{
  data: new SlashCommandBuilder()
    .setName("snipe")
    .setDescription("Show the last deleted message in this channel"),

  async execute(i) {
    const snipe = i.client.snipeCache?.get(i.channel.id);
    if (!snipe) return i.reply({ content: "🔍 Nothing to snipe — no deleted messages cached here.", ephemeral: true });

    const embed = new EmbedBuilder()
      .setColor(0x5865f2).setTitle("🎯 SNIPED MESSAGE")
      .setDescription(snipe.content || "*[no text content]*")
      .setAuthor({ name: snipe.author.tag, iconURL: snipe.author.displayAvatarURL() })
      .setFooter({ text: `Deleted in #${i.channel.name}` })
      .setTimestamp(snipe.deletedAt);

    await i.reply({ embeds: [embed] });
  }
},

/* ───────────────────────
   USERINFO
─────────────────────── */
{
  data: new SlashCommandBuilder()
    .setName("userinfo")
    .setDescription("Get information about a user")
    .addUserOption(o => o.setName("user").setDescription("User to inspect (defaults to yourself)").setRequired(false)),

  async execute(i) {
    const u      = i.options.getUser("user") ?? i.user;
    const member = await i.guild.members.fetch(u.id).catch(() => null);
    const warns  = loadJSON(warnFile)[u.id] ?? 0;
    const cases  = getCasesForUser(i.guild.id, u.id);

    const roles = member
      ? member.roles.cache
          .filter(r => r.id !== i.guild.id)
          .sort((a, b) => b.position - a.position)
          .map(r => r.toString()).slice(0, 10).join(", ") || "None"
      : "N/A";

    const joined = member ? `<t:${Math.floor(member.joinedTimestamp / 1000)}:R>` : "N/A";
    const timedOut = member?.communicationDisabledUntilTimestamp > Date.now()
      ? `⏳ Until <t:${Math.floor(member.communicationDisabledUntilTimestamp / 1000)}:R>`
      : "✅ None";

    const embed = new EmbedBuilder()
      .setColor(0x7289da).setTitle(`👤 ${u.tag}`)
      .setThumbnail(u.displayAvatarURL({ dynamic: true, size: 256 }))
      .addFields(
        { name: "ID",             value: u.id,                                             inline: true },
        { name: "Account Created",value: `<t:${Math.floor(u.createdTimestamp / 1000)}:R>`, inline: true },
        { name: "Joined Server",  value: joined,                                           inline: true },
        { name: "Warnings",       value: `${warns}`,                                       inline: true },
        { name: "Total Cases",    value: `${cases.length}`,                                inline: true },
        { name: "Active Timeout", value: timedOut,                                         inline: true },
        { name: "Roles",          value: roles }
      ).setTimestamp();

    await i.reply({ embeds: [embed], ephemeral: true });
  }
},

/* ───────────────────────
   SERVERINFO
─────────────────────── */
{
  data: new SlashCommandBuilder()
    .setName("serverinfo")
    .setDescription("Display information about this server"),

  async execute(i) {
    const g = await i.guild.fetch();

    const embed = new EmbedBuilder()
      .setColor(0x7289da).setTitle(`🏠 ${g.name}`)
      .setThumbnail(g.iconURL({ dynamic: true }))
      .addFields(
        { name: "Server ID",   value: g.id,                                              inline: true },
        { name: "Owner",       value: `<@${g.ownerId}>`,                                 inline: true },
        { name: "Members",     value: `${g.memberCount}`,                                inline: true },
        { name: "Channels",    value: `${g.channels.cache.size}`,                        inline: true },
        { name: "Roles",       value: `${g.roles.cache.size}`,                           inline: true },
        { name: "Boost Level", value: `Level ${g.premiumTier}`,                          inline: true },
        { name: "Boosts",      value: `${g.premiumSubscriptionCount ?? 0}`,              inline: true },
        { name: "Created",     value: `<t:${Math.floor(g.createdTimestamp / 1000)}:R>`,  inline: true }
      ).setTimestamp();

    await i.reply({ embeds: [embed] });
  }
},

/* ───────────────────────
   CASE — single case lookup
─────────────────────── */
{
  data: new SlashCommandBuilder()
    .setName("case")
    .setDescription("Look up all punishment cases for a user")
    .addUserOption(o => o.setName("user").setDescription("User to look up").setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

  async execute(i) {
    const u      = i.options.getUser("user");
    const cases  = getCasesForUser(i.guild.id, u.id);

    if (!cases.length) return i.reply({ content: `📭 No cases found for **${u.tag}**.`, ephemeral: true });

    // Build a compact list — show last 15
    const recent = cases.slice(-15).reverse();
    const lines  = recent.map(c =>
      `\`#${c.caseId}\` **${c.type}** — <t:${Math.floor(c.timestamp / 1000)}:d> — ${c.reason.slice(0, 60)}`
    ).join("\n");

    const embed = new EmbedBuilder()
      .setColor(0x9b59b6).setTitle(`📁 Cases for ${u.tag}`)
      .setThumbnail(u.displayAvatarURL())
      .setDescription(lines)
      .setFooter({ text: `${cases.length} total case(s) • showing last ${recent.length}` })
      .setTimestamp();

    await i.reply({ embeds: [embed], ephemeral: true });
  }
},

/* ───────────────────────
   HISTORY — recent server mod log
─────────────────────── */
{
  data: new SlashCommandBuilder()
    .setName("history")
    .setDescription("View the recent moderation log for this server")
    .addIntegerOption(o => o.setName("limit").setDescription("Number of entries to show (1–25, default 10)").setMinValue(1).setMaxValue(25).setRequired(false))
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

  async execute(i) {
    const limit   = i.options.getInteger("limit") ?? 10;
    const recent  = getRecentCases(i.guild.id, limit);

    if (!recent.length) return i.reply({ content: "📭 No moderation history found for this server.", ephemeral: true });

    const lines = recent.map(c => {
      const color = typeColor[c.type] ?? 0x7289da;
      return `\`#${c.caseId}\` **${c.type}** — <@${c.userId}> — <t:${Math.floor(c.timestamp / 1000)}:R> — by <@${c.modId}>\n> ${c.reason.slice(0, 80)}`;
    }).join("\n\n");

    const embed = new EmbedBuilder()
      .setColor(0x5865f2).setTitle(`📜 Moderation History — Last ${recent.length} Actions`)
      .setDescription(lines)
      .setFooter({ text: `${i.guild.name} • use /case @user for a per-user view` })
      .setTimestamp();

    await i.reply({ embeds: [embed], ephemeral: true });
  }
},

/* ───────────────────────
   SETUP
─────────────────────── */
{
  data: new SlashCommandBuilder()
    .setName("setup")
    .setDescription("Configure the bot for this server")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)

    .addSubcommand(sub =>
      sub.setName("view").setDescription("Show the current bot configuration")
    )

    .addSubcommandGroup(grp =>
      grp.setName("channels").setDescription("Set the channels the bot uses")
        .addSubcommand(sub =>
          sub.setName("logs").setDescription("All moderation actions are logged here")
            .addChannelOption(o => o.setName("channel").setDescription("Pick a channel").setRequired(true).addChannelTypes(ChannelType.GuildText))
        )
        .addSubcommand(sub =>
          sub.setName("ads").setDescription("Ad violation warnings are posted here")
            .addChannelOption(o => o.setName("channel").setDescription("Pick a channel").setRequired(true).addChannelTypes(ChannelType.GuildText))
        )
        .addSubcommand(sub =>
          sub.setName("mods").setDescription("General mod alerts and announcements")
            .addChannelOption(o => o.setName("channel").setDescription("Pick a channel").setRequired(true).addChannelTypes(ChannelType.GuildText))
        )
        .addSubcommand(sub =>
          sub.setName("ban-requests").setDescription("Network ban requests are posted here for review")
            .addChannelOption(o => o.setName("channel").setDescription("Pick a channel").setRequired(true).addChannelTypes(ChannelType.GuildText))
        )
        .addSubcommand(sub =>
          sub.setName("network-log").setDescription("Network ban/unban actions are broadcast here")
            .addChannelOption(o => o.setName("channel").setDescription("Pick a channel").setRequired(true).addChannelTypes(ChannelType.GuildText))
        )
    )

    .addSubcommandGroup(grp =>
      grp.setName("roles").setDescription("Set the roles the bot uses")
        .addSubcommand(sub =>
          sub.setName("jail").setDescription("Role applied when a user is jailed")
            .addRoleOption(o => o.setName("role").setDescription("Pick a role").setRequired(true))
        )
        .addSubcommand(sub =>
          sub.setName("mute").setDescription("Legacy mute role")
            .addRoleOption(o => o.setName("role").setDescription("Pick a role").setRequired(true))
        )
        .addSubcommand(sub =>
          sub.setName("staff").setDescription("The staff role")
            .addRoleOption(o => o.setName("role").setDescription("Pick a role").setRequired(true))
        )
        .addSubcommand(sub =>
          sub.setName("admin").setDescription("The admin role")
            .addRoleOption(o => o.setName("role").setDescription("Pick a role").setRequired(true))
        )
    ),

  async execute(i) {
    const cfg = loadJSON(setupFile);
    const sub = i.options.getSubcommand(false);
    const grp = i.options.getSubcommandGroup(false);

    if (sub === "view") {
      const ch = (id) => id ? `<#${id}>` : "❌ Not set";
      const ro = (id) => id ? `<@&${id}>` : "❌ Not set";

      const embed = new EmbedBuilder()
        .setColor(0x5865f2).setTitle("⚙️ Bot Configuration")
        .addFields(
          { name: "📢 Channels",   value: "\u200b" },
          { name: "Logs",          value: ch(cfg.logsChannel),        inline: true },
          { name: "Ads",           value: ch(cfg.adsChannel),         inline: true },
          { name: "Mods",          value: ch(cfg.modsChannel),        inline: true },
          { name: "Ban Requests",  value: ch(cfg.banRequestsChannel), inline: true },
          { name: "Network Log",   value: ch(cfg.networkLog),         inline: true },
          { name: "\u200b",        value: "\u200b" },
          { name: "🎭 Roles",      value: "\u200b" },
          { name: "Jail",   value: ro(cfg.jailRole),   inline: true },
          { name: "Mute",   value: ro(cfg.muteRole),   inline: true },
          { name: "Staff",  value: ro(cfg.staffRole),  inline: true },
          { name: "Admin",  value: ro(cfg.adminRole),  inline: true }
        )
        .setFooter({ text: `Requested by ${i.user.tag}` })
        .setTimestamp();

      return i.reply({ embeds: [embed], ephemeral: true });
    }

    if (grp === "channels") {
      const channel = i.options.getChannel("channel");
      const keyMap  = {
        "logs":          "logsChannel",
        "ads":           "adsChannel",
        "mods":          "modsChannel",
        "ban-requests":  "banRequestsChannel",
        "network-log":   "networkLog",
      };
      cfg[keyMap[sub]] = channel.id;
      saveJSON(setupFile, cfg);
      return i.reply({ embeds: [new EmbedBuilder().setColor(0x2ecc71).setDescription(`✅ **${sub}** channel set to ${channel}`)], ephemeral: true });
    }

    if (grp === "roles") {
      const role   = i.options.getRole("role");
      const keyMap = { jail: "jailRole", mute: "muteRole", staff: "staffRole", admin: "adminRole" };
      cfg[keyMap[sub]] = role.id;
      saveJSON(setupFile, cfg);
      return i.reply({ embeds: [new EmbedBuilder().setColor(0x2ecc71).setDescription(`✅ **${sub}** role set to ${role}`)], ephemeral: true });
    }

    await i.reply({ content: "Unknown setup option.", ephemeral: true });
  }
},

];
