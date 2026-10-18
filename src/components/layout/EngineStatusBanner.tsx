"use client";

import React, { useEffect, useState } from "react";
import { AlertCircle, X } from "lucide-react";

interface EngineStatus {
  aiConfigured?: boolean;
  hint?: string;
}

/**
 * Shows an honest warning when the deployment has no AI credentials —
 * otherwise every pipeline action quietly uses the built-in rule engine and
 * it looks like "the API is not working". Localhost is exempt (dev machines
 * usually keep keys in .env, and the banner would just be noise).
 */
export function EngineStatusBanner() {
  const [status, setStatus] = useState<EngineStatus | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (/^(localhost|127\.0\.0\.1|\[::1\])$/.test(window.location.hostname)) return;

    let cancelled = false;
    fetch("/api/engine-status")
      .then((r) => r.json())
      .then((body: EngineStatus) => {
        if (!cancelled && body && body.aiConfigured === false) setStatus(body);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  if (!status || dismissed) return null;

  return (
    <div className="flex items-start gap-2 border-b border-amber-500/25 bg-amber-500/10 px-4 py-2.5 text-xs text-amber-300 sm:px-6 lg:px-8">
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
      <p className="leading-relaxed">
        <span className="font-semibold">AI engine not configured on this deployment.</span>{" "}
        {status.hint ?? "Add your API keys in the hosting environment and redeploy."}{" "}
        The built-in rule engine is being used meanwhile.
      </p>
      <button
        type="button"
        onClick={() => setDismissed(true)}
        aria-label="Dismiss"
        className="ml-auto shrink-0 rounded p-1 text-amber-400/70 hover:text-amber-300"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
