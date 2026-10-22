// Pure logic behind the metadata checks of `npm run sdlc:scan` (§31). Kept
// free of git/fs calls so it can be unit-tested; see scan-lib.test.mjs. The
// git lookup is injected as `isCommit`.
import { GATE_FIELDS, parseGate } from './intent-check-lib.mjs';

// Anything else never reaches git: a value starting with `-` would be read as an option.
const HASH_RE = /^[0-9a-f]{7,40}$/;

/**
 * Bad values in intents' metadata.yml: a `merged:` that is not a hash or does
 * not resolve to a commit, and any malformed gate value.
 *
 * @param {{id:unknown, merged:string|null, gates:Record<string,unknown>}[]} intents
 * @param {(hash:string) => boolean} isCommit
 * @returns {{id:unknown, field:string, value:unknown, why:string}[]}
 */
export function metadataProblems(intents, isCommit) {
  const problems = [];
  for (const i of intents) {
    if (i.merged) {
      if (!HASH_RE.test(i.merged)) problems.push({ id: i.id, field: 'merged', value: i.merged, why: 'not a commit hash' });
      else if (!isCommit(i.merged)) problems.push({ id: i.id, field: 'merged', value: i.merged, why: 'does not resolve to a commit' });
    }
    for (const field of GATE_FIELDS) {
      if (parseGate(i.gates[field]).state === 'malformed') {
        problems.push({ id: i.id, field, value: i.gates[field], why: 'not empty, a date, or a date plus "by-agent"' });
      }
    }
  }
  return problems;
}

/** Per gate field, how many recorded values the owner typed and how many an agent did. */
export function gateShares(intents) {
  const out = {};
  for (const field of GATE_FIELDS) {
    out[field] = { owner: 0, agent: 0 };
    for (const i of intents) {
      const g = parseGate(i.gates[field]);
      if (g.state === 'recorded') out[field][g.by] += 1;
    }
  }
  return out;
}

// Which skill is allowed to have written each artefact (§44): a stamp names
// the skill, so a spec only counts as skill-made when /spec stamped it.
const ARTEFACT_SKILL = { 'spec.md': 'heraklios/spec', 'plan.md': 'heraklios/build-plan' };

/**
 * Per artefact (spec.md, plan.md): how many files the step's skill made
 * (stamp name matches the file), how many are hand-made under another stamp,
 * and how many are unstamped. An intent without the file is counted nowhere.
 * The stamp is `name@version`, as sdlc-scan.mjs reads it; any version counts.
 *
 * @param {{stamps:Record<string,string|null>}[]} intents
 * @returns {Record<string,{skill:number, hand:number, unstamped:number}>}
 */
export function artefactOrigins(intents) {
  const out = {};
  for (const [file, skill] of Object.entries(ARTEFACT_SKILL)) {
    out[file] = { skill: 0, hand: 0, unstamped: 0 };
    for (const i of intents) {
      if (!(file in i.stamps)) continue;
      const stamp = i.stamps[file];
      if (!stamp) out[file].unstamped += 1;
      else if (stamp.split('@')[0] === skill) out[file].skill += 1;
      else out[file].hand += 1;
    }
  }
  return out;
}
