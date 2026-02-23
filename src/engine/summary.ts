import type { LogEvent } from "./types";

export type SessionSummary = {
  student_initials: string;
  session_id: string;
  trials_total: number;
  trials_correct: number;
  accuracy: number; // 0-1
  avg_rt_ms: number;
  hints_used_rate: number; // fraction of trials where hint_step_used > 0
  avg_hint_step: number;
  started_at_iso?: string;
  ended_at_iso?: string;
};

export function computeSessionSummary(events: LogEvent[], session_id: string): SessionSummary | null {
  const sessionEvents = events.filter(e => e.session_id === session_id);
  if (!sessionEvents.length) return null;

  const student_initials = String((sessionEvents[0].payload as any)?.student_initials ?? "");

  let started_at_iso: string | undefined;
  let ended_at_iso: string | undefined;
  for (const e of sessionEvents) {
    if (e.event_type === "session_started") {
      const p = e.payload as any;
      if (p?.started_at) started_at_iso = String(p.started_at);
    }
    if (e.event_type === "session_ended") {
      const p = e.payload as any;
      if (p?.ended_at) ended_at_iso = String(p.ended_at);
    }
  }

  const trials = sessionEvents.filter(e => e.event_type === "trial_response");
  if (!trials.length) {
    return {
      student_initials,
      session_id,
      trials_total: 0,
      trials_correct: 0,
      accuracy: 0,
      avg_rt_ms: 0,
      hints_used_rate: 0,
      avg_hint_step: 0,
      started_at_iso,
      ended_at_iso
    };
  }

  let correct = 0;
  let rtSum = 0;
  let hintUsed = 0;
  let hintStepSum = 0;

  for (const e of trials) {
    const p = e.payload as Record<string, unknown>;
    if (Boolean(p["correctness"])) correct += 1;
    const rt = Number(p["rt_ms"] ?? 0);
    rtSum += isFinite(rt) ? rt : 0;
    const hintStep = Number(p["hint_step_used"] ?? 0);
    hintStepSum += isFinite(hintStep) ? hintStep : 0;
    if (hintStep > 0) hintUsed += 1;
  }

  const total = trials.length;
  return {
    student_initials,
    session_id,
    trials_total: total,
    trials_correct: correct,
    accuracy: total ? correct / total : 0,
    avg_rt_ms: total ? Math.round(rtSum / total) : 0,
    hints_used_rate: total ? hintUsed / total : 0,
    avg_hint_step: total ? Math.round((hintStepSum / total) * 10) / 10 : 0,
    started_at_iso,
    ended_at_iso
  };
}

export const LAST_SUMMARY_KEY = "slp.last_summary.v1";

export function saveLastSummary(summary: SessionSummary): void {
  localStorage.setItem(LAST_SUMMARY_KEY, JSON.stringify(summary));
}

export function loadLastSummary(): SessionSummary | null {
  try {
    const raw = localStorage.getItem(LAST_SUMMARY_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as SessionSummary;
  } catch {
    return null;
  }
}

export function clearLastSummary(): void {
  localStorage.removeItem(LAST_SUMMARY_KEY);
}
