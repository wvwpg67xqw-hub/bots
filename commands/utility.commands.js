import { SlashCommandBuilder } from "discord.js";

const snipe = {
  data: new SlashCommandBuilder()
    .setName("snipe"),

  async execute(i) {
    i.reply("🧾 Snipe system placeholder (needs message tracking middleware)");
  }
};

export default [snipe];