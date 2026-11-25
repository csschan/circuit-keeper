"use client";

import { useActiveJobIds, useJobsWithStatus } from "@/lib/hooks";
import { JobCard } from "@/components/JobCard";
import Link from "next/link";

export default function ExplorePage() {
  const { data: activeIds, isLoading } = useActiveJobIds();
  const ids = (activeIds as bigint[] | undefined)?.map(Number) ?? [];
  const jobs = useJobsWithStatus(ids);

  return (
    <div className="max-w-6xl mx-auto px-4 py-10">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white">Explore Jobs</h1>
          <p className="text-gray-500 text-sm mt-1">
            {isLoading ? "Loading…" : `${ids.length} active job${ids.length !== 1 ? "s" : ""} on-chain`}
          </p>
        </div>
        <Link
          href="/jobs/create"
          className="bg-green-500 hover:bg-green-400 text-black font-semibold px-5 py-2.5 rounded-xl transition-colors text-sm"
        >
          + New Job
        </Link>
      </div>

      {isLoading ? (
        <div className="text-center py-20 text-gray-500">Loading jobs…</div>
      ) : ids.length === 0 ? (
        <div className="text-center py-20">
          <p className="text-gray-500 mb-6">No active jobs yet. Be the first!</p>
          <Link
            href="/jobs/create"
            className="bg-green-500 hover:bg-green-400 text-black font-semibold px-6 py-3 rounded-xl transition-colors"
          >
            Create a Job
          </Link>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {jobs.map((job) => (
            <JobCard key={job.id} job={job} />
          ))}
        </div>
      )}
    </div>
  );
}
