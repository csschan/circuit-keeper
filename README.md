# Circuit Keeper

**TapeOut-powered on-chain automation for X Layer**

**Live Demo:** [frontend-ruby-chi-34.vercel.app](https://frontend-ruby-chi-34.vercel.app)  
**GitHub:** [github.com/csschan/circuit-keeper](https://github.com/csschan/circuit-keeper)

---

> *"Open-source chip design is bringing the verifiability of circuit logic to everyone."*  
> — Vitalik Buterin, [A Shallow Dive into Open-Source Chip Design](https://vitalik.eth.limo/general/2026/11/26/a_shallow_dive_into_open-source_chip_design.html) (Nov 26, 2026)
>
> **TapeOut brings this idea on-chain. Circuit Keeper is the first protocol to use TapeOut circuits as automation trigger conditions — achieving truly tamper-proof DeFi automation. Rules carved in circuits, not code.**

---

## What Problem Does Circuit Keeper Solve?

**DeFi users lose money because on-chain operations can't auto-execute.**

In centralized exchanges, you can set stop-loss and take-profit with one click. But on-chain DeFi has no such capability:

| Scenario | What happens without automation |
|---|---|
| **Lending position at risk** | OKB drops 20% overnight, your Aave collateral gets liquidated because no one called `repay()` in time |
| **Vault yield sitting idle** | Yield accumulates but doesn't auto-compound. Every hour without `harvest()`, you lose APY |
| **DAO proposal stuck** | Governance vote passed, timelock expired, but the proposal sits there because no one called `execute()` |
| **TapeOut circuit management** | Transistors need to be assembled into circuits, but no one monitors the right timing to call `tapeout()` |

**The core issue:** Every on-chain action requires someone to manually send a transaction at the right time. People sleep, forget, travel, or simply miss the window. There's no native "if-this-then-that" on the blockchain.

**Existing solutions like Gelato/Chainlink Automation** use off-chain computation or centralized node networks. Their trigger conditions are mutable code that operators can change at any time.

---

## How Circuit Keeper Solves It

Circuit Keeper is a **decentralized automation service** where:

1. **Users define "when to trigger"** using TapeOut's on-chain NAND-gate circuits — the trigger logic is **immutable**, deployed once and can never be changed, not even by the creator
2. **Users define "what to execute"** — any smart contract function call
3. **Keepers monitor and execute** — anyone can run a keeper bot (even in the browser), earn 80% of execution fees
4. **Protocol earns 20%** — sustainable revenue from every execution

### What Makes It Different from Gelato/Chainlink?

| | Gelato / Chainlink Keepers | Circuit Keeper |
|---|---|---|
| **Trigger logic** | Mutable Solidity code or off-chain scripts | TapeOut NAND circuits — **immutable once deployed** |
| **Trust model** | Trust the operator not to change conditions | **Zero trust** — circuit logic is on-chain, verifiable by anyone |
| **Composability** | Conditions are independent | Circuits can nest: one circuit's output feeds another's input |
| **Keeper access** | Requires registration or staking | **Permissionless** — connect wallet and start earning |
| **Ecosystem** | General purpose | Built for **TapeOut + X Layer** ecosystem |

---

## How It Works

```
Step 1: User creates a Job
   "When OKB price > $80, call harvest() on my vault"
   
Step 2: Conditions are resolved on-chain
   OKX API → PriceRelay contract → InputResolver → bit-packed inputs
   
Step 3: TapeOut circuit verifies
   XBOT Processor.eval(circuitId=1, inputBits) → TRUE or FALSE
   The NAND-2 circuit acts as a NOT gate: NOT(price_below_$80) = price_above_$80
   
Step 4: Keeper executes
   Any keeper sees checkUpkeep() = true → calls executeJob()
   → target contract function is called
   → Keeper earns 80% fee, protocol earns 20%
```

---

## Target Users

### DeFi Users (Job Creators)
- Want automated stop-loss, take-profit, yield harvesting, collateral management
- Pay a small fee per execution (e.g., 0.001 OKB) in exchange for 24/7 automation
- **Why they pay:** Automation prevents losses (liquidation) and maximizes gains (compound yield). The fee is negligible compared to the value protected.

### Keepers (Execution Network)
- Anyone with a wallet can run a keeper — in the browser or via CLI
- Earn 80% of feePerRun for every job they execute
- Competitive model: first to submit the transaction gets the fee
- **Why they participate:** Passive income with minimal setup. No staking required.

### TapeOut Ecosystem
- Circuit Keeper brings utility to TapeOut circuits beyond collectibles
- Every job execution is a real use of `eval()` — demonstrating circuits as functional infrastructure
- Templates for auto-tapeout, transistor DCA, circuit monitoring

---

## Revenue Model

| Revenue Stream | Description |
|---|---|
| **Protocol fee (20%)** | Every job execution, 20% of feePerRun goes to protocol. Accumulated on-chain, withdrawable by owner. |
| **Example** | 1000 jobs × 10 executions/day × 0.001 OKB fee = 2 OKB/day protocol revenue (~$160/day at $80/OKB) |
| **Scaling** | More jobs → more keeper incentive → faster execution → more users → flywheel |

---

## TapeOut Integration

Circuit Keeper uses TapeOut as the **trigger verification layer**:

- **Processor:** XBOT (`0xa5fc69Ca2D3d462CCa204D894D85ac8071c4F0f0`) — real community-deployed processor on X Layer mainnet (1 of 444+ processors)
- **Circuit ID 1:** NAND-2 gate (2 inputs, 1 output, 3 gates)
- **Usage:** `NAND(A, A) = NOT(A)` — the most fundamental logic gate used as an inverter
  - **Profit Taker:** `NOT(PRICE_BELOW $80)` = triggers when OKB > $80
  - **Stop-Loss:** `NOT(PRICE_ABOVE $75)` = triggers when OKB < $75
- **Why TapeOut matters:** The trigger condition is a physical-like circuit on-chain. Once taped out, it cannot be modified. Users can trust that their automation rules won't be tampered with — ever.
- **eval()** is a `view` function — free, gas-less, and callable by anyone for verification

---

## Product Features

### For Job Creators
- **Template system** — Pre-built templates: Profit Taker, Stop-Loss, Yield Harvester, Portfolio Rebalancer
- **Custom jobs** — Manual configuration with 7 input types: price above/below, token balance, time-based, static calls, circuit output
- **Job management** — Pause, resume, cancel (refund budget), top-up budget
- **Real-time monitoring** — Live price display, countdown timer, execution history with on-chain results

### For Keepers
- **Browser Keeper** — One-click start, runs in your browser tab, no installation needed
- **CLI Keeper** — `node keeper.js` for 24/7 server deployment
- **Live dashboard** — Scan status per job, execution count, fee earnings

### Infrastructure
- **PriceRelay** — Real-time OKB/ETH/BTC prices from OKX API, pushed on-chain every 30 seconds
- **InputResolver** — 7 adapter types for flexible trigger conditions
- **35/35 tests passing** — Full Foundry test suite

---

## Deployed Contracts (X Layer Mainnet)

| Contract | Address |
|---|---|
| JobRegistry | `0x891166Ac81f4b9cD646e9Cd645c1D6eA5d78E853` |
| PriceRelay | `0xe60A1b35Adacc16B00eF16d5542cE86E21F22d55` |
| MockProcessor | `0x8fa4617dc8De6378160a99C0C623387C08ff499F` |
| DemoTarget | `0x69145de0433562ec04C5a824a7B1f166cfB71661` |
| TapeOut XBOT Processor | `0xa5fc69Ca2D3d462CCa204D894D85ac8071c4F0f0` |
| TapeOut Factory | `0x1f09DAeFA827f02CBb40967cc91b259763760761` |

---

## Quick Start

### Smart Contracts
```bash
curl -L https://foundry.paradigm.xyz | bash && foundryup
forge build
forge test  # 35/35 passing
```

### Frontend
```bash
cd frontend && npm install && npm run dev -- --port 7001
```

### Keeper Bot
```bash
cd keeper && npm install
cp .env.example .env  # Edit with your private key
node keeper.js
```

### Price Relayer
```bash
cd keeper
PRICE_RELAY_ADDRESS=0xe60A1b35Adacc16B00eF16d5542cE86E21F22d55 \
RPC_URL=https://rpc.xlayer.tech node relayer.js
```

---

## Tech Stack

- **Contracts:** Solidity 0.8.20, Foundry, via_ir optimization
- **Frontend:** Next.js 16, wagmi v3, viem, RainbowKit, Tailwind CSS
- **Keeper:** Node.js, ethers.js v6
- **Chain:** X Layer Mainnet (Chain ID 196)
- **Oracle:** OKX API → PriceRelay contract

---

Built for the **X Layer TapeOut Accelerate Hackathon 2026**.
