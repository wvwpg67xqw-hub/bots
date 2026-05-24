import "dotenv/config";
import {
  Client,
  GatewayIntentBits,
  Collection,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  REST,
  Routes,
} from "discord.js";

import { commands } from "./commands.js";
import { loadJSON }  from "./storage.js";
import { addCase }   from "./modlog.js";

const setupFile = "./setup.json";

// =========================
// CLIENT SETUP
// =========================
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,   // needed for raidmode join-kick
  ],
});

client.commands  = new Collection();
client.raidMode  = new Map();   // guildId → boolean
client.snipeCache = new Map();  // channelId → { content, author, deletedAt }

// =========================
// LOAD COMMANDS
// =========================
for (const cmd of commands ?? []) {
  if (!cmd?.data || !cmd?.execute) { console.log("⚠️ Skipping invalid command"); continue; }
  client.commands.set(cmd.data.name, cmd);
}
console.log(`📦 Loaded ${client.commands.size} commands`);

// =========================
// SNIPE — cache deleted messages
// =========================
client.on("messageDelete", (message) => {
  if (!message.author || message.author.bot) return;
  client.snipeCache.set(message.channel.id, {
    content:   message.content,
    author:    message.author,
    deletedAt: Date.now(),
  });
});

// =========================
// RAIDMODE — kick new joins when active
// =========================
client.on("guildMemberAdd", async (member) => {
  if (!client.raidMode.get(member.guild.id)) return;

  await member.kick("Raid mode is active").catch(() => {});

  const cfg    = loadJSON(setupFile);
  const logsCh = cfg.logsChannel ? member.guild.channels.cache.get(cfg.logsChannel) : null;
  const modsCh = cfg.modsChannel ? member.guild.channels.cache.get(cfg.modsChannel) : null;

  const embed = new EmbedBuilder()
    .setColor(0xff0000)
    .setTitle("🚨 RAID MODE — JOIN BLOCKED")
    .setThumbnail(member.user.displayAvatarURL())
    .addFields(
      { name: "User",    value: `${member.user} (${member.user.tag})`, inline: true },
      { name: "User ID", value: member.user.id,                        inline: true },
      { name: "Action",  value: "Auto-kicked (raid mode on)" }
    )
    .setTimestamp();

  if (logsCh) await logsCh.send({ embeds: [embed] }).catch(() => {});
  if (modsCh) await modsCh.send({ embeds: [embed] }).catch(() => {});
});

// =========================
// READY — auto-register slash commands to all guilds
// =========================
client.once("ready", async () => {
  console.log(`✅ Logged in as ${client.user.tag}`);

  const rest = new REST({ version: "10" }).setToken(process.env.TOKEN);
  const body = commands.map(c => c.data.toJSON());

  for (const guild of client.guilds.cache.values()) {
    try {
      await rest.put(Routes.applicationGuildCommands(client.user.id, guild.id), { body });
      console.log(`✅ Registered ${body.length} commands in: ${guild.name}`);
    } catch (err) {
      console.error(`❌ Failed to register commands in ${guild.name}:`, err);
    }
  }
});

// =========================
// INTERACTION HANDLER
// =========================
client.on("interactionCreate", async (interaction) => {
  try {

    // ── Slash commands ──────────────────────────────────────
    if (interaction.isChatInputCommand()) {
      const cmd = client.commands.get(interaction.commandName);
      if (!cmd) { console.log(`❌ Unknown command: ${interaction.commandName}`); return; }
      await cmd.execute(interaction);
      return;
    }

    // ── Button interactions (ban request panel) ─────────────
    if (interaction.isButton()) {
      const [action, userId] = interaction.customId.split(":");
      if (!["ban_accept", "ban_reject", "ban_force"].includes(action)) return;

      const cfg    = loadJSON(setupFile);
      const logsId = cfg.logsChannel;
      const netId  = cfg.networkLog;

      // Disable all buttons on the original message
      const disabledRow = new ActionRowBuilder().addComponents(
        ...interaction.message.components[0].components.map(btn =>
          ButtonBuilder.from(btn).setDisabled(true)
        )
      );

      if (action === "ban_reject") {
        const embed = new EmbedBuilder()
          .setColor(0x95a5a6).setTitle("❌ BAN REQUEST REJECTED")
          .addFields(
            { name: "User ID",     value: userId },
            { name: "Rejected by", value: interaction.user.tag }
          ).setTimestamp();

        await interaction.message.edit({ components: [disabledRow] });
        await interaction.reply({ embeds: [embed] });

        if (logsId) {
          const ch = interaction.guild.channels.cache.get(logsId);
          if (ch) await ch.send({ embeds: [embed] }).catch(() => {});
        }
        return;
      }

      // accept or force → execute ban
      const member = await interaction.guild.members.fetch(userId).catch(() => null);
      const user   = await interaction.client.users.fetch(userId).catch(() => null);
      const label  = action === "ban_force" ? "🔨 BAN FORCE-EXECUTED" : "✅ BAN REQUEST ACCEPTED";
      const color  = action === "ban_force" ? 0xff0000 : 0x2ecc71;

      if (member) await member.ban({ reason: `Ban request approved by ${interaction.user.tag}` });

      const caseId = addCase({
        guildId: interaction.guild.id,
        type:    "NETWORK-BAN",
        userId,
        userTag:  user?.tag ?? userId,
        modId:    interaction.user.id,
        modTag:   interaction.user.tag,
        reason:  `Ban request ${action === "ban_force" ? "force-executed" : "accepted"} by ${interaction.user.tag}`,
      });

      const embed = new EmbedBuilder()
        .setColor(color).setTitle(label)
        .addFields(
          { name: "User",        value: user ? `${user} (${user.tag})` : userId, inline: true },
          { name: "User ID",     value: userId,                                   inline: true },
          { name: "Case",        value: `#${caseId}`,                             inline: true },
          { name: "Approved by", value: interaction.user.tag }
        ).setTimestamp();

      await interaction.message.edit({ components: [disabledRow] });
      await interaction.reply({ embeds: [embed] });

      for (const chId of [logsId, netId]) {
        if (!chId) continue;
        const ch = interaction.guild.channels.cache.get(chId);
        if (ch) await ch.send({ embeds: [embed] }).catch(() => {});
      }
    }

  } catch (err) {
    console.error("❌ Interaction error:", err);
    try {
      if (!interaction.replied && !interaction.deferred)
        await interaction.reply({ content: "❌ Something went wrong.", ephemeral: true });
    } catch {}
  }
});

// =========================
// GLOBAL ERROR SAFETY
// =========================
process.on("unhandledRejection", (err) => console.error("⚠️ Unhandled Rejection:", err));
process.on("uncaughtException",  (err) => console.error("⚠️ Uncaught Exception:",  err));

// =========================
// LOGIN
// =========================
if (!process.env.TOKEN) { console.error("❌ Missing TOKEN in .env"); process.exit(1); }
client.login(process.env.TOKEN);
