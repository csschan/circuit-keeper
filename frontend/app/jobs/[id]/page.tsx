"use client";

export const dynamic = "force-dynamic";

import { use, useState, useEffect } from "react";
import { useAccount, useWriteContract, useWaitForTransactionReceipt, useReadContract } from "wagmi";
import Link from "next/link";
import { useJob, useCheckUpkeep, useRegistryAddress } from "@/lib/hooks";
import { JOB_REGISTRY_ABI } from "@/lib/abi";
import { formatCooldown, formatBudget, jobStatus, nextRunTime, INPUT_TYPE_LABELS, InputType } from "@/lib/types";
import { parseEther } from "viem";

type ExecEvent = {
  keeper: `0x${string}`;
  timestamp: bigint;
  txHash: `0x${string}`;
  blockNumber: bigint;
  actionResult?: string; // human-readable result from DemoTarget event
};

// DemoTarget event topic → label + data decoder
const DEMO_EVENTS: Record<string, { label: string; decode: (data: string) => string }> = {
  "0xeea0ca0837bac590bc1df36a96431b06d6e8c95770315159e0545eef0f464258": {
    label: "Rebalanced",
    decode: (data) => { const tvl = parseInt(data.slice(2, 66), 16); return `TVL: $${tvl.toLocaleString()}`; },
  },
  "0x25a67b6be0ab8b7034fe740b75a05c12f1ab6d86d3b7e7e41aaa75784f6d63b3": {
    label: "Harvested",
    decode: (data) => { const y = parseInt(data.slice(2, 66), 16); return `Yield: ${y.toLocaleString()}`; },
  },
  "0x01613b267a8d893bfd7b52a7429d3890dde615412444390e9adc849f19f66c55": {
    label: "Protected",
    decode: (data) => { const c = parseInt(data.slice(2, 66), 16); return `Collateral: $${c.toLocaleString()}`; },
  },
  "0x87ccecc5d5f23b232d1d7a27a90989eab29e2f089aa9fff3854c19d0d3b10f47": {
    label: "Oracle Updated",
    decode: (data) => { const p = parseInt(data.slice(2, 66), 16) / 1e8; return `Price: $${p.toFixed(2)}`; },
  },
};

interface PageProps {
  params: Promise<{ id: string }>;
}

const DEMO_TARGET = "0x69145de0433562ec04C5a824a7B1f166cfB71661".toLowerCase();
const PRICE_RELAY = "0xe60A1b35Adacc16B00eF16d5542cE86E21F22d55".toLowerCase();

// Known function selectors → human-readable names
const KNOWN_FUNCTIONS: Record<string, { name: string; icon: string; description: string }> = {
  "0x7d7c2a1c": { name: "rebalance()", icon: "⚖️", description: "Rebalance portfolio to target allocation" },
  "0x4641257d": { name: "harvest()", icon: "🌾", description: "Harvest accumulated yield from vault" },
  "0xf9e9e57b": { name: "preventLiquidation()", icon: "🛡️", description: "Top up collateral to prevent liquidation" },
  "0xd6f124f0": { name: "updateOracle()", icon: "📡", description: "Push latest price to on-chain oracle" },
  "0x37597cb5": { name: "getActiveJobs()", icon: "📋", description: "Query active jobs (demo)" },
  "0x7bd3ac1d": { name: "tapeout()", icon: "🏭", description: "Assemble transistors into a TapeOut circuit" },
  "0x1b2ef1ca": { name: "mint()", icon: "🧱", description: "Mint TapeOut transistor tokens" },
  "0x47f9b5fd": { name: "createCPU()", icon: "🖥️", description: "Deploy a new TapeOut Processor via Factory" },
};

// Known addresses
const KNOWN_ADDRESSES: Record<string, string> = {
  [DEMO_TARGET]: "DemoTarget",
  [PRICE_RELAY]: "PriceRelay (OKX live prices)",
  "0x8fa4617dc8de6378160a99c0c623387c08ff499f": "MockProcessor (echo mode)",
  "0x891166ac81f4b9cd646e9cd645c1d6ea5d78e853": "JobRegistry",
  "0xa5fc69ca2d3d462cca204d894d85ac8071c4f0f0": "XBOT Processor (TapeOut)",
  "0x7be7280e31984d18f62218519985ec5dcca751de": "XBOT Transistors (ERC-1155)",
  "0x1f09daeafa827f02cbb40967cc91b259763760761": "TapeOut Factory",
};

