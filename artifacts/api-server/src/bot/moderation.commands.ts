import {
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
  EmbedBuilder,
  Colors,
} from "discord.js";

import {
  addWarning,
  getWarnings,
  getTopWarnedUsers,
  addAdWarning,
  removeAdWarning,
  getAdWarnings,
  addStrike,
  removeStrike,
  getStrikes,
  addModCase,
  getGuildConfig,
} from "../database";

import {
  successEmbed,
  errorEmbed,
  warnEmbed,
  infoEmbed,
  formatTimestamp,
  parseDuration,
} from "../utils";

import { logger } from "../../lib/logger";
import type { BotCommand } from "../types";

// ─────────────────────────────────────────────
// ⚠️ /warn
// ─────────────────────────────────────────────
const warnCmd: BotCommand = {
  data: new SlashCommandBuilder()
    .setName("warn")
    .setDescription("Warn a user")
    .addUserOption(o =>
      o.setName("user").setDescription("User to warn").setRequired(true)
    )
    .addStringOption(o =>
      o.setName("reason").setDescription("Reason").setRequired(true)
    ) as any,

  async execute(interaction) {
    const user = interaction.options.getUser("user", true);
    const reason = interaction.options.getString("reason", true);

    const id = addWarning(
      interaction.guildId!,
      user.id,
      interaction.user.id,
      reason
    );

    const warns = getWarnings(interaction.guildId!, user.id);

    await interaction.reply({
      embeds: [
        successEmbed(
          `**${user.tag}** warned.\nReason: ${reason}\nTotal: ${warns.length}\nCase: #${id}`,
          "⚠️ Warning Issued"
        ),
      ],
    });

    try {
      await user.send({
        embeds: [
          warnEmbed(
            `You were warned in **${interaction.guild!.name}**.\nReason: ${reason}`,
            "⚠️ Warning"
          ),
        ],
      });
    } catch {}

    await sendModLog(interaction, "warn", user, reason, undefined, id);
  },
};

// ─────────────────────────────────────────────
// 📋 /warns
// ─────────────────────────────────────────────
const warnsCmd: BotCommand = {
  data: new SlashCommandBuilder()
    .setName("warns")
    .setDescription("View user warnings")
    .addUserOption(o =>
      o.setName("user").setDescription("User").setRequired(true)
    ) as any,

  async execute(interaction) {
    const user = interaction.options.getUser("user", true);
    const warns = getWarnings(interaction.guildId!, user.id);

    if (!warns.length) {
      return interaction.reply({
        embeds: [infoEmbed(`${user.tag} has no warnings.`)],
      });
    }

    const lines = warns
      .slice(0, 10)
      .map(
        w =>
          `**#${w.id}** ${w.reason} — <@${w.moderator_id}> (${formatTimestamp(
            w.timestamp
          )})`
      )
      .join("\n");

    await interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setColor(Colors.Yellow)
          .setTitle(`⚠️ Warnings for ${user.tag}`)
          .setDescription(lines)
          .setFooter({ text: `Total: ${warns.length}` }),
      ],
    });
  },
};

// ─────────────────────────────────────────────
// ⚠️ /warn-leaderboard
// ─────────────────────────────────────────────
const warnLeaderboardCmd: BotCommand = {
  data: new SlashCommandBuilder()
    .setName("warn-leaderboard")
    .setDescription("Top warned users") as any,

  async execute(interaction) {
    const top = getTopWarnedUsers(interaction.guildId!);

    if (!top.length) {
      return interaction.reply({
        embeds: [infoEmbed("No warnings yet.")],
      });
    }

    const lines = top
      .map((r, i) => `**${i + 1}.** <@${r.user_id}> — ${r.count}`)
      .join("\n");

    await interaction.reply({
      embeds: [infoEmbed(lines, "⚠️ Warning Leaderboard")],
    });
  },
};

// ─────────────────────────────────────────────
// 📢 /ad-warn
// ─────────────────────────────────────────────
const adWarnCmd: BotCommand = {
  data: new SlashCommandBuilder()
    .setName("ad-warn")
    .setDescription("Issue ad warning")
    .addUserOption(o =>
      o.setName("user").setDescription("User").setRequired(true)
    )
    .addStringOption(o =>
      o.setName("reason").setDescription("Reason").setRequired(true)
    ) as any,

  async execute(interaction) {
    const user = interaction.options.getUser("user", true);
    const reason = interaction.options.getString("reason", true);

    const id = addAdWarning(
      interaction.guildId!,
      user.id,
      interaction.user.id,
      reason
    );

    const warns = getAdWarnings(interaction.guildId!, user.id);

    await interaction.reply({
      embeds: [
        successEmbed(
          `**${user.tag}** received ad warning.\nReason: ${reason}\nTotal: ${warns.length}`,
          "📢 Ad Warning"
        ),
      ],
    });

    await sendModLog(interaction, "ad-warn", user, reason, undefined, id);
  },
};

