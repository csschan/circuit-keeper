"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { parseEther, encodeAbiParameters, parseAbiParameters, isAddress } from "viem";
import { useRegistryAddress } from "@/lib/hooks";
import { JOB_REGISTRY_ABI } from "@/lib/abi";
import { InputType, INPUT_TYPE_LABELS } from "@/lib/types";

// ─── Types ────────────────────────────────────────────────────────────────────

interface InputSourceForm {
  inputType: InputType;
  target: string;
  threshold: string;
  // helpers per type
  priceUsd: string;        // PRICE_ABOVE/BELOW — human readable price
  intervalSec: string;     // TIMESTAMP_MOD — interval
  windowSec: string;       // TIMESTAMP_MOD — window
  account: string;         // ERC20_BALANCE — account to check
  rawData: string;         // STATIC_CALL / CIRCUIT_OUTPUT — raw hex
}

function defaultInputSource(): InputSourceForm {
  return {
    inputType: InputType.TIMESTAMP_MOD,
    target: "0x0000000000000000000000000000000000000000",
    threshold: "3600",
    priceUsd: "",
    intervalSec: "3600",
    windowSec: "60",
    account: "",
    rawData: "0x",
  };
}

// ─── Encode data for each input type ─────────────────────────────────────────

function encodeInputData(src: InputSourceForm): `0x${string}` {
  try {
    switch (src.inputType) {
      case InputType.PRICE_ABOVE:
        return encodeAbiParameters(parseAbiParameters("bool"), [true]);
      case InputType.PRICE_BELOW:
        return encodeAbiParameters(parseAbiParameters("bool"), [false]);
      case InputType.ERC20_BALANCE_ABOVE:
        return encodeAbiParameters(parseAbiParameters("address,bool"), [
          (src.account || "0x0000000000000000000000000000000000000000") as `0x${string}`,
          true,
        ]);
      case InputType.ERC20_BALANCE_BELOW:
        return encodeAbiParameters(parseAbiParameters("address,bool"), [
          (src.account || "0x0000000000000000000000000000000000000000") as `0x${string}`,
          false,
        ]);
      case InputType.TIMESTAMP_MOD:
        // data = abi.encode(window, true) — second bool = modulo mode flag
        return encodeAbiParameters(parseAbiParameters("uint256,bool"), [
          BigInt(src.windowSec || "60"),
          true,
        ]);
      case InputType.STATIC_CALL:
      case InputType.CIRCUIT_OUTPUT:
      default:
        return (src.rawData || "0x") as `0x${string}`;
    }
  } catch {
    return "0x";
  }
}

function getThreshold(src: InputSourceForm): bigint {
  try {
    switch (src.inputType) {
      case InputType.PRICE_ABOVE:
      case InputType.PRICE_BELOW: {
        // Chainlink price feeds return 8 decimals
        const price = parseFloat(src.priceUsd || "0");
        return BigInt(Math.round(price * 1e8));
      }
      case InputType.TIMESTAMP_MOD:
        return BigInt(src.intervalSec || "3600");
      default:
        return BigInt(src.threshold || "0");
    }
  } catch {
    return 0n;
  }
}

function getTarget(src: InputSourceForm): `0x${string}` {
  if (src.inputType === InputType.TIMESTAMP_MOD) {
    return "0x0000000000000000000000000000000000000000";
  }
  return (isAddress(src.target) ? src.target : "0x0000000000000000000000000000000000000000") as `0x${string}`;
}

// ─── Step components ──────────────────────────────────────────────────────────

