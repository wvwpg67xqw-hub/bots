import { useState, useEffect } from "react";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

const FEATURES = [
  { icon: "⚠️", title: "Warnings & Strikes", desc: "Track infractions with persistent warning and strike systems across your server." },
  { icon: "🔨", title: "Bans & Mutes", desc: "Full ban and mute management with timed durations and automatic role restoration." },
  { icon: "⛓️", title: "Jail System", desc: "Isolate rule-breakers in a jail channel without permanently banning them." },
  { icon: "📋", title: "Application Forms", desc: "Create custom staff application forms and review submissions from the dashboard." },
  { icon: "🔗", title: "Referral Links", desc: "Members get unique referral links — track who's growing your community." },
  { icon: "📊", title: "Message Tracking", desc: "Leaderboards, activity stats, and message count resets per user." },
  { icon: "🛡️", title: "Role Permissions", desc: "Fine-grained control over which roles can use each command." },
  { icon: "🌐", title: "Network Bans", desc: "Cross-server ban coordination and blacklist management for staff networks." },
];

const COMMANDS = [
  "/warn", "/ban", "/unban", "/mute", "/unmute", "/kick",
  "/strike", "/jail", "/unjail", "/warnings", "/cases",
  "/referral", "/referral-leaderboard", "/setup-invite",
  "/messages", "/leaderboard", "/snipe", "/break",
  "/balance", "/setup", "/setup-roles", "/setup-channels",
];

