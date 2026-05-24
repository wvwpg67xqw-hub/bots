import "dotenv/config";
import { REST, Routes } from "discord.js";

import moderation from "./commands/moderation.commands.js";
import ad from "./commands/ad.commands.js";
import network from "./commands/network.commands.js";
import setup from "./commands/setup.commands.js";

const groups = {
  moderation,
  ad,
  network,
  setup
};

const allCommands = [];

console.log("🔍 DEBUG MODE: Starting command scan...\n");

for (const [groupName, group] of Object.entries(groups)) {
  console.log(`📁 Checking group: ${groupName}`);

  for (const cmd of group) {
    if (!cmd?.data) {
      console.log(`❌ INVALID COMMAND OBJECT in ${groupName}:`, cmd);
      process.exit(1);
    }

    const name = cmd.data.name || "UNKNOWN";

    console.log(`➡️  Loading command: ${groupName}/${name}`);

    try {
      const json = cmd.data.toJSON();
      allCommands.push(json);
    } catch (err) {
      console.log("\n💥 CRASH DETECTED!");
      console.log("📁 GROUP:", groupName);
      console.log("⚙️ COMMAND:", name);
      console.log("🧨 ERROR:");
      console.error(err);
      process.exit(1);
    }
  }
}

console.log("\n✅ All commands passed validation!");
console.log("🚀 Sending to Discord...\n");

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