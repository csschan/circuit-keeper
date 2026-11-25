import Link from "next/link";

const FEATURES = [
  {
    icon: "🔒",
    title: "Immutable Trigger Logic",
    desc: "Trigger rules are TapeOut NAND-gate circuits — deployed once on-chain, verifiable by anyone, never changeable.",
  },
  {
    icon: "📡",
    title: "Real-time Price Feeds",
    desc: "Monitor OKB, ETH, BTC prices via OKX API → PriceRelay. Trigger actions when prices cross your thresholds.",
  },
  {
    icon: "🧩",
    title: "Composable Conditions",
    desc: "Combine price, time, balance, and custom contract calls. Use NAND circuits to build AND/OR/NOT logic gates.",
  },
  {
    icon: "💰",
    title: "Earn as a Keeper",
    desc: "Run the keeper bot in your browser. Earn 80% of fees for every job you execute. No staking required.",
  },
];

const USE_CASES = [
  {
    emoji: "💰",
    title: "Profit Taker",
    desc: "When OKB price rises above your target, auto-harvest yield to lock in profits. Powered by TapeOut NAND circuit.",
    circuit: "NAND(PRICE_BELOW, PRICE_BELOW) = NOT(below) = above",
  },
  {
    emoji: "🚨",
    title: "Stop-Loss Guard",
    desc: "When OKB drops below your stop-loss, auto-execute protective action before liquidation hits.",
    circuit: "NAND(PRICE_ABOVE, PRICE_ABOVE) = NOT(above) = below",
  },
  {
    emoji: "🌾",
    title: "Auto Yield Harvester",
    desc: "Harvest DeFi vault yield every N minutes. Set it and forget it — keepers handle the rest.",
    circuit: "TIMESTAMP_MOD: every 5 minutes",
  },
  {
    emoji: "⚖️",
    title: "Portfolio Rebalancer",
    desc: "Rebalance your portfolio when OKB price exceeds a threshold. Maintain target allocation automatically.",
    circuit: "PRICE_ABOVE: OKB > $80",
  },
];

