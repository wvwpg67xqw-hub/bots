import {
  SlashCommandBuilder,
  EmbedBuilder,
  PermissionFlagsBits
} from "discord.js";

import {
  addCase
} from "../modlog.js";

import {
  addWarn,
  warnTime,
  logTo
} from "./helpers.js";

/* ───────────────────────
   ACCESS CONTROL
─────────────────────── */
const allowedRoles = ["HRTL", "~~~staff~~~"];

function hasModAccess(member) {
  return member.roles.cache.some(role =>
    allowedRoles.includes(role.name)
  );
}

function silentFail(i) {
  return i.reply({
    content: "This application did not respond.",
    ephemeral: true,
  });
}

/* ───────────────────────
   WARN COMMAND
─────────────────────── */
export const warnCommand = {
  data: new SlashCommandBuilder()
    .setName("warn")
    .setDescription("Warn a user and apply an automatic escalating timeout")
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

    /* ROLE CHECK */
    if (!hasModAccess(i.member)) return silentFail(i);

    const u = i.options.getUser("user");
    const r = i.options.getString("reason");

    /* SELF-WARN PREVENTION */
    if (u.id === i.user.id) {
      return i.reply({
        content: "❌ You cannot warn yourself.",
        ephemeral: true,
      });
    }

    /* BOT PREVENTION */
    if (u.bot) {
      return i.reply({
        content: "❌ You cannot warn bots.",
        ephemeral: true,
      });
    }

    const member = await i.guild.members.fetch(u.id).catch(() => null);

    if (!member) {
      return i.reply({
        content: "❌ User not found in this server.",
        ephemeral: true,
      });
    }

    const count = addWarn(u.id);
    const mins = warnTime(count);

    await member.timeout(mins * 60000, r);

    const caseId = addCase({
      guildId: i.guild.id,
      type: "WARN",
      userId: u.id,
      userTag: u.tag,
      modId: i.user.id,
      modTag: i.user.tag,
      reason: r,
    });

    const embed = new EmbedBuilder()
      .setColor(0xffcc00)
      .setTitle("⚠️ USER WARNED")
      .setThumbnail(u.displayAvatarURL())
      .addFields(
        { name: "User", value: `${u} (${u.tag})`, inline: true },
        { name: "Moderator", value: `${i.user}`, inline: true },
        { name: "Case", value: `#${caseId}`, inline: true },
        { name: "Total Warnings", value: `${count}`, inline: true },
        { name: "Timeout", value: `${mins} minutes`, inline: true },
        { name: "Reason", value: r }
      )
      .setTimestamp();

    await logTo(i.guild, "logsChannel", embed);

    return i.reply({ embeds: [embed] });
  }
};