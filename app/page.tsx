export default function Home() {
  return (
    <div className="bg-black text-white">

      {/* HERO */}
      <section className="min-h-screen flex flex-col items-center justify-center px-6 text-center">
        <h1 className="text-4xl md:text-6xl font-bold mb-6 max-w-4xl">
          Stop Losing Plumbing Jobs To Missed Calls
        </h1>

        <p className="text-xl text-gray-300 max-w-2xl mb-8">
          Plumber Call Guard automatically texts back missed calls in seconds,
          captures the lead, and protects your revenue 24/7.
        </p>

        <div className="flex flex-col sm:flex-row gap-4">
          <a
            href="/signup"
            className="bg-green-600 hover:bg-green-700 px-8 py-4 rounded-lg text-lg font-semibold transition"
          >
            Start Free Trial
          </a>

          <a
            href="#how"
            className="border border-white px-8 py-4 rounded-lg text-lg font-semibold hover:bg-white hover:text-black transition"
          >
            See How It Works
          </a>
        </div>
      </section>

      {/* PROBLEM SECTION */}
      <section className="py-24 px-6 bg-zinc-950 text-center">
        <h2 className="text-3xl md:text-4xl font-bold mb-8">
          Every Missed Call Is Lost Revenue
        </h2>

        <p className="text-gray-400 max-w-3xl mx-auto text-lg">
          When a homeowner calls a plumber and nobody answers,
          they don’t leave a voicemail — they call the next number.
          We make sure you respond instantly, even when you're on a job.
        </p>
      </section>

      {/* HOW IT WORKS */}
      <section id="how" className="py-24 px-6 text-center">
        <h2 className="text-3xl md:text-4xl font-bold mb-16">
          How It Works
        </h2>

        <div className="grid md:grid-cols-3 gap-12 max-w-6xl mx-auto">

          <div>
            <div className="text-5xl mb-6">📞</div>
            <h3 className="text-xl font-semibold mb-4">Customer Calls</h3>
            <p className="text-gray-400">
              A potential customer calls your business but you miss it.
            </p>
          </div>

          <div>
            <div className="text-5xl mb-6">⚡</div>
            <h3 className="text-xl font-semibold mb-4">Instant Text Reply</h3>
            <p className="text-gray-400">
              We automatically send a professional SMS response within seconds.
            </p>
          </div>

          <div>
            <div className="text-5xl mb-6">💰</div>
            <h3 className="text-xl font-semibold mb-4">Lead Captured</h3>
            <p className="text-gray-400">
              The customer replies, and the lead is saved to your dashboard.
            </p>
          </div>

        </div>
      </section>

      {/* PRICING */}
      <section className="py-24 px-6 bg-zinc-950 text-center">
        <h2 className="text-3xl md:text-4xl font-bold mb-12">
          Simple Pricing
        </h2>

        <div className="max-w-xl mx-auto bg-zinc-900 p-10 rounded-2xl border border-zinc-800">
          <h3 className="text-2xl font-bold mb-4">Standard Plan</h3>

          <p className="text-5xl font-bold mb-6">
            £49<span className="text-lg text-gray-400">/month</span>
          </p>

          <ul className="space-y-3 text-gray-300 mb-8">
            <li>✔ Unlimited missed call auto replies</li>
            <li>✔ Lead capture dashboard</li>
            <li>✔ Custom SMS response</li>
            <li>✔ UK-based support</li>
          </ul>

          <a
            href="/signup"
            className="bg-green-600 hover:bg-green-700 px-8 py-4 rounded-lg text-lg font-semibold transition inline-block"
          >
            Start Free Trial
          </a>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-24 px-6 text-center">
        <h2 className="text-3xl md:text-4xl font-bold mb-12">
          Frequently Asked Questions
        </h2>

        <div className="max-w-3xl mx-auto space-y-8 text-left">

          <div>
            <h3 className="font-semibold text-lg mb-2">
              Does this replace my phone system?
            </h3>
            <p className="text-gray-400">
              No. It works alongside your existing business number.
            </p>
          </div>

          <div>
            <h3 className="font-semibold text-lg mb-2">
              How quickly does it reply?
            </h3>
            <p className="text-gray-400">
              Usually within 3–5 seconds of a missed call.
            </p>
          </div>

          <div>
            <h3 className="font-semibold text-lg mb-2">
              Can I customise the message?
            </h3>
            <p className="text-gray-400">
              Yes. You can edit your auto-response inside the dashboard.
            </p>
          </div>

        </div>
      </section>

      {/* FINAL CTA */}
      <section className="py-24 px-6 bg-green-600 text-center">
        <h2 className="text-3xl md:text-4xl font-bold mb-6 text-black">
          Stop Losing Jobs To Missed Calls
        </h2>

        <a
          href="/signup"
          className="bg-black text-white px-10 py-4 rounded-lg text-lg font-semibold hover:bg-zinc-900 transition"
        >
          Start Free Trial
        </a>
      </section>

    </div>
  );
}