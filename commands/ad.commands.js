import { SlashCommandBuilder, EmbedBuilder } from "discord.js";

export default [
{
  data: new SlashCommandBuilder()
    .setName("ad-warn")
    .setDescription("Ad violation")
    .addUserOption(o => o.setName("user").setRequired(true))
    .addStringOption(o => o.setName("reason").setRequired(true)),

  async execute(i) {
    const u = i.options.getUser("user");
    const r = i.options.getString("reason");
    const m = await i.guild.members.fetch(u.id);

    await m.timeout(5 * 60000, r);

    const embed = new EmbedBuilder()
      .setColor(0xff5500)
      .setTitle("📢 AD WARN")
      .addFields(
        { name: "User", value: u.tag },
        { name: "Reason", value: r }
      );

    i.channel.send({ embeds: [embed] });
    i.reply({ content: "AD warned", ephemeral: true });
  }
}
];