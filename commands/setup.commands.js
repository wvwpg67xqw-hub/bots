import fs from "fs";
import { SlashCommandBuilder } from "discord.js";

const file = "./setup.json";

function load() {
  return JSON.parse(fs.readFileSync(file));
}

function save(d) {
  fs.writeFileSync(file, JSON.stringify(d, null, 2));
}

export default [
{
  data: new SlashCommandBuilder()
    .setName("setup")
    .setDescription("Set configuration values") // ✅ FIXED
    .addStringOption(o =>
      o
        .setName("key")
        .setDescription("Config key to set") // ✅ FIXED
        .setRequired(true)
    )
    .addStringOption(o =>
      o
        .setName("value")
        .setDescription("Value to store") // ✅ FIXED
        .setRequired(true)
    ),

  async execute(i) {
    const d = load();

    const key = i.options.getString("key");
    const value = i.options.getString("value");

    d[key] = value;

    save(d);

    i.reply({ content: "Updated config", ephemeral: true });
  }
}
];