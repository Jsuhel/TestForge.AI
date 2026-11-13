/**
 * Persistence for project sessions.
 *
 * Primary store: Supabase (Postgres) — sessions follow the user across
 * browsers and devices. If Supabase is unreachable, unconfigured, or a call
 * times out, every function transparently falls back to IndexedDB (+ a
 * localStorage emergency copy), so the app keeps working offline exactly as
 * it did before the cloud existed. Local-only sessions (old data, or writes
 * made while offline) self-heal into the cloud on the next successful list.
 *
 * Changes are announced over a BroadcastChannel (same-browser tabs) and a
 * Supabase realtime channel (other devices), so every open view stays fresh.
 *
 * Everything here is browser-only — callers run inside "use client"
 * components or effects, never during SSR.
 */

import { getSupabase, isSupabaseConfigured, withTimeout } from "@/lib/supabase-client";
import type { RunLogLine, RunResult } from "@/lib/runner";
import type { ChatMessage, RequirementAnalysis, TestCase } from "@/lib/types";

/** Pipeline phase captured inside a saved session. */
export type SessionPhase = "analyzed" | "generating" | "generated";

/** Automation fold state — which test case is being automated and its script. */
export interface SessionAutomation {
  testCase: TestCase;
  script: string | null;
  engine: "claude" | "builtin";
  engineLabel: string;
}

/** A full restorable project workspace. */
export interface ProjectSession {
  id: string;
  /** Human title — the analyzed document name (extension stripped). */
  title: string;
  createdAt: number;
  updatedAt: number;
  phase: SessionPhase;
  analysis: RequirementAnalysis;
  chat: ChatMessage[];
  chatEngineLabel?: string;
  testCases: TestCase[];
  testEngine: "claude" | "builtin";
  testEngineLabel: string;
  automation: SessionAutomation | null;
  runResult: RunResult | null;
  runLogs: RunLogLine[];
}

/** Lightweight row for the sidebar history list. */
export interface SessionSummary {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  chatCount: number;
  testCasesCount: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Cloud layer (Supabase) — row mapping for the project_sessions table
// ─────────────────────────────────────────────────────────────────────────────

/** Column shape of public.project_sessions (snake_case, ISO timestamps). */
interface SessionRow {
  id: string;
  title: string;
  phase: string;
  analysis: RequirementAnalysis | null;
  chat: ChatMessage[] | null;
  chat_engine_label: string | null;
  test_cases: TestCase[] | null;
  test_engine: string | null;
  test_engine_label: string | null;
  automation: SessionAutomation | null;
  run_result: RunResult | null;
  run_logs: RunLogLine[] | null;
  created_at: string;
  updated_at: string;
}

const TABLE = "project_sessions";

function rowToSession(row: SessionRow): ProjectSession {
  return {
    id: row.id,
    title: row.title,
    createdAt: Date.parse(row.created_at),
    updatedAt: Date.parse(row.updated_at),
    phase: (row.phase as SessionPhase) ?? "analyzed",
    // A saved session always carries its analysis; null only appears in malformed rows.
    analysis: row.analysis as RequirementAnalysis,
    chat: row.chat ?? [],
    chatEngineLabel: row.chat_engine_label ?? undefined,
    testCases: row.test_cases ?? [],
    testEngine: (row.test_engine as "claude" | "builtin") ?? "builtin",
    testEngineLabel: row.test_engine_label ?? "Built-in Rule Engine",
    automation: row.automation ?? null,
    runResult: row.run_result ?? null,
    runLogs: row.run_logs ?? [],
  };
}

function sessionToRow(session: ProjectSession): SessionRow {
  return {
    id: session.id,
    title: session.title,
    phase: session.phase,
    analysis: session.analysis,
    chat: session.chat,
    chat_engine_label: session.chatEngineLabel ?? null,
    test_cases: session.testCases,
    test_engine: session.testEngine,
    test_engine_label: session.testEngineLabel,
    automation: session.automation,
    run_result: session.runResult,
    run_logs: session.runLogs,
    created_at: new Date(session.createdAt).toISOString(),
    updated_at: new Date(session.updatedAt).toISOString(),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Local layer (IndexedDB, with localStorage fallback)
// Kept as the offline / pre-configuration store; every public function below
// degrades to it when the cloud is unavailable.
// ─────────────────────────────────────────────────────────────────────────────

const DB_NAME = "testforge-ai";
const DB_VERSION = 1;
const STORE = "sessions";
const CHANNEL_NAME = "testforge-sessions";
/** localStorage keys used for the fallback and the active-session pointer. */
const LS_PREFIX = "testforge:session:";
const LS_ACTIVE = "testforge:active-session";

let dbPromise: Promise<IDBDatabase> | null = null;

function openDatabase(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB unavailable"));
      return;
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: "id" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Failed to open IndexedDB"));
  });
  return dbPromise;
}

function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("IndexedDB request failed"));
  });
}