export default function Home() {
  return (
    <div className="min-h-screen">
      {/* Hero */}
      <section className="max-w-5xl mx-auto px-4 pt-24 pb-20 text-center">
        <div className="inline-flex items-center gap-2 bg-green-500/10 border border-green-500/20 text-green-400 text-xs font-medium px-3 py-1.5 rounded-full mb-6">
          <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
          Live on X Layer Mainnet + TapeOut
        </div>

        <h1 className="text-5xl md:text-6xl font-bold mb-6 leading-tight">
          Automate anything on-chain.
          <br />
          <span className="text-green-400">Rules carved in circuits.</span>
        </h1>

        <p className="text-gray-400 text-xl max-w-2xl mx-auto mb-10">
          Circuit Keeper uses TapeOut&apos;s on-chain NAND-gate circuits as immutable trigger conditions.
          When your condition is met, keepers auto-execute your action and earn fees.
        </p>

        <div className="flex items-center justify-center gap-4">
          <Link
            href="/jobs/create"
            className="bg-green-500 hover:bg-green-400 text-black font-semibold px-8 py-3 rounded-xl transition-colors"
          >
            Create a Job
          </Link>
          <Link
            href="/keeper"
            className="border border-green-500/50 hover:border-green-400 text-green-400 font-medium px-8 py-3 rounded-xl transition-colors"
          >
            Earn as Keeper →
          </Link>
        </div>
      </section>

      {/* How it works */}
      <section className="max-w-5xl mx-auto px-4 py-16">
        <h2 className="text-2xl font-bold text-center mb-12 text-gray-200">How it works</h2>
        <div className="flex flex-col md:flex-row items-start gap-4">
          {[
            { step: "01", title: "Pick a template", desc: "Choose from DeFi or TapeOut automation templates — profit taker, yield harvester, stop-loss, and more." },
            { step: "02", title: "Set your conditions", desc: "Configure price thresholds, time intervals, and execution targets. Deposit OKB budget for keeper fees." },
            { step: "03", title: "TapeOut verifies", desc: "Your conditions are evaluated by real TapeOut NAND-gate circuits on X Layer. Immutable and verifiable." },
            { step: "04", title: "Keepers execute", desc: "Decentralized keepers scan every few seconds. When your circuit outputs TRUE, they execute and earn 80% fee." },
          ].map(({ step, title, desc }) => (
            <div key={step} className="flex-1 relative">
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
                <span className="text-4xl font-bold text-gray-800 font-mono">{step}</span>
                <h3 className="font-semibold text-white mt-2 mb-2">{title}</h3>
                <p className="text-gray-400 text-sm">{desc}</p>
              </div>
              {step !== "04" && (
                <div className="hidden md:block absolute top-1/2 -right-2 text-gray-700 text-xl z-10">→</div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section className="bg-gray-900/50 py-16">
        <div className="max-w-5xl mx-auto px-4">
          <h2 className="text-2xl font-bold text-center mb-12 text-gray-200">Why Circuit Keeper?</h2>
          <div className="grid md:grid-cols-2 gap-6">
            {FEATURES.map(({ icon, title, desc }) => (
              <div key={title} className="flex gap-4 p-5 bg-gray-900 border border-gray-800 rounded-xl">
                <span className="text-2xl flex-shrink-0">{icon}</span>
                <div>
                  <h3 className="font-semibold text-white mb-1">{title}</h3>
                  <p className="text-gray-400 text-sm">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Use cases */}
      <section className="max-w-5xl mx-auto px-4 py-16">
        <h2 className="text-2xl font-bold text-center mb-4 text-gray-200">What can you automate?</h2>
        <p className="text-center text-gray-500 mb-12">Every template works out of the box — just set your parameters and go.</p>
        <div className="grid md:grid-cols-2 gap-6">
          {USE_CASES.map(({ emoji, title, desc, circuit }) => (
            <div key={title} className="bg-gray-900 border border-gray-800 rounded-xl p-6">
              <div className="flex items-start gap-3 mb-3">
                <span className="text-2xl">{emoji}</span>
                <h3 className="font-semibold text-white">{title}</h3>
              </div>
              <p className="text-gray-400 text-sm mb-4">{desc}</p>
              <div className="bg-gray-800 rounded-lg px-3 py-2">
                <span className="text-xs text-gray-500">Circuit logic: </span>
                <span className="text-xs font-mono text-green-400">{circuit}</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Architecture */}
      <section className="bg-gray-900/50 py-16">
        <div className="max-w-3xl mx-auto px-4">
          <h2 className="text-2xl font-bold text-center mb-8 text-gray-200">Architecture</h2>
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 font-mono text-sm space-y-2">
            <div className="text-gray-500">{"// Full execution flow"}</div>
            <div><span className="text-blue-400">OKX API</span> <span className="text-gray-600">→</span> <span className="text-gray-400">real-time prices</span></div>
            <div className="pl-4"><span className="text-gray-600">↓</span> <span className="text-gray-500">PriceRelay pushes to chain</span></div>
            <div><span className="text-purple-400">InputResolver</span> <span className="text-gray-600">→</span> <span className="text-gray-400">resolves conditions to bits</span></div>
            <div className="pl-4"><span className="text-gray-600">↓</span> <span className="text-gray-500">bit-packed input bytes</span></div>
            <div><span className="text-green-400">TapeOut eval(circuitId, bits)</span> <span className="text-gray-600">→</span> <span className="text-gray-400">TRUE / FALSE</span></div>
            <div className="pl-4"><span className="text-gray-600">↓</span> <span className="text-gray-500">if output pin = 1</span></div>
            <div><span className="text-yellow-400">Keeper</span> <span className="text-gray-600">→</span> <span className="text-gray-400">executeJob() → target.call()</span></div>
            <div className="pl-4"><span className="text-gray-600">↓</span> <span className="text-gray-500">fee split: 80% keeper, 20% protocol</span></div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-green-500/5 border-y border-green-500/20 py-16">
        <div className="max-w-2xl mx-auto px-4 text-center">
          <h2 className="text-3xl font-bold mb-4">Trigger conditions carved in silicon.</h2>
          <p className="text-gray-400 mb-8">
            TapeOut circuits are immutable. Once deployed, not even you can change the trigger logic. That&apos;s the point.
          </p>
          <div className="flex items-center justify-center gap-4">
            <Link
              href="/jobs/create"
              className="bg-green-500 hover:bg-green-400 text-black font-semibold px-10 py-4 rounded-xl transition-colors text-lg"
            >
              Create your first Job →
            </Link>
            <Link
              href="/explore"
              className="border border-gray-700 hover:border-gray-500 text-gray-300 font-medium px-8 py-4 rounded-xl transition-colors"
            >
              View live Jobs
            </Link>
          </div>
        </div>
      </section>

      {/* Contracts */}
      <section className="max-w-3xl mx-auto px-4 py-12">
        <h3 className="text-sm font-semibold text-gray-500 text-center mb-4 uppercase tracking-wider">Deployed on X Layer Mainnet</h3>
        <div className="grid grid-cols-2 gap-3 text-xs font-mono">
          {[
            { name: "JobRegistry", addr: "0x891166Ac81f4b9cD646e9Cd645c1D6eA5d78E853" },
            { name: "PriceRelay", addr: "0xe60A1b35Adacc16B00eF16d5542cE86E21F22d55" },
            { name: "TapeOut XBOT", addr: "0xa5fc69Ca2D3d462CCa204D894D85ac8071c4F0f0" },
            { name: "TapeOut Factory", addr: "0x1f09DAeFA827f02CBb40967cc91b259763760761" },
          ].map(({ name, addr }) => (
            <div key={name} className="bg-gray-900 border border-gray-800 rounded-lg p-3">
              <div className="text-gray-500 text-[10px] mb-1">{name}</div>
              <div className="text-gray-400 truncate">{addr}</div>
            </div>
          ))}
        </div>
      </section>

      <footer className="max-w-5xl mx-auto px-4 py-8 flex items-center justify-between text-sm text-gray-600">
        <span>Circuit Keeper — X Layer TapeOut Accelerate Hackathon 2026</span>
        <div className="flex gap-6">
          <a href="https://x.com/TapeOutWorld" target="_blank" rel="noopener noreferrer" className="hover:text-gray-400 transition-colors">TapeOut</a>
          <a href="https://web3.okx.com/xlayer" target="_blank" rel="noopener noreferrer" className="hover:text-gray-400 transition-colors">X Layer</a>
        </div>
      </footer>
    </div>
  );
}
