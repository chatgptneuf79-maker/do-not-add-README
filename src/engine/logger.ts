import type { EventType, LogEvent } from "./types";
import { loadLogs, saveLogs } from "./storage";

export class Logger {
  private logs: LogEvent[];

  constructor() {
    this.logs = loadLogs();
  }

  getAll(): LogEvent[] {
    return [...this.logs];
  }

  append(event_type: EventType, session_id: string, payload: Record<string, unknown>): void {
    const ev: LogEvent = {
      event_type,
      session_id,
      ts: new Date().toISOString(),
      payload
    };
    this.logs.push(ev);
    // keep bounded in storage to avoid unlimited growth during demos
    if (this.logs.length > 5000) this.logs = this.logs.slice(-5000);
    saveLogs(this.logs);
  }

  exportJsonl(sessionId?: string): string {
    const list = sessionId ? this.logs.filter(l => l.session_id === sessionId) : this.logs;
    return list.map(l => JSON.stringify(l)).join("\n") + "\n";
  }
}
