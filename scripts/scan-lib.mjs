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
