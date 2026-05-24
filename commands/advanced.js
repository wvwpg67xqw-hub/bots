import { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } from "discord.js";
import { getCasesForUser, getRecentCases } from "../modlog.js";
import { typeColor } from "./helpers.js";

export const advancedCommands = [

/* ───────────────────────
   CASE — per-user punishment history
─────────────────────── */
{
  data: new SlashCommandBuilder()
    .setName("case")
    .setDescription("Look up all punishment cases for a user")
    .addUserOption(o => o.setName("user").setDescription("User to look up").setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

  async execute(i) {
    const u      = i.options.getUser("user");
    const cases  = getCasesForUser(i.guild.id, u.id);

    if (!cases.length) return i.reply({ content: `📭 No cases found for **${u.tag}**.`, ephemeral: true });

    const recent = cases.slice(-15).reverse();
    const lines  = recent.map(c =>
      `\`#${c.caseId}\` **${c.type}** — <t:${Math.floor(c.timestamp / 1000)}:d> — ${c.reason.slice(0, 60)}`
    ).join("\n");

    const embed = new EmbedBuilder()
      .setColor(0x9b59b6).setTitle(`📁 Cases for ${u.tag}`)
      .setThumbnail(u.displayAvatarURL())
      .setDescription(lines)
      .setFooter({ text: `${cases.length} total case(s) • showing last ${recent.length}` })
      .setTimestamp();

    await i.reply({ embeds: [embed], ephemeral: true });
  }
},

/* ───────────────────────
   HISTORY — server-wide mod log
─────────────────────── */
{
  data: new SlashCommandBuilder()
    .setName("history")
    .setDescription("View the recent moderation log for this server")
    .addIntegerOption(o => o.setName("limit").setDescription("Entries to show (1–25, default 10)").setMinValue(1).setMaxValue(25).setRequired(false))
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

  async execute(i) {
    const limit  = i.options.getInteger("limit") ?? 10;
    const recent = getRecentCases(i.guild.id, limit);

    if (!recent.length) return i.reply({ content: "📭 No moderation history found for this server.", ephemeral: true });

    const lines = recent.map(c =>
      `\`#${c.caseId}\` **${c.type}** — <@${c.userId}> — <t:${Math.floor(c.timestamp / 1000)}:R> — by <@${c.modId}>\n> ${c.reason.slice(0, 80)}`
    ).join("\n\n");

    const embed = new EmbedBuilder()
      .setColor(0x5865f2).setTitle(`📜 Moderation History — Last ${recent.length} Actions`)
      .setDescription(lines)
      .setFooter({ text: `${i.guild.name} • use /case @user for a per-user view` })
      .setTimestamp();

    await i.reply({ embeds: [embed], ephemeral: true });
  }
},

];
