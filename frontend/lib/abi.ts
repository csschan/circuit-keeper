export const JOB_REGISTRY_ABI = [
  // ─── Views ─────────────────────────────────────────────────────────────────
  {
    name: "nextJobId",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }],
  },
  {
    name: "checkUpkeep",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "jobId", type: "uint256" }],
    outputs: [{ name: "upkeepNeeded", type: "bool" }],
  },
  {
    name: "getJob",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "jobId", type: "uint256" }],
    outputs: [
      {
        type: "tuple",
        components: [
          { name: "owner",      type: "address" },
          { name: "processor",  type: "address" },
          { name: "circuitId",  type: "uint256" },
          { name: "nIn",        type: "uint8"   },
          { name: "outputPin",  type: "uint8"   },
          { name: "target",     type: "address" },
          { name: "callData",   type: "bytes"   },
          { name: "gasLimit",   type: "uint256" },
          { name: "budget",     type: "uint256" },
          { name: "feePerRun",  type: "uint256" },
          { name: "cooldown",   type: "uint256" },
          { name: "lastRun",    type: "uint256" },
          { name: "active",     type: "bool"    },
        ],
      },
    ],
  },
  {
    name: "getInputSources",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "jobId", type: "uint256" }],
    outputs: [
      {
        type: "tuple[]",
        components: [
          { name: "inputType", type: "uint8"   },
          { name: "target",    type: "address" },
          { name: "threshold", type: "uint256" },
          { name: "data",      type: "bytes"   },
        ],
      },
    ],
  },
  {
    name: "getActiveJobs",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256[]" }],
  },
  {
    name: "accumulatedFees",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }],
  },

  // ─── Writes ─────────────────────────────────────────────────────────────────
  {
    name: "registerJob",
    type: "function",
    stateMutability: "payable",
    inputs: [
      { name: "processor",  type: "address" },
      { name: "circuitId",  type: "uint256" },
      { name: "nIn",        type: "uint8"   },
      { name: "outputPin",  type: "uint8"   },
      {
        name: "inputs",
        type: "tuple[]",
        components: [
          { name: "inputType", type: "uint8"   },
          { name: "target",    type: "address" },
          { name: "threshold", type: "uint256" },
          { name: "data",      type: "bytes"   },
        ],
      },
      { name: "target",     type: "address" },
      { name: "callData",   type: "bytes"   },
      { name: "gasLimit",   type: "uint256" },
      { name: "feePerRun",  type: "uint256" },
      { name: "cooldown",   type: "uint256" },
    ],
    outputs: [{ name: "jobId", type: "uint256" }],
  },
  {
    name: "executeJob",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [{ name: "jobId", type: "uint256" }],
    outputs: [],
  },
  {
    name: "topUpBudget",
    type: "function",
    stateMutability: "payable",
    inputs: [{ name: "jobId", type: "uint256" }],
    outputs: [],
  },
  {
    name: "pauseJob",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [{ name: "jobId", type: "uint256" }],
    outputs: [],
  },
  {
    name: "resumeJob",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [{ name: "jobId", type: "uint256" }],
    outputs: [],
  },
  {
    name: "cancelJob",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [{ name: "jobId", type: "uint256" }],
    outputs: [],
  },
  {
    name: "updateCallData",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "jobId",       type: "uint256" },
      { name: "newCallData", type: "bytes"   },
    ],
    outputs: [],
  },

  // ─── Events ─────────────────────────────────────────────────────────────────
  {
    name: "JobRegistered",
    type: "event",
    inputs: [
      { name: "jobId",     type: "uint256", indexed: true  },
      { name: "owner",     type: "address", indexed: true  },
      { name: "processor", type: "address", indexed: false },
      { name: "circuitId", type: "uint256", indexed: false },
    ],
  },
  {
    name: "JobExecuted",
    type: "event",
    inputs: [
      { name: "jobId",     type: "uint256", indexed: true  },
      { name: "keeper",    type: "address", indexed: true  },
      { name: "timestamp", type: "uint256", indexed: false },
    ],
  },
  {
    name: "JobPaused",
    type: "event",
    inputs: [{ name: "jobId", type: "uint256", indexed: true }],
  },
  {
    name: "JobCancelled",
    type: "event",
    inputs: [
      { name: "jobId",          type: "uint256", indexed: true  },
      { name: "budgetRefunded", type: "uint256", indexed: false },
    ],
  },
] as const;
