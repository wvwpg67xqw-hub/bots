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
        { name: "Timeout", value: `${mins} min` }
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
}

];