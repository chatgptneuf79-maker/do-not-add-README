import type { ActivityDef, CatalogV1, TrialPlan, TrialSpec, TrialFormat } from "./types";
import { SeededRng } from "./hash";
import { getItem } from "./catalog";

export function generateTrialPlan(catalog: CatalogV1, activity: ActivityDef, seedU64: bigint): TrialPlan {
  const rng = new SeededRng(seedU64);
  const trials: TrialSpec[] = [];
  const format: TrialFormat = activity.trial_format;

  for (let idx = 0; idx < activity.trials_per_activity; idx++) {
    const item_id = rng.pick(activity.target_pool);
    const trial_id = `${activity.activity_id}.t${idx}`;

    if (format === "match_this_choose_from_these") {
      const distractPool = activity.distractor_pool.length ? activity.distractor_pool : activity.target_pool;
      const set = new Set<string>();
      set.add(item_id);
      while (set.size < Math.min(activity.choices_count, distractPool.length)) {
        set.add(rng.pick(distractPool));
      }
      const choice_ids_in_order = rng.shuffle(Array.from(set));
      trials.push({
        trial_id,
        item_id,
        format,
        correct_response_id: item_id,
        choice_ids_in_order,
        transfer_tag: null,
        novelty_tag: null
      });
      continue;
    }

    if (format === "same_different") {
      const txt = getItem(catalog, item_id)?.text ?? "";
      const parts = txt.split("•").map(p => p.trim());
      const isSame = parts.length === 2 && parts[0] === parts[1];
      const correct = isSame ? "same" : "different";
      trials.push({
        trial_id,
        item_id,
        format,
        correct_response_id: correct,
        choice_ids_in_order: ["same", "different"],
        transfer_tag: null,
        novelty_tag: null
      });
      continue;
    }

    // sort_vowel_consonant
    const grapheme = (getItem(catalog, item_id)?.text ?? "").toLowerCase();
    const vowels = new Set(["a","e","i","o","u"]);
    const correct = vowels.has(grapheme) ? "vowel" : "consonant";
    trials.push({
      trial_id,
      item_id,
      format,
      correct_response_id: correct,
      choice_ids_in_order: ["vowel", "consonant"],
      transfer_tag: null,
      novelty_tag: null
    });
  }

  return { seed: seedU64.toString(10), trials };
}
