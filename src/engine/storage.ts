import type { LogEvent, SessionState } from "./types";

export const SNAPSHOT_KEY = "slp.snapshot.v1";
export const LOGS_KEY = "slp.logs.v1";

export function loadSnapshot(): SessionState | null {
  try {
    const raw = localStorage.getItem(SNAPSHOT_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as SessionState;
  } catch {
    return null;
  }
}

export function saveSnapshot(s: SessionState): void {
  localStorage.setItem(SNAPSHOT_KEY, JSON.stringify(s));
}

export function clearSnapshot(): void {
  localStorage.removeItem(SNAPSHOT_KEY);
}

export function loadLogs(): LogEvent[] {
  try {
    const raw = localStorage.getItem(LOGS_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as LogEvent[];
  } catch {
    return [];
  }
}

export function saveLogs(logs: LogEvent[]): void {
  localStorage.setItem(LOGS_KEY, JSON.stringify(logs));
}

export function clearLogs(): void {
  localStorage.removeItem(LOGS_KEY);
}
