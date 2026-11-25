# Circuit Keeper

**On-chain automation powered by TapeOut circuits on X Layer.**

Circuit Keeper automates DeFi actions using TapeOut's immutable NAND-gate circuits as trigger conditions. When conditions are met, decentralized keepers execute your actions and earn fees.

**Live:** [frontend-ruby-chi-34.vercel.app](https://frontend-ruby-chi-34.vercel.app)

## Problem

DeFi operations on-chain have no "auto" button:
- Lending positions need manual collateral top-ups before liquidation
- Vault yields don't auto-compound — you lose APY every hour you don't harvest
- DAO proposals sit idle after timelock expires until someone calls execute()

These all require someone to send a transaction at the right time. People sleep, forget, miss windows.

## Solution

Circuit Keeper = **Trigger Conditions (TapeOut circuits)** + **Keeper Network (anyone can run)** + **Automated Execution**

```
OKX API → real-time prices
    ↓ PriceRelay pushes to chain
InputResolver → resolves conditions to bits
    ↓ bit-packed input bytes
TapeOut eval(circuitId, bits) → TRUE / FALSE
    ↓ if output pin = 1
Keeper → executeJob() → target.call()
    ↓ fee split: 80% keeper, 20% protocol
```

## Key Features

- **TapeOut Integration** — Trigger rules are real NAND-gate circuits (XBOT Processor, Circuit ID 1). Immutable, on-chain verifiable, never changeable.
- **Real-time Price Feeds** — OKB/ETH/BTC prices from OKX API via PriceRelay contract.
- **Browser Keeper** — Run a keeper directly in your browser. Connect wallet, click Start, earn fees.
- **7 Input Types** — Price above/below, token balance, time-based, static calls, circuit output (composable).
- **Template System** — Pre-built job templates: Profit Taker, Stop-Loss, Yield Harvester, Rebalancer.

## Architecture

```
┌─────────────────────────────────────────────────┐
│                   Frontend                       │
│  Create Job │ Job Detail │ Explore │ Keeper      │
└──────────────────────┬──────────────────────────┘
                       │
┌──────────────────────┴──────────────────────────┐
│                 JobRegistry                      │
│  registerJob │ checkUpkeep │ executeJob          │
│                                                  │
│  ┌──────────────┐    ┌────────────────────┐     │
│  │ InputResolver │───→│ TapeOut Processor  │     │
│  │ (7 adapters)  │    │ eval(circuitId,    │     │
│  └──────────────┘    │      inputBits)    │     │
│                      └────────────────────┘     │
└──────────────────────┬──────────────────────────┘
                       │
┌──────────────────────┴──────────────────────────┐
│              Keeper Bot / Browser                 │
│  Scan jobs → checkUpkeep → executeJob            │
│  Earn 80% of feePerRun per execution             │
└─────────────────────────────────────────────────┘
```

## Contracts (X Layer Mainnet, Chain ID 196)

| Contract | Address |
|---|---|
| JobRegistry | `0x891166Ac81f4b9cD646e9Cd645c1D6eA5d78E853` |
| PriceRelay | `0xe60A1b35Adacc16B00eF16d5542cE86E21F22d55` |
| MockProcessor | `0x8fa4617dc8De6378160a99C0C623387C08ff499F` |
| DemoTarget | `0x69145de0433562ec04C5a824a7B1f166cfB71661` |
| TapeOut XBOT Processor | `0xa5fc69Ca2D3d462CCa204D894D85ac8071c4F0f0` |
| TapeOut Factory | `0x1f09DAeFA827f02CBb40967cc91b259763760761` |

## TapeOut Usage

Circuit Keeper uses TapeOut's on-chain circuits as the trigger verification layer:

- **Processor:** XBOT (`0xa5fc69Ca...`) — a community-deployed TapeOut processor on X Layer mainnet
- **Circuit ID 1:** NAND-2 gate (nIn=2, nOut=1, gateCount=3)
- **Logic:** `NAND(A, A) = NOT(A)` — used as NOT gate to invert price conditions
  - Profit Taker: `NOT(PRICE_BELOW $80) = triggers when price > $80`
  - Stop-Loss: `NOT(PRICE_ABOVE $75) = triggers when price < $75`
- **eval()** is a view function — free to call, verifiable by anyone

## Revenue Model

| Recipient | Share | Description |
|---|---|---|
| Keeper | 80% | Paid per execution from job budget |
| Protocol | 20% | Accumulated in JobRegistry, withdrawable by owner |

## Quick Start

### Smart Contracts

```bash
# Install Foundry
curl -L https://foundry.paradigm.xyz | bash && foundryup

# Build & test
forge build
forge test  # 35/35 passing
```

### Frontend

```bash
cd frontend
npm install
npm run dev -- --port 7001
# Open http://localhost:7001
```

### Keeper Bot (CLI)

```bash
cd keeper
npm install
cp .env.example .env
# Edit .env with your private key and registry address
node keeper.js
```

### Price Relayer

```bash
cd keeper
PRICE_RELAY_ADDRESS=0xe60A1b35Adacc16B00eF16d5542cE86E21F22d55 \
RPC_URL=https://rpc.xlayer.tech \
node relayer.js
```

## Tech Stack

- **Contracts:** Solidity 0.8.20, Foundry, via_ir optimization
- **Frontend:** Next.js 16, wagmi v3, viem, RainbowKit, Tailwind CSS
- **Keeper:** Node.js, ethers.js v6
- **Chain:** X Layer Mainnet (Chain ID 196)
- **Oracle:** OKX API → PriceRelay contract

## License

MIT

---

Built for the **X Layer TapeOut Accelerate Hackathon 2026**.
