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
// DEBUG MODE
// =========================
const DEBUG = true;

function log(...args) {
  if (DEBUG) console.log("🐞", ...args);
}

// =========================
// SAFE SLASH VALIDATOR
// =========================
function safeToJSON(cmd) {
  try {
    return cmd.data.toJSON();
  } catch (err) {
    console.log("\n❌ SLASH COMMAND BUILD FAILED");
    console.log("➡️ Command:", cmd?.data?.name ?? "UNKNOWN");
    console.log("📁 File:", cmd?.filePath ?? "UNKNOWN");
    console.error(err);
    console.log("────────────────────────────\n");
    throw err;
  }
}

// =========================
// LOAD COMMANDS (DEBUG MODE)
// =========================
for (const cmd of commands ?? []) {
  try {
    console.log("🧪 Testing:", cmd?.data?.name ?? "UNKNOWN");

    if (!cmd?.data || !cmd?.execute) {
      throw new Error("Missing data or execute");
    }

    const json = safeToJSON(cmd);

    if (!json?.name || typeof json.name !== "string") {
      throw new Error("Invalid command name");
    }

    if (!json?.description || typeof json.description !== "string") {
      throw new Error(`Missing description in ${json.name}`);
    }

    client.commands.set(json.name, cmd);

    console.log("✅ Loaded:", json.name);
  } catch (err) {
    console.log("❌ FAILED COMMAND LOAD");
    console.log("➡️ Name:", cmd?.data?.name);
    console.log("📁 File:", cmd?.filePath ?? "unknown");
    console.error(err);
  }
}

console.log(`📦 Loaded ${client.commands.size} commands`);

// =========================
// READY (REGISTER COMMANDS)
// =========================
client.once("ready", async () => {
  console.log(`✅ Logged in as ${client.user.tag}`);

  const rest = new REST({ version: "10" }).setToken(process.env.TOKEN);

  const body = [];

  for (const cmd of client.commands.values()) {
    try {
      const json = safeToJSON(cmd);
      body.push(json);
    } catch (err) {
      console.log("❌ Skipping broken command:", cmd?.data?.name);
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
      console.error(`❌ Failed registering in ${guild.name}`, err);
    }
  }
});

// =========================
// INTERACTION HANDLER
// =========================
client.on("interactionCreate", async (interaction) => {
  try {
    if (!interaction.isChatInputCommand()) return;

    const cmd = client.commands.get(interaction.commandName);

    if (!cmd) {
      console.log("❌ Unknown command:", interaction.commandName);
      return;
    }

    await cmd.execute(interaction);
  } catch (err) {
    console.error("❌ INTERACTION ERROR:", err);

    if (!interaction.replied) {
      await interaction.reply({
        content: "❌ Command crashed. Check console logs.",
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