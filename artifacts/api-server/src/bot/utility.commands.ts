import {
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
  EmbedBuilder,
  Colors,
} from "discord.js";

import {
  getMessageCount,
  getTopMessageUsers,
  getSnipe,
  startBreak,
  endBreak,
  getCurrentBreaks,
  getBalance,
  getModCase,
  getGuildConfig,
  getOrCreateReferralCode,
  getReferralStats,
  getReferralLeaderboard,
} from "../database";

import {
  infoEmbed,
  successEmbed,
  errorEmbed,
  formatTimestamp,
} from "../utils";

import { logger } from "../../lib/logger";

import type { BotCommand } from "../types";

// ─────────────────────────────────────────────
// 💬 /messages
// ─────────────────────────────────────────────
const messagesCmd: BotCommand = {
  data: new SlashCommandBuilder()
    .setName("messages")
    .setDescription("View message count for a user")
    .addUserOption(o =>
      o.setName("user").setDescription("User to check (defaults to yourself)")
    ) as any,

  async execute(interaction) {
    const user = interaction.options.getUser("user") ?? interaction.user;
    const count = getMessageCount(interaction.guildId!, user.id);

    await interaction.reply({
      embeds: [
        infoEmbed(
          `**${user.tag}** has sent **${count.toLocaleString()}** messages in this server.`,
          "💬 Message Count"
        ),
      ],
    });
  },
};

// ─────────────────────────────────────────────
// 📊 /message-leaderboard
// ─────────────────────────────────────────────
const messageLeaderboardCmd: BotCommand = {
  data: new SlashCommandBuilder()
    .setName("message-leaderboard")
    .setDescription("Show top message senders") as any,

  async execute(interaction) {
    const top = getTopMessageUsers(interaction.guildId!);

    if (!top.length) {
      return interaction.reply({
        embeds: [infoEmbed("No messages recorded yet.")],
      });
    }

    const lines = top
      .map(
        (r, i) =>
          `**${i + 1}.** <@${r.user_id}> — ${r.count.toLocaleString()} messages`
      )
      .join("\n");

    await interaction.reply({
      embeds: [infoEmbed(lines, "📊 Message Leaderboard")],
    });
  },
};

// ─────────────────────────────────────────────
// 🎯 /snipe
// ─────────────────────────────────────────────
const snipeCmd: BotCommand = {
  data: new SlashCommandBuilder()
    .setName("snipe")
    .setDescription("Show last deleted message in this channel") as any,

  async execute(interaction) {
    const snipe = getSnipe(interaction.guildId!, interaction.channelId!);

    if (!snipe) {
      return interaction.reply({
        embeds: [infoEmbed("No deleted messages found.")],
      });
    }

    const embed = new EmbedBuilder()
      .setColor(Colors.DarkGrey)
      .setTitle("🎯 Sniped Message")
      .setDescription(snipe.content || "*No content*")
      .setFooter({ text: `Sent by ${snipe.username}` })
      .setTimestamp(snipe.timestamp);

    await interaction.reply({ embeds: [embed] });
  },
};

// ─────────────────────────────────────────────
// ☕ /break
// ─────────────────────────────────────────────
const breakCmd: BotCommand = {
  data: new SlashCommandBuilder()
    .setName("break")
    .setDescription("Start a break")
    .addStringOption(o =>
      o.setName("reason").setDescription("Reason for break").setRequired(true)
    ) as any,

  async execute(interaction) {
    const reason = interaction.options.getString("reason", true);

    try {
      startBreak(interaction.guildId!, interaction.user.id, reason);

      await interaction.reply({
        embeds: [
          successEmbed(
            `**${interaction.user.tag}** is now on break.\nReason: ${reason}`,
            "☕ Break Started"
          ),
        ],
      });
    } catch (e: any) {
      if (e.message === "User already on break") {
        return interaction.reply({
          embeds: [errorEmbed("You are already on break.")],
          flags: 64,
        });
      }

      logger.error(e);

      await interaction.reply({
        embeds: [errorEmbed("Failed to start break.")],
        flags: 64,
      });
    }
  },
};

// ─────────────────────────────────────────────
// 👋 /break-end
// ─────────────────────────────────────────────
const breakEndCmd: BotCommand = {
  data: new SlashCommandBuilder()
    .setName("break-end")
    .setDescription("End your break") as any,

  async execute(interaction) {
    try {
      endBreak(interaction.guildId!, interaction.user.id);

      await interaction.reply({
        embeds: [
          successEmbed(
            `**${interaction.user.tag}** is back from break.`,
            "👋 Break Ended"
          ),
        ],
      });
    } catch (e) {
      logger.error(e);

      await interaction.reply({
        embeds: [errorEmbed("Failed to end break.")],
        flags: 64,
      });
    }
  },
};

// ─────────────────────────────────────────────
// 📍 /current-breaks
// ─────────────────────────────────────────────
const currentBreaksCmd: BotCommand = {
  data: new SlashCommandBuilder()
    .setName("current-breaks")
    .setDescription("Show staff currently on break") as any,

  async execute(interaction) {
    const breaks = getCurrentBreaks(interaction.guildId!);

    if (!breaks.length) {
      return interaction.reply({
        embeds: [infoEmbed("No staff are currently on break.")],
      });
    }

    const lines = breaks
      .map(
        b =>
          `<@${b.user_id}> — *${b.reason}* (${formatTimestamp(
            b.started_at
          )})`
      )
      .join("\n");

    await interaction.reply({
      embeds: [infoEmbed(lines, "☕ Staff on Break")],
    });
  },
};

