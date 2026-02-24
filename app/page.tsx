export default function Home() {
  return (
    <div className="bg-slate-950 text-white">

      {/* HERO */}
      <section className="min-h-screen flex flex-col items-center justify-center px-6 text-center">
        <h1 className="text-4xl md:text-6xl font-bold mb-6 max-w-4xl">
          Your Plumbing Business Line. Protected.
        </h1>

        <p className="text-xl text-slate-300 max-w-2xl mb-8">
          Not just a missed call text bot. Plumber Call Guard protects your revenue,
          records inbound calls, and gives you full visibility over your business line.
        </p>

        <div className="flex flex-col sm:flex-row gap-4">
          <a
            href="/signup"
            className="bg-blue-600 hover:bg-blue-700 px-8 py-4 rounded-lg text-lg font-semibold transition"
          >
            Start 7-Day Free Trial
          </a>

          <a
            href="#pricing"
            className="border border-white px-8 py-4 rounded-lg text-lg font-semibold hover:bg-white hover:text-black transition"
          >
            View Pricing
          </a>
        </div>

        <p className="mt-6 text-sm text-slate-400">
          £99 setup fee currently waived for early members.
        </p>
      </section>

      {/* DIFFERENTIATOR */}
      <section className="py-24 px-6 bg-slate-900 text-center">
        <h2 className="text-3xl md:text-4xl font-bold mb-8">
          This Is Infrastructure — Not A Cheap SMS Bot
        </h2>

        <p className="text-slate-400 max-w-3xl mx-auto text-lg">
          Cheap missed-call text systems are basic and unreliable.
          We provide a dedicated business number, call protection,
          inbound recording, AI summaries, and a professional dashboard
          that helps you run your business properly.
        </p>
      </section>

      {/* HOW IT WORKS */}
      <section className="py-24 px-6 text-center">
        <h2 className="text-3xl md:text-4xl font-bold mb-16">
          How It Works
        </h2>

        <div className="grid md:grid-cols-3 gap-12 max-w-6xl mx-auto">

          <div>
            <div className="text-5xl mb-6">📞</div>
            <h3 className="text-xl font-semibold mb-4">Customer Calls</h3>
            <p className="text-slate-400">
              Your business line receives an inbound call.
            </p>
          </div>

          <div>
            <div className="text-5xl mb-6">⚡</div>
            <h3 className="text-xl font-semibold mb-4">Protected Instantly</h3>
            <p className="text-slate-400">
              If you miss the call, we instantly send a professional SMS reply.
            </p>
          </div>

          <div>
            <div className="text-5xl mb-6">🛡️</div>
            <h3 className="text-xl font-semibold mb-4">Full Visibility</h3>
            <p className="text-slate-400">
              Inbound calls are logged, recorded (Pro), and summarised with AI.
            </p>
          </div>

        </div>
      </section>

      {/* PRICING */}
      <section id="pricing" className="py-24 px-6 bg-slate-900 text-center">
        <h2 className="text-3xl md:text-4xl font-bold mb-16">
          Simple, Professional Pricing
        </h2>

        <div className="grid md:grid-cols-3 gap-10 max-w-6xl mx-auto">

          {/* STANDARD */}
          <div className="bg-slate-950 border border-slate-800 rounded-2xl p-10">
            <h3 className="text-2xl font-bold mb-4">Standard</h3>

            <p className="text-5xl font-bold mb-2">
              £197<span className="text-lg text-slate-400">/month</span>
            </p>

            <p className="text-sm text-slate-400 mb-6">
              + £99 setup (Currently Waived)
            </p>

            <ul className="space-y-3 text-slate-300 mb-8 text-left">
              <li>✔ Dedicated business number</li>
              <li>✔ Missed call instant SMS</li>
              <li>✔ Lead capture dashboard</li>
              <li>✔ Customisable auto-reply</li>
              <li>✔ Monthly call summary</li>
            </ul>

            <a
              href="/signup"
              className="bg-blue-600 hover:bg-blue-700 px-6 py-3 rounded-lg font-semibold transition inline-block"
            >
              Start Free Trial
            </a>
          </div>

          {/* PRO */}
          <div className="bg-blue-700 text-white rounded-2xl p-10 relative">
            <div className="absolute top-0 right-0 bg-black text-white text-xs px-3 py-1 rounded-bl-lg">
              Most Popular
            </div>

            <h3 className="text-2xl font-bold mb-4">Pro</h3>

            <p className="text-5xl font-bold mb-2">
              £297<span className="text-lg opacity-80">/month</span>
            </p>

            <p className="text-sm opacity-80 mb-6">
              + £99 setup (Currently Waived)
            </p>

            <ul className="space-y-3 mb-8 text-left">
              <li>✔ Everything in Standard</li>
              <li>✔ Inbound call recording</li>
              <li>✔ AI short call summaries</li>
              <li>✔ Call playback inside dashboard</li>
              <li>✔ Dispute & complaint protection</li>
              <li>✔ Priority support</li>
            </ul>

            <a
              href="/signup"
              className="bg-black hover:bg-slate-900 px-6 py-3 rounded-lg font-semibold transition inline-block"
            >
              Start Free Trial
            </a>
          </div>

          {/* ELITE */}
          <div className="bg-slate-950 border border-slate-800 rounded-2xl p-10">
            <h3 className="text-2xl font-bold mb-4">Elite</h3>

            <p className="text-3xl font-bold mb-6">
              Price On Request
            </p>

            <ul className="space-y-3 text-slate-300 mb-8 text-left">
              <li>✔ Everything in Pro</li>
              <li>✔ Business number ownership transfer</li>
              <li>✔ Outbound + inbound recording</li>
              <li>✔ Fleet signage coordination</li>
              <li>✔ Google Business optimisation</li>
              <li>✔ Dedicated account manager</li>
              <li>✔ Quarterly revenue review</li>
            </ul>

            <a
              href="mailto:info@plumbercallguard.co.uk"
              className="border border-white px-6 py-3 rounded-lg font-semibold hover:bg-white hover:text-black transition inline-block"
            >
              Request Info
            </a>
          </div>

        </div>
      </section>

      {/* FINAL CTA */}
      <section className="py-24 px-6 bg-blue-600 text-center">
        <h2 className="text-3xl md:text-4xl font-bold mb-6 text-white">
          Protect Your Business Line Before The Next Missed Call
        </h2>

        <a
          href="/signup"
          className="bg-black text-white px-10 py-4 rounded-lg text-lg font-semibold hover:bg-slate-900 transition"
        >
          Start Free Trial
        </a>
      </section>

    </div>
  );
}