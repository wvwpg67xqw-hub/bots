import { utilityCommands } from "./utility.commands";
import { moderatorCommands } from "./moderator.commands";

// If you add more categories later, just import them here:
// import { adminCommands } from "./admin.commands";
// import { setupCommands } from "./setup.commands";

export const allCommands = [
  ...utilityCommands,
  ...moderatorCommands,
  // ...adminCommands,
  // ...setupCommands,
];