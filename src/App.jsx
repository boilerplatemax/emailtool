export default function App() {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Nav */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <span className="text-xl font-bold text-indigo-600 tracking-tight">
            EmailTool
          </span>
          <nav className="flex gap-6 text-sm text-gray-600">
            <a href="#features" className="hover:text-indigo-600 transition-colors">Features</a>
            <a href="#pricing" className="hover:text-indigo-600 transition-colors">Pricing</a>
          </nav>
          <button className="bg-indigo-600 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors">
            Get Started
          </button>
        </div>
      </header>

      {/* Hero */}
      <main className="flex-1 flex flex-col items-center justify-center text-center px-6 py-24">
        <span className="inline-block bg-indigo-100 text-indigo-700 text-xs font-semibold px-3 py-1 rounded-full mb-6 tracking-wide uppercase">
          Now in Beta
        </span>
        <h1 className="text-5xl font-extrabold text-gray-900 leading-tight max-w-2xl">
          Send smarter emails,{' '}
          <span className="text-indigo-600">effortlessly.</span>
        </h1>
        <p className="mt-6 text-lg text-gray-500 max-w-xl">
          EmailTool helps you write, schedule, and track emails with zero friction.
          Built for teams that value clarity and speed.
        </p>
        <div className="mt-10 flex flex-col sm:flex-row gap-4 justify-center">
          <button className="bg-indigo-600 text-white font-semibold px-8 py-3 rounded-xl hover:bg-indigo-700 transition-colors shadow-sm">
            Start for free
          </button>
          <button className="bg-white text-gray-700 font-semibold px-8 py-3 rounded-xl border border-gray-300 hover:border-indigo-400 hover:text-indigo-600 transition-colors">
            See how it works
          </button>
        </div>
      </main>

      {/* Feature cards */}
      <section id="features" className="bg-white border-t border-gray-200 py-20 px-6">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl font-bold text-gray-900 text-center mb-12">
            Everything you need
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-8">
            {[
              { icon: '✉️', title: 'Smart Compose', desc: 'AI-assisted writing that matches your tone.' },
              { icon: '📅', title: 'Scheduling', desc: 'Send at the perfect time, automatically.' },
              { icon: '📊', title: 'Analytics', desc: 'Track opens, clicks, and replies in real time.' },
            ].map(({ icon, title, desc }) => (
              <div key={title} className="bg-gray-50 rounded-2xl p-6 flex flex-col gap-3">
                <span className="text-3xl">{icon}</span>
                <h3 className="text-lg font-semibold text-gray-800">{title}</h3>
                <p className="text-sm text-gray-500">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-200 py-6 text-center text-sm text-gray-400">
        © {new Date().getFullYear()} EmailTool. All rights reserved.
      </footer>
    </div>
  )
}
