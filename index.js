import "dotenv/config";
import { REST, Routes } from "discord.js";
import { commands } from "./commands.js";

console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━");
console.log("🚀 SLASH COMMAND DEPLOY START");
console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

// =============================
// 🔐 ENV SAFETY
// =============================
function requireEnv(name) {
  const val = process.env[name];
  if (!val || typeof val !== "string") {
    console.error(`❌ Missing or invalid ENV: ${name}`);
    process.exit(1);
  }
  return val;
}

const TOKEN = requireEnv("TOKEN");
const CLIENT_ID = requireEnv("CLIENT_ID");

// =============================
// 📦 SAFE VARIABLES
// =============================
const allCommands = [];
const seen = new Set();

let stats = {
  total: 0,
  loaded: 0,
  skipped: 0,
  failed: 0,
  duplicates: 0,
};

// =============================
// 🧠 SAFE COMMAND PROCESSING
// =============================
function safeString(val) {
  return typeof val === "string" ? val : "UNKNOWN";
}

console.log("🔍 Scanning commands...\n");

for (const cmd of commands ?? []) {
  stats.total++;

  if (!cmd || !cmd.data) {
    console.log("⚠️ Skipped invalid command object");
    stats.skipped++;
    continue;
  }

  let name = "UNKNOWN";

  try {
    name = safeString(cmd.data?.name);

    if (seen.has(name)) {
      console.log(`⚠️ Duplicate ignored: ${name}`);
      stats.duplicates++;
      continue;
    }

    const json = cmd.data.toJSON();

    if (!json || typeof json !== "object") {
      console.log(`⚠️ Invalid JSON output: ${name}`);
      stats.failed++;
      continue;
    }

    if (!json.name) {
      console.log(`⚠️ Missing command name: ${name}`);
      stats.failed++;
      continue;
    }

    seen.add(name);
    allCommands.push(json);

    console.log(`✅ Loaded: ${name}`);
    stats.loaded++;
  } catch (err) {
    console.log(`❌ Command crash: ${name}`);
    console.log(err?.message || err);
    stats.failed++;
    continue;
  }
}

// =============================
// 📊 SUMMARY
// =============================
console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━");
console.log("📊 DEPLOY SUMMARY");
console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━");
console.log(`📦 Total scanned: ${stats.total}`);
console.log(`✅ Loaded: ${stats.loaded}`);
console.log(`⚠️ Skipped: ${stats.skipped}`);
console.log(`🔁 Duplicates: ${stats.duplicates}`);
console.log(`❌ Failed: ${stats.failed}`);
console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

if (allCommands.length === 0) {
  console.error("💀 No valid commands found — aborting deploy safely.");
  process.exit(1);
}

// =============================
// 🌐 DISCORD REST CLIENT
// =============================
const rest = new REST({
  version: "10",
  timeout: 15_000,
}).setToken(TOKEN);

// =============================
// 🔁 RETRY SYSTEM
// =============================
async function deploy(retries = 3) {
  try {
    console.log("🚀 Sending commands to Discord...\n");

    const result = await rest.put(
      Routes.applicationCommands(CLIENT_ID),
      { body: allCommands }
    );

    console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("🎉 DEPLOY SUCCESS");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log(`📦 Registered: ${result.length || allCommands.length}`);
    console.log("✅ All slash commands deployed successfully");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

  } catch (err) {
    console.error("\n❌ DEPLOY FAILED");

    console.error("Message:", err?.message || err);

    if (err?.code) console.error("Code:", err.code);

    if (retries > 0) {
      console.log(`🔁 Retrying deploy... (${retries} left)\n`);
      await new Promise(r => setTimeout(r, 3000));
      return deploy(retries - 1);
    }

    console.log("💀 FINAL FAILURE — stopping safely.");
  }
}

// =============================
// 🧪 GLOBAL SAFETY WRAPPER
// =============================
process.on("unhandledRejection", (err) => {
  console.error("⚠️ Unhandled Rejection:", err);
});

process.on("uncaughtException", (err) => {
  console.error("⚠️ Uncaught Exception:", err);
});

// =============================
// 🚀 START DEPLOY
// =============================
deploy();