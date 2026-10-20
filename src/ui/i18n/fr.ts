import type { Messages } from './index';

/** The French message table, typed against `en.ts` (spec B2). */
export const fr: Messages = {
  languageNames: { en: 'English', fr: 'Français' },

  units: {
    archers: 'Archers',
    fantassins: 'Fantassins',
    'fantassins-archers': 'Fantassins-Archers',
    'fantassins-lourds': 'Fantassins Lourds',
    phalanges: 'Phalanges',
    'cavalerie-legere': 'Cavalerie Légère',
    'cavalerie-lourde': 'Cavalerie Lourde',
    elephants: 'Éléphants',
    'chars-legers': 'Chars Légers',
    'chars-lourds': 'Chars Lourds',
    galeres: 'Galères',
    biremes: 'Birèmes',
    triremes: 'Trirèmes',
    quintiremes: 'Quintirèmes',
  },

  countries: ['Athènes', 'Perse', 'Macédoine', 'Sparte'],

  terrain: {
    plain: 'Plaine',
    'river-wide': 'Rivière large',
    'steep-flank': 'Flancs abrupts',
    plateau: 'Plateaux',
    marsh: 'Marais',
    coast: 'Frange côtière',
    'zone-anse-hypnos': "Anse d'Hypnos",
    'zone-pointe-eole': "Pointe d'Eole",
    'zone-baie-argos': "Baie d'Argos",
    'zone-cap-zenon': 'Cap Zénon',
    sea: 'Pleine mer',
  },

  edges: { W: 'O', E: 'E', N: 'N', S: 'S' },

  colors: ['jaune', 'rouge', 'bleu', 'vert'],

  phases: { movement: 'mouvement', combat: 'combat' },

  common: {
    abandon: 'Abandonner',
    undo: '↶ Annuler',
    redo: '↷ Rétablir',
    undoWith: (label) => `↶ Annuler : ${label}`,
    redoWith: (label) => `↷ Rétablir : ${label}`,
    turn: 'Pivoter',
    cancel: 'Annuler',
    close: 'Fermer',
    yes: 'Oui',
    abandonMessage: (progressLost) => `Abandonner cette partie et revenir au menu ?\n${progressLost}`,
  },

  seat: {
    human: 'Humain',
    'ai-random': 'IA — facile',
    'ai-greedy': 'IA — normale',
    'ai-ev': 'IA — difficile',
    'ai-lookahead': 'IA — prudente',
  },

  menu: {
    source: 'Jeux & Stratégie #6 (1980) — édition numérique à écran partagé',
    numberOfPlayers: 'Nombre de joueurs',
    combatRule: 'Règle de combat',
    multiDefender: 'Attaques groupées : plusieurs unités contre plusieurs unités',
    singleDefender: 'Attaques groupées : plusieurs unités contre une seule (règle du livret)',
    turnOrder: 'Ordre de jeu',
    turnOrderRandom: 'Retiré au sort à chaque tour',
    turnOrderFixed: 'Fixe (tirage initial)',
    gameLengthLimit: 'Durée de la partie (facultatif)',
    clock: (value) => `Horloge : ${value}`,
    rounds: (value) => `Manches : ${value}`,
    off: 'Aucune',
    minutes: (n) => `${n} min`,
    hours: (n) => `${n} h`,
    roundCount: (n) => `${n} manches`,
    whoPlays: 'Qui joue chaque place',
    seatsIgnored: 'Les places au-delà du nombre de joueurs choisi sont ignorées.',
    seatLabel: (name, control) => `${name} : ${control}`,
    testMode: 'Mode test (2 joueurs, armées prêtes)',
    combatTestMode: 'Mode test de combat (unités face à face, à 2 hexagones)',
    loadGame: 'Charger une partie',
  },

  builder: {
    title: (name, edge) => `${name} — composez votre armée (bord : ${edge})`,
    abandonMessage: 'Les choix d’armée faits jusqu’ici seront perdus.',
    keepBuilding: 'Continuer',
    useDefault: 'Armée par défaut',
    costAndMax: (cost, max) => `${cost} pts  (max ${max})`,
    total: (total, budget) => `Total : ${total} / ${budget}`,
    confirm: 'Valider l’armée',
    overMax: (unit, count, max) => `${unit} : ${count} dépasse le maximum de ${max}`,
    overBudget: (total, budget) => `Le coût total de ${total} dépasse le budget de ${budget} points`,
    underBudget: (total, budget) =>
      `Le coût total de ${total} est sous le budget de ${budget} points — dépensez les ${budget} points pour valider`,
  },

  placement: {
    title: (name, edge) => `${name} — placez votre armée (bord ${edge})`,
    abandonMessage: 'Le placement fait jusqu’ici sera perdu.',
    keepPlacing: 'Continuer',
    donePlacing: 'Placement terminé',
    confirmFacing: 'Valider l’orientation',
    placeAction: (unit) => `Placer ${unit}`,
    placingShip: (unit) => `Placement : ${unit} — orientez-le avec « Pivoter », puis « Valider l’orientation » (ou « Annuler »).`,
    allPlaced: 'Toutes les unités sont placées. Cliquez sur « Placement terminé » pour continuer.',
    placing: (unit, left) => `Placement : ${unit} (${left} restant) — cliquez sur un hexagone en surbrillance`,
  },

  gameOver: {
    wins: (name) => `${name} gagne !`,
    draw: (names) => `Égalité entre ${joinNames(names)} !`,
    over: 'Partie terminée',
    pointsRemaining: (name, points) => `${name} : ${points} points restants`,
    backToMenu: 'Retour au menu',
  },

  saves: {
    panelManage: 'Sauvegarder / Charger',
    panelLoad: 'Charger une partie sauvegardée',
    autosave: 'Sauvegarde auto',
    slot: (n) => `Emplacement ${n}`,
    exportFile: 'Exporter vers un fichier',
    importFile: 'Importer un fichier',
    save: 'Sauvegarder',
    load: 'Charger',
    delete: 'Supprimer',
    empty: '— vide —',
    summary: (turn, who, phase) => `Tour ${turn} — ${who} (${phase})`,
    summaryUnknown: 'inconnu',
    savingFailed: 'Échec de la sauvegarde — le stockage du navigateur est plein ou indisponible.',
    overwrote: (slot, summary) => `Emplacement ${slot} écrasé (${summary}).`,
    savedTo: (slot) => `Sauvegardé dans l’emplacement ${slot}.`,
    slotEmpty: 'Cet emplacement est vide.',
    clearedAutosave: 'Sauvegarde auto effacée.',
    clearedSlot: (slot) => `Emplacement ${slot} effacé.`,
    exported: 'Partie exportée vers un fichier .json.',
    unreadable: 'Ce fichier n’a pas pu être lu.',
    invalidJson: 'Ce fichier n’est pas du JSON valide.',
    notASave: 'Ce fichier n’est pas une sauvegarde d’Héraklios.',
    unsupportedVersion: (version, expected) =>
      `La version ${version} du fichier de sauvegarde n’est pas prise en charge (attendue : ${expected}).`,
  },
};

/** « A et B » for two names, « A, B et C » for three or more. */
function joinNames(names: string[]): string {
  if (names.length <= 1) return names.join('');
  return `${names.slice(0, -1).join(', ')} et ${names[names.length - 1]}`;
}
