import React, { useMemo, useRef, useState } from "react";
import type { ActivityDef, CatalogV1, TrialSpec, TrialFormat } from "../engine/types";
import { getItem } from "../engine/catalog";

type ChoiceRender = {
  id: string;
  label: string;
  dim: boolean;
  highlight: boolean;
};

type Props = {
  catalog: CatalogV1;
  activity: ActivityDef;
  trial: TrialSpec;
  hintStep: number;   // 0..4
  replayCount: number;
  onReplay: () => void;
  onHint: () => void;
  onResponse: (choiceId: string, rtMs: number) => void;
};

export default function TrialView(props: Props) {
  const { catalog, activity, trial, hintStep } = props;
  const presentedAtRef = useRef<number>(performance.now());

  // Boss Clarity Template: target always visible at top.
  const targetText = useMemo(() => {
    if (trial.format === "match_this_choose_from_these") {
      return getItem(catalog, trial.item_id)?.text ?? trial.item_id;
    }
    // Same/different and sorting: stimulus is the item itself (pair or grapheme)
    return getItem(catalog, trial.item_id)?.text ?? trial.item_id;
  }, [trial.trial_id]);

  const shouldEmphasizeTarget = hintStep >= 2; // replay stimulus + highlight

  const choices: ChoiceRender[] = useMemo(() => {
    const format = trial.format;
    if (format === "match_this_choose_from_these") {
      const base = trial.choice_ids_in_order.map(id => ({
        id,
        label: getItem(catalog, id)?.text ?? id,
        dim: false,
        highlight: hintStep >= 4 && id === trial.correct_response_id
      }));

      if (hintStep < 3) return base;

      // Hint 3: reduce choices but do not hide target
      if (base.length > 2) {
        const correct = base.find(c => c.id === trial.correct_response_id)!;
        const distractor = base.find(c => c.id !== trial.correct_response_id)!;
        return [correct, distractor].map(c => ({
          ...c,
          dim: false,
          highlight: hintStep >= 4 && c.id === trial.correct_response_id
        }));
      }

      // If only 2, dim the wrong
      return base.map(c => ({
        ...c,
        dim: c.id !== trial.correct_response_id,
        highlight: hintStep >= 4 && c.id === trial.correct_response_id
      }));
    }

    if (format === "same_different") {
      const labels: Record<string, string> = { same: "Same", different: "Different" };
      return trial.choice_ids_in_order.map(id => ({
        id,
        label: labels[id] ?? id,
        dim: hintStep >= 3 && id !== trial.correct_response_id,
        highlight: hintStep >= 4 && id === trial.correct_response_id
      }));
    }

    // sort_vowel_consonant
    const labels: Record<string, string> = { vowel: "Vowel", consonant: "Consonant" };
    return trial.choice_ids_in_order.map(id => ({
      id,
      label: labels[id] ?? id,
      dim: hintStep >= 3 && id !== trial.correct_response_id,
      highlight: hintStep >= 4 && id === trial.correct_response_id
    }));
  }, [trial.trial_id, hintStep]);

  // Boss Clarity rule: replay does NOT reroll; we only provide UI affordance.
  function handleReplay() {
    props.onReplay();
  }

  function handleChoiceTap(id: string) {
    const rtMs = Math.max(0, Math.round(performance.now() - presentedAtRef.current));
    props.onResponse(id, rtMs);
    // reset timer for next trial (component remount will also do this)
    presentedAtRef.current = performance.now();
  }

  return (
    <div style={{ marginTop: 14 }}>
      <p className="prompt">{activity.prompt}</p>

      <div className={`targetCard ${shouldEmphasizeTarget ? "targetEmphasis" : ""}`} aria-label={`Target ${targetText}`}>
        {targetText}
      </div>

      <div className="grid2" role="group" aria-label="Choices">
        {choices.map(c => (
          <button
            key={c.id}
            className={`choice ${c.dim ? "choiceDim" : ""} ${c.highlight ? "choiceHighlight" : ""}`}
            onClick={() => handleChoiceTap(c.id)}
            aria-label={c.label}
          >
            {c.label}
          </button>
        ))}
      </div>

      <div className="footerRow" style={{ justifyContent: "center" }}>
        <button className="btn" onClick={handleReplay}>Replay</button>
        <button className="btn btnPrimary" onClick={props.onHint}>Hint</button>
      </div>

      <div className="small" style={{ textAlign: "center" }}>
        Hint ladder: 1=repeat prompt • 2=replay stimulus • 3=reduce/dim choices • 4=highlight target
      </div>
    </div>
  );
}
