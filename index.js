import "dotenv/config";
import {
  Client,
  GatewayIntentBits,
  Collection,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  REST,
  Routes,
} from "discord.js";

import { commands } from "./commands.js";
import { loadJSON } from "./storage.js";
import { addCase } from "./modlog.js";

const setupFile = "./setup.json";

// =========================
// CLIENT
// =========================
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMembers,
  ],
});

client.commands = new Collection();
client.raidMode = new Map();
client.snipeCache = new Map();

// =========================
// SAFE COMMAND LOADER (DEBUG MODE)
// =========================
console.log("🔧 Loading commands...");

for (const cmd of commands ?? []) {
  try {
    if (!cmd?.data || !cmd?.execute) {
      console.log("⚠️ Invalid command skipped (missing data/execute)");
      continue;
    }

    const json = cmd.data.toJSON();

    // 🔥 VALIDATION CHECK (THIS FIXES YOUR CRASH)
    for (const opt of json.options ?? []) {
      if (!opt.description) {
        throw new Error(
          `❌ COMMAND ERROR: "${json.name}" option "${opt.name}" is missing .setDescription()`
        );
      }
    }

    console.log(`✅ Loaded: ${json.name}`);
    client.commands.set(json.name, cmd);
  } catch (err) {
    console.error("❌ COMMAND FAILED TO LOAD:");
    console.error("Command:", cmd?.data?.name ?? "UNKNOWN");
    console.error(err);
  }
}

console.log(`📦 Loaded ${client.commands.size} commands`);

// =========================
// READY
// =========================
client.once("ready", async () => {
  console.log(`✅ Logged in as ${client.user.tag}`);

  const rest = new REST({ version: "10" }).setToken(process.env.TOKEN);

  const body = [...client.commands.values()].map(c => c.data.toJSON());

  try {
    for (const guild of client.guilds.cache.values()) {
      await rest.put(
        Routes.applicationGuildCommands(client.user.id, guild.id),
        { body }
      );

      console.log(`✅ Registered commands in ${guild.name}`);
    }
  } catch (err) {
    console.error("❌ Slash command registration failed:");
    console.error(err);
  }
});

// =========================
// INTERACTION HANDLER (DEBUG SAFE)
// =========================
client.on("interactionCreate", async (interaction) => {
  try {
    if (interaction.isChatInputCommand()) {
      const cmd = client.commands.get(interaction.commandName);

      if (!cmd) {
        console.log(`❌ Unknown command: ${interaction.commandName}`);
        return;
      }

      await cmd.execute(interaction);
    }
  } catch (err) {
    console.error("❌ COMMAND EXECUTION ERROR:");
    console.error("Command:", interaction.commandName);
    console.error(err);

    if (!interaction.replied) {
      await interaction.reply({
        content: "❌ Command error occurred (check console)",
        ephemeral: true,
      });
    }
  }
});

// =========================
// GLOBAL ERROR HANDLING
// =========================
process.on("unhandledRejection", (err) => {
  console.error("⚠️ UNHANDLED REJECTION:");
  console.error(err);
});

process.on("uncaughtException", (err) => {
  console.error("⚠️ UNCAUGHT EXCEPTION:");
  console.error(err);
});

// =========================
// LOGIN SAFETY
// =========================
if (!process.env.TOKEN) {
  console.error("❌ Missing TOKEN in .env");
  process.exit(1);
}

client.login(process.env.TOKEN);