import { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from "discord.js";

export default [
{
  data: new SlashCommandBuilder()
    .setName("network-ban")
    .addUserOption(o => o.setName("user").setRequired(true))
    .addStringOption(o => o.setName("reason").setRequired(true)),

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
    await i.guild.members.ban(u.id);
    i.reply("Banned");
  }
},

{
  data: new SlashCommandBuilder()
    .setName("network-ban-request")
    .addUserOption(o => o.setName("user").setRequired(true))
    .addStringOption(o => o.setName("reason").setRequired(true)),

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

    i.channel.send({ embeds: [embed], components: [row] });

    i.reply({ content: "Request sent", ephemeral: true });
  }
}
];