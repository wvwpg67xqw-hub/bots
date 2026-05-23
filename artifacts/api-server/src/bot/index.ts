import {
  Client,
  GatewayIntentBits,
  Partials,
  Events,
  type ChatInputCommandInteraction,
  Colors,
  EmbedBuilder,
  type Interaction,
} from "discord.js";

import { initDb, getCommandPermissions } from "./database";
import { allCommands } from "./commands"; // ✅ FIXED (THIS is the correct entry)
import { setupCommands } from "./setup";
import { registerCommands } from "./register";
import { logger } from "../lib/logger";

const ALL_COMMANDS = [...setupCommands, ...allCommands];

// =====================
// BOT START
// =====================
export function startBot(): Client {
  initDb();

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
    ALL_COMMANDS.map((cmd) => [cmd.data.name, cmd])
  );

  // =====================
  // READY EVENT
  // =====================
  client.once(Events.ClientReady, async (c) => {
    logger.info(
      { tag: c.user.tag, guilds: c.guilds.cache.size },
      "Bot ready"
    );

    try {
      await registerCommands(ALL_COMMANDS);
      logger.info("Slash commands registered");
    } catch (err) {
      logger.error({ err }, "Failed to register commands");
    }
  });

  // =====================
  // MESSAGE TRACKING (optional)
  // =====================
  client.on(Events.MessageCreate, (message) => {
    if (!message.guild || message.author.bot) return;

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
      // setSnipe(message.guild.id, message.channel.id, message.content, message.author.tag);
    } catch {}
  });

  // =====================
  // INTERACTIONS
  // =====================
  client.on(Events.InteractionCreate, async (interaction: Interaction) => {
    // =====================
    // SLASH COMMANDS
    // =====================
    if (interaction.isChatInputCommand()) {
      const cmd = commandMap.get(interaction.commandName);
      if (!cmd) return;

      const member = interaction.member;

      if (!member || !("roles" in member)) {
        return interaction.reply({
          content: "❌ Cannot verify permissions.",
          flags: 64,
        });
      }

      try {
        const allowedRoles = getCommandPermissions(
          interaction.guildId!,
          interaction.commandName
        );

        const memberRoles = member.roles.cache.map(r => r.id);

        // 👑 OWNER BYPASS
        if (interaction.user.id === interaction.guild?.ownerId) {
          return cmd.execute(interaction as ChatInputCommandInteraction);
        }

        // 🔒 ROLE CHECK
        const hasPermission = memberRoles.some(role =>
          allowedRoles.includes(role)
        );

        if (!hasPermission) {
          return interaction.reply({
            content: "❌ You don't have permission to use this command.",
            flags: 64,
          });
        }

        await cmd.execute(interaction as ChatInputCommandInteraction);

      } catch (err) {
        logger.error({ err }, "Command error");

        const errorMsg = {
          embeds: [
            new EmbedBuilder()
              .setColor(Colors.Red)
              .setDescription(
                "❌ Something went wrong while running this command."
              ),
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

    // =====================
    // BUTTONS (APPLICATION SYSTEM)
    // =====================
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
    logger.error("Missing TOKEN in environment variables");
    return client;
  }

  client.login(token).catch((err) => {
    logger.error({ err }, "Bot login failed");
  });

  return client;
}