const DEMO_TARGET_ABI = [
  "function stats() view returns (uint256 rebalances, uint256 harvests, uint256 liquidations, uint256 oracles, uint256 tvlRebalanced, uint256 yieldHarvested)",
  "function totalValueRebalanced() view returns (uint256)",
  "function totalYieldHarvested() view returns (uint256)",
  "function liquidationsPrevented() view returns (uint256)",
  "function priceUpdates() view returns (uint256)",
] as const;

// Live price display for PRICE_ABOVE/BELOW conditions
function LivePriceInfo({ sources }: { sources: Array<{ inputType: number; target: `0x${string}`; threshold: bigint }> | null }) {
  const [prices, setPrices] = useState<Record<string, number>>({});

  useEffect(() => {
    const hasPriceFeed = sources?.some(s => s.inputType <= 1 && s.target.toLowerCase() === PRICE_RELAY);
    if (!hasPriceFeed) return;

    const RPC = "https://rpc.xlayer.tech";
    async function fetchPrice() {
      try {
        const res = await fetch(RPC, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_call",
            params: [{ to: "0xe60A1b35Adacc16B00eF16d5542cE86E21F22d55", data: "0xfeaf968c" /* latestRoundData() */ }, "latest"] }),
        });
        const json = await res.json();
        if (json.result && json.result.length > 2) {
          // answer is at offset 32-64 bytes (second slot)
          const hex = json.result.slice(2);
          const answer = parseInt(hex.slice(64, 128), 16);
          setPrices({ "OKB/USD": answer / 1e8 });
        }
      } catch {}
    }
    fetchPrice();
    const iv = setInterval(fetchPrice, 10_000);
    return () => clearInterval(iv);
  }, [sources]);

  if (!sources) return null;

  return (
    <>
      {sources.filter(s => s.inputType <= 1).map((src, i) => {
        const isAbove = src.inputType === 0;
        const threshold = Number(src.threshold) / 1e8;
        const currentPrice = prices["OKB/USD"];
        const conditionMet = currentPrice != null && (isAbove ? currentPrice > threshold : currentPrice < threshold);

        return (
          <div key={i} className="bg-green-500/5 border border-green-500/20 rounded-xl p-4 mb-4">
            <div className="text-xs text-gray-500 mb-2">Trigger Condition — Live</div>
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-gray-400">
                  {isAbove ? "Trigger when OKB price >" : "Trigger when OKB price <"}
                  <span className="text-green-400 font-semibold ml-1">${threshold.toFixed(2)}</span>
                </div>
                {currentPrice != null && (
                  <div className="text-lg font-mono font-bold mt-1">
                    <span className="text-gray-500 text-sm mr-2">Current:</span>
                    <span className={conditionMet ? "text-green-400" : "text-yellow-400"}>
                      ${currentPrice.toFixed(2)}
                    </span>
                  </div>
                )}
              </div>
              <div className={`text-xs font-bold px-3 py-1.5 rounded-full ${conditionMet ? "bg-green-500/20 text-green-400" : "bg-yellow-500/20 text-yellow-400"}`}>
                {conditionMet ? "✓ Condition Met" : "✗ Not Met"}
              </div>
            </div>
            <div className="text-xs text-gray-600 mt-2">
              Price source: OKX API → PriceRelay ({src.target.slice(0, 10)}…)
            </div>
          </div>
        );
      })}
    </>
  );
}

