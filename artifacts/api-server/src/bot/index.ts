import {
  Client,
  GatewayIntentBits,
  Partials,
  Events,
  type Interaction,
  Colors,
  EmbedBuilder,
} from "discord.js";

import { initDb } from "./database";
import { allCommands } from "./commands";
import { setupCommands } from "./setup";
import { registerCommands } from "./register";
import { logger } from "../lib/logger";

const ALL_COMMANDS = [...setupCommands, ...allCommands];

export function startBot(): Client {
  // =====================
  // INIT DATABASE
  // =====================
  initDb();

  // =====================
  // DISCORD CLIENT
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
  // MESSAGE TRACKING
  // =====================
  client.on(Events.MessageCreate, (message) => {
    if (!message.guild || message.author.bot) return;

    // optional: if you use message stats in database.ts
    try {
      // incrementMessages(message.guild.id, message.author.id);
    } catch {}
  });

  // =====================
  // SNIPE SYSTEM (optional)
  // =====================
  client.on(Events.MessageDelete, (message) => {
    if (!message.guild || message.author?.bot) return;
    if (!message.content) return;

    try {
      // setSnipe(message.guild.id, message.channel.id, ...)
    } catch {}
  });

  // =====================
  // INTERACTIONS
  // =====================
  client.on(Events.InteractionCreate, async (interaction: Interaction) => {
    // SLASH COMMANDS
    if (interaction.isChatInputCommand()) {
      const cmd = commandMap.get(interaction.commandName);
      if (!cmd) return;

      try {
        await cmd.execute(interaction);
      } catch (err) {
        logger.error({ err }, "Command error");

        const msg = {
          embeds: [
            new EmbedBuilder()
              .setColor(Colors.Red)
              .setDescription("❌ Something went wrong."),
          ],
          flags: 64 as const,
        };

        if (interaction.replied || interaction.deferred) {
          await interaction.followUp(msg).catch(() => {});
        } else {
          await interaction.reply(msg).catch(() => {});
        }
      }
    }

    // BUTTONS (applications system if you use it)
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

        // If you still use DB functions, import them later
        // const app = getApplication(appId);

        return interaction.reply({
          content: `Application ${status} (ID: ${appId})`,
          flags: 64,
        });
      }
    }
  });

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