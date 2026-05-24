import fs from "fs";
import {
  SlashCommandBuilder,
  EmbedBuilder,
  PermissionFlagsBits,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle
} from "discord.js";

const warnFile = "./warnings.json";
const setupFile = "./setup.json";
const jailFile = "./jaildata.json";

/* =======================
   STORAGE HELPERS
======================= */

function loadJSON(file) {
  if (!fs.existsSync(file)) return {};
  return JSON.parse(fs.readFileSync(file));
}

function saveJSON(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

/* =======================
   WARN SYSTEM
======================= */

function addWarn(id) {
  const data = loadJSON(warnFile);
  data[id] = (data[id] || 0) + 1;
  saveJSON(warnFile, data);
  return data[id];
}

function warnTime(count) {
  return 5 + count * 5; // minutes
}

/* =======================
   COMMANDS
======================= */

export const commands = [

/* -----------------------
   WARN
----------------------- */
{
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
        .setDescription("Reason")
        .setRequired(true)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

  async execute(i) {
    const u = i.options.getUser("user");
    const r = i.options.getString("reason");

    const member = await i.guild.members.fetch(u.id);
    const count = addWarn(u.id);
    const mins = warnTime(count);

    await member.timeout(mins * 60000, r);

    const embed = new EmbedBuilder()
      .setColor(0xffcc00)
      .setTitle("⚠️ WARN")
      .addFields(
        { name: "User", value: u.tag },
        { name: "Reason", value: r },
        { name: "Timeout", value: `${mins} min` },
        { name: "Total Warnings", value: `${count}` }
      );

    await i.channel.send({ embeds: [embed] });
    await i.reply({ content: "User warned", ephemeral: true });
  }
},

/* -----------------------
   AD WARN
----------------------- */
{
  data: new SlashCommandBuilder()
    .setName("ad-warn")
    .setDescription("Ad violation warn")
    .addUserOption(o =>
      o.setName("user")
        .setDescription("User")
        .setRequired(true)
    )
    .addStringOption(o =>
      o.setName("reason")
        .setDescription("Reason")
        .setRequired(true)
    ),

  async execute(i) {
    const u = i.options.getUser("user");
    const r = i.options.getString("reason");

    const member = await i.guild.members.fetch(u.id);
    await member.timeout(5 * 60000, r);

    const embed = new EmbedBuilder()
      .setColor(0xff5500)
      .setTitle("📢 AD WARN")
      .addFields(
        { name: "User", value: u.tag },
        { name: "Reason", value: r }
      );

    await i.channel.send({ embeds: [embed] });
    await i.reply({ content: "Ad warned", ephemeral: true });
  }
},

/* -----------------------
   NETWORK BAN
----------------------- */
{
  data: new SlashCommandBuilder()
    .setName("network-ban")
    .setDescription("Ban user")
    .addUserOption(o =>
      o.setName("user")
        .setDescription("User")
        .setRequired(true)
    )
    .addStringOption(o =>
      o.setName("reason")
        .setDescription("Reason")
        .setRequired(true)
    ),

  async execute(i) {
    const u = i.options.getUser("user");
    const r = i.options.getString("reason");

    const embed = new EmbedBuilder()
      .setColor(0xff0000)
      .setTitle("🚨 NETWORK BAN")
      .addFields(
        { name: "User", value: u.tag },
        { name: "Reason", value: r }
      );

    await i.channel.send({ embeds: [embed] });

    const member = await i.guild.members.fetch(u.id).catch(() => null);
    if (member) await member.ban({ reason: r });

    await i.reply({ content: "User banned", ephemeral: true });
  }
},

/* -----------------------
   NETWORK BAN REQUEST
----------------------- */
{
  data: new SlashCommandBuilder()
    .setName("network-ban-request")
    .setDescription("Request a network ban")
    .addUserOption(o =>
      o.setName("user")
        .setDescription("User")
        .setRequired(true)
    )
    .addStringOption(o =>
      o.setName("reason")
        .setDescription("Reason")
        .setRequired(true)
    ),

  async execute(i) {
    const u = i.options.getUser("user");
    const r = i.options.getString("reason");

    const embed = new EmbedBuilder()
      .setColor(0x3498db)
      .setTitle("📩 BAN REQUEST")
      .addFields(
        { name: "User", value: u.tag },
        { name: "Reason", value: r }
      );

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`ban_accept:${u.id}`)
        .setLabel("Accept")
        .setStyle(ButtonStyle.Success),

      new ButtonBuilder()
        .setCustomId(`ban_reject:${u.id}`)
        .setLabel("Reject")
        .setStyle(ButtonStyle.Danger),

      new ButtonBuilder()
        .setCustomId(`ban_force:${u.id}`)
        .setLabel("Force Ban")
        .setStyle(ButtonStyle.Secondary)
    );

    await i.channel.send({ embeds: [embed], components: [row] });
    await i.reply({ content: "Request sent", ephemeral: true });
  }
},

