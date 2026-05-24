import "dotenv/config";
import { Client, GatewayIntentBits, Collection } from "discord.js";

import moderation from "./commands/moderation.commands.js";
import ad from "./commands/ad.commands.js";
import network from "./commands/network.commands.js";
import setup from "./commands/setup.commands.js";

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages
  ]
});

client.commands = new Collection();

for (const group of [moderation, ad, network, setup]) {
  for (const cmd of group) {
    client.commands.set(cmd.data.name, cmd);
  }
}

client.once("ready", () => {
  console.log(`Logged in as ${client.user.tag}`);
});

client.on("interactionCreate", async (i) => {
  if (i.isChatInputCommand()) {
    const cmd = client.commands.get(i.commandName);
    if (!cmd) return;

    try {
      await cmd.execute(i);
    } catch (e) {
      console.error(e);
      if (!i.replied) {
        i.reply({ content: "Error occurred", ephemeral: true });
      }
    }
  }

  // BUTTON HANDLER (NETWORK SYSTEM)
  if (i.isButton()) {
    const { customId } = i;

    if (customId.startsWith("ban_accept")) {
      const userId = customId.split(":")[1];
      const member = await i.guild.members.fetch(userId).catch(() => null);

      if (member) await member.ban({ reason: "Approved network ban" });

      return i.update({ content: "User banned via request", components: [] });
    }

    if (customId.startsWith("ban_reject")) {
      return i.update({ content: "Ban request rejected", components: [] });
    }

    if (customId.startsWith("ban_force")) {
      const userId = customId.split(":")[1];
      const member = await i.guild.members.fetch(userId).catch(() => null);

      if (member) await member.ban({ reason: "Escalated network ban" });

      return i.update({ content: "User force banned", components: [] });
    }
  }
});

client.login(process.env.TOKEN);