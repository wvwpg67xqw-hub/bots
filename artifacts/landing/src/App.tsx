const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

const POSITIONS = [
  { icon: "🛡️", title: "Moderator", desc: "Enforce server rules, handle reports, and keep the community safe." },
  { icon: "🤝", title: "Helper", desc: "Support members, answer questions, and guide newcomers." },
  { icon: "🎨", title: "Content Staff", desc: "Create events, announcements, and community engagement." },
  { icon: "⚡", title: "Trial Staff", desc: "Starting position for new team members learning the ropes." },
];

const STEPS = [
  { n: "1", title: "Log in with Discord", desc: "Click Apply and sign in with your Discord account — no manual forms to fill." },
  { n: "2", title: "Pick a position", desc: "Browse open positions and select the role you want to apply for." },
  { n: "3", title: "Answer the questions", desc: "Fill out the application form. Be honest and detailed." },
  { n: "4", title: "Wait for a decision", desc: "The team reviews every submission. You'll see your status in the portal." },
];

export default function App() {
  return (
    <div className="min-h-screen bg-gray-950 text-white font-sans">

      {/* Nav */}
      <nav className="border-b border-gray-800/60 bg-gray-950/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🤖</span>
            <span className="font-bold text-lg tracking-tight">Staff Applications</span>
          </div>
          <div className="flex items-center gap-3">
            <a
              href="/dashboard"
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-sm font-medium transition"
            >
              Login to Apply
            </a>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-indigo-950/40 via-gray-950 to-purple-950/30 pointer-events-none" />
        <div className="absolute top-20 left-1/2 -translate-x-1/2 w-[500px] h-[500px] bg-indigo-600/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative max-w-5xl mx-auto px-6 py-28 text-center">
          <h1 className="text-5xl sm:text-6xl font-extrabold tracking-tight mb-6 bg-gradient-to-br from-white via-gray-100 to-gray-400 bg-clip-text text-transparent">
            Join the Staff Team
          </h1>
          <p className="text-xl text-gray-400 max-w-xl mx-auto mb-10">
            We're looking for dedicated, active members to help run the server. Applications are reviewed by staff and decisions are posted in the portal.
          </p>
          <a
            href="/dashboard"
            className="inline-flex items-center justify-center gap-2 px-8 py-3.5 bg-indigo-600 hover:bg-indigo-500 rounded-xl font-semibold text-base transition shadow-lg shadow-indigo-600/25"
          >
            Apply Now →
          </a>
        </div>
      </section>

      {/* How it works */}
      <section className="border-y border-gray-800/60 bg-gray-900/30">
        <div className="max-w-5xl mx-auto px-6 py-20">
          <h2 className="text-3xl font-bold text-center mb-12">How it works</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {STEPS.map(s => (
              <div key={s.n} className="relative">
                <div className="w-10 h-10 bg-indigo-600 rounded-full flex items-center justify-center text-sm font-bold mb-4">{s.n}</div>
                <h3 className="font-semibold text-white mb-2">{s.title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Open positions */}
      <section className="max-w-5xl mx-auto px-6 py-24">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold mb-3">Open Positions</h2>
          <p className="text-gray-400">Login to see which positions are currently accepting applications.</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 mb-10">
          {POSITIONS.map(p => (
            <div key={p.title} className="bg-gray-900/60 border border-gray-800 rounded-2xl p-6 hover:border-indigo-500/50 transition group">
              <div className="text-3xl mb-4">{p.icon}</div>
              <h3 className="font-semibold text-white mb-2 group-hover:text-indigo-300 transition">{p.title}</h3>
              <p className="text-sm text-gray-500 leading-relaxed">{p.desc}</p>
            </div>
          ))}
        </div>
        <div className="text-center">
          <a
            href="/dashboard"
            className="inline-flex items-center gap-2 px-8 py-3.5 bg-indigo-600 hover:bg-indigo-500 rounded-xl font-semibold transition shadow-lg shadow-indigo-600/25"
          >
            View All Open Positions →
          </a>
        </div>
      </section>

      {/* Already applied CTA */}
      <section className="bg-gray-900/40 border-t border-gray-800/60">
        <div className="max-w-5xl mx-auto px-6 py-16 flex flex-col sm:flex-row items-center justify-between gap-6">
          <div>
            <h3 className="text-xl font-bold mb-1">Already applied?</h3>
            <p className="text-gray-400 text-sm">Log in to check the status of your application.</p>
          </div>
          <a
            href="/dashboard"
            className="flex-shrink-0 px-6 py-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl font-semibold text-sm transition"
          >
            Check My Application
          </a>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-800/60">
        <div className="max-w-5xl mx-auto px-6 py-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-gray-600">
          <span>Staff Applications Portal</span>
          <a href="/dashboard" className="hover:text-gray-400 transition">Login →</a>
        </div>
      </footer>

    </div>
  );
}
