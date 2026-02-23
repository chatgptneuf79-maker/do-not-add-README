import React, { useEffect, useMemo, useRef, useState } from "react";
import type { ActivityDef, ActivityState, CatalogV1, SessionState, TrialSpec } from "../engine/types";
import TrialView from "./TrialView";

type Props = {
  catalog: CatalogV1;
  session: SessionState;
  activity: ActivityDef;
  activityState: ActivityState;
  onReplay: () => void;
  onHint: () => void;
  onResponse: (choiceId: string, rtMs: number) => void;
  onSkipActivity: () => void;
  onEndSession: () => void;
  emitTrialPresented: (trial: TrialSpec) => void;
};

export default function SessionView(props: Props) {
  const { session, activity, activityState } = props;

  const totalTrials = activityState.trial_plan.trials.length;
  const trialIndex = activityState.current_trial_index;
  const trial = activityState.trial_plan.trials[trialIndex];

  const lastPresentedKeyRef = useRef<string>("");

  useEffect(() => {
    if (!trial) return;
    const key = `${activity.activity_id}|${trial.trial_id}|${trialIndex}`;
    if (lastPresentedKeyRef.current !== key) {
      lastPresentedKeyRef.current = key;
      props.emitTrialPresented(trial);
    }
  }, [activity.activity_id, trial?.trial_id, trialIndex]);

  const progressText = `Activity ${session.current_activity_index + 1}/${session.activity_queue.length} • Trial ${Math.min(trialIndex + 1, totalTrials)}/${totalTrials} • Hint ${activityState.current_hint_step} • Replays ${activityState.replay_count}`;

  return (
    <div>
      <div className="row">
        <div>
          <div className="small">Student: <span className="mono">{session.student_initials}</span> • World: <span className="mono">{session.world_id}</span> • Activity: <span className="mono">{activity.activity_id}</span> • Session: <span className="mono">{session.session_id.slice(0, 8)}</span></div>
          <div style={{ fontWeight: 800 }}>{activity.type.toUpperCase()}: {activity.activity_id}</div>
          <div className="small">{progressText}</div>
        </div>
        <div className="footerRow">
          <button className="btn" onClick={props.onReplay}>Replay</button>
          <button className="btn btnPrimary" onClick={props.onHint}>Hint</button>
          <button className="btn" onClick={props.onSkipActivity}>Skip Activity</button>
          <button className="btn btnDanger" onClick={props.onEndSession}>End Session</button>
        </div>
      </div>

      {trial ? (
        <TrialView
          catalog={props.catalog}
          activity={activity}
          trial={trial}
          hintStep={activityState.current_hint_step}
          replayCount={activityState.replay_count}
          onReplay={props.onReplay}
          onHint={props.onHint}
          onResponse={props.onResponse}
        />
      ) : (
        <p>Activity complete.</p>
      )}
    </div>
  );
}