// Derive job name from trigger + action combination
function resolveJobName(
  callData: string,
  target: string,
  inputSources?: Array<{ inputType: number }> | null,
): { icon: string; name: string; desc: string } {
  const selector = callData.slice(0, 10).toLowerCase();
  const fn = KNOWN_FUNCTIONS[selector];
  const triggerType = inputSources?.[0]?.inputType;

  // Smart naming: combine trigger + action
  if (fn && triggerType !== undefined) {
    // Price-triggered jobs
    if (triggerType === 0 && selector === "0x4641257d") // PRICE_ABOVE + harvest
      return { icon: "💰", name: "Circuit Profit Taker", desc: "When price rises above target, lock in profits via harvest" };
    if (triggerType === 1 && selector === "0x4641257d") // PRICE_BELOW + harvest (NAND NOT gate: NOT(below) = above)
      return { icon: "💰", name: "Circuit Profit Taker", desc: "When price rises above target, lock in profits via TapeOut NAND circuit" };
    if (triggerType === 1 && selector === "0xf9e9e57b") // PRICE_BELOW + preventLiquidation
      return { icon: "🚨", name: "Circuit Stop-Loss", desc: "When price drops below target, execute protective action" };
    if (triggerType === 0 && selector === "0xf9e9e57b") // PRICE_ABOVE + preventLiquidation (NAND NOT gate: NOT(above) = below)
      return { icon: "🚨", name: "Circuit Stop-Loss", desc: "When price drops below target, execute protection via TapeOut NAND circuit" };
    if (triggerType === 0 && selector === "0x7d7c2a1c") // PRICE_ABOVE + rebalance
      return { icon: "⚖️", name: "Price Rebalancer", desc: "When price exceeds threshold, rebalance portfolio allocation" };
    if (triggerType === 1 && selector === "0x7d7c2a1c") // PRICE_BELOW + rebalance
      return { icon: "⚖️", name: "Dip Rebalancer", desc: "When price drops below threshold, rebalance to buy the dip" };
    if (triggerType === 1 && selector === "0x1b2ef1ca") // PRICE_BELOW + mint
      return { icon: "🧱", name: "Transistor Buyer", desc: "When OKB price drops, auto-mint transistors at cheaper rate" };

    // Time-triggered jobs
    if (triggerType === 4 && selector === "0x4641257d") // TIMESTAMP + harvest
      return { icon: "🌾", name: "Auto Yield Harvester", desc: "Periodically harvest accumulated yield from vault" };
    if (triggerType === 4 && selector === "0x7d7c2a1c") // TIMESTAMP + rebalance
      return { icon: "⚖️", name: "Scheduled Rebalancer", desc: "Periodically rebalance portfolio on a fixed schedule" };
    if (triggerType === 4 && selector === "0xd6f124f0") // TIMESTAMP + updateOracle
      return { icon: "📡", name: "Oracle Updater", desc: "Periodically push fresh price data to on-chain oracle" };
    if (triggerType === 4 && selector === "0x7bd3ac1d") // TIMESTAMP + tapeout
      return { icon: "🏭", name: "Auto Tapeout", desc: "Periodically assemble transistors into TapeOut circuits" };
    if (triggerType === 4 && selector === "0x1b2ef1ca") // TIMESTAMP + mint
      return { icon: "📊", name: "Transistor DCA", desc: "Dollar-cost average into TapeOut transistors on schedule" };
    if (triggerType === 4 && selector === "0x47f9b5fd") // TIMESTAMP + createCPU
      return { icon: "🖥️", name: "CPU Factory Deployer", desc: "Periodically deploy new TapeOut Processor contracts" };

    // Circuit-triggered
    if (triggerType === 6) // CIRCUIT_OUTPUT
      return { icon: "🔬", name: "Circuit Monitor", desc: "Triggered by TapeOut circuit output change" };
  }

  if (fn) return { icon: fn.icon, name: fn.name, desc: fn.description };
  return { icon: "⚡", name: selector, desc: "Custom contract call" };
}

function resolveAddressName(addr: string): string {
  return KNOWN_ADDRESSES[addr.toLowerCase()] ?? `${addr.slice(0, 8)}…${addr.slice(-6)}`;
}

