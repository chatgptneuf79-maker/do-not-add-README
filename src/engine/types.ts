export type CatalogV1 = {
  version: number;
  worlds: WorldDef[];
  items: ItemDef[];
  activities: ActivityDef[];
};

export type WorldDef = {
  world_id: string;
  name: string;
  boards: BoardDef[];
};

export type BoardDef = {
  board_id: string;
  name: string;
  node_activity_id: string;
  boss_activity_id: string;
};

export type ItemDef = {
  item_id: string;
  type: string;
  text: string;
  tags?: string[];
};

export type ActivityDef = {
  activity_id: string;
  type: "node" | "boss";
  trial_format: TrialFormat;
  prompt: string;
  target_pool: string[];
  distractor_pool: string[];
  trials_per_activity: number;
  choices_count: number;
  skill_tag?: string;
  mastery?: {
    window_trials: number;
    min_accuracy: number;
    max_avg_hint_step: number;
  };
  remediation_map?: Record<string, string>; // error_tag -> activity_id
};

export type TrialFormat =
  | "match_this_choose_from_these"
  | "same_different"
  | "sort_vowel_consonant";

export type TrialSpec = {
  trial_id: string;             // stable per plan
  item_id: string;              // primary item
  format: TrialFormat;
  correct_response_id: string;
  choice_ids_in_order: string[]; // explicit positions (replay must not reroll)
  transfer_tag?: string | null;  // placeholder Sprint 1
  novelty_tag?: string | null;   // placeholder Sprint 1
};

export type TrialPlan = {
  seed: string; // store as string for JSON safety
  trials: TrialSpec[];
};

export type ActivityState = {
  activity_id: string;
  seed: string;
  trial_plan: TrialPlan;
  current_trial_index: number;
  current_hint_step: number; // 0-4
  replay_count: number;
  // Stats for mastery/routing
  responses_total: number;
  responses_correct: number;
  hint_step_sum: number;
  rt_ms_sum: number;
  response_history: Array<{
    trial_id: string;
    item_id: string;
    response_id: string;
    correct: boolean;
    hint_step_used: number;
    rt_ms: number;
  }>;
};

export type SessionState = {
  session_id: string;
  student_initials: string;
  world_id: string;
  started_at_iso: string;
  activity_queue: string[];
  current_activity_index: number;
  activity_states: Record<string, ActivityState>;
};

export type EventType =
  | "session_started"
  | "session_ended"
  | "activity_started"
  | "activity_completed"
  | "trial_presented"
  | "trial_response";

export type LogEvent = {
  event_type: EventType;
  session_id: string;
  ts: string; // ISO
  payload: Record<string, unknown>;
};
