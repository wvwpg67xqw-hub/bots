import {
  Client,
  GatewayIntentBits,
  Partials,
  Events,
  type Interaction,
  ButtonInteraction,
  Colors,
  EmbedBuilder,
} from "discord.js";
import { initDb, setSnipe, incrementMessages, getApplication, updateApplicationStatus, getForm } from "./database";
import { allCommands } from "./commands";
import { setupCommands } from "./setup";
import { registerCommands } from "./register";
import { logger } from "../lib/logger";

const ALL_COMMANDS = [...setupCommands, ...allCommands];

export function startBot(): Client {
  initDb();

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

  const commandMap = new Map(ALL_COMMANDS.map(c => [c.data.name, c]));

  client.once(Events.ClientReady, async (c) => {
    logger.info({ tag: c.user.tag, guilds: c.guilds.cache.size }, "Discord bot ready");
    await registerCommands(ALL_COMMANDS);
  });

  // Track messages
  client.on(Events.MessageCreate, (message) => {
    if (message.author.bot || !message.guild) return;
    incrementMessages(message.guild.id, message.author.id);
  });

  // Cache deleted messages for /snipe
  client.on(Events.MessageDelete, (message) => {
    if (!message.guild || !message.content || message.author?.bot) return;
    setSnipe(
      message.guild.id,
      message.channel.id,
      message.author?.id ?? "unknown",
      message.author?.username ?? "Unknown",
      message.content,
    );
  });

  // Handle interactions
  client.on(Events.InteractionCreate, async (interaction: Interaction) => {
    // Slash commands
    if (interaction.isChatInputCommand()) {
      const cmd = commandMap.get(interaction.commandName);
      if (!cmd) return;
      try {
        await cmd.execute(interaction);
      } catch (err) {
        logger.error({ err, command: interaction.commandName }, "Command error");
        const msg = { embeds: [new EmbedBuilder().setColor(Colors.Red).setDescription("❌ An error occurred while running this command.")], flags: 64 as const };
        if (interaction.replied || interaction.deferred) {
          await interaction.followUp(msg).catch(() => {});
        } else {
          await interaction.reply(msg).catch(() => {});
        }
      }
    }

    // Button interactions (application accept/deny)
    if (interaction.isButton()) {
      const { customId } = interaction;
      if (customId.startsWith("app_accept_") || customId.startsWith("app_deny_")) {
        const status = customId.startsWith("app_accept_") ? "accepted" : "denied";
        const appId = parseInt(customId.split("_")[2]);
        const app = getApplication(appId);
        if (!app) {
          return void interaction.reply({ content: "Application not found.", flags: 64 });
        }
        if (app.status !== "pending") {
          return void interaction.reply({ content: `This application has already been ${app.status}.`, flags: 64 });
        }

        updateApplicationStatus(appId, status, interaction.user.id, interaction.message.id);

        // Assign role if configured
        const form = getForm(app.form_id);
        const roleId = status === "accepted" ? form?.accept_role : form?.deny_role;
        if (roleId && interaction.guild) {
          try {
            const member = await interaction.guild.members.fetch(app.user_id);
            await member.roles.add(roleId);
          } catch { }
        }

        // Update the embed
        const color = status === "accepted" ? Colors.Green : Colors.Red;
        const label = status === "accepted" ? "✅ Accepted" : "❌ Denied";
        const embed = EmbedBuilder.from(interaction.message.embeds[0])
          .setColor(color)
          .setFooter({ text: `${label} by ${interaction.user.tag} • App ID: ${appId}` });

        await interaction.update({ embeds: [embed], components: [] });
      }
    }
  });

  const token = process.env["TOKEN"];
  if (!token) {
    logger.error("TOKEN environment variable is not set — bot will not start");
    return client;
  }

  client.login(token).catch(err => {
    logger.error({ err }, "Failed to login to Discord");
  });

  return client;
}