/* -----------------------
   SETUP
----------------------- */
{
  data: new SlashCommandBuilder()
    .setName("setup")
    .setDescription("Set config")
    .addStringOption(o =>
      o.setName("key")
        .setDescription("Config key")
        .setRequired(true)
    )
    .addStringOption(o =>
      o.setName("value")
        .setDescription("Value")
        .setRequired(true)
    ),

  async execute(i) {
    const data = loadJSON(setupFile);

    const key = i.options.getString("key");
    const value = i.options.getString("value");

    data[key] = value;

    saveJSON(setupFile, data);

    await i.reply({ content: "Updated config", ephemeral: true });
  }
},

/* -----------------------
   SNIPE
----------------------- */
{
  data: new SlashCommandBuilder()
    .setName("snipe")
    .setDescription("Shows last deleted message"),

  async execute(i) {
    await i.reply("Snipe system placeholder (needs message tracking)");
  }
},

/* -----------------------
   KICK
----------------------- */
{
  data: new SlashCommandBuilder()
    .setName("kick")
    .setDescription("Kick a user from the server")
    .addUserOption(o =>
      o.setName("user")
        .setDescription("User to kick")
        .setRequired(true)
    )
    .addStringOption(o =>
      o.setName("reason")
        .setDescription("Reason for kick")
        .setRequired(false)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers),

  async execute(i) {
    const u = i.options.getUser("user");
    const r = i.options.getString("reason") ?? "No reason provided";

    const member = await i.guild.members.fetch(u.id).catch(() => null);
    if (!member) return i.reply({ content: "User not found in server.", ephemeral: true });

    await member.kick(r);

    const embed = new EmbedBuilder()
      .setColor(0xe67e22)
      .setTitle("👢 KICK")
      .addFields(
        { name: "User", value: u.tag },
        { name: "Reason", value: r },
        { name: "Moderator", value: i.user.tag }
      )
      .setTimestamp();

    await i.channel.send({ embeds: [embed] });
    await i.reply({ content: "User kicked.", ephemeral: true });
  }
},

/* -----------------------
   UNBAN
----------------------- */
{
  data: new SlashCommandBuilder()
    .setName("unban")
    .setDescription("Unban a user by their ID")
    .addStringOption(o =>
      o.setName("userid")
        .setDescription("The user's Discord ID")
        .setRequired(true)
    )
    .addStringOption(o =>
      o.setName("reason")
        .setDescription("Reason for unban")
        .setRequired(false)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers),

  async execute(i) {
    const uid = i.options.getString("userid");
    const r = i.options.getString("reason") ?? "No reason provided";

    await i.guild.bans.remove(uid, r).catch(async () => {
      return i.reply({ content: "Could not unban — user may not be banned or ID is invalid.", ephemeral: true });
    });

    const embed = new EmbedBuilder()
      .setColor(0x2ecc71)
      .setTitle("✅ UNBAN")
      .addFields(
        { name: "User ID", value: uid },
        { name: "Reason", value: r },
        { name: "Moderator", value: i.user.tag }
      )
      .setTimestamp();

    await i.channel.send({ embeds: [embed] });
    if (!i.replied) await i.reply({ content: "User unbanned.", ephemeral: true });
  }
},

