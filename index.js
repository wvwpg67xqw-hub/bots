import "dotenv/config";
import {
  Client,
  GatewayIntentBits,
  Collection,
} from "discord.js";

import { commands } from "./commands.js";

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
// READY EVENT
// =========================
client.once("ready", () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
});

// =========================
// INTERACTION HANDLER (SAFE)
// =========================
client.on("interactionCreate", async (interaction) => {
  try {
    if (!interaction.isChatInputCommand()) return;

    const cmd = client.commands.get(interaction.commandName);

    if (!cmd) {
      console.log(`❌ Unknown command: ${interaction.commandName}`);
      return;
    }

    await cmd.execute(interaction);

  } catch (err) {
    console.error("❌ Command error:", err);

    try {
      if (!interaction.replied) {
        await interaction.reply({
          content: "❌ Something went wrong running this command.",
          ephemeral: true,
        });
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
// LOGIN (THIS IS WHAT YOU ASKED FOR)
// =========================
if (!process.env.TOKEN) {
  console.error("❌ Missing TOKEN in .env");
  process.exit(1);
}

client.login(process.env.TOKEN);