import React, { useMemo, useState } from "react";
import { Logger } from "../engine/logger";
import { loadLastReportExportIso, saveLastReportExportIso } from "../engine/studentStore";

type Props = {
  logger: Logger;
  sessionId: string | null;
  selectedStudentInitials: string;
  requireTeacherPin: () => boolean;
};

type TrialRow = {
  item_id: string;
  correctness: boolean;
  hint_step_used: number;
  rt_ms: number;
  ts: string;
};

function downloadText(filename: string, text: string) {
  const blob = new Blob([text], { type: "application/jsonl" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function DebugView({ logger, sessionId, selectedStudentInitials, requireTeacherPin }: Props) {
  const [mode, setMode] = useState<"session" | "student">(sessionId ? "session" : "student");

  const all = useMemo(() => logger.getAll(), [logger]);

  const student = selectedStudentInitials?.trim().toUpperCase() ?? "";
  const lastReportIso = useMemo(() => (student ? loadLastReportExportIso(student) : null), [student]);

  const filtered = useMemo(() => {
    if (mode === "session" && sessionId) return all.filter(l => l.session_id === sessionId);
    if (student) return all.filter(l => String((l.payload as any)?.student_initials ?? "").toUpperCase() === student);
    return all;
  }, [all, mode, sessionId, student]);

  const last50 = useMemo(() => {
    const rows: TrialRow[] = [];
    for (const ev of filtered) {
      if (ev.event_type !== "trial_response") continue;
      const p = ev.payload as Record<string, unknown>;
      rows.push({
        item_id: String(p["item_id"] ?? ""),
        correctness: Boolean(p["correctness"]),
        hint_step_used: Number(p["hint_step_used"] ?? 0),
        rt_ms: Number(p["rt_ms"] ?? 0),
        ts: ev.ts
      });
    }
    return rows.slice(-50).reverse();
  }, [filtered]);

  function downloadCurrentViewAll() {
    const jsonl = filtered.map(l => JSON.stringify(l)).join("\n") + "\n";
    const tag = mode === "session" && sessionId ? sessionId.slice(0, 8) : (student || "all");
    downloadText(`slp_events_${tag}.jsonl`, jsonl);
  }

  function downloadSinceLastReport() {
    if (!student) {
      alert("Select a student initials first.");
      return;
    }
    if (!requireTeacherPin()) return;

    const sinceIso = lastReportIso;
    const since = sinceIso ? Date.parse(sinceIso) : 0;

    const rows = all.filter(l => {
      const s = String((l.payload as any)?.student_initials ?? "").toUpperCase();
      if (s !== student) return false;
      const ts = Date.parse(l.ts);
      return ts > since;
    });

    const jsonl = rows.map(l => JSON.stringify(l)).join("\n") + "\n";
    const stamp = new Date().toISOString().slice(0, 10);
    downloadText(`slp_report_${student}_${stamp}.jsonl`, jsonl);

    saveLastReportExportIso(student, new Date().toISOString());
    window.location.reload();
  }

  return (
    <div>
      <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-end" }}>
        <div>
          <div style={{ fontWeight: 800 }}>Debug</div>
          <div className="small">
            View: {mode === "session" ? "Current session" : student ? `Student ${student}` : "All logs"}
            {mode === "student" && student && (
              <>
                {" "}• Last report: {lastReportIso ? lastReportIso.replace("T", " ").replace("Z", "") : "(never)"}
              </>
            )}
          </div>
        </div>

        <div className="row" style={{ gap: 8 }}>
          <button className={`btn ${mode === "session" ? "btnPrimary" : ""}`} onClick={() => setMode("session")} disabled={!sessionId}>
            Session
          </button>
          <button className={`btn ${mode === "student" ? "btnPrimary" : ""}`} onClick={() => setMode("student")}>
            Student
          </button>
        </div>
      </div>

      <div className="row" style={{ marginTop: 10, gap: 8, flexWrap: "wrap" }}>
        <button className="btn" onClick={downloadCurrentViewAll}>
          Download JSONL (current view)
        </button>
        <button className="btn btnPrimary" onClick={downloadSinceLastReport}>
          Download Report (since last report)
        </button>
      </div>

      <div style={{ marginTop: 14, overflowX: "auto" }}>
        <div style={{ fontWeight: 800 }}>Last 50 Trial Responses</div>
        <div className="small">Fields: item_id • correct • hint_step • RT(ms)</div>

        <table className="table" aria-label="Last 50 trials table" style={{ marginTop: 8 }}>
          <thead>
            <tr>
              <th>Timestamp</th>
              <th>item_id</th>
              <th>correct</th>
              <th>hint</th>
              <th>RT</th>
            </tr>
          </thead>
          <tbody>
            {last50.map((r, idx) => (
              <tr key={idx}>
                <td className="mono">{r.ts.replace("T", " ").replace("Z", "")}</td>
                <td className="mono">{r.item_id}</td>
                <td>{r.correctness ? "✔" : "✖"}</td>
                <td className="mono">{r.hint_step_used}</td>
                <td className="mono">{r.rt_ms}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