// ─────────────────────────────────────────────
// ❌ /remove-ad-warn
// ─────────────────────────────────────────────
const removeAdWarnCmd: BotCommand = {
  data: new SlashCommandBuilder()
    .setName("remove-ad-warn")
    .setDescription("Remove ad warning")
    .addIntegerOption(o =>
      o.setName("id").setDescription("Warning ID").setRequired(true)
    ) as any,

  async execute(interaction) {
    const id = interaction.options.getInteger("id", true);

    removeAdWarning(interaction.guildId!, id);

    await interaction.reply({
      embeds: [successEmbed(`Ad warning #${id} removed.`)],
    });
  },
};

// ─────────────────────────────────────────────
// 🔨 /ban
// ─────────────────────────────────────────────
const banCmd: BotCommand = {
  data: new SlashCommandBuilder()
    .setName("ban")
    .setDescription("Ban a user")
    .addUserOption(o =>
      o.setName("user").setDescription("User").setRequired(true)
    )
    .addStringOption(o =>
      o.setName("reason").setDescription("Reason")
    ) as any,

  async execute(interaction) {
    const user = interaction.options.getUser("user", true);
    const reason =
      interaction.options.getString("reason") ?? "No reason provided";

    try {
      await interaction.guild!.members.ban(user, { reason });

      addModCase(
        interaction.guildId!,
        user.id,
        interaction.user.id,
        "ban",
        reason
      );

      await interaction.reply({
        embeds: [
          successEmbed(
            `**${user.tag}** banned.\nReason: ${reason}`,
            "🔨 Banned"
          ),
        ],
      });

      await sendModLog(interaction, "ban", user, reason);
    } catch (e) {
      logger.error(e);
      await interaction.reply({
        embeds: [errorEmbed("Failed to ban user.")],
      });
    }
  },
};

// ─────────────────────────────────────────────
// ⚡ /strike
// ─────────────────────────────────────────────
const strikeCmd: BotCommand = {
  data: new SlashCommandBuilder()
    .setName("strike")
    .setDescription("Issue a strike")
    .addUserOption(o =>
      o.setName("user").setDescription("User").setRequired(true)
    )
    .addStringOption(o =>
      o.setName("reason").setDescription("Reason").setRequired(true)
    ) as any,

  async execute(interaction) {
    const user = interaction.options.getUser("user", true);
    const reason = interaction.options.getString("reason", true);

    const id = addStrike(
      interaction.guildId!,
      user.id,
      interaction.user.id,
      reason
    );

    const strikes = getStrikes(interaction.guildId!, user.id);

    await interaction.reply({
      embeds: [
        successEmbed(
          `**${user.tag}** struck.\nTotal: ${strikes.length}\nCase: #${id}`,
          "⚡ Strike Issued"
        ),
      ],
    });

    await sendModLog(interaction, "strike", user, reason, undefined, id);
  },
};

// ─────────────────────────────────────────────
// ❌ /strike-remove
// ─────────────────────────────────────────────
const strikeRemoveCmd: BotCommand = {
  data: new SlashCommandBuilder()
    .setName("strike-remove")
    .setDescription("Remove strike")
    .addIntegerOption(o =>
      o.setName("id").setDescription("Strike ID").setRequired(true)
    ) as any,

  async execute(interaction) {
    const id = interaction.options.getInteger("id", true);

    removeStrike(interaction.guildId!, id);

    await interaction.reply({
      embeds: [successEmbed(`Strike #${id} removed.`)],
    });
  },
};

// ─────────────────────────────────────────────
// 📦 EXPORT
// ─────────────────────────────────────────────
export const moderationCommands: BotCommand[] = [
  warnCmd,
  warnsCmd,
  warnLeaderboardCmd,
  adWarnCmd,
  removeAdWarnCmd,
  banCmd,
  strikeCmd,
  strikeRemoveCmd,
];

// ─────────────────────────────────────────────
// 📡 MOD LOG HELPER
// ─────────────────────────────────────────────
async function sendModLog(
  interaction: ChatInputCommandInteraction,
  action: string,
  user: any,
  reason: string,
  duration?: string,
  caseId?: number
) {
  const config = getGuildConfig(interaction.guildId!);
  const logId = config?.mod_log_channel;

  if (!logId) return;

  const channel = interaction.guild?.channels.cache.get(logId);
  if (!channel?.isTextBased()) return;

  const embed = new EmbedBuilder()
    .setColor(Colors.Blurple)
    .setTitle(`📋 ${action.toUpperCase()}`)
    .addFields(
      { name: "User", value: `${user.tag} (${user.id})` },
      { name: "Moderator", value: `<@${interaction.user.id}>` },
      { name: "Reason", value: reason }
    )
    .setTimestamp();

  if (caseId) embed.setFooter({ text: `Case #${caseId}` });

  await channel.send({ embeds: [embed] }).catch(() => {});
}