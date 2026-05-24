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

  if (!Array.isArray(group)) {
    console.log(`❌ GROUP IS NOT AN ARRAY: ${groupName}`);
    continue;
  }

  for (const cmd of group) {
    if (!cmd || !cmd.data) {
      console.log(`❌ INVALID COMMAND OBJECT in ${groupName}:`, cmd);
      continue;
    }

    const name = cmd.data?.name ?? "UNKNOWN";
    console.log(`➡️ Loading command: ${groupName}/${name}`);

    let json;

    try {
      json = cmd.data.toJSON();
    } catch (err) {
      console.log("\n💥 CRASH DETECTED!");
      console.log("📁 GROUP:", groupName);
      console.log("⚙️ COMMAND:", name);
      console.log("🧨 ERROR:");
      console.error(err);

      // IMPORTANT: don't hide the real issue
      process.exit(1);
    }

    allCommands.push(json);
  }
}

console.log("\n✅ All commands passed validation!");
console.log(`🚀 Sending ${allCommands.length} commands to Discord...\n`);

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