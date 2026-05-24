import "dotenv/config";
import {
  Client,
  GatewayIntentBits,
  Collection,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  REST,
  Routes,
} from "discord.js";

import { commands } from "./commands.js";
import { loadJSON } from "./storage.js";
import { addCase } from "./modlog.js";

const setupFile = "./setup.json";

/* ───────────────────────
   CLIENT
─────────────────────── */
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
  ],
});

client.commands = new Collection();
client.raidMode = new Map();
client.snipeCache = new Map();

/* ───────────────────────
   LOAD COMMANDS
─────────────────────── */
for (const cmd of commands ?? []) {
  if (!cmd?.data || !cmd?.execute) continue;
  client.commands.set(cmd.data.name, cmd);
}

console.log(`📦 Loaded ${client.commands.size} commands`);

/* ───────────────────────
   SNIPE CACHE
─────────────────────── */
client.on("messageDelete", (message) => {
  if (!message.author || message.author.bot) return;

  client.snipeCache.set(message.channel.id, {
    content: message.content,
    author: message.author,
    deletedAt: Date.now(),
  });
});

/* ───────────────────────
   RAID MODE
─────────────────────── */
client.on("guildMemberAdd", async (member) => {
  if (!client.raidMode.get(member.guild.id)) return;

  await member.kick("Raid mode active").catch(() => null);

  const cfg = loadJSON(setupFile);

  const embed = new EmbedBuilder()
    .setColor(0xff0000)
    .setTitle("🚨 RAID MODE ACTIVE")
    .addFields(
      { name: "User", value: `${member.user.tag}`, inline: true },
      { name: "ID", value: member.id, inline: true },
      { name: "Action", value: "Auto-kicked" }
    )
    .setTimestamp();

  const logs = cfg.logsChannel
    ? member.guild.channels.cache.get(cfg.logsChannel)
    : null;

  if (logs) logs.send({ embeds: [embed] }).catch(() => {});
});

/* ───────────────────────
   READY (FIXED DEPRECATED EVENT)
─────────────────────── */
client.once("clientReady", async () => {
  console.log(`✅ Logged in as ${client.user.tag}`);

  const rest = new REST({ version: "10" }).setToken(process.env.TOKEN);

  const body = commands.map(c => c.data.toJSON());

  for (const guild of client.guilds.cache.values()) {
    try {
      await rest.put(
        Routes.applicationGuildCommands(client.user.id, guild.id),
        { body }
      );

      console.log(`✅ Registered ${body.length} commands in ${guild.name}`);
    } catch (err) {
      console.error(`❌ Failed in ${guild.name}`, err);
    }
  }
});

/* ───────────────────────
   INTERACTIONS
─────────────────────── */
client.on("interactionCreate", async (interaction) => {
  try {
    /* ── Slash Commands ── */
    if (interaction.isChatInputCommand()) {
      const cmd = client.commands.get(interaction.commandName);

      if (!cmd) {
        console.log(`❌ Unknown command: ${interaction.commandName}`);
        return;
      }

      return await cmd.execute(interaction);
    }

    /* ── BUTTONS (BAN SYSTEM) ── */
    if (interaction.isButton()) {
      const [action, userId] = interaction.customId.split(":");

      if (!["ban_accept", "ban_reject", "ban_force"].includes(action)) return;

      const cfg = loadJSON(setupFile);

      const logsId = cfg.logsChannel;
      const netId = cfg.networkLog;

      const disabledRow = new ActionRowBuilder().addComponents(
        ...interaction.message.components[0].components.map(btn =>
          ButtonBuilder.from(btn).setDisabled(true)
        )
      );

      if (action === "ban_reject") {
        const embed = new EmbedBuilder()
          .setColor(0x95a5a6)
          .setTitle("❌ BAN REJECTED")
          .addFields(
            { name: "User ID", value: userId },
            { name: "By", value: interaction.user.tag }
          )
          .setTimestamp();

        await interaction.message.edit({ components: [disabledRow] });
        return interaction.reply({ embeds: [embed] });
      }

      const member = await interaction.guild.members.fetch(userId).catch(() => null);
      const user = await interaction.client.users.fetch(userId).catch(() => null);

      if (member) {
        await member.ban({
          reason: `Ban approved by ${interaction.user.tag}`,
        });
      }

      const caseId = addCase({
        guildId: interaction.guild.id,
        type: "NETWORK-BAN",
        userId,
        userTag: user?.tag ?? userId,
        modId: interaction.user.id,
        modTag: interaction.user.tag,
        reason: `Ban ${action} by ${interaction.user.tag}`,
      });

      const embed = new EmbedBuilder()
        .setColor(action === "ban_force" ? 0xff0000 : 0x2ecc71)
        .setTitle(action === "ban_force"
          ? "🔨 FORCE BAN"
          : "✅ BAN APPROVED"
        )
        .addFields(
          { name: "User", value: user ? user.tag : userId, inline: true },
          { name: "Case", value: `#${caseId}`, inline: true },
          { name: "By", value: interaction.user.tag }
        )
        .setTimestamp();

      await interaction.message.edit({ components: [disabledRow] });
      return interaction.reply({ embeds: [embed] });
    }

  } catch (err) {
    console.error("❌ Interaction error:", err);

    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({
        content: "❌ Error occurred.",
        ephemeral: true,
      });
    }
  }
});

/* ───────────────────────
   SAFETY ERRORS (CLEAN)
─────────────────────── */
process.on("unhandledRejection", (err) => {
  console.error("⚠️ Promise Error:", err);
});

process.on("uncaughtException", (err) => {
  console.error("⚠️ Crash Error:", err);
});

/* ───────────────────────
   LOGIN
─────────────────────── */
if (!process.env.TOKEN) {
  console.error("❌ Missing TOKEN in .env");
  process.exit(1);
}

client.login(process.env.TOKEN);