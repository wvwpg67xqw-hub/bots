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
} from "../database";

import { allCommands } from "../commands";
import { setupCommands } from "../setup";
import { registerCommands } from "../register";
import { logger } from "../../lib/logger";

const ALL_COMMANDS = [...setupCommands, ...allCommands];

export function startBot(): Client {
  // =====================
  // INIT DB
  // =====================
  initDb();

  // =====================
  // CLIENT
  // =====================
  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMembers,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent,
    ],
    partials: [Partials.Message, Partials.Channel],
  });

  const commandMap = new Map(
    ALL_COMMANDS.map((cmd) => [cmd.data.name, cmd]),
  );

  // =====================
  // READY EVENT
  // =====================
  client.once(Events.ClientReady, async (c) => {
    logger.info(
      { tag: c.user.tag, guilds: c.guilds.cache.size },
      "Bot ready",
    );

    await registerCommands(ALL_COMMANDS);
  });

  // =====================
  // GUILD JOIN
  // =====================
  client.on(Events.GuildCreate, async (guild) => {
    logger.info(
      { guild: guild.name, id: guild.id },
      "Joined new server",
    );
  });

  // =====================
  // MESSAGE TRACKING
  // =====================
  client.on(Events.MessageCreate, (message) => {
    if (!message.guild || message.author.bot) return;

    incrementMessages(message.guild.id, message.author.id);
  });

  // =====================
  // SNIPE SYSTEM
  // =====================
  client.on(Events.MessageDelete, (message) => {
    if (!message.guild || message.author?.bot) return;
    if (!message.content) return;

    setSnipe(
      message.guild.id,
      message.channel.id,
      message.author?.id ?? "unknown",
      message.author?.username ?? "Unknown",
      message.content,
    );
  });

  // =====================
  // INTERACTIONS
  // =====================
  client.on(
    Events.InteractionCreate,
    async (interaction: Interaction) => {
      // SLASH COMMANDS
      if (interaction.isChatInputCommand()) {
        const cmd = commandMap.get(interaction.commandName);
        if (!cmd) return;

        try {
          await cmd.execute(interaction);
        } catch (err) {
          logger.error(
            { err },
            "Command error",
          );

          const errorMsg = {
            embeds: [
              new EmbedBuilder()
                .setColor(Colors.Red)
                .setDescription("❌ Something went wrong."),
            ],
            flags: 64 as const,
          };

          if (interaction.replied || interaction.deferred) {
            await interaction.followUp(errorMsg).catch(() => {});
          } else {
            await interaction.reply(errorMsg).catch(() => {});
          }
        }
      }

      // BUTTONS (applications)
      if (interaction.isButton()) {
        const { customId } = interaction;

        if (
          customId.startsWith("app_accept_") ||
          customId.startsWith("app_deny_")
        ) {
          const status = customId.startsWith("app_accept_")
            ? "accepted"
            : "denied";

          const appId = Number(customId.split("_")[2]);

          const app = getApplication(appId);
          if (!app) {
            return interaction.reply({
              content: "Application not found.",
              flags: 64,
            });
          }

          if (app.status !== "pending") {
            return interaction.reply({
              content: `Already ${app.status}.`,
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
                await interaction.guild.members.fetch(app.user_id);

              await member.roles.add(roleId);
            } catch {}
          }

          const color =
            status === "accepted"
              ? Colors.Green
              : Colors.Red;

          const label =
            status === "accepted"
              ? "Accepted"
              : "Denied";

          const embed = EmbedBuilder.from(
            interaction.message.embeds[0],
          )
            .setColor(color)
            .setFooter({
              text: `${label} by ${interaction.user.tag}`,
            });

          await interaction.update({
            embeds: [embed],
            components: [],
          });
        }
      }
    },
  );

  // =====================
  // LOGIN
  // =====================
  const token = process.env["TOKEN"];

  if (!token) {
    logger.error("Missing TOKEN");
    return client;
  }

  client.login(token).catch((err) => {
    logger.error({ err }, "Login failed");
  });

  return client;
}