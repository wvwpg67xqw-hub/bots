import { moderationCommands } from "./commands/moderation.js";
import { networkCommands }    from "./commands/network.js";
import { utilityCommands }    from "./commands/utility.js";
import { advancedCommands }   from "./commands/advanced.js";
import { setupCommands }      from "./commands/setup.js";

export const commands = [
  ...moderationCommands,
  ...networkCommands,
  ...utilityCommands,
  ...advancedCommands,
  ...setupCommands,
];