function DemoTargetStats({ target, execCount }: { target: `0x${string}`; execCount: number }) {
  const [stats, setStats] = useState<{
    rebalances: number; harvests: number; liquidations: number; oracles: number;
    tvl: number; yield_: number;
  } | null>(null);

  useEffect(() => {
    if (target.toLowerCase() !== DEMO_TARGET || execCount === 0) return;

    const RPC = "https://rpc.xlayer.tech";
    async function fetchStats() {
      try {
        // Call stats() — returns 6 uint256s
        const res = await fetch(RPC, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            jsonrpc: "2.0", id: 1, method: "eth_call",
            params: [{ to: target, data: "0xd80528ae" /* stats() selector */ }, "latest"],
          }),
        });
        const json = await res.json();
        if (json.result && json.result !== "0x") {
          const hex = json.result.slice(2);
          const vals = [];
          for (let i = 0; i < 6; i++) {
            vals.push(parseInt(hex.slice(i * 64, (i + 1) * 64), 16));
          }
          setStats({
            rebalances: vals[0], harvests: vals[1], liquidations: vals[2],
            oracles: vals[3], tvl: vals[4], yield_: vals[5],
          });
        }
      } catch (e) { console.error("DemoTarget stats error:", e); }
    }

    fetchStats();
    const iv = setInterval(fetchStats, 15_000);
    return () => clearInterval(iv);
  }, [target, execCount]);

  if (!stats || target.toLowerCase() !== DEMO_TARGET) return null;

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 mb-4">
      <div className="text-xs text-gray-500 mb-3">Execution Results (DemoTarget)</div>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {stats.rebalances > 0 && (
          <div className="text-center">
            <div className="text-lg font-bold text-green-400 font-mono">{stats.rebalances}</div>
            <div className="text-xs text-gray-500">Rebalances</div>
            <div className="text-xs text-gray-400 font-mono">${stats.tvl.toLocaleString()} TVL</div>
          </div>
        )}
        {stats.harvests > 0 && (
          <div className="text-center">
            <div className="text-lg font-bold text-yellow-400 font-mono">{stats.harvests}</div>
            <div className="text-xs text-gray-500">Harvests</div>
            <div className="text-xs text-gray-400 font-mono">{stats.yield_.toLocaleString()} yield</div>
          </div>
        )}
        {stats.liquidations > 0 && (
          <div className="text-center">
            <div className="text-lg font-bold text-red-400 font-mono">{stats.liquidations}</div>
            <div className="text-xs text-gray-500">Liquidations Prevented</div>
          </div>
        )}
        {stats.oracles > 0 && (
          <div className="text-center">
            <div className="text-lg font-bold text-blue-400 font-mono">{stats.oracles}</div>
            <div className="text-xs text-gray-500">Oracle Updates</div>
          </div>
        )}
      </div>
    </div>
  );
}

function InputTypeBadge({ inputType }: { inputType: number }) {
  const label = INPUT_TYPE_LABELS[inputType as InputType] ?? `Type ${inputType}`;
  return (
    <span className="text-xs bg-gray-800 text-gray-300 px-2 py-0.5 rounded font-mono">
      {label}
    </span>
  );
}

