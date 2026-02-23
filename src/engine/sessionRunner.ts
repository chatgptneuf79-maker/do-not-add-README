import type { CatalogV1, SessionState, ActivityState } from "./types";
import { getWorld, getActivity } from "./catalog";
import { fnv1a64, u64ToString } from "./hash";
import { generateTrialPlan } from "./trialPlanGenerator";
import { Logger } from "./logger";
import { clearSnapshot, loadSnapshot, saveSnapshot } from "./storage";

export function buildWorldQueue(catalog: CatalogV1, worldId: string): string[] {
  const w = getWorld(catalog, worldId);
  if (!w) return [];
  return w.boards.flatMap(b => [b.node_activity_id, b.boss_activity_id]);
}

export function startNewSession(catalog: CatalogV1, worldId: string, studentInitials: string, logger: Logger): SessionState {
  const sessionId = crypto.randomUUID();
  const started_at_iso = new Date().toISOString();
  const activity_queue = buildWorldQueue(catalog, worldId);

  const s: SessionState = {
    session_id: sessionId,
    student_initials: studentInitials,
    world_id: worldId,
    started_at_iso,
    activity_queue,
    current_activity_index: 0,
    activity_states: {}
  };

  logger.append("session_started", sessionId, { student_initials: studentInitials, world_id: worldId, started_at: started_at_iso });
  saveSnapshot(s);
  return s;
}


export function startNewSessionWithQueue(catalog: CatalogV1, worldId: string, studentInitials: string, activity_queue: string[], logger: Logger): SessionState {
  const sessionId = crypto.randomUUID();
  const started_at_iso = new Date().toISOString();

  const s: SessionState = {
    session_id: sessionId,
    student_initials: studentInitials,
    world_id: worldId,
    started_at_iso,
    activity_queue,
    current_activity_index: 0,
    activity_states: {}
  };

  logger.append("session_started", sessionId, { student_initials: studentInitials, world_id: worldId, started_at: started_at_iso });
  saveSnapshot(s);
  return s;
}

export function resumeSessionIfPresent(catalog: CatalogV1, logger: Logger): SessionState | null {
  const snap = loadSnapshot();
  if (!snap) return null;

  // We log session_started on resume as well, with resumed flag (not required, but useful)
  logger.append("session_started", snap.session_id, { student_initials: snap.student_initials, world_id: snap.world_id, resumed: true, started_at: snap.started_at_iso });
  return snap;
}

export function endSession(session: SessionState, logger: Logger): void {
  logger.append("session_ended", session.session_id, { ended_at: new Date().toISOString() });
  clearSnapshot();
}

export function ensureActivityState(catalog: CatalogV1, session: SessionState, activityId: string): ActivityState {
  const existing = session.activity_states[activityId];
  if (existing) return existing;

  const act = getActivity(catalog, activityId);
  if (!act) {
    // should never happen if catalog is valid
    const stub: ActivityState = {
      activity_id: activityId,
      seed: "0",
      trial_plan: { seed: "0", trials: [] },
      current_trial_index: 0,
      current_hint_step: 0,
      replay_count: 0,
      responses_total: 0,
      responses_correct: 0,
      hint_step_sum: 0,
      rt_ms_sum: 0,
      response_history: []
    };
    session.activity_states[activityId] = stub;
    return stub;
  }

  const seed = u64ToString(fnv1a64(`${session.session_id}|${activityId}`));
  const plan = generateTrialPlan(catalog, act, BigInt(seed));
  const st: ActivityState = {
    activity_id: activityId,
    seed,
    trial_plan: plan,
    current_trial_index: 0,
    current_hint_step: 0,
    replay_count: 0,
    responses_total: 0,
    responses_correct: 0,
    hint_step_sum: 0,
    rt_ms_sum: 0,
    response_history: []
  };
  session.activity_states[activityId] = st;
  return st;
}

export function persist(session: SessionState): void {
  saveSnapshot(session);
}