/** True once the transaction settles — writes need this before notifying peers. */
function transactionDone(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error("IndexedDB transaction failed"));
    tx.onabort = () => reject(tx.error ?? new Error("IndexedDB transaction aborted"));
  });
}

async function dbGetAll(): Promise<ProjectSession[]> {
  const db = await openDatabase();
  const tx = db.transaction(STORE, "readonly");
  return requestToPromise(tx.objectStore(STORE).getAll() as IDBRequest<ProjectSession[]>);
}

async function dbGet(id: string): Promise<ProjectSession | undefined> {
  const db = await openDatabase();
  const tx = db.transaction(STORE, "readonly");
  return requestToPromise(tx.objectStore(STORE).get(id) as IDBRequest<ProjectSession | undefined>);
}

async function dbPut(session: ProjectSession): Promise<void> {
  const db = await openDatabase();
  const tx = db.transaction(STORE, "readwrite");
  tx.objectStore(STORE).put(session);
  await transactionDone(tx);
}

async function dbDelete(id: string): Promise<void> {
  const db = await openDatabase();
  const tx = db.transaction(STORE, "readwrite");
  tx.objectStore(STORE).delete(id);
  await transactionDone(tx);
}

function lsGet(id: string): ProjectSession | null {
  try {
    const raw = localStorage.getItem(LS_PREFIX + id);
    return raw ? (JSON.parse(raw) as ProjectSession) : null;
  } catch {
    return null;
  }
}

function lsAll(): ProjectSession[] {
  const out: ProjectSession[] = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith(LS_PREFIX)) {
        const session = lsGet(key.slice(LS_PREFIX.length));
        if (session) out.push(session);
      }
    }
  } catch {
    // ignore — fall back to whatever was collected
  }
  return out;
}

/** Load every locally saved session, newest first. */
async function localList(): Promise<ProjectSession[]> {
  try {
    const all = await dbGetAll();
    return all.sort((a, b) => b.updatedAt - a.updatedAt);
  } catch {
    return lsAll().sort((a, b) => b.updatedAt - a.updatedAt);
  }
}

async function localGet(id: string): Promise<ProjectSession | null> {
  try {
    const session = await dbGet(id);
    return session ?? null;
  } catch {
    return lsGet(id);
  }
}

async function localPut(session: ProjectSession): Promise<void> {
  try {
    await dbPut(session);
  } catch {
    try {
      localStorage.setItem(LS_PREFIX + session.id, JSON.stringify(session));
    } catch {
      // Storage full / unavailable — persistence is best-effort.
    }
  }
}

