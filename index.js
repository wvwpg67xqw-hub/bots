import "dotenv/config";
import { REST, Routes } from "discord.js";
import { commands } from "./commands.js";

const allCommands = [];

console.log("🔍 Loading single command file...\n");

for (const cmd of commands) {
  if (!cmd?.data) {
    console.log("❌ Invalid command object:", cmd);
    continue;
  }

  const name = cmd.data.name ?? "UNKNOWN";
  console.log(`➡️ Loading command: ${name}`);

  try {
    allCommands.push(cmd.data.toJSON());
  } catch (err) {
    console.log("\n💥 CRASH DETECTED!");
    console.log("⚙️ COMMAND:", name);
    console.error(err);
    process.exit(1);
  }
}

console.log(`\n✅ Loaded ${allCommands.length} commands`);
console.log("🚀 Registering slash commands...\n");

const rest = new REST({ version: "10" }).setToken(process.env.TOKEN);

(async () => {
  try {
    await rest.put(
      Routes.applicationCommands(process.env.CLIENT_ID),
      { body: allCommands }
    );

    console.log("✅ Slash commands registered successfully!");
  } catch (error) {
    console.error("❌ Failed to register commands:");
    console.error(error);
  }
})();