export default function JobDetailPage({ params }: PageProps) {
  const { id: idStr } = use(params);
  const jobId = parseInt(idStr, 10);
  const registry = useRegistryAddress();
  const { address } = useAccount();

  const { data: job, isLoading, refetch } = useJob(jobId);
  const { data: ready } = useCheckUpkeep(jobId);

  const { data: sources } = useReadContract({
    address: registry,
    abi: JOB_REGISTRY_ABI,
    functionName: "getInputSources",
    args: [BigInt(jobId)],
  });

  const { writeContract, data: txHash, isPending, error: writeError } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash: txHash });

  const [execEvents, setExecEvents] = useState<ExecEvent[]>([]);

  useEffect(() => {
    if (!registry) return;
    let cancelled = false;

    const RPC = "https://rpc.xlayer.tech";
    // JobExecuted(uint256 indexed jobId, address indexed keeper, uint256 timestamp)
    const EVENT_TOPIC = "0x6eeb70d5c615850631e61e82fdcee26590140c0519588217fe96ed6f86935457";

    let rpcId = 0;
    async function rpcCall(method: string, params: unknown[]) {
      const id = ++rpcId;
      const res = await fetch(RPC, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id, method, params }),
      });
      const json = await res.json();
      return json.result;
    }

    async function fetchLogs() {
      try {
        const hexBlock = await rpcCall("eth_blockNumber", []);
        const currentBlock = parseInt(hexBlock, 16);
        const BATCH = 99;
        const TOTAL_SCAN = 10000;
        const startBlock = Math.max(0, currentBlock - TOTAL_SCAN);
        const allEvents: ExecEvent[] = [];
        const targetJobId = jobId;

        // Build all batch requests
        const batches: Array<{ from: number; to: number }> = [];
        for (let from = startBlock; from <= currentBlock; from += BATCH + 1) {
          batches.push({ from, to: Math.min(from + BATCH, currentBlock) });
        }

        // Run in parallel (5 at a time to avoid RPC rate limits)
        const CONCURRENCY = 5;
        for (let i = 0; i < batches.length && !cancelled; i += CONCURRENCY) {
          const chunk = batches.slice(i, i + CONCURRENCY);
          const results = await Promise.all(chunk.map(({ from, to }) =>
            rpcCall("eth_getLogs", [{
              address: registry,
              topics: [EVENT_TOPIC],
              fromBlock: "0x" + from.toString(16),
              toBlock: "0x" + to.toString(16),
            }]).catch(() => null)
          ));

          for (const logs of results) {
            if (!Array.isArray(logs)) continue;
            for (const log of logs) {
              const logJobId = parseInt(log.topics[1], 16);
              if (logJobId !== targetJobId) continue;
              allEvents.push({
                keeper: ("0x" + log.topics[2].slice(26)) as `0x${string}`,
                timestamp: BigInt(log.data),
                txHash: log.transactionHash as `0x${string}`,
                blockNumber: BigInt(log.blockNumber),
              });
            }
          }
        }

        // Fetch action results from tx receipts (for DemoTarget events)
        if (allEvents.length > 0 && !cancelled) {
          const enriched = await Promise.all(allEvents.map(async (evt) => {
            try {
              const receipt = await rpcCall("eth_getTransactionReceipt", [evt.txHash]);
              if (receipt?.logs) {
                for (const rl of receipt.logs) {
                  const handler = DEMO_EVENTS[rl.topics?.[0]];
                  if (handler) {
                    return { ...evt, actionResult: `${handler.label} — ${handler.decode(rl.data)}` };
                  }
                }
              }
            } catch {}
            return evt;
          }));
          setExecEvents(enriched);
        } else if (!cancelled) {
          setExecEvents(allEvents);
        }
      } catch (e) {
        console.error("Failed to fetch execution logs:", e);
      }
    }

    fetchLogs();
    const interval = setInterval(fetchLogs, 15_000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [registry, jobId]);

  const [topUpAmount, setTopUpAmount] = useState("0.1");

  // Live countdown — must be before any conditional returns
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  if (isLoading) {
    return <div className="max-w-3xl mx-auto px-4 py-20 text-center text-gray-500">Loading job…</div>;
  }

  if (!job) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-20 text-center">
        <p className="text-gray-500">Job #{jobId} not found.</p>
        <Link href="/jobs" className="text-green-400 mt-4 inline-block">← My Jobs</Link>
      </div>
    );
  }

  const isOwner = address?.toLowerCase() === job.owner.toLowerCase();
  const nextRun = nextRunTime(job.lastRun, job.cooldown);

  const cooldownRemaining = Math.max(0, Math.ceil((nextRun.getTime() - now) / 1000));
  const cooldownLabel = cooldownRemaining > 0
    ? `${Math.floor(cooldownRemaining / 60)}m ${cooldownRemaining % 60}s`
    : "0s";
  const cooldownPct = job.lastRun > 0n && Number(job.cooldown) > 0
    ? Math.min(100, Math.max(0, 100 - (cooldownRemaining / Number(job.cooldown)) * 100))
    : 0;

  // Chain-confirmed ready (for trigger button — must be true on-chain)
  const chainReady = ready ?? false;
  // Display-level ready (responsive status badge — local countdown + chain)
  const displayReady = chainReady || (job.active && job.budget >= job.feePerRun && cooldownRemaining === 0);
  const status = jobStatus(job, displayReady);

  const handlePause = () => writeContract({ address: registry, abi: JOB_REGISTRY_ABI, functionName: "pauseJob", args: [BigInt(jobId)] });
  const handleResume = () => writeContract({ address: registry, abi: JOB_REGISTRY_ABI, functionName: "resumeJob", args: [BigInt(jobId)] });
  const handleCancel = () => {
    if (confirm(`Cancel Job #${jobId}? Remaining budget will be refunded.`)) {
      writeContract({ address: registry, abi: JOB_REGISTRY_ABI, functionName: "cancelJob", args: [BigInt(jobId)] });
    }
  };
  const handleTopUp = () => {
    const val = parseFloat(topUpAmount);
    if (isNaN(val) || val <= 0) return;
    writeContract({
      address: registry,
      abi: JOB_REGISTRY_ABI,
      functionName: "topUpBudget",
      args: [BigInt(jobId)],
      value: parseEther(topUpAmount),
    });
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-10">
      {/* Back */}
      <Link href="/jobs" className="text-sm text-gray-500 hover:text-gray-300 transition-colors mb-6 inline-flex items-center gap-1">
        ← My Jobs
      </Link>

      {/* Header */}
      {(() => {
        const action = resolveJobName(job.callData, job.target, sources as unknown as Array<{ inputType: number }> | null);
        return (
          <div className="flex items-start justify-between mb-6">
            <div>
              <span className="text-xs font-mono text-gray-400">Job #{jobId}</span>
              <h1 className="text-xl font-bold text-white mt-1 flex items-center gap-2">
                <span>{action.icon}</span> {action.name}
              </h1>
              <div className="text-sm text-gray-400 mt-0.5">{action.desc}</div>
              <div className="text-xs text-gray-500 mt-1">
                Target: {resolveAddressName(job.target)}
              </div>
            </div>
            <span className={`text-xs font-medium px-3 py-1.5 rounded-full bg-gray-800 ${status.color}`}>
              {status.label}
            </span>
          </div>
        );
      })()}

      {/* Stats grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 text-center">
          <div className="text-xs text-gray-500 mb-1">Budget</div>
          <div className="font-mono font-semibold text-green-400">{formatBudget(job.budget)}</div>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 text-center">
          <div className="text-xs text-gray-500 mb-1">Fee/Run</div>
          <div className="font-mono font-semibold text-yellow-400">{formatBudget(job.feePerRun)}</div>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 text-center">
          <div className="text-xs text-gray-500 mb-1">
            {cooldownRemaining > 0 ? "Next Run" : "Cooldown"}
          </div>
          <div className={`font-mono font-semibold ${cooldownRemaining > 0 ? "text-yellow-400" : "text-purple-400"}`}>
            {cooldownRemaining > 0 ? cooldownLabel : formatCooldown(job.cooldown)}
          </div>
          {cooldownRemaining > 0 && (
            <div className="mt-1.5 w-full bg-gray-800 rounded-full h-1 overflow-hidden">
              <div
                className="h-full bg-yellow-400 rounded-full transition-all duration-1000"
                style={{ width: `${cooldownPct}%` }}
              />
            </div>
          )}
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 text-center">
          <div className="text-xs text-gray-500 mb-1">Est. Runs</div>
          <div className="font-mono font-semibold text-blue-400">{job.budget < job.feePerRun ? "0" : `~${Number(job.budget / job.feePerRun)}`}</div>
        </div>
      </div>

      {/* Live price condition */}
      <LivePriceInfo sources={sources as unknown as Array<{ inputType: number; target: `0x${string}`; threshold: bigint }> | null} />

      {/* Condition status + manual trigger */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 mb-4">
        <div className="flex items-center justify-between mb-2">
          <div className="text-xs text-gray-500">Condition Status</div>
          {chainReady && (
            <button
              onClick={() => writeContract({
                address: registry,
                abi: JOB_REGISTRY_ABI,
                functionName: "executeJob",
                args: [BigInt(jobId)],
              })}
              disabled={isPending || isConfirming}
              className="bg-green-500 hover:bg-green-400 disabled:opacity-50 text-black text-xs font-bold px-4 py-1.5 rounded-lg transition-colors"
            >
              {isPending ? "Confirm…" : isConfirming ? "Executing…" : "⚡ Trigger Now"}
            </button>
          )}
        </div>
        {chainReady ? (
          <div className="flex items-center gap-2 text-green-400 font-medium">
            <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
            Circuit evaluates to TRUE — ready to execute
          </div>
        ) : displayReady ? (
          <div className="flex items-center gap-2 text-yellow-400">
            <span className="w-2 h-2 rounded-full bg-yellow-400 animate-pulse" />
            Cooldown ended — waiting for condition window to open…
          </div>
        ) : (
          <div>
            <div className="flex items-center gap-2 text-gray-400">
              <span className="w-2 h-2 rounded-full bg-gray-600" />
              {job.lastRun === 0n
                ? "Waiting for first trigger window…"
                : cooldownRemaining > 0
                  ? <>Cooldown: <span className="text-yellow-400 font-mono font-semibold">{cooldownLabel}</span> remaining</>
                  : "Condition window not currently open"}
            </div>
            {/* Cooldown progress bar */}
            {job.lastRun > 0n && cooldownRemaining > 0 && (
              <div className="mt-2.5 w-full bg-gray-800 rounded-full h-1.5 overflow-hidden">
                <div
                  className="h-full bg-yellow-400 rounded-full transition-all duration-1000"
                  style={{ width: `${cooldownPct}%` }}
                />
              </div>
            )}
          </div>
        )}
        {isSuccess && (
          <div className="mt-2 text-xs text-green-400">Triggered successfully!</div>
        )}
        {writeError && (
          <div className="mt-2 text-xs text-red-400">
            {writeError.message.includes("CooldownNotMet")
              ? "Keeper already executed this job — cooldown restarted."
              : writeError.message.includes("ConditionNotMet")
              ? "Condition window just closed — wait for next cycle."
              : `Error: ${writeError.message.slice(0, 100)}`}
          </div>
        )}
      </div>

      {/* Input sources */}
      {sources && (sources as unknown[]).length > 0 && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 mb-4">
          <div className="text-xs text-gray-500 mb-3">Input Sources ({(sources as unknown[]).length})</div>
          <div className="space-y-2">
            {(sources as Array<{ inputType: number; target: `0x${string}`; threshold: bigint; data: `0x${string}` }>).map((src, i) => {
              const isTimestamp = src.inputType === 4; // TIMESTAMP_MOD
              const thresholdSec = Number(src.threshold);
              const thresholdLabel = isTimestamp
                ? (thresholdSec >= 3600 ? `${thresholdSec / 3600}h` : thresholdSec >= 60 ? `${thresholdSec / 60}m` : `${thresholdSec}s`)
                : src.threshold.toString();
              const isZeroTarget = src.target === "0x0000000000000000000000000000000000000000";
              return (
                <div key={i} className="flex items-start gap-3 text-sm">
                  <span className="text-gray-400 font-mono text-xs mt-0.5">#{i}</span>
                  <div className="flex-1">
                    <InputTypeBadge inputType={src.inputType} />
                    <div className="mt-1 font-mono text-xs text-gray-400 space-y-0.5">
                      {isTimestamp ? (
                        <span>every <span className="text-gray-200">{thresholdLabel}</span></span>
                      ) : (
                        <>
                          {!isZeroTarget && <span>target: <span className="text-gray-200">{src.target.slice(0, 10)}…{src.target.slice(-6)}</span></span>}
                          <span> · threshold: <span className="text-gray-200">{thresholdLabel}</span></span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Target call */}
      {(() => {
        const action = resolveJobName(job.callData, job.target, sources as unknown as Array<{ inputType: number }> | null);
        return (
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 mb-4">
            <div className="text-xs text-gray-500 mb-3">When triggered, executes:</div>
            <div className="flex items-center gap-3 mb-3">
              <span className="text-2xl">{action.icon}</span>
              <div>
                <div className="text-sm text-white font-semibold">{action.desc}</div>
                <div className="text-xs text-gray-500">
                  {resolveAddressName(job.target)} → <span className="text-green-400 font-mono">{action.name}</span>
                </div>
              </div>
            </div>
            <div className="space-y-2 font-mono text-xs">
              <div className="flex gap-3">
                <span className="text-gray-500 w-20 shrink-0">contract</span>
                <span className="text-gray-200 break-all">{job.target}</span>
              </div>
          <div className="flex gap-3">
            <span className="text-gray-500 w-20 shrink-0">gas limit</span>
            <span className="text-gray-200">{job.gasLimit.toString()}</span>
          </div>
        </div>
          </div>
        );
      })()}

      {/* Owner actions */}
      {isOwner && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 mb-4">
          <div className="text-xs text-gray-500 mb-4">Owner Controls</div>

          {/* Top up */}
          <div className="flex items-center gap-3 mb-4">
            <input
              type="number"
              min="0"
              step="0.01"
              value={topUpAmount}
              onChange={(e) => setTopUpAmount(e.target.value)}
              className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm font-mono text-gray-300 focus:outline-none focus:border-green-500"
              placeholder="OKB amount"
            />
            <span className="text-xs text-gray-500">OKB</span>
            <button
              onClick={handleTopUp}
              disabled={isPending || isConfirming}
              className="bg-green-500 hover:bg-green-400 disabled:opacity-50 text-black font-semibold px-4 py-2 rounded-lg text-sm transition-colors"
            >
              Top Up
            </button>
          </div>

          {/* Pause / Resume / Cancel */}
          <div className="flex gap-3">
            {job.active ? (
              <button
                onClick={handlePause}
                disabled={isPending || isConfirming}
                className="flex-1 border border-yellow-500/50 hover:border-yellow-400 text-yellow-400 disabled:opacity-50 font-medium px-4 py-2 rounded-lg text-sm transition-colors"
              >
                Pause
              </button>
            ) : (
              <button
                onClick={handleResume}
                disabled={isPending || isConfirming}
                className="flex-1 border border-green-500/50 hover:border-green-400 text-green-400 disabled:opacity-50 font-medium px-4 py-2 rounded-lg text-sm transition-colors"
              >
                Resume
              </button>
            )}
            <button
              onClick={handleCancel}
              disabled={isPending || isConfirming}
              className="flex-1 border border-red-500/50 hover:border-red-400 text-red-400 disabled:opacity-50 font-medium px-4 py-2 rounded-lg text-sm transition-colors"
            >
              Cancel & Refund
            </button>
          </div>

          {/* Tx status */}
          {(isPending || isConfirming) && (
            <div className="mt-3 text-xs text-yellow-400">
              {isPending ? "Confirm in wallet…" : "Waiting for confirmation…"}
            </div>
          )}
          {isSuccess && (
            <div className="mt-3 text-xs text-green-400">Transaction confirmed!</div>
          )}
          {writeError && (
            <div className="mt-3 text-xs text-red-400">{writeError.message.slice(0, 120)}</div>
          )}
        </div>
      )}

      {/* Execution history */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 mb-4">
        <div className="text-xs text-gray-500 mb-3">
          Execution History
          {execEvents && execEvents.length > 0 && (
            <span className="ml-2 bg-green-500/20 text-green-400 px-1.5 py-0.5 rounded font-semibold">
              {execEvents.length} run{execEvents.length !== 1 ? "s" : ""}
            </span>
          )}
        </div>
        {!execEvents || execEvents.length === 0 ? (
          <div className="text-sm text-gray-500">No executions yet.</div>
        ) : (
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {[...execEvents].reverse().map((e, i) => (
              <div key={i} className="text-xs font-mono py-2 border-b border-gray-800 last:border-0">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-500 shrink-0" />
                    <span className="text-gray-300">
                      {e.timestamp > 0n ? new Date(Number(e.timestamp) * 1000).toLocaleString() : `block ${e.blockNumber.toString()}`}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-gray-500">keeper</span>
                    <span className="text-gray-300">{e.keeper.slice(0, 8)}…{e.keeper.slice(-6)}</span>
                    <a
                      href={`https://www.okx.com/web3/explorer/xlayer/tx/${e.txHash}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-green-400 hover:text-green-300 underline"
                    >
                      tx ↗
                    </a>
                  </div>
                </div>
                {e.actionResult && (
                  <div className="mt-1 ml-4 text-yellow-400">
                    → {e.actionResult}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Target Results — read DemoTarget stats if applicable */}
      <DemoTargetStats target={job.target} execCount={execEvents.length} />

      {/* Meta */}
      <div className="text-xs text-gray-400 font-mono space-y-1">
        <div><span className="text-gray-500">owner    </span> {job.owner}</div>
        <div><span className="text-gray-500">last run </span> {job.lastRun === 0n ? "never" : new Date(Number(job.lastRun) * 1000).toLocaleString()}</div>
      </div>
    </div>
  );
}