export default function App() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    const target = 38;
    let current = 0;
    const step = Math.ceil(target / 30);
    const interval = setInterval(() => {
      current = Math.min(current + step, target);
      setCount(current);
      if (current >= target) clearInterval(interval);
    }, 40);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen bg-gray-950 text-white font-sans">
      {/* Nav */}
      <nav className="border-b border-gray-800/60 bg-gray-950/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🤖</span>
            <span className="font-bold text-lg tracking-tight">ModBot</span>
          </div>
          <div className="flex items-center gap-4">
            <a href="/apply" className="text-gray-400 hover:text-white text-sm transition">Apply for Staff</a>
            <a href="/dashboard" className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-sm font-medium transition">
              Dashboard
            </a>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-indigo-950/40 via-gray-950 to-purple-950/30 pointer-events-none" />
        <div className="absolute top-20 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-indigo-600/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative max-w-6xl mx-auto px-6 py-28 text-center">
          <div className="inline-flex items-center gap-2 bg-indigo-500/10 border border-indigo-500/20 rounded-full px-4 py-1.5 text-sm text-indigo-300 mb-8">
            <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
            Now serving 3+ servers
          </div>
          <h1 className="text-5xl sm:text-7xl font-extrabold tracking-tight mb-6 bg-gradient-to-br from-white via-gray-100 to-gray-400 bg-clip-text text-transparent">
            The Last Moderation Bot<br />You'll Ever Need
          </h1>
          <p className="text-xl text-gray-400 max-w-2xl mx-auto mb-10">
            38 slash commands, an application system, referral tracking, role-based permissions, and a full web dashboard — all in one bot.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <a href="https://discord.com/oauth2/authorize" className="inline-flex items-center justify-center gap-2 px-8 py-3.5 bg-indigo-600 hover:bg-indigo-500 rounded-xl font-semibold text-base transition shadow-lg shadow-indigo-600/25">
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057c.002.022.015.043.033.055a19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z"/></svg>
              Add to Discord
            </a>
            <a href="/apply" className="inline-flex items-center justify-center gap-2 px-8 py-3.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl font-semibold text-base transition">
              Apply for Staff →
            </a>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="border-y border-gray-800/60 bg-gray-900/30">
        <div className="max-w-6xl mx-auto px-6 py-10 grid grid-cols-2 sm:grid-cols-4 gap-8 text-center">
          {[
            { label: "Slash Commands", value: `${count}+` },
            { label: "Moderation Tools", value: "15+" },
            { label: "Setup Commands", value: "6" },
            { label: "Always Online", value: "24/7" },
          ].map(s => (
            <div key={s.label}>
              <div className="text-3xl font-bold text-white mb-1">{s.value}</div>
              <div className="text-sm text-gray-500">{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section className="max-w-6xl mx-auto px-6 py-24">
        <div className="text-center mb-16">
          <h2 className="text-3xl sm:text-4xl font-bold mb-4">Everything your server needs</h2>
          <p className="text-gray-400 text-lg max-w-xl mx-auto">Built for serious moderation teams who need reliability, not workarounds.</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {FEATURES.map(f => (
            <div key={f.title} className="bg-gray-900/60 border border-gray-800 rounded-2xl p-6 hover:border-indigo-500/50 transition group">
              <div className="text-3xl mb-4">{f.icon}</div>
              <h3 className="font-semibold text-white mb-2 group-hover:text-indigo-300 transition">{f.title}</h3>
              <p className="text-sm text-gray-500 leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Commands */}
      <section className="bg-gray-900/40 border-y border-gray-800/60">
        <div className="max-w-6xl mx-auto px-6 py-20">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-4">38 commands. Zero confusion.</h2>
            <p className="text-gray-400">Every command is a slash command — no prefix needed, full autocomplete support.</p>
          </div>
          <div className="flex flex-wrap justify-center gap-2">
            {COMMANDS.map(c => (
              <span key={c} className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-gray-300 font-mono hover:border-indigo-500/50 hover:text-indigo-300 transition cursor-default">
                {c}
              </span>
            ))}
            <span className="bg-indigo-900/30 border border-indigo-700/40 rounded-lg px-3 py-1.5 text-sm text-indigo-400 font-mono">+16 more</span>
          </div>
        </div>
      </section>

      {/* Dashboard CTA */}
      <section className="max-w-6xl mx-auto px-6 py-24">
        <div className="bg-gradient-to-br from-indigo-900/40 via-gray-900 to-purple-900/30 border border-indigo-500/20 rounded-3xl p-10 sm:p-16 text-center relative overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-indigo-600/10 to-transparent pointer-events-none" />
          <div className="relative">
            <div className="text-4xl mb-4">🖥️</div>
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">Manage everything from the web</h2>
            <p className="text-gray-400 text-lg max-w-xl mx-auto mb-8">
              The owner dashboard lets you create application forms, manage staff access, review submissions, and track referral stats — all without touching Discord.
            </p>
            <a href="/dashboard" className="inline-flex items-center gap-2 px-8 py-3.5 bg-indigo-600 hover:bg-indigo-500 rounded-xl font-semibold transition shadow-lg shadow-indigo-600/25">
              Open Dashboard →
            </a>
          </div>
        </div>
      </section>

      {/* Referral CTA */}
      <section className="bg-gray-900/40 border-y border-gray-800/60">
        <div className="max-w-6xl mx-auto px-6 py-20 grid sm:grid-cols-2 gap-12 items-center">
          <div>
            <div className="text-4xl mb-4">🔗</div>
            <h2 className="text-2xl font-bold mb-3">Grow your community with referrals</h2>
            <p className="text-gray-400 leading-relaxed mb-6">
              Every member gets a unique referral link. Use <code className="bg-gray-800 px-1.5 py-0.5 rounded text-indigo-300 text-sm">/referral</code> in Discord to get yours. Each referral is tracked, counted, and shown on the leaderboard.
            </p>
            <div className="flex gap-3">
              <div className="flex-1 bg-gray-800 border border-gray-700 rounded-xl p-4 text-center">
                <div className="text-2xl font-bold text-indigo-400 mb-1">/referral</div>
                <div className="text-xs text-gray-500">Get your link + stats</div>
              </div>
              <div className="flex-1 bg-gray-800 border border-gray-700 rounded-xl p-4 text-center">
                <div className="text-2xl font-bold text-indigo-400 mb-1">/referral-leaderboard</div>
                <div className="text-xs text-gray-500">Top referrers in the server</div>
              </div>
            </div>
          </div>
          <div className="bg-gray-800/50 border border-gray-700 rounded-2xl p-6">
            <div className="text-xs text-gray-500 uppercase tracking-wide mb-3">How it works</div>
            {[
              { step: "1", text: "Run /referral to get your unique link" },
              { step: "2", text: "Share it with friends or in other servers" },
              { step: "3", text: "When someone joins via your link, you get credit" },
              { step: "4", text: "Compete on the referral leaderboard" },
            ].map(s => (
              <div key={s.step} className="flex gap-3 mb-4 last:mb-0">
                <span className="w-7 h-7 bg-indigo-600 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-bold">{s.step}</span>
                <span className="text-sm text-gray-300 pt-1">{s.text}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Apply CTA */}
      <section className="max-w-6xl mx-auto px-6 py-24 text-center">
        <h2 className="text-3xl font-bold mb-4">Want to join the team?</h2>
        <p className="text-gray-400 text-lg mb-8 max-w-lg mx-auto">Staff applications are open. Fill out the form and our team will review your submission.</p>
        <a href="/apply" className="inline-flex items-center gap-2 px-8 py-3.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl font-semibold transition">
          View Open Positions →
        </a>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-800/60 bg-gray-900/30">
        <div className="max-w-6xl mx-auto px-6 py-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-gray-500">
          <div className="flex items-center gap-2">
            <span className="text-xl">🤖</span>
            <span>ModBot — Built with discord.js v14</span>
          </div>
          <div className="flex items-center gap-6">
            <a href="/apply" className="hover:text-gray-300 transition">Apply</a>
            <a href="/dashboard" className="hover:text-gray-300 transition">Dashboard</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
