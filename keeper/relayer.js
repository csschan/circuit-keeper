#!/usr/bin/env node
"use strict";

/**
 * Price Relayer — reads real prices from X Layer mainnet, pushes to testnet PriceRelay contract.
 * Runs alongside keeper.js to provide real-world data for demo jobs.
 */

require("dotenv").config();
const { ethers } = require("ethers");
const log = require("./logger");

// ─── Config ──────────────────────────────────────────────────────────────────

const TESTNET_RPC = process.env.RPC_URL ?? "https://testrpc.xlayer.tech";
const RELAY_KEY = process.env.KEEPER_PRIVATE_KEY;
const PRICE_RELAY_ADDRESS = process.env.PRICE_RELAY_ADDRESS;
const RELAY_INTERVAL = parseInt(process.env.RELAY_INTERVAL_MS ?? "30000"); // 30s default

if (!RELAY_KEY) throw new Error("KEEPER_PRIVATE_KEY not set");
if (!PRICE_RELAY_ADDRESS) throw new Error("PRICE_RELAY_ADDRESS not set");

// ─── OKX API price sources (real market data) ────────────────────────────────

const PRICE_PAIRS = {
  "OKB/USD":  "OKB-USDT",   // OKX spot pair
  "USDC/USD": "USDC-USDT",
  "ETH/USD":  "ETH-USDT",
  "BTC/USD":  "BTC-USDT",
};

const PRICE_RELAY_ABI = [
  "function batchUpdate(string[] calldata pairs, int256[] calldata prices) external",
  "function getPrice(string calldata pair) external view returns (int256 price, uint256 updatedAt)",
  "function totalUpdates() external view returns (uint256)",
];

// ─── Setup ───────────────────────────────────────────────────────────────────

const testnetProvider = new ethers.JsonRpcProvider(TESTNET_RPC);
const wallet = new ethers.Wallet(RELAY_KEY, testnetProvider);
const priceRelay = new ethers.Contract(PRICE_RELAY_ADDRESS, PRICE_RELAY_ABI, wallet);

// ─── Read real market prices from OKX API ────────────────────────────────────

async function readMarketPrices() {
  const results = {};

  for (const [pair, instId] of Object.entries(PRICE_PAIRS)) {
    try {
      const url = `https://www.okx.com/api/v5/market/ticker?instId=${instId}`;
      const res = await fetch(url);
      const json = await res.json();
      const last = parseFloat(json.data?.[0]?.last);

      if (!isNaN(last)) {
        // Convert to 8-decimal Chainlink format
        const price8d = BigInt(Math.round(last * 1e8));
        results[pair] = price8d;
        log.info(`${pair}: $${last.toFixed(4)} (OKX live)`);
      }
    } catch (err) {
      log.error(`Failed to read ${pair}:`, err.message?.slice(0, 80));
    }
  }

  return results;
}

// ─── Push to testnet ─────────────────────────────────────────────────────────

async function relayPrices(prices) {
  const pairs = Object.keys(prices);
  const values = pairs.map((p) => prices[p]);

  if (pairs.length === 0) {
    log.warn("No prices to relay");
    return;
  }

  try {
    const tx = await priceRelay.batchUpdate(pairs, values);
    const receipt = await tx.wait();
    log.info(`Relayed ${pairs.length} prices → tx ${receipt.hash.slice(0, 18)}… gas=${receipt.gasUsed}`);
  } catch (err) {
    log.error("Relay tx failed:", err.message?.slice(0, 100));
  }
}

// ─── Main loop ───────────────────────────────────────────────────────────────

async function run() {
  log.info("=== Price Relayer ===");
  log.info(`Testnet RPC:  ${TESTNET_RPC}`);
  log.info(`PriceRelay:   ${PRICE_RELAY_ADDRESS}`);
  log.info(`Relayer:      ${wallet.address}`);
  log.info(`Interval:     ${RELAY_INTERVAL / 1000}s`);
  log.info(`Feeds:        ${Object.keys(PRICE_PAIRS).join(", ")}`);

  // Initial relay
  const prices = await readMarketPrices();
  await relayPrices(prices);

  // Periodic relay
  setInterval(async () => {
    try {
      const p = await readMarketPrices();
      await relayPrices(p);
    } catch (err) {
      log.error("Relay cycle error:", err.message);
    }
  }, RELAY_INTERVAL);
}

process.on("SIGINT", () => { log.info("Relayer shutting down..."); process.exit(0); });
process.on("SIGTERM", () => { log.info("Relayer shutting down..."); process.exit(0); });

run().catch((err) => {
  log.error("Fatal:", err);
  process.exit(1);
});
