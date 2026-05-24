import fs from "fs";
import { SlashCommandBuilder } from "discord.js";

const file = "./warnings.json";

function load() {
  if (!fs.existsSync(file)) return {};
  return JSON.parse(fs.readFileSync(file));
}

function save(d) {
  fs.writeFileSync(file, JSON.stringify(d, null, 2));
}

function add(id) {
  const d = load();
  d[id] = (d[id] || 0) + 1;
  save(d);
  return d[id];
}

function calc(n) {
  return 5 + (n * 5);
}

const adWarn = {
  data: new SlashCommandBuilder()
    .setName("ad-warn")
    .setDescription("Warn advertisement violation")
    .addUserOption(o => o.setName("user").setRequired(true))
    .addStringOption(o => o.setName("reason").setRequired(true))
    .addStringOption(o => o.setName("target")),

  async execute(i) {
    const u = i.options.getUser("user");
    const r = i.options.getString("reason");
    const t = i.options.getString("target");

    const m = await i.guild.members.fetch(u.id);

    const count = add(u.id);
    const time = calc(count);

    await m.timeout(time * 60000, r);

    if (t) {
      const msg = await i.channel.messages.fetch(t).catch(() => null);
      if (msg) await msg.delete();
    }

    i.reply(`📢 AD WARN ${u.tag} | ${time} min timeout`);
  }
};

export default [adWarn];