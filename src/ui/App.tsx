import React, { useEffect, useMemo, useState } from "react";
import catalog from "../content/catalog_v1.json";
import type { CatalogV1, SessionState, TrialSpec } from "../engine/types";
import { Logger } from "../engine/logger";
import { endSession, ensureActivityState, persist, resumeSessionIfPresent, startNewSession, startNewSessionWithQueue } from "../engine/sessionRunner";
import { getActivity, getItem } from "../engine/catalog";
import DebugView from "./DebugView";
import SessionView from "./SessionView";
import { loadSelectedStudent, loadStudents, normalizeInitials, saveSelectedStudent, saveStudents } from "../engine/studentStore";
import { clearLogs } from "../engine/storage";
import { TEACHER_PIN } from "../engine/config";
import { loadStudentSettings, saveStudentSettings, type StudentNavSettings } from "../engine/settingsStore";
import { computeStudentProgress, getRecommendedBoardId, getRemediationActivityIdForBoardBoss } from "../engine/progress";
import { clearLastSummary, computeSessionSummary, loadLastSummary, saveLastSummary, type SessionSummary } from "../engine/summary";

const CATALOG = catalog as unknown as CatalogV1;

type Tab = "session" | "debug";

function requirePin(): boolean {
  const entered = window.prompt("Teacher PIN required:");
  if (entered === null) return false;
  if (String(entered).trim() === TEACHER_PIN) return true;
  alert("Incorrect PIN.");
  return false;
}

