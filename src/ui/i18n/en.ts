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
