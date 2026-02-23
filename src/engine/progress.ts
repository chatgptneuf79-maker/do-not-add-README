import type { CatalogV1, LogEvent } from "./types";
import { getActivity, getWorld } from "./catalog";

export type BoardStatus = "not_started" | "in_progress" | "mastered";

export type BoardProgress = {
  world_id: string;
  board_id: string;
  name: string;
  status: BoardStatus;
  boss_activity_id: string;
  node_activity_id: string;
  boss_accuracy?: number;
  boss_avg_hint_step?: number;
  boss_trials_count?: number;
  top_error_tag?: string | null;
  last_practice_iso?: string | null;
};

export type StudentProgress = {
  student_initials: string;
  by_board_id: Record<string, BoardProgress>;
  top_error_tag_recent: string | null;
};

type TrialResp = {
  ts: string;
  activity_id: string;
  correct: boolean;
  hint_step: number;
  rt_ms: number;
  inferred_error_tag: string | null;
};

function isTrialResponse(ev: LogEvent): boolean {
  return ev.event_type === "trial_response";
}

function toTrialResp(ev: LogEvent): TrialResp | null {
  const p = ev.payload as Record<string, unknown>;
  const activity_id = String(p.activity_id ?? "");
  if (!activity_id) return null;
  const correctness = Boolean(p.correctness);
  const hint_step = Number(p.hint_step_used ?? 0);
  const rt_ms = Number(p.rt_ms ?? 0);
  const tag = p.inferred_error_tag === null || p.inferred_error_tag === undefined ? null : String(p.inferred_error_tag);
  return { ts: ev.ts, activity_id, correct: correctness, hint_step, rt_ms, inferred_error_tag: tag };
}

function filterStudent(logs: LogEvent[], student: string): LogEvent[] {
  const u = student.trim().toUpperCase();
  return logs.filter(l => {
    const p = l.payload as Record<string, unknown>;
    return String(p.student_initials ?? "").trim().toUpperCase() === u;
  });
}

export function computeStudentProgress(catalog: CatalogV1, logs: LogEvent[], student: string): StudentProgress {
  const studentLogs = filterStudent(logs, student);
  const trials: TrialResp[] = studentLogs.filter(isTrialResponse).map(toTrialResp).filter(Boolean) as TrialResp[];

  // Recent top error tag (last 30 incorrect)
  const recentIncorrect = trials.filter(t => !t.correct && t.inferred_error_tag).slice(-30);
  const counts: Record<string, number> = {};
  for (const t of recentIncorrect) {
    const tag = t.inferred_error_tag!;
    counts[tag] = (counts[tag] ?? 0) + 1;
  }
  const top_error_tag_recent = Object.entries(counts).sort((a,b) => b[1]-a[1])[0]?.[0] ?? null;

  const by_board_id: Record<string, BoardProgress> = {};

  for (const world of catalog.worlds) {
    for (const board of world.boards) {
      const bossId = board.boss_activity_id;
      const nodeId = board.node_activity_id;

      const bossAct = getActivity(catalog, bossId);
      const bossTrials = trials.filter(t => t.activity_id === bossId);
      const nodeTrials = trials.filter(t => t.activity_id === nodeId);

      const any = bossTrials.length > 0 || nodeTrials.length > 0;
      let status: BoardStatus = any ? "in_progress" : "not_started";

      let boss_accuracy: number | undefined;
      let boss_avg_hint_step: number | undefined;
      let boss_trials_count: number | undefined;
      let last_practice_iso: string | null = null;

      if (bossTrials.length > 0) {
        const window = bossAct?.mastery?.window_trials ?? Math.min(12, bossTrials.length);
        const recent = bossTrials.slice(-window);
        const acc = recent.length ? (recent.filter(x => x.correct).length / recent.length) : 0;
        const avgHint = recent.length ? (recent.reduce((s,x) => s + x.hint_step, 0) / recent.length) : 99;
        boss_accuracy = acc;
        boss_avg_hint_step = avgHint;
        boss_trials_count = recent.length;
        last_practice_iso = recent[recent.length-1].ts;

        if (bossAct?.mastery) {
          const mastered = acc >= bossAct.mastery.min_accuracy && avgHint <= bossAct.mastery.max_avg_hint_step && recent.length >= bossAct.mastery.window_trials;
          if (mastered) status = "mastered";
        }
      } else if (nodeTrials.length > 0) {
        last_practice_iso = nodeTrials[nodeTrials.length-1].ts;
      }

      // Board-specific top error tag (based on boss incorrect within last 20)
      const boardIncorrect = bossTrials.filter(t => !t.correct && t.inferred_error_tag).slice(-20);
      const bcounts: Record<string, number> = {};
      for (const t of boardIncorrect) {
        const tag = t.inferred_error_tag!;
        bcounts[tag] = (bcounts[tag] ?? 0) + 1;
      }
      const top_error_tag = Object.entries(bcounts).sort((a,b) => b[1]-a[1])[0]?.[0] ?? null;

      by_board_id[board.board_id] = {
        world_id: world.world_id,
        board_id: board.board_id,
        name: board.name,
        status,
        boss_activity_id: bossId,
        node_activity_id: nodeId,
        boss_accuracy,
        boss_avg_hint_step,
        boss_trials_count,
        top_error_tag,
        last_practice_iso
      };
    }
  }

  return { student_initials: student.trim().toUpperCase(), by_board_id, top_error_tag_recent };
}

export function getRecommendedBoardId(catalog: CatalogV1, progress: StudentProgress, worldId: string): string | null {
  const world = getWorld(catalog, worldId);
  if (!world) return null;
  for (const b of world.boards) {
    const p = progress.by_board_id[b.board_id];
    if (!p) continue;
    if (p.status !== "mastered") return b.board_id;
  }
  return world.boards[0]?.board_id ?? null;
}

export function getRemediationActivityIdForBoardBoss(catalog: CatalogV1, bossActivityId: string, errorTag: string | null): string | null {
  if (!errorTag) return null;
  const act = getActivity(catalog, bossActivityId);
  const map = act?.remediation_map;
  if (!map) return null;
  return map[errorTag] ?? map["confusable_bd"] ?? null;
}
