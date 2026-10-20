import type { BoardingReport, CombatReport, RamReport } from './reports';

/**
 * The English message table. It defines the set of messages: `fr.ts` is typed
 * against it (`Messages` in `index.ts`), so a missing, extra or wrongly-typed
 * message is a build error. A message with values in it is a function, so each
 * language writes its whole sentence, with its own word order and plurals.
 */
export const en = {
  languageNames: { en: 'English', fr: 'Français' },

  units: {
    archers: 'Archers',
    fantassins: 'Infantry',
    'fantassins-archers': 'Infantry-archers',
    'fantassins-lourds': 'Heavy infantry',
    phalanges: 'Phalanxes',
    'cavalerie-legere': 'Light cavalry',
    'cavalerie-lourde': 'Heavy cavalry',
    elephants: 'Elephants',
    'chars-legers': 'Light chariots',
    'chars-lourds': 'Heavy chariots',
    galeres: 'Galleys',
    biremes: 'Biremes',
    triremes: 'Triremes',
    quintiremes: 'Quinqueremes',
  },

  /** Default player names, seat by seat: Athens, Persia, Macedon, Sparta. */
  countries: ['Athens', 'Persia', 'Macedon', 'Sparta'],

  terrain: {
    plain: 'Plain',
    'river-wide': 'Wide river',
    'steep-flank': 'Steep flanks',
    plateau: 'Plateau',
    marsh: 'Marsh',
    coast: 'Coastal fringe',
    'zone-anse-hypnos': 'Hypnos Cove',
    'zone-pointe-eole': 'Aeolus Point',
    'zone-baie-argos': 'Bay of Argos',
    'zone-cap-zenon': 'Cape Zeno',
    sea: 'High seas',
  },

  edges: { W: 'W', E: 'E', N: 'N', S: 'S' },

  /** Player counter colours, by seat: the display words (the texture keys are
   * `PLAYER_COLOR_NAMES` in hexRender.ts). */
  colors: ['yellow', 'red', 'blue', 'green'],

  phases: { movement: 'movement', combat: 'combat' },

  common: {
    abandon: 'Abandon',
    undo: '↶ Undo',
    redo: '↷ Redo',
    undoWith: (label: string) => `↶ Undo: ${label}`,
    redoWith: (label: string) => `↷ Redo: ${label}`,
    turn: 'Turn',
    cancel: 'Cancel',
    close: 'Close',
    yes: 'Yes',
    abandonMessage: (progressLost: string) => `Abandon this game and return to the menu?\n${progressLost}`,
  },

  /** Short labels for the Menu button and the Board's status line. The first
   * three difficulty names describe *strength*, not the implementation tier.
   * `ai-lookahead` is deliberately "cautious", not "expert": it shares
   * `ai-ev`'s combat logic and only adds a bounded threat check to movement,
   * and measurement (`heuristicSoak.test.ts`, plan-history.md §6.14) could not
   * show it is reliably stronger — only more defensive. */
  seat: {
    human: 'Human',
    'ai-random': 'AI — easy',
    'ai-greedy': 'AI — normal',
    'ai-ev': 'AI — hard',
    'ai-lookahead': 'AI — cautious',
  },

  menu: {
    source: 'Jeux & Stratégie #6 (1980) — digital hotseat edition',
    numberOfPlayers: 'Number of players',
    combatRule: 'Combat rule',
    multiDefender: 'Group attacks: several units vs. several units',
    singleDefender: 'Group attacks: several units vs. one unit (rulebook)',
    turnOrder: 'Turn order',
    turnOrderRandom: 'Re-randomized each turn',
    turnOrderFixed: 'Fixed (initial draw)',
    gameLengthLimit: 'Game length limit (optional)',
    clock: (value: string) => `Clock: ${value}`,
    rounds: (value: string) => `Rounds: ${value}`,
    off: 'Off',
    minutes: (n: number) => `${n} min`,
    hours: (n: number) => `${n} h`,
    roundCount: (n: number) => `${n} rounds`,
    whoPlays: 'Who plays each seat',
    seatsIgnored: 'Seats beyond the player count you pick are ignored.',
    seatLabel: (name: string, control: string) => `${name}: ${control}`,
    testMode: 'Test mode (2 players, armies ready)',
    combatTestMode: 'Combat test mode (units face to face, 2 hexes)',
    loadGame: 'Load a game',
  },

  builder: {
    title: (name: string, edge: string) => `${name} — build your army (edge: ${edge})`,
    abandonMessage: 'Army selections made so far will be lost.',
    keepBuilding: 'Keep building',
    useDefault: 'Use default army',
    costAndMax: (cost: number, max: number) => `${cost}pt  (max ${max})`,
    total: (total: number, budget: number) => `Total: ${total} / ${budget}`,
    confirm: 'Confirm army',
    overMax: (unit: string, count: number, max: number) => `${unit}: ${count} exceeds the maximum of ${max}`,
    overBudget: (total: number, budget: number) => `Total cost ${total} exceeds the ${budget}-point budget`,
    underBudget: (total: number, budget: number) =>
      `Total cost ${total} is under the ${budget}-point budget — spend all ${budget} points to confirm`,
  },

  placement: {
    title: (name: string, edge: string) => `${name} — place your army (edge ${edge})`,
    abandonMessage: 'Placement made so far will be lost.',
    keepPlacing: 'Keep placing',
    donePlacing: 'Done placing',
    confirmFacing: 'Confirm facing',
    placeAction: (unit: string) => `Place ${unit}`,
    placingShip: (unit: string) => `Placing ${unit}: turn it with "Turn", then "Confirm facing" (or "Cancel").`,
    allPlaced: 'All units placed. Click "Done placing" to continue.',
    placing: (unit: string, left: number) => `Placing: ${unit} (${left} left) — click a highlighted hex`,
  },

  gameOver: {
    wins: (name: string) => `${name} wins!`,
    draw: (names: string[]) => `Draw between ${joinNames(names)}!`,
    over: 'Game over',
    pointsRemaining: (name: string, points: number) => `${name}: ${points} points remaining`,
    backToMenu: 'Back to menu',
  },

  drift: {
    started: (unit: string) => `${unit} is forced to retreat - instead it drifts!`,
    directionRolled: (die: number, steps: number) => `Direction die: ${die} - ${steps} hex(es) of movement to go.`,
    moved: (unit: string, q: number, r: number) => `${unit} moves to (${q}, ${r}).`,
    stopped: (unit: string) => `${unit} has used up its movement and stops drifting.`,
    exitOffMap: (unit: string) => `${unit} drifts off the map and is eliminated!`,
    exitMarsh: (unit: string) => `${unit} drifts into the marsh and is eliminated!`,
    exitSea: (unit: string) => `${unit} drifts into the sea and is eliminated!`,
    destroyed: (unit: string) => `${unit} is destroyed.`,
    repelled: (unit: string) => `${unit} is repelled and must drift again!`,
  },

  board: {
    endPhase: 'End phase',
    resolveAttack: 'Resolve attack',
    ram: 'Ram!',
    saveLoad: '💾 Save / Load',
    abandonGame: '✕ Abandon game',
    endGame: '⚑ End game',
    endingAfterRound: '⚑ Ending after this round',
    pauseClock: '⏸ Pause clock',
    resumeClock: '▶ Resume clock',
    continue: '▶ Continue',
    keepPlaying: 'Keep playing',
    abandonMessage: 'Progress since your last save will be lost.',
    endGameMessage:
      'End the game now?\nEvery player still finishes their current round — the highest remaining army value wins, and a tie is a draw.',
    endGameConfirm: 'End game',
    seat: (name: string, edge: string, color: string) => `${name} (${edge}, ${color})`,
    seatWithControl: (seat: string, control: string) => `${seat} [${control}]`,
    status: (turn: number, who: string, phase: string, finalRound: boolean) =>
      `Turn ${turn} — ${who} — ${phase.toUpperCase()} phase${finalRound ? ' — FINAL ROUND' : ''}`,
    clock: (time: string, paused: boolean) => `Clock: ${time} remaining${paused ? ' (paused)' : ''}`,
    ramPrompt: (defender: string, bonus: number) => `Ram ${defender}?\n(bonus +${bonus})`,
    holdOff: 'Hold off',
    boardPrompt: (attacker: string, defender: string) => `Board ${defender}?\n${attacker} vs ${defender}`,
    board: 'Board!',
    advanceTitle: 'Advance into the vacated hex?',
    advanceUnit: (letter: string, unit: string) => `${letter} — Advance ${unit}`,
    dontAdvance: "Don't advance",
    exchangeTitle: (required: number) => `Exchange: choose losses\n(need ≥ ${required} attack force)`,
    exchangeRow: (checked: boolean, letter: string, unit: string, attack: number) =>
      `${checked ? '☒' : '☐'} ${letter} — ${unit} (atk ${attack})`,
    selectedForce: (sum: number, required: number, met: boolean) => `Selected force: ${sum} / ${required}${met ? ' ✓' : ''}`,
    confirmLosses: 'Confirm losses',
  },

  /** Undo/redo labels: made in the language of the moment and kept in the history as text. */
  actions: {
    move: (unit: string) => `Move ${unit}`,
    moveIntoContact: (unit: string) => `Move ${unit} into contact`,
    turn: (unit: string) => `Turn ${unit}`,
    ram: (unit: string) => `Ram ${unit}`,
    board: (unit: string) => `Board ${unit}`,
    select: (unit: string) => `Select ${unit}`,
    deselect: (unit: string) => `Deselect ${unit}`,
    target: (unit: string) => `Target ${unit}`,
    untarget: (unit: string) => `Untarget ${unit}`,
    attackWith: (count: number) => `Attack with ${count} unit(s)`,
  },

  results: {
    AE: 'AE — attacker eliminated',
    AR: 'AR — attacker retreats',
    DE: 'DE — defender eliminated',
    DR: 'DR — defender retreats',
    EX: 'EX — exchange',
  },

  log: {
    gameLoaded: 'Game loaded.',
    waitComputerSave: "Wait for the computer's turn to finish before saving or loading.",
    resolvePendingSave: 'Resolve the pending retreat/drift before saving or loading.',
    waitComputerEnd: "Wait for the computer's turn to finish before ending the game.",
    resolvePendingEnd: 'Resolve the pending retreat/drift before ending the game.',
    alreadyEnding: 'The game is already ending after this round.',
    willEnd: 'The game will end once every player has finished this round.',
    cantUndoComputer: "Can't undo during the computer's turn.",
    resolvePendingUndo: 'Resolve the pending retreat/drift before undoing.',
    nothingToUndo: 'Nothing to undo.',
    undone: (label: string) => `Undone: ${label}`,
    cantRedoComputer: "Can't redo during the computer's turn.",
    resolvePendingRedo: 'Resolve the pending retreat/drift before redoing.',
    nothingToRedo: 'Nothing to redo.',
    redone: (label: string) => `Redone: ${label}`,
    charges: (unit: string) => `${unit} charges!`,
    noMovementToRotate: 'No movement left to rotate.',
    alreadyAttacked: (unit: string) => `${unit} has already attacked this phase.`,
    alreadyRammed: (unit: string) => `${unit} already rammed this turn and can't also board.`,
    cantReachTargets: (unit: string) => `${unit} can't reach the current target(s).`,
    noCommonTarget: (unit: string) => `${unit} has no eligible target in common with the current group.`,
    removedFromCombat: (units: string[]) => `Removed from the combat (nothing left in range): ${units.join(', ')}.`,
    alreadyAttackedTarget: (unit: string) => `${unit} has already been attacked this phase.`,
    notBoardable: (unit: string) => `${unit} isn't adjacent with a parallel facing — not a legal boarding target.`,
    singleTargetOnly: 'Single-defender mode: only one target per attack — resolve or deselect it first.',
    cavalryCantAttack: (unit: string) => `${unit} can't be attacked by cavalry — remove the cavalry from the group first.`,
    notReachable: (unit: string) => `${unit} isn't reachable by the current attack group.`,
    advances: (unit: string) => `${unit} advances into the vacated hex.`,
    resolvePendingAttack: 'Resolve the pending retreat/drift before starting a new attack.',
    selectAttacker: 'Select at least one attacking unit first.',
    navalImmediate: 'Naval attacks resolve immediately when you pick a target.',
    selectTarget: 'Select at least one target.',
    exchangeSacrificed: (units: string[]) =>
      `Exchange: defender(s) destroyed; sacrificed ${units.join(', ') || 'none'}.`,
    selectMoreForce: (required: number) => `Select units totaling at least ${required} attack force before confirming.`,
    waitComputerPhase: "Wait for the computer's turn to finish before ending the phase.",
    resolvePendingPhase: 'Resolve the pending retreat/drift before ending the phase.',
    computerError: 'The computer player hit an error and stopped. See the console.',
    computerMoves: (seat: string, unit: string, q: number, r: number) => `${seat}: ${unit} moves to (${q}, ${r}).`,
    computerTurns: (seat: string, unit: string) => `${seat}: ${unit} turns.`,
    tramples: (drifting: string, occupant: string, q: number, r: number) => `${drifting} tramples into ${occupant} at (${q}, ${r}).`,
    retreats: (unit: string) => `${unit} retreats.`,
    retreatsMakingRoom: (pushed: string, unit: string) => `${pushed} retreats, making room for ${unit}.`,
    eliminatedNowhere: (unit: string) => `${unit} had nowhere to retreat and was eliminated.`,
    mustRetreatRoom: (unit: string) => `${unit} must retreat to make room — click a highlighted hex.`,
    mustRetreat: (unit: string) => `${unit} must retreat — click a highlighted hex.`,
    nowhereToRetreat: (unit: string, count: number) =>
      `${unit} has nowhere to retreat — ${count === 1 ? 'one neighboring friendly unit can' : `${count} neighboring friendly units can`} make room. Click one to push it.`,
    terrainModifier: (value: number, terrain: string, q: number | null, r: number | null) =>
      `${value} ${terrain}${q === null || r === null ? '' : ` at (${q}, ${r})`}`,
    riverModifier: (value: number) => `${value} river crossing`,
    combatReport: (r: CombatReport) =>
      [
        `ATTACKERS (total ${r.attackTotal}):`,
        ...r.attackers.map((l) => `  ${l.unit} (atk ${l.force})`),
        `DEFENDERS (total ${r.defenseTotal}):`,
        ...r.defenders.map((l) => `  ${l.unit} (def ${l.force})`),
        `Ratio: ${r.ratio} (CRT column "${r.crtColumn}", column ${r.columnNumber} of ${r.columnCount}, array index ${r.columnIndex})`,
        (r.modifier !== 0
          ? `Die: ${r.dieRaw} + ${r.modifier} (${r.modifierParts.join(' + ')}) = ${r.dieModified}`
          : `Die: ${r.dieRaw}`) + (r.dieUsed !== null ? ` (used ${r.dieUsed})` : ''),
        `Result: ${r.result}`,
        ...(r.exchangeThreshold !== null
          ? [
              `Exchange threshold: attacker must sacrifice units totaling at least ${r.exchangeThreshold} attack (the defenders' total force).`,
            ]
          : []),
      ].join('\n'),
    ramReport: (r: RamReport) =>
      [
        `Ramming: ${r.attacker} vs ${r.defender}, bonus +${r.bonus} (${r.unusedMovement} unused movement ${r.unusedMovement === 1 ? 'point' : 'points'})`,
        `Succeeds on: ${r.successRange}   (printed table row: ${r.printedRange}${
          r.note === 'everyFace'
            ? " — bonus pushes the upper bound to a d6's 6th face, so every roll hits"
            : r.note === 'bonus'
              ? ` — bonus +${r.bonus} extends the upper bound`
              : ''
        })`,
        `Die: ${r.die} -> ${r.hit ? 'SUNK!' : 'missed'}`,
      ].join('\n'),
    boardingReport: (r: BoardingReport) =>
      [
        `Boarding: ${r.attacker.unit} (attack ${r.attacker.forceBefore}) vs ${r.defender.unit} (defense ${r.defender.forceBefore})`,
        `CRT column: "${r.column}" (column ${r.columnNumber} of ${r.columnCount}, array index ${r.columnIndex})`,
        r.side !== null ? `Die: ${r.die} -> ${r.side} loses ${r.loss} equipment` : `Die: ${r.die} -> no decisive effect`,
        ...(r.attackerSunk ? [`  ${r.attacker.unit} is SUNK!`] : []),
        ...(r.defenderSunk ? [`  ${r.defender.unit} is SUNK!`] : []),
        `  ${r.attacker.unit} (attacker): ${r.attacker.before}/${r.attacker.max} -> ${r.attacker.after}/${r.attacker.max} equipment (attack ${r.attacker.forceBefore} -> ${r.attacker.forceAfter})`,
        `  ${r.defender.unit} (defender): ${r.defender.before}/${r.defender.max} -> ${r.defender.after}/${r.defender.max} equipment (defense ${r.defender.forceBefore} -> ${r.defender.forceAfter})`,
      ].join('\n'),
  },

  saves: {
    panelManage: 'Save / Load',
    panelLoad: 'Load a saved game',
    autosave: 'Autosave',
    slot: (n: number) => `Slot ${n}`,
    exportFile: 'Export to file',
    importFile: 'Import from file',
    save: 'Save',
    load: 'Load',
    delete: 'Delete',
    empty: '— empty —',
    summary: (turn: number, who: string, phase: string) => `Turn ${turn} — ${who} (${phase})`,
    summaryUnknown: 'unknown',
    savingFailed: 'Saving failed — browser storage is full or unavailable.',
    overwrote: (slot: number | string, summary: string) => `Overwrote slot ${slot} (${summary}).`,
    savedTo: (slot: number | string) => `Saved to slot ${slot}.`,
    slotEmpty: 'That slot is empty.',
    clearedAutosave: 'Cleared the autosave.',
    clearedSlot: (slot: number | string) => `Cleared slot ${slot}.`,
    exported: 'Exported the current game to a .json file.',
    unreadable: "That file couldn't be read.",
    invalidJson: "That file isn't valid JSON.",
    notASave: "That file isn't a Héraklios save.",
    unsupportedVersion: (version: number, expected: number) =>
      `Save file version ${version} isn't supported (expected ${expected}).`,
  },
};

/** "A and B" for two names, "A, B and C" for three or more. */
function joinNames(names: string[]): string {
  if (names.length <= 1) return names.join('');
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}
