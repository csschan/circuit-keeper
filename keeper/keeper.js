#!/usr/bin/env node
"use strict";

require("dotenv").config();
const { ethers }           = require("ethers");
const { JOB_REGISTRY_ABI } = require("./abi");
const log                  = require("./logger");

// ─── Config ──────────────────────────────────────────────────────────────────

const RPC_URL          = process.env.RPC_URL          ?? "https://rpc.xlayer.tech";
const KEEPER_KEY       = process.env.KEEPER_PRIVATE_KEY;
const REGISTRY_ADDRESS = process.env.REGISTRY_ADDRESS;
const MAX_GAS_GWEI     = BigInt(process.env.MAX_GAS_PRICE_GWEI ?? "50") * BigInt(1e9);
const POLL_INTERVAL_MS = parseInt(process.env.POLL_INTERVAL_MS ?? "0");

// ─── Validate ────────────────────────────────────────────────────────────────

if (!KEEPER_KEY)       throw new Error("KEEPER_PRIVATE_KEY not set in .env");
if (!REGISTRY_ADDRESS) throw new Error("REGISTRY_ADDRESS not set in .env");

// ─── Setup ───────────────────────────────────────────────────────────────────

const provider = new ethers.JsonRpcProvider(RPC_URL);
const wallet   = new ethers.Wallet(KEEPER_KEY, provider);
const registry = new ethers.Contract(REGISTRY_ADDRESS, JOB_REGISTRY_ABI, wallet);

// Track in-flight job IDs to avoid double-submitting
const executing = new Set();

// ─── Core: check and execute one job ─────────────────────────────────────────

async function tryExecuteJob(jobId) {
  if (executing.has(jobId)) {
    log.debug(`Job ${jobId} already in-flight, skipping`);
    return;
  }

  try {
    // view call — free, no gas
    const shouldRun = await registry.checkUpkeep(jobId);
    if (!shouldRun) {
      log.debug(`Job ${jobId} condition not met`);
      return;
    }

    log.info(`Job ${jobId} ready — submitting...`);
    executing.add(jobId);

    // Check current gas price against limit
    const feeData = await provider.getFeeData();
    const gasPrice = feeData.gasPrice ?? feeData.maxFeePerGas;
    if (gasPrice && gasPrice > MAX_GAS_GWEI) {
      log.warn(`Job ${jobId} skipped: gas price ${ethers.formatUnits(gasPrice, "gwei")} gwei > max ${process.env.MAX_GAS_PRICE_GWEI} gwei`);
      executing.delete(jobId);
      return;
    }

    const tx = await registry.executeJob(jobId, {
      gasLimit: 500_000n,
    });

    log.info(`Job ${jobId} tx submitted: ${tx.hash}`);

    const receipt = await tx.wait();
    if (receipt.status === 1) {
      log.info(`Job ${jobId} executed ✓  block=${receipt.blockNumber}  gas=${receipt.gasUsed}`);
    } else {
      log.warn(`Job ${jobId} tx mined but reverted  tx=${tx.hash}`);
    }

  } catch (err) {
    // Classify the error
    const msg = err.message ?? String(err);

    if (msg.includes("CooldownNotMet")) {
      log.debug(`Job ${jobId} skipped: cooldown not met (another keeper was faster)`);
    } else if (msg.includes("ConditionNotMet")) {
      log.debug(`Job ${jobId} skipped: condition flipped before our tx landed`);
    } else if (msg.includes("InsufficientBudget")) {
      log.info(`Job ${jobId} paused: budget exhausted`);
    } else if (msg.includes("JobNotActive")) {
      log.info(`Job ${jobId} no longer active`);
    } else {
      log.error(`Job ${jobId} unexpected error:`, msg);
    }
  } finally {
    executing.delete(jobId);
  }
}

// ─── Scan all active jobs ─────────────────────────────────────────────────────

async function scanJobs() {
  let activeJobIds;
  try {
    activeJobIds = await registry.getActiveJobs();
  } catch (err) {
    log.error("Failed to fetch active jobs:", err.message);
    return;
  }

  if (activeJobIds.length === 0) {
    log.debug("No active jobs");
    return;
  }

  log.debug(`Scanning ${activeJobIds.length} active jobs`);

  // Check all jobs in parallel (they're all view calls)
  const checks = activeJobIds.map((jobId) =>
    registry.checkUpkeep(jobId)
      .then((ok) => ({ jobId, ok }))
      .catch(() => ({ jobId, ok: false }))
  );
  const results = await Promise.all(checks);

  // Execute ready jobs sequentially to avoid nonce conflicts
  for (const { jobId, ok } of results) {
    if (ok) {
      await tryExecuteJob(Number(jobId));
    }
  }
}

// ─── Block-driven mode (default) ─────────────────────────────────────────────

async function startBlockDriven() {
  log.info("Starting keeper in block-driven mode");
  log.info(`Registry: ${REGISTRY_ADDRESS}`);
  log.info(`Keeper:   ${wallet.address}`);

  const balance = await provider.getBalance(wallet.address);
  log.info(`Balance:  ${ethers.formatEther(balance)} OKB`);

  if (balance < ethers.parseEther("0.01")) {
    log.warn("Low keeper balance! Top up to avoid missing executions.");
  }

  // Run once immediately on startup
  await scanJobs();

  // Poll every 5 seconds (HTTP RPC doesn't support block subscriptions)
  const SCAN_INTERVAL = 5_000;
  let scanning = false;
  setInterval(async () => {
    if (scanning) return; // skip if previous scan still running
    scanning = true;
    try {
      await scanJobs();
    } finally {
      scanning = false;
    }
  }, SCAN_INTERVAL);

  log.info(`Polling every ${SCAN_INTERVAL / 1000}s for ready jobs...`);
}

// ─── Polling mode (fallback) ──────────────────────────────────────────────────

async function startPolling(intervalMs) {
  log.info(`Starting keeper in polling mode (interval=${intervalMs}ms)`);
  log.info(`Registry: ${REGISTRY_ADDRESS}`);
  log.info(`Keeper:   ${wallet.address}`);

  await scanJobs();
  setInterval(scanJobs, intervalMs);
}

// ─── Graceful shutdown ────────────────────────────────────────────────────────

process.on("SIGINT",  () => { log.info("Shutting down..."); process.exit(0); });
process.on("SIGTERM", () => { log.info("Shutting down..."); process.exit(0); });

process.on("unhandledRejection", (reason) => {
  log.error("Unhandled rejection:", reason);
});

// ─── Entry point ─────────────────────────────────────────────────────────────

(async () => {
  try {
    // Test RPC connection
    const network = await provider.getNetwork();
    log.info(`Connected to chain ID ${network.chainId}`);

    if (POLL_INTERVAL_MS > 0) {
      await startPolling(POLL_INTERVAL_MS);
    } else {
      await startBlockDriven();
    }
  } catch (err) {
    log.error("Fatal startup error:", err);
    process.exit(1);
  }
})();
