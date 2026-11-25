"use client";

import { useAccount, useReadContract, useReadContracts } from "wagmi";
import Link from "next/link";
import { JobCard } from "@/components/JobCard";
import { useRegistryAddress, useJobsWithStatus } from "@/lib/hooks";
import { JOB_REGISTRY_ABI } from "@/lib/abi";
import { type OnChainJob, estimatedRuns } from "@/lib/types";

function MyJobsList({ address }: { address: `0x${string}` }) {
  const registry = useRegistryAddress();

  const { data: nextId } = useReadContract({
    address: registry,
    abi: JOB_REGISTRY_ABI,
    functionName: "nextJobId",
  });

  const total = nextId ? Number(nextId) : 0;
  const allIds = Array.from({ length: total }, (_, i) => i);

  const jobContracts = allIds.map((id) => ({
    address: registry,
    abi: JOB_REGISTRY_ABI,
    functionName: "getJob" as const,
    args: [BigInt(id)] as [bigint],
  }));

  const { data: jobData, isLoading } = useReadContracts({
    contracts: jobContracts,
    query: { enabled: total > 0 },
  });

  const myIds = allIds.filter((i) => {
    const job = jobData?.[i]?.result as OnChainJob | undefined;
    return job?.owner.toLowerCase() === address.toLowerCase();
  });

  const jobs = useJobsWithStatus(myIds);

  if (total === 0 || isLoading) {
    return (
      <div className="text-center py-20 text-gray-500">
        {isLoading ? "Loading jobs…" : "No jobs found."}
      </div>
    );
  }

  if (myIds.length === 0) {
    return (
      <div className="text-center py-20">
        <p className="text-gray-500 mb-6">You haven&apos;t created any jobs yet.</p>
        <Link
          href="/jobs/create"
          className="bg-green-500 hover:bg-green-400 text-black font-semibold px-6 py-3 rounded-xl transition-colors"
        >
          Create your first Job
        </Link>
      </div>
    );
  }

  return (
    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
      {jobs.map((job) => (
        <JobCard key={job.id} job={job} />
      ))}
    </div>
  );
}

export default function JobsPage() {
  const { address, isConnected } = useAccount();

  return (
    <div className="max-w-6xl mx-auto px-4 py-10">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white">My Jobs</h1>
          <p className="text-gray-500 text-sm mt-1">Jobs owned by your wallet</p>
        </div>
        <Link
          href="/jobs/create"
          className="bg-green-500 hover:bg-green-400 text-black font-semibold px-5 py-2.5 rounded-xl transition-colors text-sm"
        >
          + New Job
        </Link>
      </div>

      {!isConnected ? (
        <div className="text-center py-20 text-gray-500">
          Connect your wallet to see your jobs.
        </div>
      ) : (
        <MyJobsList address={address!} />
      )}
    </div>
  );
}
