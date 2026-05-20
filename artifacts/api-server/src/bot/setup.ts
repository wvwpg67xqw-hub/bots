import {
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
  EmbedBuilder,
  Colors,
  ChannelType,
} from "discord.js";
import { setGuildConfigMulti, getGuildConfig, setCommandPermission, removeCommandPermission, getCommandPermissions } from "./database";
import { successEmbed, errorEmbed, infoEmbed } from "./utils";
import type { BotCommand } from "./commands";
// eslint-disable-next-line @typescript-eslint/no-unused-vars

const setupCmd: BotCommand = {
  data: new SlashCommandBuilder()
    .setName("setup")
    .setDescription("Configure the bot for this server")
    .addChannelOption(o => o.setName("log_channel").setDescription("Main log channel").addChannelTypes(ChannelType.GuildText))
    .addChannelOption(o => o.setName("mod_log_channel").setDescription("Moderation log channel").addChannelTypes(ChannelType.GuildText))
    .addRoleOption(o => o.setName("admin_role").setDescription("Admin role"))
    .addRoleOption(o => o.setName("mod_role").setDescription("Moderator role"))
    .addRoleOption(o => o.setName("staff_role").setDescription("Staff role"))
    .addRoleOption(o => o.setName("jail_role").setDescription("Jail role"))
    .addRoleOption(o => o.setName("mute_role").setDescription("Mute role (legacy)")) as any,
  async execute(interaction) {
    if (!(interaction.member as any)?.permissions?.has("Administrator")) {
      return void interaction.reply({ embeds: [errorEmbed("You need Administrator permission to run setup.")], flags: 64 });
    }
    const fields: Record<string, string> = {};
    const logCh = interaction.options.getChannel("log_channel");
    const modLogCh = interaction.options.getChannel("mod_log_channel");
    const adminRole = interaction.options.getRole("admin_role");
    const modRole = interaction.options.getRole("mod_role");
    const staffRole = interaction.options.getRole("staff_role");
    const jailRole = interaction.options.getRole("jail_role");
    const muteRole = interaction.options.getRole("mute_role");
    if (logCh) fields.log_channel = logCh.id;
    if (modLogCh) fields.mod_log_channel = modLogCh.id;
    if (adminRole) fields.admin_role = adminRole.id;
    if (modRole) fields.mod_role = modRole.id;
    if (staffRole) fields.staff_role = staffRole.id;
    if (jailRole) fields.jail_role = jailRole.id;
    if (muteRole) fields.mute_role = muteRole.id;
    fields.setup_done = "1";
    setGuildConfigMulti(interaction.guildId!, fields);
    const lines = Object.entries(fields)
      .filter(([k]) => k !== "setup_done")
      .map(([k, v]) => `**${k}:** <#${v}> or <@&${v}>`)
      .join("\n") || "No changes made.";
    await interaction.reply({ embeds: [successEmbed(`Server configuration updated!\n\n${lines}`, "⚙️ Setup Complete")] });
  }
};

const setupRolesCmd: BotCommand = {
  data: new SlashCommandBuilder()
    .setName("setup-roles")
    .setDescription("Configure additional staff roles")
    .addRoleOption(o => o.setName("junior_mod").setDescription("Junior moderator role"))
    .addRoleOption(o => o.setName("trial_mod").setDescription("Trial moderator role"))
    .addRoleOption(o => o.setName("partner").setDescription("Partner role"))
    .addRoleOption(o => o.setName("break_role").setDescription("Break/AFK role")) as any,
  async execute(interaction) {
    if (!(interaction.member as any)?.permissions?.has("Administrator")) {
      return void interaction.reply({ embeds: [errorEmbed("You need Administrator permission.")], flags: 64 });
    }
    const fields: Record<string, string> = {};
    const jr = interaction.options.getRole("junior_mod");
    const trial = interaction.options.getRole("trial_mod");
    const partner = interaction.options.getRole("partner");
    const breakRole = interaction.options.getRole("break_role");
    if (jr) fields.junior_mod_role = jr.id;
    if (trial) fields.trial_mod_role = trial.id;
    if (partner) fields.partner_role = partner.id;
    if (breakRole) fields.break_role = breakRole.id;
    if (Object.keys(fields).length === 0) return void interaction.reply({ embeds: [errorEmbed("No roles provided.")] });
    setGuildConfigMulti(interaction.guildId!, fields);
    await interaction.reply({ embeds: [successEmbed("Staff roles updated!", "⚙️ Roles Configured")] });
  }
};

