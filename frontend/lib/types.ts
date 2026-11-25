export enum InputType {
  PRICE_ABOVE         = 0,
  PRICE_BELOW         = 1,
  ERC20_BALANCE_ABOVE = 2,
  ERC20_BALANCE_BELOW = 3,
  TIMESTAMP_MOD       = 4,
  STATIC_CALL         = 5,
  CIRCUIT_OUTPUT      = 6,
}

export const INPUT_TYPE_LABELS: Record<InputType, string> = {
  [InputType.PRICE_ABOVE]:         "Price Above",
  [InputType.PRICE_BELOW]:         "Price Below",
  [InputType.ERC20_BALANCE_ABOVE]: "Token Balance Above",
  [InputType.ERC20_BALANCE_BELOW]: "Token Balance Below",
  [InputType.TIMESTAMP_MOD]:       "Scheduled (Time-based)",
  [InputType.STATIC_CALL]:         "Custom Contract Call",
  [InputType.CIRCUIT_OUTPUT]:      "Sub-circuit Output",
};

export type OnChainJob = {
  owner:      `0x${string}`;
  processor:  `0x${string}`;
  circuitId:  bigint;
  nIn:        number;
  outputPin:  number;
  target:     `0x${string}`;
  callData:   `0x${string}`;
  gasLimit:   bigint;
  budget:     bigint;
  feePerRun:  bigint;
  cooldown:   bigint;
  lastRun:    bigint;
  active:     boolean;
};

export type OnChainInputSource = {
  inputType: number;
  target:    `0x${string}`;
  threshold: bigint;
  data:      `0x${string}`;
};

export type JobWithId = OnChainJob & {
  id:            number;
  ready:         boolean;
  estimatedRuns: number;
};

export function formatCooldown(seconds: bigint): string {
  const s = Number(seconds);
  if (s < 60)   return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
}

export function formatBudget(wei: bigint): string {
  const okb = Number(wei) / 1e18;
  return okb.toFixed(4) + " OKB";
}

export function estimatedRuns(budget: bigint, feePerRun: bigint): number {
  if (feePerRun === 0n) return 0;
  return Number(budget / feePerRun);
}

export function nextRunTime(lastRun: bigint, cooldown: bigint): Date {
  return new Date(Number(lastRun + cooldown) * 1000);
}

export function jobStatus(job: OnChainJob, ready: boolean): {
  label: string;
  color: string;
} {
  if (!job.active && job.budget === 0n)   return { label: "Cancelled",         color: "text-gray-500"   };
  if (!job.active)                        return { label: "Paused",           color: "text-yellow-400" };
  if (job.budget < job.feePerRun)        return { label: "Budget Empty",      color: "text-red-400"    };
  if (ready)                              return { label: "Ready to Trigger",  color: "text-green-400"  };
  return                                         { label: "Active (Cooldown)", color: "text-blue-400"   };
}
