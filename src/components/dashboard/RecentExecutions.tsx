import React from "react";
import {
  CheckCircle2,
  XCircle,
  Loader2,
  Clock,
  ArrowUpRight,
  Filter,
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export interface ExecutionRecord {
  id: string;
  scenario: string;
  project: string;
  status: "Passed" | "Failed" | "Running";
  duration: string;
  executedAt: string;
}

const mockExecutions: ExecutionRecord[] = [
  {
    id: "SMK_001",
    scenario: "Loan Application E2E",
    project: "Loan Management",
    status: "Passed",
    duration: "1m 42s",
    executedAt: "3 mins ago",
  },
  {
    id: "SMK_002",
    scenario: "Customer Creation & KYC",
    project: "Customer Management",
    status: "Failed",
    duration: "45s",
    executedAt: "12 mins ago",
  },
  {
    id: "SMK_003",
    scenario: "Login & MFA Verification E2E",
    project: "Authentication",
    status: "Passed",
    duration: "28s",
    executedAt: "25 mins ago",
  },
  {
    id: "REG_014",
    scenario: "Credit Score Calculation Pipeline",
    project: "Risk Assessment",
    status: "Running",
    duration: "2m 10s",
    executedAt: "Just now",
  },
  {
    id: "REG_022",
    scenario: "Disbursement Webhook Trigger",
    project: "Loan Management",
    status: "Passed",
    duration: "52s",
    executedAt: "1 hour ago",
  },
  {
    id: "SEC_005",
    scenario: "Session Invalidation on Password Reset",
    project: "Authentication",
    status: "Passed",
    duration: "34s",
    executedAt: "2 hours ago",
  },
];

export function RecentExecutions() {
  return (
    <Card className="border-slate-800/80 bg-slate-900/60 shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <div>
          <CardTitle className="text-base text-white">Recent Test Executions</CardTitle>
          <CardDescription className="mt-1">
            Real-time pipeline telemetry across automated regression suites
          </CardDescription>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="hidden sm:inline-flex text-xs">
            <Filter className="h-3.5 w-3.5 mr-1" />
            Filter
          </Button>
          <Button variant="ghost" size="sm" className="text-xs text-blue-400 hover:text-blue-300">
            View All
            <ArrowUpRight className="h-3.5 w-3.5 ml-1" />
          </Button>
        </div>
      </CardHeader>

      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-800/80 bg-slate-950/40 text-slate-400">
                <th className="py-3 px-4 sm:px-6 font-semibold uppercase tracking-wider text-[11px]">
                  Test ID
                </th>
                <th className="py-3 px-4 font-semibold uppercase tracking-wider text-[11px]">
                  Test Scenario
                </th>
                <th className="py-3 px-4 font-semibold uppercase tracking-wider text-[11px]">
                  Project
                </th>
                <th className="py-3 px-4 font-semibold uppercase tracking-wider text-[11px]">
                  Status
                </th>
                <th className="py-3 px-4 font-semibold uppercase tracking-wider text-[11px]">
                  Duration
                </th>
                <th className="py-3 px-4 sm:px-6 font-semibold uppercase tracking-wider text-[11px]">
                  Executed At
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {mockExecutions.map((item) => {
                return (
                  <tr
                    key={item.id}
                    className="hover:bg-slate-800/30 transition-colors group"
                  >
                    {/* Test ID */}
                    <td className="py-3.5 px-4 sm:px-6 font-mono text-xs font-semibold text-blue-400">
                      {item.id}
                    </td>

                    {/* Scenario */}
                    <td className="py-3.5 px-4 font-medium text-slate-200">
                      <span className="group-hover:text-white transition-colors">
                        {item.scenario}
                      </span>
                    </td>

                    {/* Project */}
                    <td className="py-3.5 px-4 text-slate-400">
                      <span className="inline-flex items-center rounded-md bg-slate-800/80 px-2 py-0.5 text-[11px] font-medium text-slate-300 border border-slate-700/60">
                        {item.project}
                      </span>
                    </td>

                    {/* Status Badge */}
                    <td className="py-3.5 px-4">
                      {item.status === "Passed" && (
                        <Badge variant="success">
                          <CheckCircle2 className="h-3 w-3" />
                          Passed
                        </Badge>
                      )}
                      {item.status === "Failed" && (
                        <Badge variant="destructive">
                          <XCircle className="h-3 w-3" />
                          Failed
                        </Badge>
                      )}
                      {item.status === "Running" && (
                        <Badge variant="info">
                          <Loader2 className="h-3 w-3 animate-spin" />
                          Running
                        </Badge>
                      )}
                    </td>

                    {/* Duration */}
                    <td className="py-3.5 px-4 font-mono text-slate-400">
                      <div className="flex items-center gap-1.5">
                        <Clock className="h-3 w-3 text-slate-400" />
                        {item.duration}
                      </div>
                    </td>

                    {/* Executed At */}
                    <td className="py-3.5 px-4 sm:px-6 text-slate-400">
                      {item.executedAt}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
