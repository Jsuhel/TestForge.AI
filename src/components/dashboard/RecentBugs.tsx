import React from "react";
import {
  Bug,
  AlertCircle,
  ArrowUpRight,
  User,
  CheckCircle2,
  Clock,
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface BugRecord {
  id: string;
  title: string;
  severity: "Critical" | "High" | "Medium" | "Low";
  developer: string;
  devAvatar?: string;
  status: "Open" | "In Progress" | "Resolved";
  createdAt: string;
}

const mockBugs: BugRecord[] = [
  {
    id: "BUG-001",
    title: "Loan submission failed during KYC stage",
    severity: "High",
    developer: "Rahul",
    status: "Open",
    createdAt: "25m ago",
  },
  {
    id: "BUG-002",
    title: "MFA SMS token expiry timeout mismatch",
    severity: "Critical",
    developer: "Elena",
    status: "In Progress",
    createdAt: "1h ago",
  },
  {
    id: "BUG-003",
    title: "Customer address line 2 overflow in PDF export",
    severity: "Medium",
    developer: "David",
    status: "Open",
    createdAt: "3h ago",
  },
  {
    id: "BUG-004",
    title: "Interest rate rounding discrepancy on 30yr tenure",
    severity: "High",
    developer: "Sarah",
    status: "In Progress",
    createdAt: "5h ago",
  },
  {
    id: "BUG-005",
    title: "Session cookies missing SameSite=Strict flag",
    severity: "Low",
    developer: "Rahul",
    status: "Resolved",
    createdAt: "1d ago",
  },
];

export function RecentBugs() {
  const getSeverityBadge = (severity: BugRecord["severity"]) => {
    switch (severity) {
      case "Critical":
        return <Badge variant="destructive" className="text-[10px] font-semibold">Critical</Badge>;
      case "High":
        return <Badge variant="destructive" className="text-[10px] font-semibold bg-rose-500/15 text-rose-400 border-rose-500/30">High</Badge>;
      case "Medium":
        return <Badge variant="warning" className="text-[10px] font-semibold">Medium</Badge>;
      case "Low":
        return <Badge variant="info" className="text-[10px] font-semibold">Low</Badge>;
    }
  };

  const getStatusBadge = (status: BugRecord["status"]) => {
    switch (status) {
      case "Open":
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-400">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
            Open
          </span>
        );
      case "In Progress":
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-blue-400">
            <span className="h-1.5 w-1.5 rounded-full bg-blue-400 animate-pulse" />
            In Progress
          </span>
        );
      case "Resolved":
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-400">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
            Resolved
          </span>
        );
    }
  };

  return (
    <Card className="border-slate-800/80 bg-slate-900/60 shadow-sm flex flex-col h-full">
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <div>
          <div className="flex items-center gap-2">
            <CardTitle className="text-base text-white">Recent Bugs</CardTitle>
            <Badge variant="destructive" className="text-[10px] px-2 py-0">
              7 Active
            </Badge>
          </div>
          <CardDescription className="mt-1">
            Issues identified by automated validation runs
          </CardDescription>
        </div>

        <Button variant="ghost" size="sm" className="text-xs text-blue-400 hover:text-blue-300">
          View All
          <ArrowUpRight className="h-3.5 w-3.5 ml-1" />
        </Button>
      </CardHeader>

      <CardContent className="p-0 flex-1">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-800/80 bg-slate-950/40 text-slate-400">
                <th className="py-2.5 px-4 font-semibold uppercase tracking-wider text-[11px]">
                  Bug ID
                </th>
                <th className="py-2.5 px-4 font-semibold uppercase tracking-wider text-[11px]">
                  Title
                </th>
                <th className="py-2.5 px-3 font-semibold uppercase tracking-wider text-[11px]">
                  Severity
                </th>
                <th className="py-2.5 px-3 font-semibold uppercase tracking-wider text-[11px]">
                  Assignee
                </th>
                <th className="py-2.5 px-4 font-semibold uppercase tracking-wider text-[11px]">
                  Status
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {mockBugs.map((bug) => (
                <tr
                  key={bug.id}
                  className="hover:bg-slate-800/30 transition-colors group"
                >
                  {/* Bug ID */}
                  <td className="py-3 px-4 font-mono font-semibold text-rose-400/90 whitespace-nowrap">
                    {bug.id}
                  </td>

                  {/* Title */}
                  <td className="py-3 px-4 font-medium text-slate-200">
                    <p className="line-clamp-1 group-hover:text-white transition-colors">
                      {bug.title}
                    </p>
                  </td>

                  {/* Severity */}
                  <td className="py-3 px-3 whitespace-nowrap">
                    {getSeverityBadge(bug.severity)}
                  </td>

                  {/* Developer */}
                  <td className="py-3 px-3 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-800 border border-slate-700 text-[10px] font-semibold text-slate-200">
                        {bug.developer.slice(0, 1)}
                      </div>
                      <span className="text-slate-300 text-xs font-medium">
                        {bug.developer}
                      </span>
                    </div>
                  </td>

                  {/* Status */}
                  <td className="py-3 px-4 whitespace-nowrap">
                    {getStatusBadge(bug.status)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
