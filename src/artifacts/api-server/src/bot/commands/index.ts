import { utilityCommands } from "/utility.commands";
import { moderatorCommands } from "../moderator.commands";

export const allCommands = [
  ...utilityCommands,
  ...moderatorCommands,
];