"use client";

import Link from "next/link";
import { type JobWithId, formatCooldown, formatBudget, jobStatus, nextRunTime } from "@/lib/types";

interface JobCardProps {
  job: JobWithId;
}

export function JobCard({ job }: JobCardProps) {
  const status = jobStatus(job, job.ready);
  const nextRun = nextRunTime(job.lastRun, job.cooldown);
  const isInPast = nextRun < new Date();

  return (
    <Link href={`/jobs/${job.id}`}>
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 hover:border-gray-600 transition-all group">
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div>
            <span className="text-xs font-mono text-gray-500">Job #{job.id}</span>
            <div className="mt-1 font-mono text-sm text-gray-300 truncate max-w-[200px]">
              {job.processor.slice(0, 6)}…{job.processor.slice(-4)}
              <span className="text-gray-500"> / circuit {job.circuitId.toString()}</span>
            </div>
          </div>
          <span className={`text-xs font-medium px-2 py-1 rounded-full bg-gray-800 ${status.color}`}>
            {status.label}
          </span>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3 text-center">
          <div className="bg-gray-800/50 rounded-lg p-2">
            <div className="text-xs text-gray-500 mb-1">Budget</div>
            <div className="text-sm font-mono text-green-400">{formatBudget(job.budget)}</div>
          </div>
          <div className="bg-gray-800/50 rounded-lg p-2">
            <div className="text-xs text-gray-500 mb-1">Runs left</div>
            <div className="text-sm font-mono text-blue-400">~{job.estimatedRuns}</div>
          </div>
          <div className="bg-gray-800/50 rounded-lg p-2">
            <div className="text-xs text-gray-500 mb-1">Cooldown</div>
            <div className="text-sm font-mono text-purple-400">{formatCooldown(job.cooldown)}</div>
          </div>
        </div>

        {/* Next run */}
        <div className="mt-3 text-xs text-gray-500 flex items-center gap-1">
          {job.ready ? (
            <span className="text-green-400 font-medium">▶ Ready to execute now</span>
          ) : isInPast ? (
            <span className="text-yellow-400">⏳ Waiting for condition...</span>
          ) : (
            <span>⏱ Next run: {nextRun.toLocaleTimeString()}</span>
          )}
        </div>
      </div>
    </Link>
  );
}