function StepIndicator({ current, total }: { current: number; total: number }) {
  return (
    <div className="flex items-center gap-2 mb-8">
      {Array.from({ length: total }, (_, i) => (
        <div key={i} className="flex items-center gap-2">
          <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border ${
            i + 1 < current ? "bg-green-500 border-green-500 text-black" :
            i + 1 === current ? "border-green-500 text-green-400" :
            "border-gray-700 text-gray-600"
          }`}>
            {i + 1 < current ? "✓" : i + 1}
          </div>
          {i < total - 1 && <div className={`h-px w-8 ${i + 1 < current ? "bg-green-500" : "bg-gray-800"}`} />}
        </div>
      ))}
    </div>
  );
}

// ─── Job Templates ────────────────────────────────────────────────────────────

// X Layer Mainnet addresses
const MOCK_PROCESSOR = "0x8fa4617dc8De6378160a99C0C623387C08ff499F";
const DEMO_TARGET = "0x69145de0433562ec04C5a824a7B1f166cfB71661";
const PRICE_RELAY = "0xe60A1b35Adacc16B00eF16d5542cE86E21F22d55";

// TapeOut ecosystem addresses (X Layer mainnet)
const TAPEOUT_FACTORY = "0x1f09DAeFA827f02CBb40967cc91b259763760761";
const XBOT_PROCESSOR = "0xa5fc69Ca2D3d462CCa204D894D85ac8071c4F0f0";
const XBOT_TRANSISTORS = "0x7bE7280e31984d18f62218519985EC5DcCa751De";

interface JobTemplate {
  name: string;
  description: string;
  icon: string;
  processor: string;
  circuitId: string;
  outputPin: string;
  sources: InputSourceForm[];
  target: string;
  callData: string;
  gasLimit: string;
  cooldown: string;
  feePerRun: string;
  budget: string;
}

const JOB_TEMPLATES: JobTemplate[] = [
  {
    name: "Portfolio Rebalancer",
    description: "When OKB price exceeds $80, auto-rebalance portfolio to maintain target allocation",
    icon: "⚖️",
    processor: MOCK_PROCESSOR,
    circuitId: "50",
    outputPin: "0",
    sources: [{
      ...defaultInputSource(),
      inputType: InputType.PRICE_ABOVE,
      target: PRICE_RELAY,
      priceUsd: "80",
    }],
    target: DEMO_TARGET,
    callData: "0x7d7c2a1c", // rebalance()
    gasLimit: "300000",
    cooldown: "120",
    feePerRun: "0.001",
    budget: "0.02",
  },
  {
    name: "Yield Harvester",
    description: "Periodically harvest yield from DeFi vaults every 5 minutes",
    icon: "🌾",
    processor: MOCK_PROCESSOR,
    circuitId: "51",
    outputPin: "0",
    sources: [{
      ...defaultInputSource(),
      inputType: InputType.TIMESTAMP_MOD,
      target: "0x0000000000000000000000000000000000000000",
      intervalSec: "300",
      windowSec: "90",
    }],
    target: DEMO_TARGET,
    callData: "0x4641257d", // harvest()
    gasLimit: "300000",
    cooldown: "300",
    feePerRun: "0.001",
    budget: "0.02",
  },
  {
    name: "Liquidation Guard",
    description: "When OKB price drops below $85, top up collateral to prevent liquidation",
    icon: "🛡️",
    processor: MOCK_PROCESSOR,
    circuitId: "52",
    outputPin: "0",
    sources: [{
      ...defaultInputSource(),
      inputType: InputType.PRICE_BELOW,
      target: PRICE_RELAY,
      priceUsd: "85",
    }],
    target: DEMO_TARGET,
    callData: "0xf9e9e57b", // preventLiquidation()
    gasLimit: "300000",
    cooldown: "180",
    feePerRun: "0.001",
    budget: "0.02",
  },
  {
    name: "Oracle Price Updater",
    description: "Push fresh price data to on-chain oracle every 2 minutes",
    icon: "📡",
    processor: MOCK_PROCESSOR,
    circuitId: "53",
    outputPin: "0",
    sources: [{
      ...defaultInputSource(),
      inputType: InputType.TIMESTAMP_MOD,
      target: "0x0000000000000000000000000000000000000000",
      intervalSec: "120",
      windowSec: "30",
    }],
    target: DEMO_TARGET,
    callData: "0xd6f124f0", // updateOracle()
    gasLimit: "300000",
    cooldown: "120",
    feePerRun: "0.001",
    budget: "0.02",
  },
  // ─── TapeOut Ecosystem Templates ───────────────────────────────────
  {
    name: "Circuit Profit Taker",
    description: "When OKB price rises above target, harvest profits. Uses TapeOut NAND circuit as NOT gate: NOT(price_below) = price_above.",
    icon: "💰",
    processor: XBOT_PROCESSOR,
    circuitId: "1",
    outputPin: "0",
    sources: [
      // NAND(A,A) = NOT(A). Input = PRICE_BELOW → NOT → triggers when price is ABOVE
      {
        ...defaultInputSource(),
        inputType: InputType.PRICE_BELOW,
        target: PRICE_RELAY,
        priceUsd: "85",
      },
      {
        ...defaultInputSource(),
        inputType: InputType.PRICE_BELOW,
        target: PRICE_RELAY,
        priceUsd: "85",
      },
    ],
    target: DEMO_TARGET,
    callData: "0x4641257d", // harvest() — take profit
    gasLimit: "300000",
    cooldown: "180",
    feePerRun: "0.001",
    budget: "0.02",
  },
  {
    name: "Circuit Stop-Loss",
    description: "When OKB drops below stop-loss, execute protection. Uses TapeOut NAND circuit as NOT gate: NOT(price_above) = price_below.",
    icon: "🚨",
    processor: XBOT_PROCESSOR,
    circuitId: "1",
    outputPin: "0",
    sources: [
      // NAND(A,A) = NOT(A). Input = PRICE_ABOVE → NOT → triggers when price is BELOW
      {
        ...defaultInputSource(),
        inputType: InputType.PRICE_ABOVE,
        target: PRICE_RELAY,
        priceUsd: "75",
      },
      {
        ...defaultInputSource(),
        inputType: InputType.PRICE_ABOVE,
        target: PRICE_RELAY,
        priceUsd: "75",
      },
    ],
    target: DEMO_TARGET,
    callData: "0xf9e9e57b", // preventLiquidation()
    gasLimit: "300000",
    cooldown: "120",
    feePerRun: "0.001",
    budget: "0.02",
  },
];

// ─── Template Card ────────────────────────────────────────────────────────────

function TemplateCard({ template: t, onSelect, tapeout }: { template: JobTemplate; onSelect: (t: JobTemplate) => void; tapeout?: boolean }) {
  return (
    <button
      onClick={() => onSelect(t)}
      className={`bg-gray-900 border rounded-xl p-5 text-left transition-colors group ${
        tapeout ? "border-green-500/20 hover:border-green-500/50" : "border-gray-800 hover:border-green-500/50"
      }`}
    >
      <div className="flex items-start gap-4">
        <span className="text-3xl">{t.icon}</span>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-white group-hover:text-green-400 transition-colors">
              {t.name}
            </span>
            {tapeout && (
              <span className="text-[10px] bg-green-500/20 text-green-400 px-1.5 py-0.5 rounded font-semibold">
                TapeOut
              </span>
            )}
          </div>
          <div className="text-sm text-gray-500 mt-1">{t.description}</div>
          <div className="flex gap-3 mt-2 text-xs text-gray-600">
            <span>Cooldown: {parseInt(t.cooldown) >= 60 ? `${parseInt(t.cooldown)/60}m` : `${t.cooldown}s`}</span>
            <span>·</span>
            <span>Fee: {t.feePerRun} OKB/run</span>
            <span>·</span>
            <span>Budget: {t.budget} OKB</span>
          </div>
        </div>
        <span className="text-gray-700 group-hover:text-green-500 text-lg transition-colors">→</span>
      </div>
    </button>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function CreateJobPage() {
  const router = useRouter();
  const { isConnected } = useAccount();
  const registry = useRegistryAddress();

  const [step, setStep] = useState(0); // 0 = template selection

  // Step 1: Circuit
  const [processor, setProcessor] = useState("");
  const [circuitId, setCircuitId] = useState("1");
  const [nIn, setNIn] = useState("1");
  const [outputPin, setOutputPin] = useState("0");

  // Step 2: Input sources
  const [sources, setSources] = useState<InputSourceForm[]>([defaultInputSource()]);

  // Step 3: Target
  const [target, setTarget] = useState("");
  const [callData, setCallData] = useState("0x");
  const [gasLimit, setGasLimit] = useState("200000");
  const [cooldown, setCooldown] = useState("3600");
  const [feePerRun, setFeePerRun] = useState("0.001");

  // Step 4: Budget
  const [budget, setBudget] = useState("0.1");

  const [selectedTemplate, setSelectedTemplate] = useState<JobTemplate | null>(null);

  function applyTemplate(t: JobTemplate) {
    setProcessor(t.processor);
    setCircuitId(t.circuitId);
    setOutputPin(t.outputPin);
    setSources(t.sources);
    setTarget(t.target);
    setCallData(t.callData);
    setGasLimit(t.gasLimit);
    setCooldown(t.cooldown);
    setFeePerRun(t.feePerRun);
    setBudget(t.budget);
    setSelectedTemplate(t);
    setStep(5); // go to template customize step
  }

  const { writeContract, data: txHash, isPending, error: writeError, reset } = useWriteContract();
  const { isLoading: isConfirming, isSuccess, data: receipt } = useWaitForTransactionReceipt({ hash: txHash });

  // Parse new jobId from receipt logs
  const newJobId = (() => {
    if (!receipt) return null;
    try {
      // JobRegistered event topic[1] = jobId
      const log = receipt.logs[0];
      if (log?.topics[1]) return parseInt(log.topics[1], 16);
    } catch {}
    return null;
  })();

  function addSource() {
    setSources((s) => [...s, defaultInputSource()]);
  }

  function removeSource(i: number) {
    setSources((s) => s.filter((_, j) => j !== i));
  }

  function updateSource(i: number, patch: Partial<InputSourceForm>) {
    setSources((s) => s.map((src, j) => (j === i ? { ...src, ...patch } : src)));
  }

  // Auto-sync nIn with actual sources count
  const actualNIn = sources.length;

  function handleSubmit() {
    if (!isAddress(processor) || !isAddress(target)) return;
    if (actualNIn === 0) return;

    const fee = parseFloat(feePerRun);
    const gas = parseInt(gasLimit);
    if (isNaN(fee) || fee < 0.0001) {
      alert("Fee per run must be at least 0.0001 OKB");
      return;
    }
    if (isNaN(gas) || gas < 50000 || gas > 5000000) {
      alert("Gas limit must be between 50,000 and 5,000,000");
      return;
    }

    const encodedSources = sources.map((src) => ({
      inputType: src.inputType,
      target: getTarget(src),
      threshold: getThreshold(src),
      data: encodeInputData(src),
    }));

    writeContract({
      address: registry,
      abi: JOB_REGISTRY_ABI,
      functionName: "registerJob",
      args: [
        processor as `0x${string}`,
        BigInt(circuitId),
        actualNIn,            // always match sources.length
        parseInt(outputPin),
        encodedSources,
        target as `0x${string}`,
        (callData || "0x") as `0x${string}`,
        BigInt(gasLimit),
        parseEther(feePerRun),
        BigInt(cooldown),
      ],
      value: parseEther(budget),
    });
  }

  if (!isConnected) {
    return (
      <div className="max-w-xl mx-auto px-4 py-20 text-center">
        <p className="text-gray-500 mb-4">Connect your wallet to create a job.</p>
      </div>
    );
  }

  if (isSuccess) {
    return (
      <div className="max-w-xl mx-auto px-4 py-20 text-center">
        <div className="text-5xl mb-4">✅</div>
        <h2 className="text-2xl font-bold text-white mb-2">Job Created!</h2>
        {newJobId !== null && (
          <p className="text-gray-400 mb-6">Job #{newJobId} is now live and keepers are watching.</p>
        )}
        <div className="flex gap-3 justify-center">
          {newJobId !== null && (
            <button
              onClick={() => router.push(`/jobs/${newJobId}`)}
              className="bg-green-500 hover:bg-green-400 text-black font-semibold px-6 py-3 rounded-xl transition-colors"
            >
              View Job
            </button>
          )}
          <button
            onClick={() => { reset(); setStep(1); }}
            className="border border-gray-700 hover:border-gray-500 text-gray-300 font-medium px-6 py-3 rounded-xl transition-colors"
          >
            Create Another
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-10">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Create a Job</h1>
        <p className="text-gray-500 text-sm mt-1">Automate any on-chain action with a TapeOut circuit trigger</p>
      </div>

      {step > 0 && <StepIndicator current={step} total={4} />}

      {/* ── Step 0: Template Selection ── */}
      {step === 0 && (
        <div>
          {/* DeFi Automation */}
          <div className="mb-6">
            <h3 className="text-sm font-semibold text-gray-400 mb-3 uppercase tracking-wider">DeFi Automation</h3>
            <div className="grid gap-3">
              {JOB_TEMPLATES.slice(0, 4).map((t, i) => (
                <TemplateCard key={i} template={t} onSelect={applyTemplate} />
              ))}
            </div>
          </div>

          {/* TapeOut Ecosystem */}
          <div className="mb-6">
            <h3 className="text-sm font-semibold text-green-400 mb-3 uppercase tracking-wider">TapeOut Ecosystem</h3>
            <div className="grid gap-3">
              {JOB_TEMPLATES.slice(4).map((t, i) => (
                <TemplateCard key={i + 4} template={t} onSelect={applyTemplate} tapeout />
              ))}
            </div>
          </div>

          <div className="text-center">
            <button
              onClick={() => setStep(1)}
              className="text-sm text-gray-500 hover:text-gray-300 underline transition-colors"
            >
              Or configure manually from scratch →
            </button>
          </div>
        </div>
      )}

      {/* ── Step 1: Circuit ── */}
      {step === 1 && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
          <h2 className="font-semibold text-white mb-1">Circuit (Trigger Condition)</h2>
          <p className="text-sm text-gray-500 mb-4">The TapeOut processor and circuit that evaluates your trigger logic.</p>

          {/* Testnet notice */}
          <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg px-4 py-3 mb-5 text-xs text-yellow-400 space-y-1">
            <div className="font-semibold">X Layer Testnet</div>
            <div>TapeOut Factory is mainnet-only. Use the MockProcessor below, which supports echo mode (input bit → output bit).</div>
            <button
              type="button"
              onClick={() => setProcessor("0xe2215f60f1686E6e7D576dCfa2A5ea22112c8880")}
              className="mt-1 underline hover:text-yellow-300 transition-colors font-mono"
            >
              Fill: 0xe2215f60f1686E6e7D576dCfa2A5ea22112c8880
            </button>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-xs text-gray-500 mb-1.5">Processor Address</label>
              <input
                value={processor}
                onChange={(e) => setProcessor(e.target.value)}
                placeholder="0x…"
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-sm font-mono text-gray-300 focus:outline-none focus:border-green-500 placeholder-gray-600"
              />
              <p className="text-xs text-gray-600 mt-1">
                Mainnet: TapeOut Factory 0x1f09DAeFA… · Testnet: MockProcessor above
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1.5">Circuit ID</label>
                <input
                  type="number"
                  min="0"
                  value={circuitId}
                  onChange={(e) => setCircuitId(e.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-sm font-mono text-gray-300 focus:outline-none focus:border-green-500"
                />
                <p className="text-xs text-gray-600 mt-1">Any unused ID (echo mode)</p>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1.5">Output Pin</label>
                <input
                  type="number"
                  min="0"
                  value={outputPin}
                  onChange={(e) => setOutputPin(e.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-sm font-mono text-gray-300 focus:outline-none focus:border-green-500"
                />
                <p className="text-xs text-gray-600 mt-1">Which bit to check (0=first)</p>
              </div>
            </div>
          </div>

          <div className="mt-6 flex justify-end">
            <button
              onClick={() => setStep(2)}
              disabled={!isAddress(processor)}
              className="bg-green-500 hover:bg-green-400 disabled:opacity-40 text-black font-semibold px-6 py-2.5 rounded-xl transition-colors"
            >
              Next →
            </button>
          </div>
        </div>
      )}

      {/* ── Step 2: Input Sources ── */}
      {step === 2 && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
          <h2 className="font-semibold text-white mb-1">Input Sources</h2>
          <p className="text-sm text-gray-500 mb-6">
            Define what data each circuit input reads. These bits are fed into circuit #{circuitId}.
          </p>

          <div className="space-y-4">
            {sources.map((src, i) => (
              <div key={i} className="bg-gray-800/50 border border-gray-700 rounded-xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs text-gray-500 font-mono">Input #{i}</span>
                  {sources.length > 1 && (
                    <button onClick={() => removeSource(i)} className="text-xs text-red-400 hover:text-red-300">
                      Remove
                    </button>
                  )}
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Type</label>
                    <select
                      value={src.inputType}
                      onChange={(e) => updateSource(i, { inputType: parseInt(e.target.value) as InputType })}
                      className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-300 focus:outline-none focus:border-green-500"
                    >
                      {Object.values(InputType).filter((v) => typeof v === "number").map((v) => (
                        <option key={v} value={v}>{INPUT_TYPE_LABELS[v as InputType]}</option>
                      ))}
                    </select>
                  </div>

                  {/* PRICE_ABOVE / PRICE_BELOW */}
                  {(src.inputType === InputType.PRICE_ABOVE || src.inputType === InputType.PRICE_BELOW) && (
                    <>
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Chainlink Feed Address</label>
                        <input
                          value={src.target}
                          onChange={(e) => updateSource(i, { target: e.target.value })}
                          placeholder="0x… (OKB/USD feed)"
                          className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm font-mono text-gray-300 focus:outline-none focus:border-green-500 placeholder-gray-600"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Price Threshold (USD)</label>
                        <input
                          type="number"
                          value={src.priceUsd}
                          onChange={(e) => updateSource(i, { priceUsd: e.target.value })}
                          placeholder="e.g. 45.00"
                          className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm font-mono text-gray-300 focus:outline-none focus:border-green-500 placeholder-gray-600"
                        />
                        <p className="text-xs text-gray-600 mt-1">Encoded as 8-decimal Chainlink price</p>
                      </div>
                    </>
                  )}

                  {/* ERC20_BALANCE */}
                  {(src.inputType === InputType.ERC20_BALANCE_ABOVE || src.inputType === InputType.ERC20_BALANCE_BELOW) && (
                    <>
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Token Contract</label>
                        <input
                          value={src.target}
                          onChange={(e) => updateSource(i, { target: e.target.value })}
                          placeholder="0x… ERC20 token"
                          className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm font-mono text-gray-300 focus:outline-none focus:border-green-500 placeholder-gray-600"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Account to Check</label>
                        <input
                          value={src.account}
                          onChange={(e) => updateSource(i, { account: e.target.value })}
                          placeholder="0x… wallet"
                          className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm font-mono text-gray-300 focus:outline-none focus:border-green-500 placeholder-gray-600"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Threshold (wei)</label>
                        <input
                          value={src.threshold}
                          onChange={(e) => updateSource(i, { threshold: e.target.value })}
                          placeholder="1000000000000000000"
                          className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm font-mono text-gray-300 focus:outline-none focus:border-green-500 placeholder-gray-600"
                        />
                      </div>
                    </>
                  )}

                  {/* TIMESTAMP_MOD */}
                  {src.inputType === InputType.TIMESTAMP_MOD && (
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Interval (seconds)</label>
                        <input
                          type="number"
                          value={src.intervalSec}
                          onChange={(e) => updateSource(i, { intervalSec: e.target.value })}
                          placeholder="3600"
                          className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm font-mono text-gray-300 focus:outline-none focus:border-green-500"
                        />
                        <p className="text-xs text-gray-600 mt-1">e.g. 3600=1h, 86400=1d</p>
                      </div>
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Window (seconds)</label>
                        <input
                          type="number"
                          value={src.windowSec}
                          onChange={(e) => updateSource(i, { windowSec: e.target.value })}
                          placeholder="60"
                          className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm font-mono text-gray-300 focus:outline-none focus:border-green-500"
                        />
                        <p className="text-xs text-gray-600 mt-1">Trigger window per cycle</p>
                      </div>
                    </div>
                  )}

                  {/* STATIC_CALL / CIRCUIT_OUTPUT */}
                  {(src.inputType === InputType.STATIC_CALL || src.inputType === InputType.CIRCUIT_OUTPUT) && (
                    <>
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">
                          {src.inputType === InputType.CIRCUIT_OUTPUT ? "Sub-circuit Processor" : "Target Contract"}
                        </label>
                        <input
                          value={src.target}
                          onChange={(e) => updateSource(i, { target: e.target.value })}
                          placeholder="0x…"
                          className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm font-mono text-gray-300 focus:outline-none focus:border-green-500 placeholder-gray-600"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">
                          {src.inputType === InputType.CIRCUIT_OUTPUT ? "Sub-circuit ID (threshold)" : "Threshold"}
                        </label>
                        <input
                          value={src.threshold}
                          onChange={(e) => updateSource(i, { threshold: e.target.value })}
                          placeholder="0"
                          className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm font-mono text-gray-300 focus:outline-none focus:border-green-500 placeholder-gray-600"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">
                          {src.inputType === InputType.CIRCUIT_OUTPUT ? "Sub-circuit Input (hex)" : "Call Data (hex)"}
                        </label>
                        <input
                          value={src.rawData}
                          onChange={(e) => updateSource(i, { rawData: e.target.value })}
                          placeholder="0x"
                          className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm font-mono text-gray-300 focus:outline-none focus:border-green-500 placeholder-gray-600"
                        />
                      </div>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>

          <button
            onClick={addSource}
            disabled={sources.length >= 64}
            className="mt-3 w-full border border-dashed border-gray-700 hover:border-gray-500 disabled:opacity-30 text-gray-500 hover:text-gray-400 text-sm py-2.5 rounded-xl transition-colors"
          >
            + Add Input Source ({sources.length} total)
          </button>

          <div className="mt-6 flex justify-between">
            <button onClick={() => setStep(1)} className="text-gray-500 hover:text-gray-300 text-sm transition-colors">← Back</button>
            <button
              onClick={() => setStep(3)}
              className="bg-green-500 hover:bg-green-400 text-black font-semibold px-6 py-2.5 rounded-xl transition-colors"
            >
              Next →
            </button>
          </div>
        </div>
      )}

      {/* ── Step 3: Target Action ── */}
      {step === 3 && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
          <h2 className="font-semibold text-white mb-1">Target Action</h2>
          <p className="text-sm text-gray-500 mb-6">What contract to call when the circuit triggers.</p>

          <div className="space-y-4">
            <div>
              <label className="block text-xs text-gray-500 mb-1.5">Target Contract</label>
              <input
                value={target}
                onChange={(e) => setTarget(e.target.value)}
                placeholder="0x…"
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-sm font-mono text-gray-300 focus:outline-none focus:border-green-500 placeholder-gray-600"
              />
            </div>

            <div>
              <label className="block text-xs text-gray-500 mb-1.5">Call Data (hex)</label>
              <input
                value={callData}
                onChange={(e) => setCallData(e.target.value)}
                placeholder="0x…"
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-sm font-mono text-gray-300 focus:outline-none focus:border-green-500 placeholder-gray-600"
              />
              <p className="text-xs text-gray-600 mt-1">ABI-encoded function call (function selector + args)</p>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1.5">Gas Limit</label>
                <input
                  type="number"
                  value={gasLimit}
                  onChange={(e) => setGasLimit(e.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-sm font-mono text-gray-300 focus:outline-none focus:border-green-500"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1.5">Cooldown (sec)</label>
                <input
                  type="number"
                  value={cooldown}
                  onChange={(e) => setCooldown(e.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-sm font-mono text-gray-300 focus:outline-none focus:border-green-500"
                />
                <p className="text-xs text-gray-600 mt-1">Min. seconds between runs</p>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1.5">Fee/Run (OKB)</label>
                <input
                  type="number"
                  step="0.001"
                  value={feePerRun}
                  onChange={(e) => setFeePerRun(e.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-sm font-mono text-gray-300 focus:outline-none focus:border-green-500"
                />
                <p className="text-xs text-gray-600 mt-1">Paid to keeper per execution</p>
              </div>
            </div>
          </div>

          <div className="mt-6 flex justify-between">
            <button onClick={() => setStep(2)} className="text-gray-500 hover:text-gray-300 text-sm transition-colors">← Back</button>
            <button
              onClick={() => setStep(4)}
              disabled={!isAddress(target)}
              className="bg-green-500 hover:bg-green-400 disabled:opacity-40 text-black font-semibold px-6 py-2.5 rounded-xl transition-colors"
            >
              Next →
            </button>
          </div>
        </div>
      )}

      {/* ── Step 4: Budget & Submit ── */}
      {step === 4 && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
          <h2 className="font-semibold text-white mb-1">Budget</h2>
          <p className="text-sm text-gray-500 mb-6">Deposit OKB to fund executions. You can top up later.</p>

          <div className="space-y-4">
            <div>
              <label className="block text-xs text-gray-500 mb-1.5">Initial Budget (OKB)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={budget}
                onChange={(e) => setBudget(e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-sm font-mono text-gray-300 focus:outline-none focus:border-green-500"
              />
            </div>

            {/* Summary */}
            <div className="bg-gray-800/50 rounded-xl p-4 space-y-2 text-sm">
              <div className="flex justify-between text-gray-400">
                <span>Circuit</span>
                <span className="font-mono">{processor.slice(0, 8)}… / #{circuitId}</span>
              </div>
              <div className="flex justify-between text-gray-400">
                <span>Input sources</span>
                <span>{sources.length}</span>
              </div>
              <div className="flex justify-between text-gray-400">
                <span>Cooldown</span>
                <span>{parseInt(cooldown) >= 3600 ? `${Math.floor(parseInt(cooldown)/3600)}h` : `${cooldown}s`}</span>
              </div>
              <div className="flex justify-between text-gray-400">
                <span>Fee per run</span>
                <span className="font-mono">{feePerRun} OKB</span>
              </div>
              <div className="border-t border-gray-700 pt-2 flex justify-between text-white font-semibold">
                <span>Estimated runs</span>
                <span>~{parseFloat(feePerRun) > 0 ? Math.floor(parseFloat(budget) / parseFloat(feePerRun)) : 0}</span>
              </div>
            </div>
          </div>

          {writeError && (
            <div className="mt-4 bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-xs text-red-400">
              {writeError.message.slice(0, 200)}
            </div>
          )}

          <div className="mt-6 flex justify-between">
            <button onClick={() => setStep(3)} className="text-gray-500 hover:text-gray-300 text-sm transition-colors">← Back</button>
            <button
              onClick={handleSubmit}
              disabled={isPending || isConfirming || !(parseFloat(budget) > 0)}
              className="bg-green-500 hover:bg-green-400 disabled:opacity-50 text-black font-semibold px-8 py-2.5 rounded-xl transition-colors"
            >
              {isPending ? "Confirm in wallet…" : isConfirming ? "Submitting…" : `Create Job (${budget} OKB)`}
            </button>
          </div>
        </div>
      )}

      {/* ── Step 5: Template Customize & Confirm ── */}
      {step === 5 && selectedTemplate && (() => {
        // Template-specific config
        const tplName = selectedTemplate.name;
        const isPriceTrigger = sources[0]?.inputType === InputType.PRICE_ABOVE || sources[0]?.inputType === InputType.PRICE_BELOW;
        const isTimeTrigger = sources[0]?.inputType === InputType.TIMESTAMP_MOD;
        const isTapeOut = selectedTemplate.processor === XBOT_PROCESSOR;

        // Scenario descriptions per template
        const SCENARIOS: Record<string, { scenario: string; triggerLabel: string; actionLabel: string; protocol: string }> = {
          "Portfolio Rebalancer": {
            scenario: "When OKB price exceeds your threshold, the portfolio is overweight. Auto-rebalance sells high-priced assets and buys underweight ones to restore target allocation.",
            triggerLabel: "Rebalance when OKB price exceeds",
            actionLabel: "Execute rebalance() on DeFi Vault",
            protocol: "Target: DeFi Vault (DemoTarget simulates TVL rebalancing with randomized amounts)",
          },
          "Yield Harvester": {
            scenario: "DeFi vaults accumulate yield over time but don't auto-compound. This job periodically calls harvest() to collect yield and reinvest, maximizing APY.",
            triggerLabel: "Harvest yield every",
            actionLabel: "Execute harvest() on Yield Vault",
            protocol: "Target: Yield Vault (DemoTarget simulates yield accumulation per harvest cycle)",
          },
          "Liquidation Guard": {
            scenario: "When OKB drops below your safety threshold, your DeFi lending position is at risk. This job auto-tops-up collateral before liquidation hits.",
            triggerLabel: "Protect when OKB drops below",
            actionLabel: "Execute preventLiquidation() on Lending Protocol",
            protocol: "Target: Lending Protocol (DemoTarget simulates collateral top-up with mock amounts)",
          },
          "Oracle Price Updater": {
            scenario: "On-chain oracles need fresh price data. This job periodically pushes the latest price to keep DeFi protocols updated and prevent stale-price exploits.",
            triggerLabel: "Push new price every",
            actionLabel: "Execute updateOracle() on Price Oracle",
            protocol: "Target: Price Oracle (DemoTarget simulates oracle price updates from OKX feed)",
          },
          "Circuit Profit Taker": {
            scenario: "When OKB price rises above your take-profit level, harvest accumulated DeFi yield to lock in gains. Uses TapeOut NAND circuit as NOT gate for price verification.",
            triggerLabel: "Take profit when OKB rises above",
            actionLabel: "Execute harvest() to lock in profits",
            protocol: "Target: DeFi Vault (DemoTarget simulates profit harvesting with yield amounts)",
          },
          "Circuit Stop-Loss": {
            scenario: "When OKB drops below your stop-loss level, auto-execute protective action to prevent further losses. TapeOut NAND circuit verifies the price condition immutably.",
            triggerLabel: "Stop loss when OKB drops below",
            actionLabel: "Execute preventLiquidation() for position protection",
            protocol: "Target: DeFi Position (DemoTarget simulates collateral protection with mock values)",
          },
        };

        const info = SCENARIOS[tplName] ?? {
          scenario: selectedTemplate.description,
          triggerLabel: "Trigger condition",
          actionLabel: "Target action",
          protocol: "Target: Custom contract",
        };

        return (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
          {/* Header */}
          <div className="flex items-center gap-3 mb-4">
            <span className="text-3xl">{selectedTemplate.icon}</span>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-semibold text-white">{selectedTemplate.name}</h2>
                {isTapeOut && <span className="text-[10px] bg-green-500/20 text-green-400 px-1.5 py-0.5 rounded font-semibold">TapeOut NAND</span>}
              </div>
              <p className="text-sm text-gray-500 mt-0.5">{info.scenario}</p>
            </div>
          </div>

          {/* What this job does - visual flow */}
          <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4 mb-5">
            <div className="text-xs text-white font-semibold mb-3">Execution Flow</div>
            <div className="flex items-center gap-2 text-xs flex-wrap">
              <span className="bg-blue-500/20 text-blue-400 px-2 py-1 rounded">
                {isPriceTrigger ? "OKB Price" : "Timer"}
              </span>
              <span className="text-gray-600">→</span>
              <span className="bg-purple-500/20 text-purple-400 px-2 py-1 rounded">InputResolver</span>
              <span className="text-gray-600">→</span>
              <span className="bg-green-500/20 text-green-400 px-2 py-1 rounded">
                {isTapeOut ? "TapeOut NAND eval()" : "MockProcessor eval()"}
              </span>
              <span className="text-gray-600">→</span>
              <span className="bg-yellow-500/20 text-yellow-400 px-2 py-1 rounded">Keeper executes</span>
              <span className="text-gray-600">→</span>
              <span className="bg-red-500/20 text-red-300 px-2 py-1 rounded">{info.actionLabel.split("Execute ")[1]?.split(" on")[0] ?? "target()"}</span>
            </div>
            <div className="mt-3 text-xs text-gray-500">{info.protocol}</div>
          </div>

          {/* Trigger condition */}
          <div className="mb-5">
            <div className="text-xs text-gray-500 mb-2">{info.triggerLabel}</div>
            {isPriceTrigger && (
              <div className="flex items-center gap-3">
                <span className="text-2xl font-bold text-white">$</span>
                <input
                  type="number"
                  value={sources[0].priceUsd}
                  onChange={(e) => {
                    // Update ALL sources with same price (NAND templates have 2 identical inputs)
                    const newSources = sources.map(s => ({ ...s, priceUsd: e.target.value }));
                    setSources(newSources);
                  }}
                  className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-3 text-lg font-mono text-gray-300 focus:outline-none focus:border-green-500"
                />
                <span className="text-sm text-gray-500">USD</span>
              </div>
            )}
            {isTimeTrigger && (
              <div>
                <div className="flex gap-2">
                  {[60, 120, 300, 600, 1800].map(s => (
                    <button key={s} onClick={() => {
                      const newSources = sources.map(src => ({ ...src, intervalSec: String(s) }));
                      setSources(newSources);
                      setCooldown(String(s));
                    }} className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                      sources[0].intervalSec === String(s)
                        ? "bg-green-500 text-black"
                        : "bg-gray-800 text-gray-400 hover:border-green-500 border border-gray-700"
                    }`}>
                      {s >= 3600 ? `${s / 3600}h` : s >= 60 ? `${s / 60}m` : `${s}s`}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Execution settings */}
          <div className="text-xs text-gray-500 mb-3">Execution Settings</div>
          <div className="space-y-4">

            {/* Cooldown */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-gray-400 mb-1.5">Cooldown (seconds)</label>
                <input
                  type="number"
                  value={cooldown}
                  onChange={(e) => setCooldown(e.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-sm font-mono text-gray-300 focus:outline-none focus:border-green-500"
                />
                <p className="text-xs text-gray-600 mt-1">Min. wait between executions</p>
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1.5">Fee per Run (OKB)</label>
                <input
                  type="number"
                  step="0.001"
                  value={feePerRun}
                  onChange={(e) => setFeePerRun(e.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-sm font-mono text-gray-300 focus:outline-none focus:border-green-500"
                />
                <p className="text-xs text-gray-600 mt-1">Paid to keeper (80%) + protocol (20%)</p>
              </div>
            </div>

            {/* Budget */}
            <div>
              <label className="block text-xs text-gray-400 mb-1.5">Budget (OKB)</label>
              <input
                type="number"
                step="0.01"
                min="0.001"
                value={budget}
                onChange={(e) => {
                  const v = e.target.value;
                  if (v === "" || parseFloat(v) >= 0) setBudget(v);
                }}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-sm font-mono text-gray-300 focus:outline-none focus:border-green-500"
              />
              <p className="text-xs text-gray-600 mt-1">
                ≈ {parseFloat(feePerRun) > 0 ? Math.floor(parseFloat(budget) / parseFloat(feePerRun)) : 0} runs · Top up anytime
              </p>
            </div>
          </div>

          {writeError && (
            <div className="mt-4 bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-xs text-red-400">
              {writeError.message.slice(0, 200)}
            </div>
          )}

          <div className="mt-6 flex justify-between">
            <button onClick={() => setStep(0)} className="text-gray-500 hover:text-gray-300 text-sm transition-colors">← Templates</button>
            <button
              onClick={handleSubmit}
              disabled={isPending || isConfirming || !(parseFloat(budget) > 0)}
              className="bg-green-500 hover:bg-green-400 disabled:opacity-50 text-black font-semibold px-8 py-2.5 rounded-xl transition-colors"
            >
              {isPending ? "Confirm in wallet…" : isConfirming ? "Submitting…" : `Create Job (${budget} OKB)`}
            </button>
          </div>
        </div>
        );
      })()}
    </div>
  );
}
