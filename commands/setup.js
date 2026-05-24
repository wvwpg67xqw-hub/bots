import { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits, ChannelType } from "discord.js";
import { loadJSON, saveJSON } from "../storage.js";
import { setupFile } from "./helpers.js";

export const setupCommands = [

/* ───────────────────────
   SETUP
─────────────────────── */
{
  data: new SlashCommandBuilder()
    .setName("setup")
    .setDescription("Configure the bot for this server")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)

    .addSubcommand(sub =>
      sub.setName("view").setDescription("Show the current bot configuration")
    )

    .addSubcommandGroup(grp =>
      grp.setName("channels").setDescription("Set the channels the bot uses")
        .addSubcommand(sub =>
          sub.setName("logs").setDescription("All moderation actions are logged here")
            .addChannelOption(o => o.setName("channel").setDescription("Pick a channel").setRequired(true).addChannelTypes(ChannelType.GuildText))
        )
        .addSubcommand(sub =>
          sub.setName("ads").setDescription("Ad violation warnings are posted here")
            .addChannelOption(o => o.setName("channel").setDescription("Pick a channel").setRequired(true).addChannelTypes(ChannelType.GuildText))
        )
        .addSubcommand(sub =>
          sub.setName("mods").setDescription("General mod alerts and announcements")
            .addChannelOption(o => o.setName("channel").setDescription("Pick a channel").setRequired(true).addChannelTypes(ChannelType.GuildText))
        )
        .addSubcommand(sub =>
          sub.setName("ban-requests").setDescription("Network ban requests are posted here for review")
            .addChannelOption(o => o.setName("channel").setDescription("Pick a channel").setRequired(true).addChannelTypes(ChannelType.GuildText))
        )
        .addSubcommand(sub =>
          sub.setName("network-log").setDescription("Network ban/unban actions are broadcast here")
            .addChannelOption(o => o.setName("channel").setDescription("Pick a channel").setRequired(true).addChannelTypes(ChannelType.GuildText))
        )
    )

    .addSubcommandGroup(grp =>
      grp.setName("roles").setDescription("Set the roles the bot uses")
        .addSubcommand(sub =>
          sub.setName("jail").setDescription("Role applied when a user is jailed")
            .addRoleOption(o => o.setName("role").setDescription("Pick a role").setRequired(true))
        )
        .addSubcommand(sub =>
          sub.setName("mute").setDescription("Legacy mute role")
            .addRoleOption(o => o.setName("role").setDescription("Pick a role").setRequired(true))
        )
        .addSubcommand(sub =>
          sub.setName("staff").setDescription("The staff role")
            .addRoleOption(o => o.setName("role").setDescription("Pick a role").setRequired(true))
        )
        .addSubcommand(sub =>
          sub.setName("admin").setDescription("The admin role")
            .addRoleOption(o => o.setName("role").setDescription("Pick a role").setRequired(true))
        )
    ),

  async execute(i) {
    const cfg = loadJSON(setupFile);
    const sub = i.options.getSubcommand(false);
    const grp = i.options.getSubcommandGroup(false);

    if (sub === "view") {
      const ch = (id) => id ? `<#${id}>` : "❌ Not set";
      const ro = (id) => id ? `<@&${id}>` : "❌ Not set";

      const embed = new EmbedBuilder()
        .setColor(0x5865f2).setTitle("⚙️ Bot Configuration")
        .addFields(
          { name: "📢 Channels",  value: "\u200b" },
          { name: "Logs",         value: ch(cfg.logsChannel),        inline: true },
          { name: "Ads",          value: ch(cfg.adsChannel),         inline: true },
          { name: "Mods",         value: ch(cfg.modsChannel),        inline: true },
          { name: "Ban Requests", value: ch(cfg.banRequestsChannel), inline: true },
          { name: "Network Log",  value: ch(cfg.networkLog),         inline: true },
          { name: "\u200b",       value: "\u200b" },
          { name: "🎭 Roles",     value: "\u200b" },
          { name: "Jail",  value: ro(cfg.jailRole),  inline: true },
          { name: "Mute",  value: ro(cfg.muteRole),  inline: true },
          { name: "Staff", value: ro(cfg.staffRole), inline: true },
          { name: "Admin", value: ro(cfg.adminRole), inline: true }
        )
        .setFooter({ text: `Requested by ${i.user.tag}` })
        .setTimestamp();

      return i.reply({ embeds: [embed], ephemeral: true });
    }

    if (grp === "channels") {
      const channel = i.options.getChannel("channel");
      const keyMap  = {
        "logs":         "logsChannel",
        "ads":          "adsChannel",
        "mods":         "modsChannel",
        "ban-requests": "banRequestsChannel",
        "network-log":  "networkLog",
      };
      cfg[keyMap[sub]] = channel.id;
      saveJSON(setupFile, cfg);
      return i.reply({ embeds: [new EmbedBuilder().setColor(0x2ecc71).setDescription(`✅ **${sub}** channel set to ${channel}`)], ephemeral: true });
    }

    if (grp === "roles") {
      const role   = i.options.getRole("role");
      const keyMap = { jail: "jailRole", mute: "muteRole", staff: "staffRole", admin: "adminRole" };
      cfg[keyMap[sub]] = role.id;
      saveJSON(setupFile, cfg);
      return i.reply({ embeds: [new EmbedBuilder().setColor(0x2ecc71).setDescription(`✅ **${sub}** role set to ${role}`)], ephemeral: true });
    }

    await i.reply({ content: "Unknown setup option.", ephemeral: true });
  }
},

];
