export default function Home() {
  return (
    <div className="bg-slate-950 text-white">

      {/* HERO */}
      <section className="min-h-screen flex flex-col items-center justify-center px-6 text-center">
        <div className="max-w-4xl">

          <h1 className="text-5xl md:text-7xl font-bold leading-tight mb-8">
            Your Plumbing Business Line.
            <br />
            <span className="text-blue-500">Protected.</span>
          </h1>

          <p className="text-xl md:text-2xl text-slate-300 mb-10">
            Not just a missed call text.
            Real call protection, recordings, AI summaries,
            and full visibility over your inbound calls.
          </p>

          <div className="flex flex-col sm:flex-row gap-5 justify-center">
            <a
              href="/signup"
              className="bg-blue-600 hover:bg-blue-700 px-10 py-4 rounded-lg text-lg font-semibold transition"
            >
              Start 7-Day Free Trial
            </a>

            <a
              href="#pricing"
              className="border border-white px-10 py-4 rounded-lg text-lg font-semibold hover:bg-white hover:text-black transition"
            >
              View Pricing
            </a>
          </div>

          <p className="mt-6 text-sm text-slate-400">
            £99 setup fee currently waived for early members.
          </p>

        </div>
      </section>


      {/* SIMPLE STATEMENT SECTION */}
      <section className="py-36 px-6 text-center">
        <h2 className="text-4xl md:text-6xl font-bold max-w-4xl mx-auto leading-tight">
          Not a cheap SMS bot.
          <br />
          Infrastructure for your business line.
        </h2>
      </section>


      {/* HOW IT WORKS */}
      <section className="py-32 px-6 bg-slate-900 text-center">
        <h2 className="text-4xl font-bold mb-20">
          How It Works
        </h2>

        <div className="grid md:grid-cols-3 gap-16 max-w-6xl mx-auto">

          <div>
            <div className="text-5xl mb-6">📞</div>
            <h3 className="text-xl font-semibold mb-4">Customer Calls</h3>
            <p className="text-slate-400">
              Your business number receives an inbound call.
            </p>
          </div>

          <div>
            <div className="text-5xl mb-6">⚡</div>
            <h3 className="text-xl font-semibold mb-4">Instant Protection</h3>
            <p className="text-slate-400">
              Miss it? We immediately send a professional text reply.
            </p>
          </div>

          <div>
            <div className="text-5xl mb-6">🛡️</div>
            <h3 className="text-xl font-semibold mb-4">Full Visibility</h3>
            <p className="text-slate-400">
              Calls logged. Recorded (Pro). AI summarised. Stored safely.
            </p>
          </div>

        </div>
      </section>


      {/* PRICING */}
      <section id="pricing" className="py-36 px-6 text-center">
        <h2 className="text-4xl font-bold mb-20">
          Professional Pricing
        </h2>

        <div className="grid md:grid-cols-3 gap-10 max-w-6xl mx-auto">

          {/* STANDARD */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-10">
            <h3 className="text-2xl font-bold mb-4">Standard</h3>

            <p className="text-5xl font-bold mb-3">
              £197<span className="text-lg text-slate-400">/month</span>
            </p>

            <p className="text-sm text-slate-400 mb-6">
              + £99 setup (Waived)
            </p>

            <ul className="space-y-3 text-slate-300 mb-10 text-left">
              <li>✔ Dedicated business number</li>
              <li>✔ Instant missed call SMS</li>
              <li>✔ Lead capture dashboard</li>
              <li>✔ Custom auto-reply message</li>
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
          <div className="bg-blue-600 text-white rounded-2xl p-10 relative scale-105">
            <div className="absolute top-0 right-0 bg-black text-white text-xs px-3 py-1 rounded-bl-lg">
              Most Popular
            </div>

            <h3 className="text-2xl font-bold mb-4">Pro</h3>

            <p className="text-5xl font-bold mb-3">
              £297<span className="text-lg opacity-80">/month</span>
            </p>

            <p className="text-sm opacity-80 mb-6">
              + £99 setup (Waived)
            </p>

            <ul className="space-y-3 mb-10 text-left">
              <li>✔ Everything in Standard</li>
              <li>✔ Inbound call recording</li>
              <li>✔ AI short call transcripts</li>
              <li>✔ Call playback in dashboard</li>
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
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-10">
            <h3 className="text-2xl font-bold mb-4">Elite</h3>

            <p className="text-3xl font-bold mb-8">
              Price On Request
            </p>

            <ul className="space-y-3 text-slate-300 mb-10 text-left">
              <li>✔ Everything in Pro</li>
              <li>✔ Inbound & outbound recording</li>
              <li>✔ Business number ownership transfer</li>
              <li>✔ Google Business optimisation</li>
              <li>✔ Fleet signage coordination</li>
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
      <section className="py-32 px-6 bg-blue-600 text-center">
        <h2 className="text-4xl font-bold mb-8 text-white">
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