/* -----------------------
   UNMUTE (Remove Timeout)
----------------------- */
{
  data: new SlashCommandBuilder()
    .setName("unmute")
    .setDescription("Remove a timeout from a user")
    .addUserOption(o =>
      o.setName("user")
        .setDescription("User to unmute")
        .setRequired(true)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

  async execute(i) {
    const u = i.options.getUser("user");
    const member = await i.guild.members.fetch(u.id).catch(() => null);
    if (!member) return i.reply({ content: "User not found.", ephemeral: true });

    await member.timeout(null);

    const embed = new EmbedBuilder()
      .setColor(0x2ecc71)
      .setTitle("🔊 UNMUTE")
      .addFields(
        { name: "User", value: u.tag },
        { name: "Moderator", value: i.user.tag }
      )
      .setTimestamp();

    await i.channel.send({ embeds: [embed] });
    await i.reply({ content: "Timeout removed.", ephemeral: true });
  }
},

/* -----------------------
   WARNINGS CHECK
----------------------- */
{
  data: new SlashCommandBuilder()
    .setName("warnings")
    .setDescription("Check how many warnings a user has")
    .addUserOption(o =>
      o.setName("user")
        .setDescription("User to check")
        .setRequired(true)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

  async execute(i) {
    const u = i.options.getUser("user");
    const data = loadJSON(warnFile);
    const count = data[u.id] ?? 0;

    const embed = new EmbedBuilder()
      .setColor(0x9b59b6)
      .setTitle("📋 WARNINGS")
      .addFields(
        { name: "User", value: u.tag },
        { name: "Total Warnings", value: `${count}` }
      )
      .setTimestamp();

    await i.reply({ embeds: [embed], ephemeral: true });
  }
},

/* -----------------------
   CLEAR WARNINGS
----------------------- */
{
  data: new SlashCommandBuilder()
    .setName("clearwarnings")
    .setDescription("Clear all warnings for a user")
    .addUserOption(o =>
      o.setName("user")
        .setDescription("User to clear")
        .setRequired(true)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

  async execute(i) {
    const u = i.options.getUser("user");
    const data = loadJSON(warnFile);
    const prev = data[u.id] ?? 0;
    delete data[u.id];
    saveJSON(warnFile, data);

    const embed = new EmbedBuilder()
      .setColor(0x1abc9c)
      .setTitle("🧹 WARNINGS CLEARED")
      .addFields(
        { name: "User", value: u.tag },
        { name: "Warnings Removed", value: `${prev}` },
        { name: "Moderator", value: i.user.tag }
      )
      .setTimestamp();

    await i.channel.send({ embeds: [embed] });
    await i.reply({ content: "Warnings cleared.", ephemeral: true });
  }
},

/* -----------------------
   PURGE
----------------------- */
{
  data: new SlashCommandBuilder()
    .setName("purge")
    .setDescription("Bulk delete messages in the current channel")
    .addIntegerOption(o =>
      o.setName("amount")
        .setDescription("Number of messages to delete (1–100)")
        .setMinValue(1)
        .setMaxValue(100)
        .setRequired(true)
    )
    .addUserOption(o =>
      o.setName("user")
        .setDescription("Only delete messages from this user (optional)")
        .setRequired(false)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),

  async execute(i) {
    const amount = i.options.getInteger("amount");
    const filterUser = i.options.getUser("user");

    await i.deferReply({ ephemeral: true });

    const fetched = await i.channel.messages.fetch({ limit: 100 });
    let toDelete = [...fetched.values()];

    if (filterUser) toDelete = toDelete.filter(m => m.author.id === filterUser.id);

    toDelete = toDelete.slice(0, amount);

    const deleted = await i.channel.bulkDelete(toDelete, true).catch(() => null);
    const count = deleted ? deleted.size : 0;

    await i.editReply({ content: `🗑️ Deleted **${count}** message(s).` });
  }
},

/* -----------------------
   JAIL
----------------------- */
{
  data: new SlashCommandBuilder()
    .setName("jail")
    .setDescription("Apply the jail role to a user")
    .addUserOption(o =>
      o.setName("user")
        .setDescription("User to jail")
        .setRequired(true)
    )
    .addStringOption(o =>
      o.setName("reason")
        .setDescription("Reason")
        .setRequired(false)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

  async execute(i) {
    const u = i.options.getUser("user");
    const r = i.options.getString("reason") ?? "No reason provided";
    const cfg = loadJSON(setupFile);

    if (!cfg.jailRole) return i.reply({ content: "⚠️ Jail role not configured. Use `/setup key:jailRole value:<roleId>`.", ephemeral: true });

    const member = await i.guild.members.fetch(u.id).catch(() => null);
    if (!member) return i.reply({ content: "User not found.", ephemeral: true });

    await member.roles.add(cfg.jailRole, r);

    const jailData = loadJSON(jailFile);
    jailData[u.id] = { reason: r, jailedBy: i.user.id, timestamp: Date.now() };
    saveJSON(jailFile, jailData);

    const embed = new EmbedBuilder()
      .setColor(0x95a5a6)
      .setTitle("🔒 JAILED")
      .addFields(
        { name: "User", value: u.tag },
        { name: "Reason", value: r },
        { name: "Moderator", value: i.user.tag }
      )
      .setTimestamp();

    await i.channel.send({ embeds: [embed] });
    await i.reply({ content: "User jailed.", ephemeral: true });
  }
},

/* -----------------------
   UNJAIL
----------------------- */
{
  data: new SlashCommandBuilder()
    .setName("unjail")
    .setDescription("Remove the jail role from a user")
    .addUserOption(o =>
      o.setName("user")
        .setDescription("User to unjail")
        .setRequired(true)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

  async execute(i) {
    const u = i.options.getUser("user");
    const cfg = loadJSON(setupFile);

    if (!cfg.jailRole) return i.reply({ content: "⚠️ Jail role not configured. Use `/setup key:jailRole value:<roleId>`.", ephemeral: true });

    const member = await i.guild.members.fetch(u.id).catch(() => null);
    if (!member) return i.reply({ content: "User not found.", ephemeral: true });

    await member.roles.remove(cfg.jailRole);

    const jailData = loadJSON(jailFile);
    delete jailData[u.id];
    saveJSON(jailFile, jailData);

    const embed = new EmbedBuilder()
      .setColor(0x2ecc71)
      .setTitle("🔓 UNJAILED")
      .addFields(
        { name: "User", value: u.tag },
        { name: "Moderator", value: i.user.tag }
      )
      .setTimestamp();

    await i.channel.send({ embeds: [embed] });
    await i.reply({ content: "User unjailed.", ephemeral: true });
  }
},

/* -----------------------
   SLOWMODE
----------------------- */
{
  data: new SlashCommandBuilder()
    .setName("slowmode")
    .setDescription("Set slowmode in the current channel")
    .addIntegerOption(o =>
      o.setName("seconds")
        .setDescription("Slowmode delay in seconds (0 to disable, max 21600)")
        .setMinValue(0)
        .setMaxValue(21600)
        .setRequired(true)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),

  async execute(i) {
    const secs = i.options.getInteger("seconds");
    await i.channel.setRateLimitPerUser(secs);

    const msg = secs === 0 ? "Slowmode disabled." : `Slowmode set to **${secs}s**.`;

    const embed = new EmbedBuilder()
      .setColor(0x3498db)
      .setTitle("🐢 SLOWMODE")
      .setDescription(msg)
      .addFields({ name: "Set by", value: i.user.tag })
      .setTimestamp();

    await i.channel.send({ embeds: [embed] });
    await i.reply({ content: msg, ephemeral: true });
  }
},

/* -----------------------
   USERINFO
----------------------- */
{
  data: new SlashCommandBuilder()
    .setName("userinfo")
    .setDescription("Get information about a user")
    .addUserOption(o =>
      o.setName("user")
        .setDescription("User to inspect (defaults to yourself)")
        .setRequired(false)
    ),

  async execute(i) {
    const u = i.options.getUser("user") ?? i.user;
    const member = await i.guild.members.fetch(u.id).catch(() => null);
    const warns = loadJSON(warnFile)[u.id] ?? 0;

    const roles = member
      ? member.roles.cache
          .filter(r => r.id !== i.guild.id)
          .map(r => r.toString())
          .join(", ") || "None"
      : "N/A";

    const joined = member
      ? `<t:${Math.floor(member.joinedTimestamp / 1000)}:R>`
      : "N/A";

    const embed = new EmbedBuilder()
      .setColor(0x7289da)
      .setTitle("👤 USER INFO")
      .setThumbnail(u.displayAvatarURL({ dynamic: true }))
      .addFields(
        { name: "Tag", value: u.tag, inline: true },
        { name: "ID", value: u.id, inline: true },
        { name: "Account Created", value: `<t:${Math.floor(u.createdTimestamp / 1000)}:R>`, inline: true },
        { name: "Joined Server", value: joined, inline: true },
        { name: "Warnings", value: `${warns}`, inline: true },
        { name: "Roles", value: roles }
      )
      .setTimestamp();

    await i.reply({ embeds: [embed], ephemeral: true });
  }
},

/* -----------------------
   MUTE (Timed Timeout)
----------------------- */
{
  data: new SlashCommandBuilder()
    .setName("mute")
    .setDescription("Timeout a user for a set duration")
    .addUserOption(o =>
      o.setName("user")
        .setDescription("User to mute")
        .setRequired(true)
    )
    .addIntegerOption(o =>
      o.setName("minutes")
        .setDescription("Duration in minutes (1–10080)")
        .setMinValue(1)
        .setMaxValue(10080)
        .setRequired(true)
    )
    .addStringOption(o =>
      o.setName("reason")
        .setDescription("Reason")
        .setRequired(false)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

  async execute(i) {
    const u = i.options.getUser("user");
    const mins = i.options.getInteger("minutes");
    const r = i.options.getString("reason") ?? "No reason provided";

    const member = await i.guild.members.fetch(u.id).catch(() => null);
    if (!member) return i.reply({ content: "User not found.", ephemeral: true });

    await member.timeout(mins * 60000, r);

    const embed = new EmbedBuilder()
      .setColor(0xe74c3c)
      .setTitle("🔇 MUTE")
      .addFields(
        { name: "User", value: u.tag },
        { name: "Duration", value: `${mins} minute(s)` },
        { name: "Reason", value: r },
        { name: "Moderator", value: i.user.tag }
      )
      .setTimestamp();

    await i.channel.send({ embeds: [embed] });
    await i.reply({ content: "User muted.", ephemeral: true });
  }
},

/* -----------------------
   SERVERINFO
----------------------- */
{
  data: new SlashCommandBuilder()
    .setName("serverinfo")
    .setDescription("Display information about this server"),

  async execute(i) {
    const g = i.guild;
    await g.fetch();

    const embed = new EmbedBuilder()
      .setColor(0x7289da)
      .setTitle(`🏠 ${g.name}`)
      .setThumbnail(g.iconURL({ dynamic: true }))
      .addFields(
        { name: "Server ID", value: g.id, inline: true },
        { name: "Owner", value: `<@${g.ownerId}>`, inline: true },
        { name: "Members", value: `${g.memberCount}`, inline: true },
        { name: "Channels", value: `${g.channels.cache.size}`, inline: true },
        { name: "Roles", value: `${g.roles.cache.size}`, inline: true },
        { name: "Boost Level", value: `${g.premiumTier}`, inline: true },
        { name: "Created", value: `<t:${Math.floor(g.createdTimestamp / 1000)}:R>`, inline: true }
      )
      .setTimestamp();

    await i.reply({ embeds: [embed] });
  }
}

];
