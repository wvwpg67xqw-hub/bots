import "dotenv/config";
import {
  Client,
  GatewayIntentBits,
  Collection,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  REST,
  Routes,
} from "discord.js";

import { commands } from "./commands.js";
import { loadJSON, saveJSON } from "./storage.js";

const setupFile = "./setup.json";

// =========================
// CLIENT SETUP
// =========================
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

client.commands = new Collection();

// =========================
// LOAD COMMANDS
// =========================
for (const cmd of commands ?? []) {
  if (!cmd?.data || !cmd?.execute) {
    console.log("⚠️ Skipping invalid command");
    continue;
  }
  client.commands.set(cmd.data.name, cmd);
}

console.log(`📦 Loaded ${client.commands.size} commands`);

// =========================
// SNIPE CACHE  (channel id → last deleted message)
// =========================
client.snipeCache = new Map();

client.on("messageDelete", (message) => {
  if (!message.author || message.author.bot) return;
  client.snipeCache.set(message.channel.id, {
    content:   message.content,
    author:    message.author,
    deletedAt: Date.now(),
  });
});

// =========================
// READY — auto-register slash commands to all guilds
// =========================
client.once("ready", async () => {
  console.log(`✅ Logged in as ${client.user.tag}`);

  const rest = new REST({ version: "10" }).setToken(process.env.TOKEN);
  const body = commands.map(c => c.data.toJSON());

  for (const guild of client.guilds.cache.values()) {
    try {
      await rest.put(
        Routes.applicationGuildCommands(client.user.id, guild.id),
        { body }
      );
      console.log(`✅ Registered ${body.length} commands in: ${guild.name}`);
    } catch (err) {
      console.error(`❌ Failed to register commands in ${guild.name}:`, err);
    }
  }
});

// =========================
// INTERACTION HANDLER
// =========================
client.on("interactionCreate", async (interaction) => {
  try {

    // ── Slash commands ──────────────────────────────────────
    if (interaction.isChatInputCommand()) {
      const cmd = client.commands.get(interaction.commandName);
      if (!cmd) {
        console.log(`❌ Unknown command: ${interaction.commandName}`);
        return;
      }
      await cmd.execute(interaction);
      return;
    }

    // ── Button interactions ─────────────────────────────────
    if (interaction.isButton()) {
      const [action, userId] = interaction.customId.split(":");
      if (!["ban_accept", "ban_reject", "ban_force"].includes(action)) return;

      const cfg = loadJSON(setupFile);
      const logsId = cfg.logsChannel;

      // Disable all buttons on the original message
      const disabledRow = new ActionRowBuilder().addComponents(
        ...interaction.message.components[0].components.map(btn =>
          ButtonBuilder.from(btn).setDisabled(true)
        )
      );

      if (action === "ban_reject") {
        const embed = new EmbedBuilder()
          .setColor(0x95a5a6)
          .setTitle("❌ BAN REQUEST REJECTED")
          .addFields(
            { name: "User ID", value: userId },
            { name: "Rejected by", value: interaction.user.tag }
          )
          .setTimestamp();

        await interaction.message.edit({ components: [disabledRow] });
        await interaction.reply({ embeds: [embed], ephemeral: false });

        if (logsId) {
          const logCh = interaction.guild.channels.cache.get(logsId);
          if (logCh) await logCh.send({ embeds: [embed] });
        }
        return;
      }

      // accept or force — both result in a ban
      const member = await interaction.guild.members.fetch(userId).catch(() => null);
      const user = await interaction.client.users.fetch(userId).catch(() => null);
      const label = action === "ban_force" ? "🔨 BAN FORCE-EXECUTED" : "✅ BAN REQUEST ACCEPTED";
      const color = action === "ban_force" ? 0xff0000 : 0x2ecc71;

      if (member) await member.ban({ reason: `Ban request approved by ${interaction.user.tag}` });

      const embed = new EmbedBuilder()
        .setColor(color)
        .setTitle(label)
        .addFields(
          { name: "User", value: user ? user.tag : userId },
          { name: "User ID", value: userId },
          { name: "Approved by", value: interaction.user.tag }
        )
        .setTimestamp();

      await interaction.message.edit({ components: [disabledRow] });
      await interaction.reply({ embeds: [embed], ephemeral: false });

      if (logsId) {
        const logCh = interaction.guild.channels.cache.get(logsId);
        if (logCh) await logCh.send({ embeds: [embed] });
      }
    }

  } catch (err) {
    console.error("❌ Interaction error:", err);
    try {
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({ content: "❌ Something went wrong.", ephemeral: true });
      }
    } catch {}
  }
});

// =========================
// GLOBAL ERROR SAFETY
// =========================
process.on("unhandledRejection", (err) => {
  console.error("⚠️ Unhandled Rejection:", err);
});

process.on("uncaughtException", (err) => {
  console.error("⚠️ Uncaught Exception:", err);
});

// =========================
// LOGIN
// =========================
if (!process.env.TOKEN) {
  console.error("❌ Missing TOKEN in .env");
  process.exit(1);
}

client.login(process.env.TOKEN);