export default function App() {
  const logger = useMemo(() => new Logger(), []);
  const [tab, setTab] = useState<Tab>("session");
  const [session, setSession] = useState<SessionState | null>(null);

  // Student initials
  const [students, setStudents] = useState<string[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<string>("");
  const [newInitials, setNewInitials] = useState<string>("");

  // World selection
  const [selectedWorld, setSelectedWorld] = useState<string>("W0");

  // End-of-session summary
  const [lastSummary, setLastSummary] = useState<SessionSummary | null>(null);

  // Per-student navigation settings
  const [studentSettings, setStudentSettings] = useState<StudentNavSettings>({ nav_mode: "guided", remedial_rule: "on" });

  useEffect(() => {
    setStudents(loadStudents());
    const sel = loadSelectedStudent();
    if (sel) setSelectedStudent(sel);
    const saved = loadLastSummary();
    if (saved) setLastSummary(saved);
  }, []);

  useEffect(() => {
    if (!selectedStudent) return;
    setStudentSettings(loadStudentSettings(selectedStudent));
  }, [selectedStudent]);


  useEffect(() => {
    const resumed = resumeSessionIfPresent(CATALOG, logger);
    if (resumed) {
      setSession(resumed);
      setSelectedStudent(resumed.student_initials);
      setSelectedWorld(resumed.world_id);
      saveSelectedStudent(resumed.student_initials);
    }
  }, [logger]);

  function addStudent() {
    if (!requirePin()) return;
    const norm = normalizeInitials(newInitials);
    if (!norm) return;
    const next = Array.from(new Set([...students, norm])).sort();
    setStudents(next);
    saveStudents(next);
    setSelectedStudent(norm);
    saveSelectedStudent(norm);
    setNewInitials("");
  }

  function chooseStudent(v: string) {
    const norm = normalizeInitials(v);
    setSelectedStudent(norm);
    if (norm) saveSelectedStudent(norm);
  }


  function startBoardSession(boardId: string | null) {
    const student = selectedStudent.trim().toUpperCase();
    if (!student) {
      alert("Select student initials first.");
      return;
    }
    if (!boardId) {
      alert("No board selected.");
      return;
    }

    clearLastSummary();
    setLastSummary(null);

    const world = CATALOG.worlds.find(w => w.world_id === selectedWorld);
    const board = world?.boards.find(b => b.board_id === boardId);
    if (!board) {
      alert("Board not found in catalog.");
      return;
    }

    const queue: string[] = [board.node_activity_id, board.boss_activity_id];

    // Optional remedial block based on recent errors (requires remediation_map in boss activity)
    if (studentSettings.remedial_rule === "on") {
      const prog = computeStudentProgress(CATALOG, logger.getAll(), student);
      const remedId = getRemediationActivityIdForBoardBoss(CATALOG, board.boss_activity_id, prog.top_error_tag_recent);
      if (remedId && !queue.includes(remedId)) queue.unshift(remedId);
    }

    const s = startNewSessionWithQueue(CATALOG, selectedWorld, student, queue, logger);
    const actId = s.activity_queue[s.current_activity_index];
    const act = getActivity(CATALOG, actId);
    if (act) {
      logger.append("activity_started", s.session_id, { student_initials: student, activity_id: actId, activity_type: act.type });
    }
    setSession({ ...s });
  }

  function handleStart() {
    startBoardSession(recommendedBoardId);
  }


  function handleResume() {
    const s = resumeSessionIfPresent(CATALOG, logger);
    if (s) {
      setSession({ ...s });
      setSelectedStudent(s.student_initials);
      saveSelectedStudent(s.student_initials);
    }
  }

  function finalizeSessionSummary(s: SessionState) {
    const summary = computeSessionSummary(logger.getAll(), s.session_id);
    if (summary) {
      setLastSummary(summary);
      saveLastSummary(summary);
    }
  }

  function handleEnd() {
    if (!session) return;
    logger.append("session_ended", session.session_id, { student_initials: session.student_initials, ended_at: new Date().toISOString() });
    endSession(session, logger);
    finalizeSessionSummary(session);
    setSession(null);
  }


  function openTeacherSettings() {
    const student = selectedStudent.trim().toUpperCase();
    if (!student) {
      alert("Select student initials first.");
      return;
    }
    if (!requirePin()) return;

    const current = loadStudentSettings(student);

    const nav = window.prompt("Navigation mode for " + student + " (guided | locked | free):", current.nav_mode);
    if (nav === null) return;
    const nav_mode = (nav.trim() === "locked" || nav.trim() === "free" || nav.trim() === "guided") ? (nav.trim() as any) : current.nav_mode;

    const remed = window.prompt("Remedial rule (one short remedial block before mainline) (on | off):", current.remedial_rule);
    if (remed === null) return;
    const remedial_rule = (remed.trim() === "on" || remed.trim() === "off") ? (remed.trim() as any) : current.remedial_rule;

    const nextSettings: StudentNavSettings = { nav_mode, remedial_rule };
    saveStudentSettings(student, nextSettings);
    setStudentSettings(nextSettings);
  }
  function handleClearLogs() {
    if (!requirePin()) return;
    clearLogs();
    clearLastSummary();
    window.location.reload();
  }

  const currentActivityId = session ? session.activity_queue[session.current_activity_index] : null;
  const currentActivity = currentActivityId ? getActivity(CATALOG, currentActivityId) : null;
  const activityState = (session && currentActivityId) ? ensureActivityState(CATALOG, session, currentActivityId) : null;

  function advanceActivity() {
    if (!session) return;
    const prevId = session.activity_queue[session.current_activity_index];
    logger.append("activity_completed", session.session_id, { student_initials: session.student_initials, activity_id: prevId });

    // If this was a boss, apply mastery gate + remediation routing (World 1 confusables).
    const prevAct = getActivity(CATALOG, prevId);
    const prevState = session.activity_states[prevId];
    if (prevAct?.type === "boss" && prevAct.mastery && prevState) {
      const window = Math.min(prevState.response_history.length, prevAct.mastery.window_trials);
      const recent = prevState.response_history.slice(-window);
      const acc = window ? (recent.filter(r => r.correct).length / window) : 0;
      const avgHint = window ? (recent.reduce((s, r) => s + r.hint_step_used, 0) / window) : 99;

      if (acc < prevAct.mastery.min_accuracy || avgHint > prevAct.mastery.max_avg_hint_step) {
        // Determine most common expected error tag among incorrect trials
        const counts: Record<string, number> = {};
        for (const r of recent) {
          if (r.correct) continue;
          const tags = getItem(CATALOG, r.item_id)?.tags ?? [];
          const tag = tags[0] ?? "unknown";
          counts[tag] = (counts[tag] ?? 0) + 1;
        }
        const sorted = Object.entries(counts).sort((a,b) => b[1]-a[1]);
        const topTag = (sorted[0]?.[0] ?? "confusable_bd");
        const remedId = prevAct.remediation_map?.[topTag] ?? prevAct.remediation_map?.["confusable_bd"];

        if (remedId) {
          // Insert remediation, then retry the boss (same plan; anti-memorization comes later).
          const insertAt = session.current_activity_index + 1;
          session.activity_queue.splice(insertAt, 0, remedId, prevId);

          // Reset boss state so the retry starts at trial 0.
          delete session.activity_states[prevId];

          logger.append("activity_started", session.session_id, { student_initials: session.student_initials, activity_id: remedId, activity_type: "node", routed_from: prevId, reason: "mastery_gate_fail", top_error_tag: topTag });
          persist(session);
          setSession({ ...session });
          return;
        }
      }
    }

    const nextIndex = session.current_activity_index + 1;
    const next: SessionState = { ...session, current_activity_index: nextIndex };
    if (nextIndex >= next.activity_queue.length) {
      logger.append("session_ended", next.session_id, { student_initials: next.student_initials, ended_at: new Date().toISOString() });
      endSession(next, logger);
      finalizeSessionSummary(next);
      setSession(null);
      return;
    }

    const nextActId = next.activity_queue[nextIndex];
    const act = getActivity(CATALOG, nextActId);
    if (act) logger.append("activity_started", next.session_id, { student_initials: next.student_initials, activity_id: nextActId, activity_type: act.type });

    persist(next);
    setSession({ ...next });
  }

  function onReplay() {
    if (!session || !activityState) return;
    activityState.replay_count += 1;
    persist(session);
    setSession({ ...session });
  }

  function onHint() {
    if (!session || !activityState) return;
    activityState.current_hint_step = Math.min(4, activityState.current_hint_step + 1);
    persist(session);
    setSession({ ...session });
  }

  function onResponse(choiceId: string, rtMs: number) {
    if (!session || !currentActivity || !activityState) return;

    const trial = activityState.trial_plan.trials[activityState.current_trial_index];
    const correct = choiceId === trial.correct_response_id;

    // Tags for error pattern logging (World 1 confusables)
    const expectedTags = getItem(CATALOG, trial.item_id)?.tags ?? [];
    const chosenTags = getItem(CATALOG, choiceId)?.tags ?? [];
    const inferred_error_tag = !correct ? (expectedTags[0] ?? null) : null;

    // Update activity stats/history (for mastery + routing)
    activityState.responses_total += 1;
    if (correct) activityState.responses_correct += 1;
    activityState.hint_step_sum += activityState.current_hint_step;
    activityState.rt_ms_sum += rtMs;

    // Keep history minimal (do NOT add expected_tags here; types don’t include it)
    activityState.response_history.push({
      trial_id: trial.trial_id,
      item_id: trial.item_id,
      response_id: choiceId,
      correct,
      hint_step_used: activityState.current_hint_step,
      rt_ms: rtMs
    });

    // Log response (includes tags)
    logger.append("trial_response", session.session_id, {
      student_initials: session.student_initials,
      activity_id: currentActivity.activity_id,
      trial_id: trial.trial_id,
      item_id: trial.item_id,
      response_id: choiceId,
      correctness: correct,
      hint_step_used: activityState.current_hint_step,
      replay_count: activityState.replay_count,
      rt_ms: rtMs,
      expected_tags: expectedTags,
      chosen_tags: chosenTags,
      inferred_error_tag
    });

    activityState.current_trial_index += 1;
    activityState.current_hint_step = 0;

    if (activityState.current_trial_index >= activityState.trial_plan.trials.length) {
      persist(session);
      setSession({ ...session });
      advanceActivity();
      return;
    }

    persist(session);
    setSession({ ...session });
  }

  function emitTrialPresentedIfNeeded(trial: TrialSpec) {
    if (!session || !currentActivity) return;
    logger.append("trial_presented", session.session_id, {
      student_initials: session.student_initials,
      activity_id: currentActivity.activity_id,
      trial_id: trial.trial_id,
      item_id: trial.item_id,
      trial_format: trial.format,
      choices: trial.choice_ids_in_order
    });
  }

  const student = selectedStudent.trim().toUpperCase();

  const progress = useMemo(() => {
    if (!student) return null;
    return computeStudentProgress(CATALOG, logger.getAll(), student);
  }, [student, logger]);

  const recommendedBoardId = useMemo(() => {
    if (!progress) return null;
    return getRecommendedBoardId(CATALOG, progress, selectedWorld);
  }, [progress, selectedWorld]);


  return (
    <div className="container">
      <div className="header">
        <h1 className="h1">SLP — Boards</h1>
        <div className="badge">catalog v{CATALOG.version}</div>
      </div>

      <div className="tabs" role="tablist" aria-label="Views">
        <button className={`tabBtn ${tab === "session" ? "tabBtnActive" : ""}`} onClick={() => setTab("session")} role="tab" aria-selected={tab === "session"}>
          Session
        </button>
        <button className={`tabBtn ${tab === "debug" ? "tabBtnActive" : ""}`} onClick={() => setTab("debug")} role="tab" aria-selected={tab === "debug"}>
          Debug
        </button>
      </div>

      {tab === "session" && (
        <div className="card">
          {!session && (
            <>
              {lastSummary && (
                <div className="card" style={{ marginBottom: 12, border: "2px solid #00000022" }}>
                  <div style={{ fontWeight: 900, marginBottom: 6 }}>Last Session Summary</div>
                  <div className="small">
                    Student: <span className="mono">{lastSummary.student_initials}</span> • Session: <span className="mono">{lastSummary.session_id.slice(0, 8)}</span>
                  </div>

                  <div className="row" style={{ marginTop: 10, flexWrap: "wrap" }}>
                    <div className="badge">Trials: {lastSummary.trials_total}</div>
                    <div className="badge">Accuracy: {Math.round(lastSummary.accuracy * 100)}%</div>
                    <div className="badge">Avg RT: {lastSummary.avg_rt_ms} ms</div>
                    <div className="badge">Hints used: {Math.round(lastSummary.hints_used_rate * 100)}%</div>
                    <div className="badge">Avg hint step: {lastSummary.avg_hint_step}</div>
                  </div>

                  <div className="row" style={{ marginTop: 12, gap: 8, flexWrap: "wrap" }}>
                    <button className="btn" onClick={() => { clearLastSummary(); setLastSummary(null); }}>Dismiss</button>
                    <button className="btn btnPrimary" onClick={() => setTab("debug")}>Download report</button>
                  </div>

                  <div className="small" style={{ marginTop: 8 }}>
                    Downloading “since last report” is done from Debug (Teacher PIN required).
                  </div>
                </div>
              )}

              <div style={{ fontWeight: 800, marginBottom: 8 }}>Select Student (Initials)</div>

              <div className="row" style={{ alignItems: "flex-end" }}>
                <div style={{ minWidth: 240 }}>
                  <div className="small">Student initials</div>
                  <select
                    className="btn"
                    style={{ width: "100%", textAlign: "left" }}
                    value={selectedStudent}
                    onChange={(e) => chooseStudent(e.target.value)}
                    aria-label="Select student initials"
                  >
                    <option value="">— Select —</option>
                    {students.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>

                <div style={{ minWidth: 240 }}>
                  <div className="small">Add new initials (Teacher PIN)</div>
                  <input
                    className="btn"
                    style={{ width: "100%" }}
                    value={newInitials}
                    onChange={(e) => setNewInitials(e.target.value)}
                    placeholder="e.g., AB"
                    inputMode="text"
                    aria-label="Add new student initials"
                  />
                </div>

                <button className="btn" onClick={addStudent}>Add</button>
              </div>

              <div className="row" style={{ alignItems: "flex-end", marginTop: 12, flexWrap: "wrap" }}>
                <div style={{ minWidth: 320 }}>
                  <div className="small">World</div>
                  <select
                    className="btn"
                    style={{ width: "100%", textAlign: "left" }}
                    value={selectedWorld}
                    onChange={(e) => setSelectedWorld(e.target.value)}
                    aria-label="Select world"
                  >
                    {CATALOG.worlds.map(w => (
                      <option key={w.world_id} value={w.world_id}>{w.name}</option>
                    ))}
                  </select>
                </div>

                <div style={{ minWidth: 320 }}>
                  <div className="small">Navigation</div>
                  <div className="badge">{studentSettings.nav_mode.toUpperCase()}</div>
                  <div className="badge">Remedial: {studentSettings.remedial_rule.toUpperCase()}</div>
                </div>

                <button className="btn" onClick={openTeacherSettings}>Teacher settings (PIN)</button>
              </div>

              <div className="card" style={{ marginTop: 14, border: "2px solid #00000022" }}>
                <div style={{ fontWeight: 900, marginBottom: 6 }}>Recommended next</div>
                <div className="small">
                  {recommendedBoardId ? (
                    <>
                      Board: <span className="mono">{recommendedBoardId}</span>
                      {progress?.by_board_id[recommendedBoardId] && (
                        <> • Status: <span className="mono">{progress.by_board_id[recommendedBoardId].status}</span></>
                      )}
                      {progress?.top_error_tag_recent && (
                        <> • Top gap: <span className="mono">{progress.top_error_tag_recent}</span></>
                      )}
                    </>
                  ) : (
                    <>Select a world to see recommendation.</>
                  )}
                </div>
                <div className="row" style={{ marginTop: 10, gap: 8, flexWrap: "wrap" }}>
                  <button
                    className="btn btnPrimary"
                    onClick={handleStart}
                    disabled={!recommendedBoardId || (studentSettings.nav_mode === "locked" && progress?.by_board_id[recommendedBoardId]?.status === "mastered")}
                  >
                    Start recommended board
                  </button>
                  <button className="btn" onClick={handleResume}>Resume Session</button>
                </div>
                {studentSettings.nav_mode === "locked" && (
                  <div className="small" style={{ marginTop: 8 }}>
                    Locked mode: staff must complete the recommended board next (or switch to Guided/Free with PIN).
                  </div>
                )}
              </div>

              <div style={{ fontWeight: 800, marginTop: 14, marginBottom: 8 }}>Boards in {CATALOG.worlds.find(w => w.world_id === selectedWorld)?.name ?? selectedWorld}</div>

              <div className="card" style={{ border: "2px solid #00000012" }}>
                {CATALOG.worlds.find(w => w.world_id === selectedWorld)?.boards.map(b => {
                  const p = progress?.by_board_id[b.board_id];
                  const status = p?.status ?? "not_started";
                  const lockedBlock = studentSettings.nav_mode === "locked" && recommendedBoardId && b.board_id !== recommendedBoardId;
                  const guidedNote = studentSettings.nav_mode === "guided" && recommendedBoardId && b.board_id !== recommendedBoardId && status !== "mastered";
                  return (
                    <div key={b.board_id} style={{ padding: 10, borderBottom: "1px solid #00000011" }}>
                      <div className="row" style={{ justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
                        <div>
                          <div style={{ fontWeight: 900 }}>{b.name}</div>
                          <div className="small">
                            <span className="badge">{status}</span>
                            {p?.boss_accuracy !== undefined && (
                              <span className="badge">Boss acc: {Math.round((p.boss_accuracy ?? 0) * 100)}%</span>
                            )}
                            {p?.boss_avg_hint_step !== undefined && (
                              <span className="badge">Avg hint: {Math.round(p.boss_avg_hint_step ?? 0)}</span>
                            )}
                            {p?.top_error_tag && (
                              <span className="badge">Gap: {p.top_error_tag}</span>
                            )}
                            {p?.last_practice_iso && (
                              <span className="badge">Last: {p.last_practice_iso.slice(0, 10)}</span>
                            )}
                            {b.board_id === recommendedBoardId && (
                              <span className="badge">Recommended</span>
                            )}
                          </div>
                          {guidedNote && (
                            <div className="small" style={{ marginTop: 4 }}>
                              Not the recommended next board — gaps may remain.
                            </div>
                          )}
                        </div>

                        <div className="row" style={{ gap: 8 }}>
                          <button className={`btn ${b.board_id === recommendedBoardId ? "btnPrimary" : ""}`} disabled={!!lockedBlock}
 onClick={() => startBoardSession(b.board_id)}>
                            Start
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <p className="small" style={{ marginTop: 10 }}>
                Recommendation for privacy: use initials only, no full names.
              </p>
            </>
          )}

          {session && currentActivity && activityState && (
            <SessionView
              catalog={CATALOG}
              session={session}
              activity={currentActivity}
              activityState={activityState}
              onReplay={onReplay}
              onHint={onHint}
              onResponse={onResponse}
              onSkipActivity={advanceActivity}
              onEndSession={handleEnd}
              emitTrialPresented={emitTrialPresentedIfNeeded}
            />
          )}

          {session && !currentActivity && (
            <div>
              <p>Session loaded, but current activity not found. Check catalog integrity.</p>
              <button className="btn btnDanger" onClick={handleEnd}>End Session</button>
            </div>
          )}
        </div>
      )}

      {tab === "debug" && (
        <div className="card">
          <DebugView
            logger={logger}
            sessionId={session?.session_id ?? null}
            selectedStudentInitials={student}
            requireTeacherPin={requirePin}
          />
          <div className="footerRow">
            <button className="btn" onClick={handleClearLogs}>Clear Stored Logs (Teacher PIN)</button>
          </div>
        </div>
      )}
    </div>
  );
}
