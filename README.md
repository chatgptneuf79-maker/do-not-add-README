# SLP Web Vertical Slice — Sprint 1 (World 0)

This is a **web-based (iOS Safari-friendly)** vertical slice that meets Sprint 1 requirements:
- Session → Activity → Trial state machine
- World 0: W0.B0, W0.B1, W0.B2 — each includes Node + Boss
- Boss Clarity Rule: target always visible; **Replay does not re-roll** current trial/choices
- Hint ladder steps 1–4 (logged)
- TrialPlan generation + storage for reproducibility
- Full logging contract + internal debug view (last 50 trial responses)
- Minimal versioned content catalog loader

## Run locally (VS Code)
1) Install Node.js (LTS) on your computer.
2) In VS Code Terminal:
   - `npm install`
   - `npm run dev`
3) iPad on same Wi‑Fi:
   - open Safari → `http://<your-computer-lan-ip>:5173`

## Demo Criteria Checklist (Sprint 1)
- One session runs: W0.B0 node+boss, W0.B1 node+boss, W0.B2 node+boss
- Replay does not change current trial/choice positions
- Hint ladder reduces choices/highlights without hiding target
- Debug tab shows last 50 trials (item_id, correct, hint step, RT)
- Resume: reload page → Resume Session restores exact trial (SM‑001 basic)

## Logs
- Stored in `localStorage` under `slp.logs.v1` and also downloadable as JSONL.
- Snapshot stored under `slp.snapshot.v1`.


## Student Initials
This build adds a simple student selector (initials only). All logged events include `student_initials`.


## Teacher Lock + Reports
- Teacher PIN protects: adding students, clearing logs, downloading "since last report" exports.
- Default PIN in this build: 2111 (change in src/engine/config.ts).
- "Since last report" export tracks last-export timestamp per student.
