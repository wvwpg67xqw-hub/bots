import { loadJSON, saveJSON } from "../storage.js";

const warnFile  = "./warnings.json";
const setupFile = "./setup.json";
const jailFile  = "./jaildata.json";

export { warnFile, setupFile, jailFile };

export function addWarn(id) {
  const data = loadJSON(warnFile);
  data[id] = (data[id] || 0) + 1;
  saveJSON(warnFile, data);
  return data[id];
}

export function warnTime(count) {
  return 5 + count * 5; // minutes
}

export async function logTo(guild, channelKey, embed) {
  const cfg  = loadJSON(setupFile);
  const chId = cfg[channelKey];
  if (!chId) return;
  const ch = guild.channels.cache.get(chId);
  if (ch) await ch.send({ embeds: [embed] }).catch(() => {});
}

export const typeColor = {
  WARN:            0xffcc00,
  "AD-WARN":       0xff5500,
  MUTE:            0xe74c3c,
  UNMUTE:          0x2ecc71,
  KICK:            0xe67e22,
  BAN:             0xff0000,
  "NETWORK-BAN":   0xff0000,
  UNBAN:           0x2ecc71,
  "NETWORK-UNBAN": 0x2ecc71,
  JAIL:            0x95a5a6,
  UNJAIL:          0x2ecc71,
  LOCKDOWN:        0xe74c3c,
  UNLOCK:          0x2ecc71,
};
