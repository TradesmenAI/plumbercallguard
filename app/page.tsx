export default function Home() {
  return (
    <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center px-6">
      
      <h1 className="text-4xl md:text-6xl font-bold text-center mb-6">
        Stop Losing Plumbing Jobs To Missed Calls
      </h1>

      <p className="text-xl text-center max-w-2xl mb-8 text-gray-300">
        Plumber Call Guard automatically texts back missed calls,
        captures the lead, and protects your business line 24/7.
      </p>

      <div className="flex gap-4">
        <button className="bg-green-600 hover:bg-green-700 px-6 py-3 rounded-lg text-lg font-semibold">
          Start Free Trial
        </button>

        <button className="border border-white px-6 py-3 rounded-lg text-lg font-semibold hover:bg-white hover:text-black transition">
          See How It Works
        </button>
      </div>

    </div>
  );
}