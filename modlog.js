import { loadJSON, saveJSON } from "./storage.js";

const caseFile = "./cases.json";

/* =======================
   CASE SYSTEM
   Each case: { caseId, guildId, type, userId, userTag, modId, modTag, reason, timestamp }
======================= */

export function addCase({ guildId, type, userId, userTag, modId, modTag, reason }) {
  const data  = loadJSON(caseFile);
  if (!data[guildId]) data[guildId] = [];

  const caseId = data[guildId].length + 1;
  data[guildId].push({
    caseId,
    type,
    userId,
    userTag,
    modId,
    modTag,
    reason: reason ?? "No reason provided",
    timestamp: Date.now(),
  });

  saveJSON(caseFile, data);
  return caseId;
}

export function getCasesForUser(guildId, userId) {
  const data = loadJSON(caseFile);
  return (data[guildId] ?? []).filter(c => c.userId === userId);
}

export function getRecentCases(guildId, limit = 10) {
  const data = loadJSON(caseFile);
  const all  = data[guildId] ?? [];
  return all.slice(-limit).reverse();
}

export function getCaseById(guildId, caseId) {
  const data = loadJSON(caseFile);
  return (data[guildId] ?? []).find(c => c.caseId === caseId) ?? null;
}
