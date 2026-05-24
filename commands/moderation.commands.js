import fs from "fs";
import { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } from "discord.js";

const warnFile = "./warnings.json";

function load() {
  if (!fs.existsSync(warnFile)) return {};
  return JSON.parse(fs.readFileSync(warnFile));
}

function save(d) {
  fs.writeFileSync(warnFile, JSON.stringify(d, null, 2));
}

function addWarn(id) {
  const d = load();
  d[id] = (d[id] || 0) + 1;
  save(d);
  return d[id];
}

function time(count) {
  return 5 + count * 5;
}

export default [
{
  data: new SlashCommandBuilder()
    .setName("warn")
    .setDescription("Warn user")
    .addUserOption(o => o.setName("user").setRequired(true))
    .addStringOption(o => o.setName("reason").setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

  async execute(i) {
    const u = i.options.getUser("user");
    const r = i.options.getString("reason");
    const m = await i.guild.members.fetch(u.id);

    const count = addWarn(u.id);
    const mins = time(count);

    await m.timeout(mins * 60000, r);

    const embed = new EmbedBuilder()
      .setColor(0xffcc00)
      .setTitle("⚠️ WARN")
      .addFields(
        { name: "User", value: u.tag },
        { name: "Reason", value: r },
        { name: "Timeout", value: `${mins} min` }
      );

    i.channel.send({ embeds: [embed] });
    i.reply({ content: "Warned", ephemeral: true });
  }
}
];