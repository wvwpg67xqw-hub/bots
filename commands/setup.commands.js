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
    .addStringOption(o => o.setName("key").setRequired(true))
    .addStringOption(o => o.setName("value").setRequired(true)),

  async execute(i) {
    const d = load();

    d[i.options.getString("key")] = i.options.getString("value");

    save(d);

    i.reply("Updated config");
  }
}
];