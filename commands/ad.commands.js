import fs from "fs";
import { SlashCommandBuilder, EmbedBuilder } from "discord.js";

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

    const m = await i.guild.members.fetch(u.id);

    const count = add(u.id);
    const time = calc(count);

    await m.timeout(time * 60000, r);

    const embed = new EmbedBuilder()
      .setColor(0xff5500)
      .setTitle("📢 AD WARNING")
      .setDescription(`${u.tag} violated advertisement rules`)
      .addFields(
        { name: "Reason", value: r },
        { name: "Timeout", value: `${time} minutes` }
      )
      .setFooter({ text: "DM <@1501608341661683752> if incorrect" });

    await i.channel.send({ embeds: [embed] });

    i.reply({ content: "AD warn issued", ephemeral: true });
  }
};

export default [adWarn];