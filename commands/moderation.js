import { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } from "discord.js";
import { loadJSON, saveJSON } from "../storage.js";
import { addCase } from "../modlog.js";
import { addWarn, warnTime, logTo, setupFile, warnFile, jailFile } from "./helpers.js";

export const moderationCommands = [

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

];
