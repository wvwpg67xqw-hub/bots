import {
  SlashCommandBuilder,
  EmbedBuilder,
  PermissionFlagsBits,
} from "discord.js";

import { addCase } from "../modlog.js";

/* ───────────────────────
   SIMPLE ACCESS CHECK
─────────────────────── */
const allowedRoles = ["HRTL", "~~~staff~~~"];

function hasModAccess(member) {
  return member?.roles?.cache?.some(r =>
    allowedRoles.includes(r.name)
  );
}

function fail(i) {
  return i.reply({
    content: "❌ No permission.",
    ephemeral: true,
  });
}

/* ───────────────────────
   SNIPE STORE (in-memory fallback)
─────────────────────── */
const snipeCache = new Map();

/* ───────────────────────
   COMMANDS
─────────────────────── */
export const extraModerationCommands = [

/* ───────── PING ───────── */
{
  data: new SlashCommandBuilder()
    .setName("ping")
    .setDescription("Bot latency"),

  async execute(i) {
    const msg = await i.reply({ content: "Pinging...", fetchReply: true });
    const ping = msg.createdTimestamp - i.createdTimestamp;

    return i.editReply(`🏓 Pong! ${ping}ms`);
  }
},

/* ───────── USERINFO ───────── */
{
  data: new SlashCommandBuilder()
    .setName("userinfo")
    .setDescription("Get user info")
    .addUserOption(o =>
      o.setName("user")
        .setDescription("User")
        .setRequired(false)
    ),

  async execute(i) {
    const user = i.options.getUser("user") || i.user;
    const member = await i.guild.members.fetch(user.id).catch(() => null);

    const embed = new EmbedBuilder()
      .setTitle(`👤 ${user.tag}`)
      .setThumbnail(user.displayAvatarURL())
      .addFields(
        { name: "ID", value: user.id, inline: true },
        { name: "Joined", value: member?.joinedAt?.toDateString() ?? "N/A", inline: true },
        { name: "Created", value: user.createdAt.toDateString(), inline: true }
      )
      .setColor(0x3498db);

    return i.reply({ embeds: [embed] });
  }
},

/* ───────── SERVERINFO ───────── */
{
  data: new SlashCommandBuilder()
    .setName("serverinfo")
    .setDescription("Server info"),

  async execute(i) {
    const g = i.guild;

    const embed = new EmbedBuilder()
      .setTitle(`🏠 ${g.name}`)
      .setThumbnail(g.iconURL())
      .addFields(
        { name: "Members", value: `${g.memberCount}`, inline: true },
        { name: "Owner", value: `<@${g.ownerId}>`, inline: true },
        { name: "Created", value: g.createdAt.toDateString(), inline: true }
      )
      .setColor(0x2ecc71);

    return i.reply({ embeds: [embed] });
  }
},

/* ───────── PURGE ───────── */
{
  data: new SlashCommandBuilder()
    .setName("purge")
    .setDescription("Delete messages")
    .addIntegerOption(o =>
      o.setName("amount")
        .setDescription("1-100")
        .setRequired(true)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),

  async execute(i) {
    if (!hasModAccess(i.member)) return fail(i);

    const amount = i.options.getInteger("amount");
    if (amount < 1 || amount > 100) {
      return i.reply({ content: "❌ 1-100 only", ephemeral: true });
    }

    await i.channel.bulkDelete(amount, true);

    return i.reply({
      content: `🧹 Deleted ${amount} messages`,
      ephemeral: true
    });
  }
},

/* ───────── SLOWMODE ───────── */
{
  data: new SlashCommandBuilder()
    .setName("slowmode")
    .setDescription("Set channel slowmode")
    .addIntegerOption(o =>
      o.setName("seconds")
        .setDescription("0-21600")
        .setRequired(true)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),

  async execute(i) {
    if (!hasModAccess(i.member)) return fail(i);

    const sec = i.options.getInteger("seconds");

    await i.channel.setRateLimitPerUser(sec);

    return i.reply({
      content: `⏱ Slowmode set to ${sec}s`,
      ephemeral: true
    });
  }
},

/* ───────── SNIPE ───────── */
{
  data: new SlashCommandBuilder()
    .setName("snipe")
    .setDescription("Show last deleted message"),

  async execute(i) {
    const snipe = snipeCache.get(i.channel.id);

    if (!snipe) {
      return i.reply({ content: "Nothing to snipe.", ephemeral: true });
    }

    const embed = new EmbedBuilder()
      .setTitle("🕵️ Snipe")
      .addFields(
        { name: "Author", value: snipe.author.tag },
        { name: "Content", value: snipe.content || "N/A" }
      )
      .setColor(0xe67e22);

    return i.reply({ embeds: [embed] });
  }
},

];

/* ───────────────────────
   MESSAGE DELETE TRACKER (IMPORTANT)
─────────────────────── */
export function attachSnipe(client) {
  client.on("messageDelete", (message) => {
    if (!message.author || message.author.bot) return;

    snipeCache.set(message.channel.id, {
      content: message.content,
      author: message.author,
      deletedAt: Date.now(),
    });
  });
}