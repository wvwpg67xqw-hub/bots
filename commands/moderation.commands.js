import fs from "fs";
import { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } from "discord.js";

const warnFile = "./warnings.json";
const jailFile = "./jaildata.json";

/* ---------- HELPERS ---------- */

function load(file) {
  if (!fs.existsSync(file)) return {};
  return JSON.parse(fs.readFileSync(file));
}

function save(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

/* ---------- WARN SYSTEM ---------- */

function addWarn(id) {
  const data = load(warnFile);
  data[id] = (data[id] || 0) + 1;
  save(warnFile, data);
  return data[id];
}

function calcTime(count) {
  return 5 + (count * 5);
}

/* ---------- WARN ---------- */

const warn = {
  data: new SlashCommandBuilder()
    .setName("warn")
    .setDescription("Warn a user")
    .addUserOption(o => o.setName("user").setRequired(true))
    .addStringOption(o => o.setName("reason").setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

  async execute(i) {
    const u = i.options.getUser("user");
    const r = i.options.getString("reason");
    const m = await i.guild.members.fetch(u.id);

    const count = addWarn(u.id);
    const time = calcTime(count);

    await m.timeout(time * 60000, r);

    const embed = new EmbedBuilder()
      .setColor(0xffcc00)
      .setTitle("⚠️ USER WARNED")
      .addFields(
        { name: "User", value: u.tag },
        { name: "Reason", value: r },
        { name: "Timeout", value: `${time} minutes` }
      )
      .setFooter({ text: "DM <@1501608341661683752> if incorrect" });

    await i.channel.send({ embeds: [embed] });
    i.reply({ content: "User warned", ephemeral: true });
  }
};

/* ---------- MUTE ---------- */

const mute = {
  data: new SlashCommandBuilder()
    .setName("mute")
    .addUserOption(o => o.setName("user").setRequired(true))
    .addIntegerOption(o => o.setName("minutes").setRequired(true))
    .addStringOption(o => o.setName("reason").setRequired(true)),

  async execute(i) {
    const u = i.options.getUser("user");
    const m = await i.guild.members.fetch(u.id);

    await m.timeout(i.options.getInteger("minutes") * 60000, i.options.getString("reason"));

    i.reply(`🔇 Muted ${u.tag}`);
  }
};

/* ---------- UNMUTE ---------- */

const unmute = {
  data: new SlashCommandBuilder()
    .setName("unmute")
    .addUserOption(o => o.setName("user").setRequired(true)),

  async execute(i) {
    const u = i.options.getUser("user");
    const m = await i.guild.members.fetch(u.id);

    await m.timeout(null);

    i.reply(`🔊 Unmuted ${u.tag}`);
  }
};

/* ---------- JAIL ---------- */

const jail = {
  data: new SlashCommandBuilder()
    .setName("jail")
    .addUserOption(o => o.setName("user").setRequired(true))
    .addStringOption(o => o.setName("reason").setRequired(true)),

  async execute(i) {
    const u = i.options.getUser("user");
    const m = await i.guild.members.fetch(u.id);

    const roles = m.roles.cache.filter(r => r.id !== i.guild.id).map(r => r.id);

    const data = load(jailFile);
    data[u.id] = roles;
    save(jailFile, data);

    await m.roles.set([]);

    const jr = i.guild.roles.cache.find(r => r.name === "Jail");
    if (jr) await m.roles.add(jr);

    i.reply(`🚨 Jailed ${u.tag}`);
  }
};

/* ---------- UNJAIL ---------- */

const unjail = {
  data: new SlashCommandBuilder()
    .setName("unjail")
    .addUserOption(o => o.setName("user").setRequired(true)),

  async execute(i) {
    const u = i.options.getUser("user");
    const m = await i.guild.members.fetch(u.id);

    const data = load(jailFile);
    const roles = data[u.id] || [];

    await m.roles.set(roles);

    delete data[u.id];
    save(jailFile, data);

    i.reply(`✅ Unjailed ${u.tag}`);
  }
};

export default [warn, mute, unmute, jail, unjail];