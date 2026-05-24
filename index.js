import "dotenv/config";
import { Client, GatewayIntentBits, Collection } from "discord.js";

import moderation from "./commands/moderation.commands.js";
import ad from "./commands/ad.commands.js";
import utility from "./commands/utility.commands.js";
import setup from "./commands/setup.commands.js";

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

client.commands = new Collection();

// register all command groups
const groups = [moderation, ad, utility, setup];

for (const group of groups) {
  for (const cmd of group) {
    client.commands.set(cmd.data.name, cmd);
  }
}

client.once("ready", () => {
  console.log(`Logged in as ${client.user.tag}`);
});

client.on("interactionCreate", async (i) => {
  if (!i.isChatInputCommand()) return;

  const cmd = client.commands.get(i.commandName);
  if (!cmd) return;

  try {
    await cmd.execute(i);
  } catch (err) {
    console.error(err);
    if (!i.replied) {
      i.reply({ content: "Error executing command", ephemeral: true });
    }
  }
});

client.login(process.env.TOKEN);