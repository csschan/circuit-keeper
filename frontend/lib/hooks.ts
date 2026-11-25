"use client";

import { useReadContract, useReadContracts, useChainId } from "wagmi";
import { JOB_REGISTRY_ABI } from "./abi";
import { getContracts } from "./config";
import { type JobWithId, type OnChainJob, estimatedRuns } from "./types";

// ─── Registry address for current chain ──────────────────────────────────────

export function useRegistryAddress() {
  const chainId = useChainId();
  return getContracts(chainId).jobRegistry;
}

// ─── All active job IDs ───────────────────────────────────────────────────────

export function useActiveJobIds() {
  const address = useRegistryAddress();
  return useReadContract({
    address,
    abi: JOB_REGISTRY_ABI,
    functionName: "getActiveJobs",
  });
}

// ─── Single job ───────────────────────────────────────────────────────────────

export function useJob(jobId: number) {
  const address = useRegistryAddress();
  return useReadContract({
    address,
    abi: JOB_REGISTRY_ABI,
    functionName: "getJob",
    args: [BigInt(jobId)],
    query: { refetchInterval: 10_000 },
  });
}

// ─── Single job upkeep status ─────────────────────────────────────────────────

export function useCheckUpkeep(jobId: number) {
  const address = useRegistryAddress();
  return useReadContract({
    address,
    abi: JOB_REGISTRY_ABI,
    functionName: "checkUpkeep",
    args: [BigInt(jobId)],
    query: { refetchInterval: 10_000 }, // Poll every 10s
  });
}

// ─── Multiple jobs with their upkeep status ───────────────────────────────────

export function useJobsWithStatus(jobIds: number[]): JobWithId[] {
  const address = useRegistryAddress();

  const jobContracts = jobIds.map((id) => ({
    address,
    abi: JOB_REGISTRY_ABI,
    functionName: "getJob" as const,
    args: [BigInt(id)] as [bigint],
  }));

  const upkeepContracts = jobIds.map((id) => ({
    address,
    abi: JOB_REGISTRY_ABI,
    functionName: "checkUpkeep" as const,
    args: [BigInt(id)] as [bigint],
  }));

  const { data: jobData }    = useReadContracts({ contracts: jobContracts });
  const { data: upkeepData } = useReadContracts({
    contracts: upkeepContracts,
    query: { refetchInterval: 10_000 },
  });

  if (!jobData) return [];

  return jobIds.flatMap((id, i) => {
    const job   = jobData[i]?.result as OnChainJob | undefined;
    const ready = (upkeepData?.[i]?.result as boolean | undefined) ?? false;
    if (!job) return [];
    return [{
      ...job,
      id,
      ready,
      estimatedRuns: estimatedRuns(job.budget, job.feePerRun),
    }];
  });
}

// ─── Total job count ──────────────────────────────────────────────────────────

export function useNextJobId() {
  const address = useRegistryAddress();
  return useReadContract({
    address,
    abi: JOB_REGISTRY_ABI,
    functionName: "nextJobId",
  });
}