const setupRolesExtraCmd: BotCommand = {
  data: new SlashCommandBuilder()
    .setName("setup-roles-extra")
    .setDescription("Configure command-specific role permissions")
    .addStringOption(o => o.setName("command").setDescription("Command name").setRequired(true))
    .addRoleOption(o => o.setName("role").setDescription("Role to allow").setRequired(true))
    .addBooleanOption(o => o.setName("remove").setDescription("Remove this role permission instead of adding")) as any,
  async execute(interaction) {
    if (!(interaction.member as any)?.permissions?.has("Administrator")) {
      return void interaction.reply({ embeds: [errorEmbed("You need Administrator permission.")], flags: 64 });
    }
    const cmd = interaction.options.getString("command", true);
    const role = interaction.options.getRole("role", true);
    const remove = interaction.options.getBoolean("remove") ?? false;
    if (remove) {
      removeCommandPermission(interaction.guildId!, cmd, role.id);
      await interaction.reply({ embeds: [successEmbed(`Removed **${role.name}** from \`/${cmd}\` permissions.`)] });
    } else {
      setCommandPermission(interaction.guildId!, cmd, role.id);
      await interaction.reply({ embeds: [successEmbed(`**${role.name}** can now use \`/${cmd}\`.`)] });
    }
  }
};

const setupRolesWizardCmd: BotCommand = {
  data: new SlashCommandBuilder()
    .setName("setup-roles-wizard")
    .setDescription("View current role permission configuration") as any,
  async execute(interaction) {
    if (!(interaction.member as any)?.permissions?.has("Administrator")) {
      return void interaction.reply({ embeds: [errorEmbed("You need Administrator permission.")], flags: 64 });
    }
    const config = getGuildConfig(interaction.guildId!);
    const embed = new EmbedBuilder()
      .setColor(Colors.Blurple)
      .setTitle("⚙️ Current Configuration")
      .addFields(
        { name: "Log Channel", value: config?.log_channel ? `<#${config.log_channel}>` : "Not set", inline: true },
        { name: "Mod Log Channel", value: config?.mod_log_channel ? `<#${config.mod_log_channel}>` : "Not set", inline: true },
        { name: "Admin Role", value: config?.admin_role ? `<@&${config.admin_role}>` : "Not set", inline: true },
        { name: "Mod Role", value: config?.mod_role ? `<@&${config.mod_role}>` : "Not set", inline: true },
        { name: "Staff Role", value: config?.staff_role ? `<@&${config.staff_role}>` : "Not set", inline: true },
        { name: "Jail Role", value: config?.jail_role ? `<@&${config.jail_role}>` : "Not set", inline: true },
        { name: "Junior Mod Role", value: config?.junior_mod_role ? `<@&${config.junior_mod_role}>` : "Not set", inline: true },
        { name: "Trial Mod Role", value: config?.trial_mod_role ? `<@&${config.trial_mod_role}>` : "Not set", inline: true },
        { name: "Break Role", value: config?.break_role ? `<@&${config.break_role}>` : "Not set", inline: true },
      );
    await interaction.reply({ embeds: [embed] });
  }
};

const setupStatusCmd: BotCommand = {
  data: new SlashCommandBuilder()
    .setName("setup-status")
    .setDescription("Check if the bot has been configured") as any,
  async execute(interaction) {
    const config = getGuildConfig(interaction.guildId!);
    if (config?.setup_done) {
      await interaction.reply({ embeds: [successEmbed("✅ Bot is configured and ready to use.")] });
    } else {
      await interaction.reply({ embeds: [warnEmbed("⚠️ Bot has not been set up yet. Run `/setup` to get started.")] });
    }
  }
};

const setupEditCmd: BotCommand = {
  data: new SlashCommandBuilder()
    .setName("setup-edit")
    .setDescription("Edit a single configuration value")
    .addStringOption(o => o.setName("key").setDescription("Config key (e.g. log_channel, jail_role)").setRequired(true))
    .addStringOption(o => o.setName("value").setDescription("New value (channel/role ID)").setRequired(true)) as any,
  async execute(interaction) {
    if (!(interaction.member as any)?.permissions?.has("Administrator")) {
      return void interaction.reply({ embeds: [errorEmbed("You need Administrator permission.")], flags: 64 });
    }
    const key = interaction.options.getString("key", true);
    const value = interaction.options.getString("value", true);
    const allowed = ["log_channel", "mod_log_channel", "admin_role", "mod_role", "staff_role", "jail_role", "mute_role", "junior_mod_role", "trial_mod_role", "partner_role", "break_role"];
    if (!allowed.includes(key)) return void interaction.reply({ embeds: [errorEmbed(`Invalid key. Allowed: ${allowed.join(", ")}`)] });
    setGuildConfigMulti(interaction.guildId!, { [key]: value });
    await interaction.reply({ embeds: [successEmbed(`Updated **${key}** to \`${value}\`.`)] });
  }
};

function warnEmbed(desc: string) {
  return new EmbedBuilder().setColor(Colors.Yellow).setDescription(desc);
}

export const setupCommands: BotCommand[] = [
  setupCmd, setupRolesCmd, setupRolesExtraCmd, setupRolesWizardCmd, setupStatusCmd, setupEditCmd,
];
