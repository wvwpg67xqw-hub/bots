import { REST, Routes } from "discord.js";
import type { BotCommand } from "./commands";
import { logger } from "../lib/logger";

export async function registerCommands(commands: BotCommand[]) {
  const token = process.env["TOKEN"];
  const clientId = process.env["CLIENT_ID"];
  if (!token || !clientId) {
    logger.warn("TOKEN or CLIENT_ID not set — skipping command registration");
    return;
  }
  const rest = new REST({ version: "10" }).setToken(token);
  const body = commands.map(c => c.data.toJSON());
  try {
    logger.info({ count: body.length }, "Registering slash commands globally...");
    await rest.put(Routes.applicationCommands(clientId), { body });
    logger.info("Slash commands registered successfully");
  } catch (err) {
    logger.error({ err }, "Failed to register slash commands");
  }
}
