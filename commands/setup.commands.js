import fs from "fs";
import { SlashCommandBuilder } from "discord.js";

const file = "./setup.json";

function load() {
  return JSON.parse(fs.readFileSync(file));
}

function save(d) {
  fs.writeFileSync(file, JSON.stringify(d, null, 2));
}

const setup = {
  data: new SlashCommandBuilder()
    .setName("setup")
    .addStringOption(o => o.setName("key").setRequired(true))
    .addStringOption(o => o.setName("value").setRequired(true)),

  async execute(i) {
    const k = i.options.getString("key");
    const v = i.options.getString("value");

    const d = load();
    d[k] = v;
    save(d);

    i.reply(`⚙️ Updated ${k}`);
  }
};

export default [setup];