// ─────────────────────────────────────────────
// 💰 /balance
// ─────────────────────────────────────────────
const balanceCmd: BotCommand = {
  data: new SlashCommandBuilder()
    .setName("balance")
    .setDescription("Check your balance")
    .addUserOption(o =>
      o.setName("user").setDescription("User to check (optional)")
    ) as any,

  async execute(interaction) {
    const user = interaction.options.getUser("user") ?? interaction.user;
    const amount = getBalance(interaction.guildId!, user.id);

    await interaction.reply({
      embeds: [
        infoEmbed(
          `**${user.tag}** has **${amount.toLocaleString()} coins**.`,
          "💰 Balance"
        ),
      ],
    });
  },
};

// ─────────────────────────────────────────────
// 📋 /case-info
// ─────────────────────────────────────────────
const caseInfoCmd: BotCommand = {
  data: new SlashCommandBuilder()
    .setName("case-info")
    .setDescription("View a moderation case")
    .addIntegerOption(o =>
      o.setName("id").setDescription("Case ID").setRequired(true)
    ) as any,

  async execute(interaction) {
    const id = interaction.options.getInteger("id", true);
    const c = getModCase(interaction.guildId!, id);

    if (!c) {
      return interaction.reply({
        embeds: [errorEmbed(`Case #${id} not found.`)],
      });
    }

    const embed = new EmbedBuilder()
      .setColor(Colors.Blurple)
      .setTitle(`📋 Case #${c.id}`)
      .addFields(
        { name: "Action", value: c.action, inline: true },
        { name: "User", value: `<@${c.user_id}>`, inline: true },
        { name: "Moderator", value: `<@${c.moderator_id}>`, inline: true },
        { name: "Reason", value: c.reason },
        { name: "Date", value: formatTimestamp(c.timestamp), inline: true }
      );

    if (c.duration) {
      embed.addFields({ name: "Duration", value: c.duration, inline: true });
    }

    await interaction.reply({ embeds: [embed] });
  },
};

// ─────────────────────────────────────────────
// 🔗 /referral
// ─────────────────────────────────────────────
const referralCmd: BotCommand = {
  data: new SlashCommandBuilder()
    .setName("referral")
    .setDescription("View your referral stats")
    .addUserOption(o =>
      o.setName("user").setDescription("Check another user (admin only)")
    ) as any,

  async execute(interaction) {
    const target = interaction.options.getUser("user");
    const user = target ?? interaction.user;

    const code = getOrCreateReferralCode(interaction.guildId!, user.id);
    const stats = getReferralStats(interaction.guildId!, user.id);

    const domain =
      process.env["REPLIT_DOMAINS"]?.split(",")[0] || "your-domain";

    const link = `https://${domain}/refer/${code}`;

    const recent =
      stats.recent.length > 0
        ? stats.recent
            .map(
              r =>
                `• ${r.referred_name} — <t:${Math.floor(
                  r.joined_at / 1000
                )}:R>`
            )
            .join("\n")
        : "No referrals yet.";

    const embed = new EmbedBuilder()
      .setColor(Colors.Green)
      .setTitle(`🔗 Referral Stats — ${user.username}`)
      .setThumbnail(user.displayAvatarURL())
      .addFields(
        { name: "Referral Link", value: `\`${link}\`` },
        { name: "Total Referrals", value: stats.total.toString(), inline: true },
        { name: "Code", value: `\`${code}\``, inline: true },
        { name: "Recent", value: recent }
      );

    await interaction.reply({ embeds: [embed] });
  },
};

// ─────────────────────────────────────────────
// 📊 /referral-leaderboard
// ─────────────────────────────────────────────
const referralLeaderboardCmd: BotCommand = {
  data: new SlashCommandBuilder()
    .setName("referral-leaderboard")
    .setDescription("Top referrers") as any,

  async execute(interaction) {
    const top = getReferralLeaderboard(interaction.guildId!);

    if (!top.length) {
      return interaction.reply({
        embeds: [infoEmbed("No referrals yet.")],
      });
    }

    const lines = top
      .map(
        (r, i) =>
          `**${i + 1}.** <@${r.referrer_id}> — ${r.count} referrals`
      )
      .join("\n");

    await interaction.reply({
      embeds: [infoEmbed(lines, "🔗 Referral Leaderboard")],
    });
  },
};

// ─────────────────────────────────────────────
// 📦 /setup-invite
// ─────────────────────────────────────────────
const setupInviteCmd: BotCommand = {
  data: new SlashCommandBuilder()
    .setName("setup-invite")
    .setDescription("Set referral invite URL")
    .addStringOption(o =>
      o.setName("invite").setDescription("Invite link").setRequired(true)
    ) as any,

  async execute(interaction) {
    if (
      !(interaction.member as any)?.permissions?.has("Administrator")
    ) {
      return interaction.reply({
        embeds: [errorEmbed("Administrator only.")],
        flags: 64,
      });
    }

    const invite = interaction.options.getString("invite", true);

    if (!invite.startsWith("https://discord.gg/")) {
      return interaction.reply({
        embeds: [errorEmbed("Invalid invite link.")],
        flags: 64,
      });
    }

    const { setGuildConfigMulti } = await import("../database");

    setGuildConfigMulti(interaction.guildId!, {
      invite_url: invite,
    } as any);

    await interaction.reply({
      embeds: [
        successEmbed(`Invite set to: ${invite}`, "✅ Updated"),
      ],
    });
  },
};

// ─────────────────────────────────────────────
// EXPORT
// ─────────────────────────────────────────────
export const utilityCommands: BotCommand[] = [
  messagesCmd,
  messageLeaderboardCmd,
  snipeCmd,
  breakCmd,
  breakEndCmd,
  currentBreaksCmd,
  balanceCmd,
  caseInfoCmd,
  referralCmd,
  referralLeaderboardCmd,
  setupInviteCmd,
];