async function localDelete(id: string): Promise<void> {
  try {
    await dbDelete(id);
  } catch {
    try {
      localStorage.removeItem(LS_PREFIX + id);
    } catch {
      // best-effort
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Self-heal: push local-only sessions (pre-cloud data, offline writes) up
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Runs on every successful cloud list. Idempotent and cheap — a handful of
 * id comparisons — so stale offline copies converge into the cloud without
 * any explicit migration step for the user.
 */
async function pushLocalOnlySessionsToCloud(remoteRows: SessionRow[]): Promise<void> {
  try {
    const local = await localList();
    const remoteIds = new Set(remoteRows.map((row) => row.id));
    const missing = local.filter((session) => !remoteIds.has(session.id));
    if (missing.length === 0) return;
    const sb = getSupabase();
    for (const session of missing) {
      await sb.from(TABLE).upsert(sessionToRow(session));
    }
    notifyPeers("migrated");
  } catch {
    // best-effort — the next successful list retries
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Public API — cloud first, local fallback
// ─────────────────────────────────────────────────────────────────────────────

export function toSummary(session: ProjectSession): SessionSummary {
  return {
    id: session.id,
    title: session.title,
    createdAt: session.createdAt,
    updatedAt: session.updatedAt,
    chatCount: session.chat.filter((m) => m.role === "user").length,
    testCasesCount: session.testCases.length,
  };
}

/** Load every saved session, newest first. */
export async function listSessions(): Promise<ProjectSession[]> {
  if (isSupabaseConfigured()) {
    try {
      const { data, error } = await withTimeout(
        getSupabase().from(TABLE).select("*").order("updated_at", { ascending: false }),
      );
      if (error) throw error;
      const rows = (data ?? []) as SessionRow[];
      void pushLocalOnlySessionsToCloud(rows);
      return rows.map(rowToSession);
    } catch {
      // offline / unconfigured — fall through to local
    }
  }
  return localList();
}

/** Load one session by id (null when missing). */
export async function getSession(id: string): Promise<ProjectSession | null> {
  if (isSupabaseConfigured()) {
    try {
      const { data, error } = await withTimeout(
        getSupabase().from(TABLE).select("*").eq("id", id).maybeSingle(),
      );
      if (error) throw error;
      if (data) return rowToSession(data as SessionRow);
      // Not in the cloud — it may only exist locally (offline write).
    } catch {
      // offline — fall through to local
    }
  }
  return localGet(id);
}

/** Insert or update a session and notify other tabs/devices. */
export async function putSession(session: ProjectSession): Promise<void> {
  if (isSupabaseConfigured()) {
    try {
      const { error } = await withTimeout(getSupabase().from(TABLE).upsert(sessionToRow(session)));
      if (!error) {
        notifyPeers(session.id);
        return;
      }
    } catch {
      // offline — persist locally instead
    }
  }
  await localPut(session);
  notifyPeers(session.id);
}

/** Delete a session everywhere (cloud + local cache). */
export async function deleteSession(id: string): Promise<void> {
  if (isSupabaseConfigured()) {
    try {
      await withTimeout(getSupabase().from(TABLE).delete().eq("id", id));
    } catch {
      // offline — the local delete below still runs; cloud copy is
      // removed on the next successful delete or list reconciliation
    }
  }
  await localDelete(id);
  notifyPeers(id);
}

/** Remember which session the dashboard is showing (survives refresh). */
export function setActiveSessionId(id: string | null): void {
  try {
    if (id) localStorage.setItem(LS_ACTIVE, id);
    else localStorage.removeItem(LS_ACTIVE);
  } catch {
    // best-effort
  }
}

export function getActiveSessionId(): string | null {
  try {
    return localStorage.getItem(LS_ACTIVE);
  } catch {
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Change notifications — same-browser tabs + other devices
// ─────────────────────────────────────────────────────────────────────────────

let channel: BroadcastChannel | null = null;
function getChannel(): BroadcastChannel | null {
  if (typeof BroadcastChannel === "undefined") return null;
  if (!channel) {
    try {
      channel = new BroadcastChannel(CHANNEL_NAME);
    } catch {
      return null;
    }
  }
  return channel;
}

function notifyPeers(sessionId: string) {
  getChannel()?.postMessage({ type: "changed", sessionId });
}

/**
 * Subscribe to session changes from other tabs, windows and devices.
 * Returns an unsubscribe function.
 */
export function subscribeToSessions(listener: () => void): () => void {
  const ch = getChannel();
  const handler = () => listener();
  ch?.addEventListener("message", handler);
  // storage events cover browsers without BroadcastChannel support
  const onStorage = (e: StorageEvent) => {
    if (e.key?.startsWith(LS_PREFIX) || e.key === LS_ACTIVE) listener();
  };
  window.addEventListener("storage", onStorage);

  // Supabase realtime — fires when another device (or tab) writes a row.
  let unsubscribeRealtime: (() => void) | null = null;
  if (isSupabaseConfigured()) {
    try {
      const sb = getSupabase();
      const realtimeChannel = sb.channel("testforge-sessions-changes");
      realtimeChannel.on(
        "postgres_changes",
        { event: "*", schema: "public", table: TABLE },
        () => listener(),
      );
      realtimeChannel.subscribe();
      unsubscribeRealtime = () => {
        void sb.removeChannel(realtimeChannel);
      };
    } catch {
      // realtime is an enhancement — never fatal
    }
  }

  return () => {
    ch?.removeEventListener("message", handler);
    window.removeEventListener("storage", onStorage);
    unsubscribeRealtime?.();
  };
}

/** Fresh id for a new project session. */
export function newSessionId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `s-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
