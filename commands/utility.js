import { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } from "discord.js";
import { loadJSON } from "../storage.js";
import { getCasesForUser } from "../modlog.js";
import { logTo, warnFile } from "./helpers.js";

export const utilityCommands = [

/* ───────────────────────
   PING
─────────────────────── */
{
  data: new SlashCommandBuilder()
    .setName("ping")
    .setDescription("Check the bot's connection latency"),

  async execute(i) {
    const sent      = await i.reply({ content: "🏓 Pinging…", fetchReply: true });
    const roundtrip = sent.createdTimestamp - i.createdTimestamp;
    const ws        = i.client.ws.ping;

    const embed = new EmbedBuilder()
      .setColor(roundtrip < 150 ? 0x2ecc71 : roundtrip < 300 ? 0xffcc00 : 0xe74c3c)
      .setTitle("🏓 Pong!")
      .addFields(
        { name: "Roundtrip", value: `${roundtrip}ms`, inline: true },
        { name: "WebSocket", value: `${ws}ms`,         inline: true }
      ).setTimestamp();

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

    const joined   = member ? `<t:${Math.floor(member.joinedTimestamp / 1000)}:R>` : "N/A";
    const timedOut = member?.communicationDisabledUntilTimestamp > Date.now()
      ? `⏳ Until <t:${Math.floor(member.communicationDisabledUntilTimestamp / 1000)}:R>`
      : "✅ None";

    const embed = new EmbedBuilder()
      .setColor(0x7289da).setTitle(`👤 ${u.tag}`)
      .setThumbnail(u.displayAvatarURL({ dynamic: true, size: 256 }))
      .addFields(
        { name: "ID",              value: u.id,                                             inline: true },
        { name: "Account Created", value: `<t:${Math.floor(u.createdTimestamp / 1000)}:R>`, inline: true },
        { name: "Joined Server",   value: joined,                                           inline: true },
        { name: "Warnings",        value: `${warns}`,                                       inline: true },
        { name: "Total Cases",     value: `${cases.length}`,                                inline: true },
        { name: "Active Timeout",  value: timedOut,                                         inline: true },
        { name: "Roles",           value: roles }
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
        { name: "Channel", value: `${i.channel}`,                   inline: true },
        { name: "Delay",   value: secs === 0 ? "Off" : `${secs}s`, inline: true },
        { name: "Set by",  value: `${i.user}`,                      inline: true }
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

];
