import express from "express";
import {
  Client,
  GatewayIntentBits,
  Partials,
  Events,
  type Interaction,
  Colors,
  EmbedBuilder,
} from "discord.js";

import {
  initDb,
  setSnipe,
  incrementMessages,
  getApplication,
  updateApplicationStatus,
  getForm,
} from "./database";

import { allCommands } from "./commands";
import { setupCommands } from "./setup";
import { registerCommands } from "./register";
import { logger } from "../lib/logger";

const ALL_COMMANDS = [...setupCommands, ...allCommands];

export function startBot(): Client {
  // =========================
  // DATABASE
  // =========================
  initDb();

  // =========================
  // EXPRESS HEALTH SERVER
  // =========================
  const app = express();

  app.get("/", (_req, res) => {
    res.send("Bot is online.");
  });

  app.get("/healthz", (_req, res) => {
    res.status(200).json({
      status: "ok",
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    });
  });

  const PORT = Number(process.env["PORT"]) || 3000;

  app.listen(PORT, "0.0.0.0", () => {
    logger.info(`Health server running on port ${PORT}`);
  });

  // =========================
  // DISCORD CLIENT
  // =========================
  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMembers,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.GuildModeration,
      GatewayIntentBits.MessageContent,
    ],
    partials: [Partials.Message, Partials.Channel],
  });

  const commandMap = new Map(
    ALL_COMMANDS.map((c) => [c.data.name, c]),
  );

  // =========================
  // BOT READY
  // =========================
  client.once(Events.ClientReady, async (c) => {
    logger.info(
      {
        tag: c.user.tag,
        guilds: c.guilds.cache.size,
      },
      "Discord bot ready",
    );

    await registerCommands(ALL_COMMANDS);
  });

  // =========================
  // BOT ADDED TO SERVER
  // =========================
  client.on(Events.GuildCreate, async (guild) => {
    logger.info(
      {
        guild: guild.name,
        id: guild.id,
      },
      "Bot added to new server",
    );

    const ownerId = process.env["OWNER_ID"];

    if (ownerId) {
      try {
        const owner = await client.users.fetch(ownerId);

        await owner.send(
          `🆕 **Bot added to a new server!**

**Server:** ${guild.name}
**Members:** ${guild.memberCount}
**Server ID:** \`${guild.id}\`

Manage it from the dashboard.

Use \`/setup\` in the server to configure it.

If you didn't authorize this, you can remove the bot from the Owner Panel.`,
        );
      } catch {}
    }
  });

  // =========================
  // BOT REMOVED FROM SERVER
  // =========================
  client.on(Events.GuildDelete, (guild) => {
    logger.info(
      {
        guild: guild.name,
        id: guild.id,
      },
      "Bot removed from server",
    );
  });

  // =========================
  // MESSAGE CREATE
  // =========================
  client.on(Events.MessageCreate, (message) => {
    if (message.author.bot || !message.guild) return;

    incrementMessages(message.guild.id, message.author.id);
  });

  // =========================
  // MESSAGE DELETE / SNIPE
  // =========================
  client.on(Events.MessageDelete, (message) => {
    if (
      !message.guild ||
      !message.content ||
      message.author?.bot
    ) {
      return;
    }

    setSnipe(
      message.guild.id,
      message.channel.id,
      message.author?.id ?? "unknown",
      message.author?.username ?? "Unknown",
      message.content,
    );
  });

  // =========================
  // INTERACTIONS
  // =========================
  client.on(
    Events.InteractionCreate,
    async (interaction: Interaction) => {
      // ---------------------
      // SLASH COMMANDS
      // ---------------------
      if (interaction.isChatInputCommand()) {
        const cmd = commandMap.get(interaction.commandName);

        if (!cmd) return;

        try {
          await cmd.execute(interaction);
        } catch (err) {
          logger.error(
            {
              err,
              command: interaction.commandName,
            },
            "Command error",
          );

          const msg = {
            embeds: [
              new EmbedBuilder()
                .setColor(Colors.Red)
                .setDescription(
                  "❌ An error occurred while running this command.",
                ),
            ],
            flags: 64 as const,
          };

          if (
            interaction.replied ||
            interaction.deferred
          ) {
            await interaction.followUp(msg).catch(() => {});
          } else {
            await interaction.reply(msg).catch(() => {});
          }
        }
      }

      // ---------------------
      // APPLICATION BUTTONS
      // ---------------------
      if (interaction.isButton()) {
        const { customId } = interaction;

        if (
          customId.startsWith("app_accept_") ||
          customId.startsWith("app_deny_")
        ) {
          const status = customId.startsWith("app_accept_")
            ? "accepted"
            : "denied";

          const appId = parseInt(
            customId.split("_")[2],
          );

          const app = getApplication(appId);

          if (!app) {
            return void interaction.reply({
              content: "Application not found.",
              flags: 64,
            });
          }

          if (app.status !== "pending") {
            return void interaction.reply({
              content: `This application has already been ${app.status}.`,
              flags: 64,
            });
          }

          updateApplicationStatus(
            appId,
            status,
            interaction.user.id,
            interaction.message.id,
          );

          const form = getForm(app.form_id);

          const roleId =
            status === "accepted"
              ? form?.accept_role
              : form?.deny_role;

          if (roleId && interaction.guild) {
            try {
              const member =
                await interaction.guild.members.fetch(
                  app.user_id,
                );

              await member.roles.add(roleId);
            } catch {}
          }

          const color =
            status === "accepted"
              ? Colors.Green
              : Colors.Red;

          const label =
            status === "accepted"
              ? "✅ Accepted"
              : "❌ Denied";

          const embed = EmbedBuilder.from(
            interaction.message.embeds[0],
          )
            .setColor(color)
            .setFooter({
              text: `${label} by ${interaction.user.tag} • App ID: ${appId}`,
            });

          await interaction.update({
            embeds: [embed],
            components: [],
          });
        }
      }
    },
  );

  // =========================
  // LOGIN
  // =========================
  const token = process.env["TOKEN"];

  if (!token) {
    logger.error(
      "TOKEN environment variable is not set — bot will not start",
    );

    return client;
  }

  client.login(token).catch((err) => {
    logger.error(
      { err },
      "Failed to login to Discord",
    );
  });

  return client;
}