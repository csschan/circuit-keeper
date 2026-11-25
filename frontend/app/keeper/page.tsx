"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useReadContract, useAccount, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { useRegistryAddress, useActiveJobIds } from "@/lib/hooks";
import { JOB_REGISTRY_ABI } from "@/lib/abi";
import { formatBudget } from "@/lib/types";

type LogEntry = {
  time: string;
  msg: string;
  type: "info" | "success" | "warn" | "error";
};

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
      <div className="text-xs text-gray-500 mb-1">{label}</div>
      <div className="text-xl font-mono font-bold text-green-400">{value}</div>
      {sub && <div className="text-xs text-gray-600 mt-1">{sub}</div>}
    </div>
  );
}

// ─── Browser Keeper Component ────────────────────────────────────────────────

function BrowserKeeper() {
  const registry = useRegistryAddress();
  const { address, isConnected } = useAccount();
  const { data: activeIds } = useActiveJobIds();

  const [running, setRunning] = useState(false);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [scanned, setScanned] = useState(0);
  const [executed, setExecuted] = useState(0);
  const [earned, setEarned] = useState(0);
  const [pendingJobId, setPendingJobId] = useState<number | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const logsEndRef = useRef<HTMLDivElement>(null);

  const { writeContract, data: txHash, isPending, error: writeError, reset: resetTx } = useWriteContract();
  const { isSuccess: txConfirmed } = useWaitForTransactionReceipt({ hash: txHash });

  const addLog = useCallback((msg: string, type: LogEntry["type"] = "info") => {
    const time = new Date().toLocaleTimeString();
    setLogs(prev => [...prev.slice(-50), { time, msg, type }]);
  }, []);

  // Auto-scroll logs
  useEffect(() => {
    // Only scroll within the log container, not the whole page
    const container = logsEndRef.current?.parentElement;
    if (container) {
      container.scrollTop = container.scrollHeight;
    }
  }, [logs]);

  // Handle tx confirmation
  useEffect(() => {
    if (txConfirmed && pendingJobId !== null) {
      addLog(`Job #${pendingJobId} executed successfully! Fee earned.`, "success");
      setExecuted(prev => prev + 1);
      setPendingJobId(null);
      resetTx();
    }
  }, [txConfirmed, pendingJobId, addLog, resetTx]);

  // Handle tx error — reset so next scan can proceed
  useEffect(() => {
    if (writeError && pendingJobId !== null) {
      const msg = writeError.message;
      if (msg.includes("CooldownNotMet")) {
        addLog(`Job #${pendingJobId} — another keeper was faster`, "warn");
      } else if (msg.includes("User rejected") || msg.includes("denied")) {
        addLog(`Job #${pendingJobId} — wallet rejected`, "warn");
      } else {
        addLog(`Job #${pendingJobId} — ${msg.slice(0, 80)}`, "error");
      }
      setPendingJobId(null);
      resetTx();
    }
  }, [writeError, pendingJobId, addLog, resetTx]);

  const scanOnce = useCallback(async () => {
    if (!registry || !activeIds) return;
    // Skip if a tx is in-flight or pending wallet confirmation
    if (isPending || pendingJobId !== null) {
      return;
    }

    const jobIds = (activeIds as bigint[]).map(Number);
    if (jobIds.length === 0) {
      addLog("No active jobs found", "warn");
      return;
    }

    setScanned(prev => prev + 1);

    const RPC = "https://rpc.xlayer.tech";
    const readyJobs: number[] = [];
    const statuses: string[] = [];

    for (const jobId of jobIds) {
      try {
        const selector = "0xf7d334ba"; // checkUpkeep(uint256)
        const data = selector + jobId.toString(16).padStart(64, "0");
        const res = await fetch(RPC, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            jsonrpc: "2.0", id: jobId, method: "eth_call",
            params: [{ to: registry, data }, "latest"],
          }),
        });
        const json = await res.json();
        const isReady = json.result && json.result !== "0x" && json.result.endsWith("1");
        if (isReady) {
          readyJobs.push(jobId);
          statuses.push(`#${jobId} ✓ READY`);
        } else if (json.error) {
          statuses.push(`#${jobId} ✗ condition not met`);
        } else {
          statuses.push(`#${jobId} ✗ cooldown`);
        }
      } catch {
        statuses.push(`#${jobId} ? error`);
      }
    }

    addLog(`Scan: ${statuses.join("  ")}`, readyJobs.length > 0 ? "info" : "info");

    if (readyJobs.length > 0) {
      const jobId = readyJobs[0];
      addLog(`Executing Job #${jobId}...`, "success");
      setPendingJobId(jobId);
      writeContract({
        address: registry,
        abi: JOB_REGISTRY_ABI,
        functionName: "executeJob",
        args: [BigInt(jobId)],
      });
    }
  }, [registry, activeIds, isPending, pendingJobId, addLog, writeContract]);

  function start() {
    setRunning(true);
    addLog("Keeper started! Scanning every 10 seconds...", "success");
    // Use ref-based interval that won't be affected by re-renders
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = setInterval(() => {
      scanOnce();
    }, 10_000);
    // Run first scan immediately
    scanOnce();
  }

  function stop() {
    setRunning(false);
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    addLog("Keeper stopped", "warn");
  }

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  if (!isConnected) {
    return (
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 mb-8">
        <h2 className="font-semibold text-white mb-2">Browser Keeper</h2>
        <p className="text-gray-500 text-sm">Connect your wallet to run a keeper directly in the browser.</p>
      </div>
    );
  }

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 mb-8">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="font-semibold text-white">Browser Keeper</h2>
          <p className="text-gray-500 text-xs mt-0.5">Run a keeper bot right here — earn fees with your connected wallet</p>
        </div>
        {!running ? (
          <button
            onClick={start}
            className="bg-green-500 hover:bg-green-400 text-black font-bold px-6 py-2.5 rounded-xl transition-colors text-sm"
          >
            ▶ Start Keeper
          </button>
        ) : (
          <button
            onClick={stop}
            className="bg-red-500 hover:bg-red-400 text-white font-bold px-6 py-2.5 rounded-xl transition-colors text-sm"
          >
            ■ Stop
          </button>
        )}
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className="bg-gray-800 rounded-lg p-3 text-center">
          <div className="text-xs text-gray-500">Scans</div>
          <div className="text-lg font-mono font-bold text-blue-400">{scanned}</div>
        </div>
        <div className="bg-gray-800 rounded-lg p-3 text-center">
          <div className="text-xs text-gray-500">Executed</div>
          <div className="text-lg font-mono font-bold text-green-400">{executed}</div>
        </div>
        <div className="bg-gray-800 rounded-lg p-3 text-center">
          <div className="text-xs text-gray-500">Status</div>
          <div className={`text-sm font-semibold ${running ? "text-green-400" : "text-gray-500"}`}>
            {running ? (isPending ? "Executing..." : "Running") : "Stopped"}
          </div>
        </div>
      </div>

      {/* Log output */}
      <div className="bg-black rounded-lg p-3 h-48 overflow-y-auto font-mono text-xs space-y-0.5">
        {logs.length === 0 ? (
          <div className="text-gray-600">Press "Start Keeper" to begin scanning for jobs...</div>
        ) : (
          logs.map((log, i) => (
            <div key={i} className={
              log.type === "success" ? "text-green-400" :
              log.type === "warn" ? "text-yellow-400" :
              log.type === "error" ? "text-red-400" :
              "text-gray-400"
            }>
              <span className="text-gray-600">[{log.time}]</span> {log.msg}
            </div>
          ))
        )}
        <div ref={logsEndRef} />
      </div>

      <div className="mt-3 text-xs text-gray-600">
        Keeper wallet: <span className="font-mono text-gray-400">{address}</span>
      </div>
    </div>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function KeeperPage() {
  const registry = useRegistryAddress();
  const { data: activeIds } = useActiveJobIds();
  const { data: accFees } = useReadContract({
    address: registry,
    abi: JOB_REGISTRY_ABI,
    functionName: "accumulatedFees",
  });

  const totalJobs = (activeIds as bigint[] | undefined)?.length ?? 0;
  const protocolFees = accFees as bigint | undefined;

  return (
    <div className="max-w-4xl mx-auto px-4 py-10">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">Keeper Dashboard</h1>
        <p className="text-gray-500 text-sm mt-1">
          Run a keeper bot to earn 80% of execution fees on every job you trigger.
        </p>
      </div>

      {/* Stats */}
      <div className="grid md:grid-cols-3 gap-4 mb-8">
        <StatCard label="Active Jobs" value={totalJobs.toString()} sub="Jobs watching for triggers" />
        <StatCard label="Keeper Reward" value="80%" sub="Of each job's feePerRun" />
        <StatCard label="Protocol Fees" value={protocolFees !== undefined ? formatBudget(protocolFees) : "—"} sub="Accumulated in registry" />
      </div>

      {/* Browser Keeper */}
      <BrowserKeeper />

      {/* How it works */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 mb-8">
        <h2 className="font-semibold text-white mb-4">How keepers earn</h2>
        <div className="grid md:grid-cols-3 gap-4 text-sm">
          <div className="flex gap-3">
            <span className="text-2xl">👁</span>
            <div>
              <div className="text-gray-300 font-medium mb-1">Scan active jobs</div>
              <div className="text-gray-500">Keeper calls <code className="text-green-400 font-mono text-xs">checkUpkeep(jobId)</code> for each active job every few seconds.</div>
            </div>
          </div>
          <div className="flex gap-3">
            <span className="text-2xl">⚡</span>
            <div>
              <div className="text-gray-300 font-medium mb-1">Execute when ready</div>
              <div className="text-gray-500">When condition is met, calls <code className="text-green-400 font-mono text-xs">executeJob(jobId)</code>. Fee paid instantly.</div>
            </div>
          </div>
          <div className="flex gap-3">
            <span className="text-2xl">💰</span>
            <div>
              <div className="text-gray-300 font-medium mb-1">Earn 80% per run</div>
              <div className="text-gray-500">Fee is paid from job budget to your wallet. No claim or staking required.</div>
            </div>
          </div>
        </div>
      </div>

      {/* Fee model */}
      <div className="bg-green-500/5 border border-green-500/20 rounded-xl p-6">
        <h2 className="font-semibold text-white mb-3">Fee Model</h2>
        <div className="grid md:grid-cols-2 gap-4 text-sm">
          <div>
            <div className="text-gray-400 mb-2">On each execution:</div>
            <div className="space-y-1.5">
              <div className="flex justify-between">
                <span className="text-gray-500">Keeper receives</span>
                <span className="text-green-400 font-mono font-semibold">80% of feePerRun</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Protocol receives</span>
                <span className="text-gray-400 font-mono">20% of feePerRun</span>
              </div>
              <div className="flex justify-between border-t border-gray-800 pt-1.5">
                <span className="text-gray-500">Job budget deducted</span>
                <span className="text-gray-400 font-mono">full feePerRun</span>
              </div>
            </div>
          </div>
          <div>
            <div className="text-gray-400 mb-2">Example (feePerRun = 0.001 OKB):</div>
            <div className="space-y-1.5 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Keeper gets</span>
                <span className="text-green-400 font-mono">0.0008 OKB</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Protocol gets</span>
                <span className="text-gray-400 font-mono">0.0002 OKB</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">100 runs yield keeper</span>
                <span className="text-green-400 font-mono">0.08 OKB (~$6.80)</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
