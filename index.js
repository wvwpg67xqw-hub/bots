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
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
  ],
});

client.commands = new Collection();
client.raidMode = new Map();
client.snipeCache = new Map();

// =========================
// DEBUG MODE FLAG
// =========================
const DEBUG = true;

function debugLog(...args) {
  if (DEBUG) console.log("🐞 [DEBUG]", ...args);
}

// =========================
// LOAD COMMANDS (SAFE MODE)
// =========================
for (const cmd of commands ?? []) {
  try {
    if (!cmd?.data) {
      console.log("⚠️ Skipping command: missing data");
      continue;
    }

    if (!cmd?.execute) {
      console.log(`⚠️ Skipping command ${cmd.data?.name}: missing execute`);
      continue;
    }

    // 🔥 CRASH FIX: validate builder before register
    const json = cmd.data.toJSON();

    if (!json?.name || typeof json.name !== "string") {
      throw new Error(`Invalid command name in: ${cmd.data?.name}`);
    }

    if (!json?.description || typeof json.description !== "string") {
      throw new Error(`Missing description in: ${json.name}`);
    }

    client.commands.set(json.name, cmd);
    debugLog(`Loaded command: ${json.name}`);
  } catch (err) {
    console.error("❌ COMMAND LOAD FAILED:", err);
    console.error("➡️ Problem command:", cmd?.data?.name ?? "UNKNOWN");
  }
}

console.log(`📦 Loaded ${client.commands.size} commands`);

// =========================
// READY
// =========================
client.once("ready", async () => {
  console.log(`✅ Logged in as ${client.user.tag}`);

  const rest = new REST({ version: "10" }).setToken(process.env.TOKEN);

  const body = [];

  for (const cmd of client.commands.values()) {
    try {
      const json = cmd.data.toJSON();

      if (!json?.name || !json?.description) {
        throw new Error(`Invalid slash command: ${json?.name}`);
      }

      body.push(json);
    } catch (err) {
      console.error("❌ SLASH BUILD ERROR:", err);
    }
  }

  for (const guild of client.guilds.cache.values()) {
    try {
      await rest.put(
        Routes.applicationGuildCommands(client.user.id, guild.id),
        { body }
      );

      console.log(`✅ Registered ${body.length} commands in ${guild.name}`);
    } catch (err) {
      console.error(`❌ Failed registering in ${guild.name}:`, err);
    }
  }
});

// =========================
// INTERACTION HANDLER
// =========================
client.on("interactionCreate", async (interaction) => {
  try {
    if (interaction.isChatInputCommand()) {
      const cmd = client.commands.get(interaction.commandName);

      if (!cmd) {
        console.log("❌ Unknown command:", interaction.commandName);
        return;
      }

      await cmd.execute(interaction);
    }
  } catch (err) {
    console.error("❌ INTERACTION CRASH:", err);

    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({
        content: "❌ Command crashed (check console)",
        ephemeral: true,
      });
    }
  }
});

// =========================
// GLOBAL CRASH SAFETY
// =========================
process.on("unhandledRejection", (err) => {
  console.error("⚠️ UNHANDLED REJECTION:", err);
});

process.on("uncaughtException", (err) => {
  console.error("⚠️ UNCAUGHT EXCEPTION:", err);
});

// =========================
// LOGIN
// =========================
if (!process.env.TOKEN) {
  console.error("❌ Missing TOKEN");
  process.exit(1);
}

client.login(process.env.TOKEN);