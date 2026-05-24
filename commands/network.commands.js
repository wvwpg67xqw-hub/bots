import {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle
} from "discord.js";

export default [
{
  data: new SlashCommandBuilder()
    .setName("network-ban")
    .setDescription("Ban a user from the network") // REQUIRED
    .addUserOption(o =>
      o.setName("user")
        .setDescription("User to ban")
        .setRequired(true)
    )
    .addStringOption(o =>
      o.setName("reason")
        .setDescription("Reason for ban")
        .setRequired(true)
    ),

  async execute(i) {
    const u = i.options.getUser("user");
    const r = i.options.getString("reason");

    const embed = new EmbedBuilder()
      .setColor(0xff0000)
      .setTitle("🚨 NETWORK BAN")
      .addFields(
        { name: "User", value: u.tag, inline: true },
        { name: "Reason", value: r, inline: true }
      );

    await i.channel.send({ embeds: [embed] });

    const member = await i.guild.members.fetch(u.id).catch(() => null);
    if (member) await member.ban({ reason: r });

    return i.reply({ content: "User banned successfully.", ephemeral: true });
  }
},

{
  data: new SlashCommandBuilder()
    .setName("network-ban-request")
    .setDescription("Request approval for a network ban") // REQUIRED
    .addUserOption(o =>
      o.setName("user")
        .setDescription("User to request ban for")
        .setRequired(true)
    )
    .addStringOption(o =>
      o.setName("reason")
        .setDescription("Reason for request")
        .setRequired(true)
    ),

  async execute(i) {
    const u = i.options.getUser("user");
    const r = i.options.getString("reason");

    const embed = new EmbedBuilder()
      .setColor(0x3498db)
      .setTitle("📩 BAN REQUEST")
      .addFields(
        { name: "User", value: u.tag, inline: true },
        { name: "Reason", value: r, inline: true }
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

    return i.reply({ content: "Ban request sent.", ephemeral: true });
  }
}
];