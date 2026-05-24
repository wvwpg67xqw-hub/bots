import "dotenv/config";
import { REST, Routes } from "discord.js";

import moderation from "./commands/moderation.commands.js";
import ad from "./commands/ad.commands.js";
import network from "./commands/network.commands.js";
import setup from "./commands/setup.commands.js";

const allCommands = [];

// flatten all command groups
for (const group of [moderation, ad, network, setup]) {
  for (const cmd of group) {
    if (!cmd?.data) continue;
    allCommands.push(cmd.data.toJSON());
  }
}

const rest = new REST({ version: "10" }).setToken(process.env.TOKEN);

(async () => {
  try {
    console.log("🔄 Registering slash commands...");

    // GLOBAL commands (takes up to 1 hour to update sometimes)
    await rest.put(
      Routes.applicationCommands(process.env.CLIENT_ID),
      { body: allCommands }
    );

    console.log("✅ Slash commands registered successfully!");
  } catch (error) {
    console.error("❌ Failed to register commands:", error);
  }
})();