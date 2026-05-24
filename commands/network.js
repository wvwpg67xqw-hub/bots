import {
  SlashCommandBuilder,
  EmbedBuilder,
  PermissionFlagsBits,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
} from "discord.js";
import { loadJSON } from "../storage.js";
import { addCase } from "../modlog.js";
import { logTo, setupFile } from "./helpers.js";

export const networkCommands = [

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
    const u      = i.options.getUser("user");
    const r      = i.options.getString("reason");
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
    .addStringOption(o => o.setName("reason").setDescription("Reason for lifting the ban").setRequired(false))
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
    .addStringOption(o => o.setName("reason").setDescription("Reason").setRequired(false))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),

  async execute(i) {
    const target = i.options.getChannel("channel") ?? i.channel;
    const r      = i.options.getString("reason") ?? "No reason provided";

    await target.permissionOverwrites.edit(i.guild.roles.everyone, { SendMessages: false });

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

    await target.permissionOverwrites.edit(i.guild.roles.everyone, { SendMessages: null });

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
      o.setName("action").setDescription("Enable or disable raid mode").setRequired(true)
        .addChoices({ name: "enable", value: "enable" }, { name: "disable", value: "disable" })
    )
    .addStringOption(o => o.setName("reason").setDescription("Reason").setRequired(false))
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(i) {
    const action = i.options.getString("action");
    const r      = i.options.getString("reason") ?? "No reason provided";
    const on     = action === "enable";

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
      ).setTimestamp();

    await logTo(i.guild, "logsChannel", embed);
    await logTo(i.guild, "modsChannel", embed);
    await i.reply({ embeds: [embed] });
  }
},

];
