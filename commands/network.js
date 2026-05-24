import {
  SlashCommandBuilder,
  EmbedBuilder,
  PermissionFlagsBits,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} from "discord.js";

import { loadJSON } from "../storage.js";
import { addCase } from "../modlog.js";
import { logTo, setupFile } from "./helpers.js";

export const networkCommands = [

/* ───────────────────────
   NETWORK BAN
─────────────────────── */
{
  data: new SlashCommandBuilder()
    .setName("network-ban")
    .setDescription("Globally ban a user and broadcast to the network log")
    .addUserOption(o =>
      o.setName("user")
        .setDescription("User to network-ban")
        .setRequired(true)
    )
    .addStringOption(o =>
      o.setName("reason")
        .setDescription("Reason")
        .setRequired(true)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(i) {

    /* ROLE CHECK */
    const allowedRoles = ["HRTL", "~~~staff~~~"];

    const hasAllowedRole = i.member.roles.cache.some(role =>
      allowedRoles.includes(role.name)
    );

    /* SILENT FAIL */
    if (!hasAllowedRole) {
      return i.reply({
        content: "This application did not respond.",
        ephemeral: true,
      });
    }

    const u = i.options.getUser("user");
    const r = i.options.getString("reason");

    const member =
      await i.guild.members.fetch(u.id).catch(() => null);

    if (!member) {
      return i.reply({
        content: "❌ User not found in this server.",
        ephemeral: true,
      });
    }

    /* TIMEOUT BEFORE BAN */
    await member.timeout(
      10 * 60 * 1000,
      `Network Ban Pending | ${r}`
    ).catch(() => null);

    /* BAN USER */
    await member.ban({ reason: r });

    const caseId = addCase({
      guildId: i.guild.id,
      type: "NETWORK-BAN",
      userId: u.id,
      userTag: u.tag,
      modId: i.user.id,
      modTag: i.user.tag,
      reason: r,
    });

    const embed = new EmbedBuilder()
      .setColor(0xff0000)
      .setTitle("🚨 NETWORK BAN ISSUED")
      .setThumbnail(u.displayAvatarURL())
      .addFields(
        {
          name: "User",
          value: `${u} (${u.tag})`,
          inline: true,
        },
        {
          name: "Moderator",
          value: `${i.user}`,
          inline: true,
        },
        {
          name: "Case",
          value: `#${caseId}`,
          inline: true,
        },
        {
          name: "Action",
          value: "User was timed out before removal.",
        },
        {
          name: "Reason",
          value: r,
        }
      )
      .setTimestamp();

    await logTo(i.guild, "networkLog", embed);
    await logTo(i.guild, "logsChannel", embed);
    await logTo(i.guild, "modsChannel", embed);

    await i.reply({ embeds: [embed] });
  },
},

/* ───────────────────────
   NETWORK UNBAN
─────────────────────── */
{
  data: new SlashCommandBuilder()
    .setName("network-unban")
    .setDescription("Remove a network ban and log the removal")
    .addStringOption(o =>
      o.setName("userid")
        .setDescription("User ID")
        .setRequired(true)
    )
    .addStringOption(o =>
      o.setName("reason")
        .setDescription("Reason")
        .setRequired(false)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(i) {

    /* ROLE CHECK */
    const allowedRoles = ["HRTL", "~~~staff~~~"];

    const hasAllowedRole = i.member.roles.cache.some(role =>
      allowedRoles.includes(role.name)
    );

    /* SILENT FAIL */
    if (!hasAllowedRole) {
      return i.reply({
        content: "This application did not respond.",
        ephemeral: true,
      });
    }

    const uid = i.options.getString("userid");

    const r =
      i.options.getString("reason") ??
      "Network ban lifted";

    const removed =
      await i.guild.bans.remove(uid, r).catch(() => null);

    if (!removed) {
      return i.reply({
        content:
          "❌ Could not remove network ban.",
        ephemeral: true,
      });
    }

    addCase({
      guildId: i.guild.id,
      type: "NETWORK-UNBAN",
      userId: uid,
      userTag: removed.user?.tag ?? uid,
      modId: i.user.id,
      modTag: i.user.tag,
      reason: r,
    });

    const embed = new EmbedBuilder()
      .setColor(0x2ecc71)
      .setTitle("✅ NETWORK BAN REMOVED")
      .addFields(
        {
          name: "User ID",
          value: uid,
          inline: true,
        },
        {
          name: "Moderator",
          value: `${i.user}`,
          inline: true,
        },
        {
          name: "Reason",
          value: r,
        }
      )
      .setTimestamp();

    await logTo(i.guild, "networkLog", embed);
    await logTo(i.guild, "logsChannel", embed);
    await logTo(i.guild, "modsChannel", embed);

    await i.reply({ embeds: [embed] });
  },
},

/* ───────────────────────
   NETWORK BAN REQUEST
─────────────────────── */
{
  data: new SlashCommandBuilder()
    .setName("network-ban-request")
    .setDescription("Submit a network ban request")
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

    const cfg = loadJSON(setupFile);

    const embed = new EmbedBuilder()
      .setColor(0x3498db)
      .setTitle("📩 NETWORK BAN REQUEST")
      .setThumbnail(u.displayAvatarURL())
      .addFields(
        {
          name: "User",
          value: `${u} (${u.tag})`,
          inline: true,
        },
        {
          name: "Requested by",
          value: `${i.user}`,
          inline: true,
        },
        {
          name: "Reason",
          value: r,
        }
      )
      .setTimestamp();

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`ban_accept:${u.id}`)
        .setLabel("✅ Accept")
        .setStyle(ButtonStyle.Success),

      new ButtonBuilder()
        .setCustomId(`ban_reject:${u.id}`)
        .setLabel("❌ Reject")
        .setStyle(ButtonStyle.Danger),

      new ButtonBuilder()
        .setCustomId(`ban_force:${u.id}`)
        .setLabel("🔨 Force Ban")
        .setStyle(ButtonStyle.Secondary)
    );

    const targetChId = cfg.banRequestsChannel;

    const targetCh = targetChId
      ? i.guild.channels.cache.get(targetChId)
      : i.channel;

    if (targetCh) {
      await targetCh.send({
        embeds: [embed],
        components: [row],
      });
    }

    await i.reply({
      content: "📩 Network ban request submitted.",
      ephemeral: true,
    });
  },
},

];