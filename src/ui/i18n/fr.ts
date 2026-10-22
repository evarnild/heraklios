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
    turnOrderRandom: 'Tiré au sort à chaque tour',
    turnOrderFixed: 'Fixe (tirage initial)',
    gameLengthLimit: 'Durée de la partie (facultatif)',
    clock: (value) => `Horloge : ${value}`,
    rounds: (value) => `Manches : ${value}`,
    off: 'Aucune',
    minutes: (n) => `${n} min`,
    hours: (n) => `${n} h`,
    roundCount: (n) => `${n} manches`,
    whoPlays: 'Qui joue chaque camp',
    seatsIgnored: 'Les camps au-delà du nombre de joueurs choisi sont ignorés.',
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
    donePlacing: 'Terminé',
    confirmFacing: 'Valider',
    placeAction: (unit) => `Placer ${unit}`,
    placingShip: (unit) => `Placement : ${unit} — orientez-le avec « Pivoter », puis « Valider » (ou « Annuler »).`,
    allPlaced: 'Toutes les unités sont placées. Cliquez sur « Terminé » pour continuer.',
    placing: (unit, left) => `Placement : ${unit} (${left} restant${left > 1 ? 's' : ''}) — cliquez sur un hexagone en surbrillance`,
  },

  gameOver: {
    wins: (name) => `${name} gagne !`,
    draw: (names) => `Égalité entre ${joinNames(names)} !`,
    over: 'Partie terminée',
    pointsRemaining: (name, points) => `${name} : ${points} points restants`,
    backToMenu: 'Retour au menu',
  },

  drift: {
    started: (unit) => `L’unité ${unit} doit reculer — elle dérive à la place !`,
    directionRolled: (die, steps) => `Dé de direction : ${die} — ${steps} hexagone(s) de déplacement restant(s).`,
    moved: (unit, q, r) => `L’unité ${unit} se déplace en (${q}, ${r}).`,
    stopped: (unit) => `L’unité ${unit} a épuisé son déplacement et cesse de dériver.`,
    exitOffMap: (unit) => `L’unité ${unit} dérive hors de la carte et est éliminée !`,
    exitMarsh: (unit) => `L’unité ${unit} dérive dans les marais et est éliminée !`,
    exitSea: (unit) => `L’unité ${unit} dérive dans la mer et est éliminée !`,
    destroyed: (unit) => `L’unité ${unit} est détruite.`,
    repelled: (unit) => `L’unité ${unit} est repoussée et doit dériver à nouveau !`,
  },

  board: {
    endPhase: 'Fin de phase',
    resolveAttack: 'Résoudre l’attaque',
    ram: 'Éperonner !',
    saveLoad: '💾 Sauver / Charger',
    abandonGame: '✕ Abandonner',
    endGame: '⚑ Finir la partie',
    endingAfterRound: '⚑ Fin après cette manche',
    pauseClock: '⏸ Pause horloge',
    resumeClock: '▶ Reprise horloge',
    continue: '▶ Continuer',
    keepPlaying: 'Continuer à jouer',
    abandonMessage: 'La progression depuis votre dernière sauvegarde sera perdue.',
    endGameMessage:
      'Terminer la partie maintenant ?\nChaque joueur termine encore sa manche en cours — la plus forte valeur d’armée restante gagne, et une égalité est un match nul.',
    endGameConfirm: 'Finir la partie',
    seat: (name, edge, color) => `${name} (${edge}, ${color})`,
    seatWithControl: (seat, control) => `${seat} [${control}]`,
    status: (turn, who, phase, finalRound) =>
      `Tour ${turn} — ${who} — phase de ${phase.toUpperCase()}${finalRound ? ' — DERNIÈRE MANCHE' : ''}`,
    clock: (time, paused) => `Horloge : ${time} restantes${paused ? ' (en pause)' : ''}`,
    ramPrompt: (defender, bonus) => `Éperonner ${defender} ?\n(bonus +${bonus})`,
    holdOff: 'Renoncer',
    boardPrompt: (attacker, defender) => `Aborder ${defender} ?\n${attacker} contre ${defender}`,
    board: 'Aborder !',
    advanceTitle: 'Avancer dans l’hexagone libéré ?',
    advanceUnit: (letter, unit) => `${letter} — Avancer ${unit}`,
    dontAdvance: 'Ne pas avancer',
    exchangeTitle: (required) => `Échange : choisissez les pertes\n(il faut ≥ ${required} de force d’attaque)`,
    exchangeRow: (checked, letter, unit, attack) => `${checked ? '☒' : '☐'} ${letter} — ${unit} (att ${attack})`,
    selectedForce: (sum, required, met) => `Force choisie : ${sum} / ${required}${met ? ' ✓' : ''}`,
    confirmLosses: 'Valider les pertes',
  },

  actions: {
    move: (unit) => `Déplacer ${unit}`,
    moveIntoContact: (unit) => `Déplacer ${unit} au contact`,
    turn: (unit) => `Pivoter ${unit}`,
    ram: (unit) => `Éperonner ${unit}`,
    board: (unit) => `Aborder ${unit}`,
    select: (unit) => `Choisir ${unit}`,
    deselect: (unit) => `Retirer ${unit}`,
    target: (unit) => `Cibler ${unit}`,
    untarget: (unit) => `Décibler ${unit}`,
    attackWith: (count) => `Attaquer avec ${count} unité(s)`,
  },

  results: {
    AE: 'AE — attaquant éliminé',
    AR: 'AR — attaquant recule',
    DE: 'DE — défenseur éliminé',
    DR: 'DR — défenseur recule',
    EX: 'EX — échange',
  },

  log: {
    gameLoaded: 'Partie chargée.',
    waitComputerSave: 'Attendez la fin du tour de l’ordinateur avant de sauvegarder ou de charger.',
    resolvePendingSave: 'Résolvez d’abord la retraite ou la dérive en attente avant de sauvegarder ou de charger.',
    waitComputerEnd: 'Attendez la fin du tour de l’ordinateur avant de terminer la partie.',
    resolvePendingEnd: 'Résolvez d’abord la retraite ou la dérive en attente avant de terminer la partie.',
    alreadyEnding: 'La partie se termine déjà après cette manche.',
    willEnd: 'La partie se terminera quand chaque joueur aura fini cette manche.',
    cantUndoComputer: 'Impossible d’annuler pendant le tour de l’ordinateur.',
    resolvePendingUndo: 'Résolvez d’abord la retraite ou la dérive en attente avant d’annuler.',
    nothingToUndo: 'Rien à annuler.',
    undone: (label) => `Annulé : ${label}`,
    cantRedoComputer: 'Impossible de rétablir pendant le tour de l’ordinateur.',
    resolvePendingRedo: 'Résolvez d’abord la retraite ou la dérive en attente avant de rétablir.',
    nothingToRedo: 'Rien à rétablir.',
    redone: (label) => `Rétabli : ${label}`,
    charges: (unit) => `L’unité ${unit} charge !`,
    noMovementToRotate: 'Plus de mouvement pour pivoter.',
    alreadyAttacked: (unit) => `L’unité ${unit} a déjà attaqué pendant cette phase.`,
    alreadyRammed: (unit) => `L’unité ${unit} a déjà éperonné ce tour et ne peut pas aussi aborder.`,
    cantReachTargets: (unit) => `L’unité ${unit} ne peut pas atteindre la ou les cibles actuelles.`,
    noCommonTarget: (unit) => `L’unité ${unit} n’a aucune cible possible en commun avec le groupe actuel.`,
    removedFromCombat: (units) => `Retiré du combat (plus rien à portée) : ${units.join(', ')}.`,
    alreadyAttackedTarget: (unit) => `L’unité ${unit} a déjà été attaquée pendant cette phase.`,
    notBoardable: (unit) => `L’unité ${unit} n’est pas adjacente avec une orientation parallèle — cible d’abordage illégale.`,
    singleTargetOnly: 'Mode un seul défenseur : une seule cible par attaque — résolvez-la ou retirez-la d’abord.',
    cavalryCantAttack: (unit) => `L’unité ${unit} ne peut pas être attaquée par la cavalerie — retirez d’abord la cavalerie du groupe.`,
    notReachable: (unit) => `L’unité ${unit} n’est pas atteignable par le groupe d’attaque actuel.`,
    advances: (unit) => `L’unité ${unit} avance dans l’hexagone libéré.`,
    resolvePendingAttack: 'Résolvez d’abord la retraite ou la dérive en attente avant une nouvelle attaque.',
    selectAttacker: 'Choisissez d’abord au moins une unité attaquante.',
    navalImmediate: 'Les attaques navales se résolvent immédiatement quand vous choisissez une cible.',
    selectTarget: 'Choisissez au moins une cible.',
    exchangeSacrificed: (units) => `Échange : défenseur(s) détruit(s) ; sacrifié(s) : ${units.join(', ') || 'aucun'}.`,
    selectMoreForce: (required) => `Choisissez des unités totalisant au moins ${required} de force d’attaque avant de valider.`,
    waitComputerPhase: 'Attendez la fin du tour de l’ordinateur avant de terminer la phase.',
    resolvePendingPhase: 'Résolvez d’abord la retraite ou la dérive en attente avant de terminer la phase.',
    computerError: 'Le joueur ordinateur a rencontré une erreur et s’est arrêté. Voir la console.',
    computerMoves: (seat, unit, q, r) => `${seat} : l’unité ${unit} se déplace en (${q}, ${r}).`,
    computerTurns: (seat, unit) => `${seat} : l’unité ${unit} pivote.`,
    tramples: (drifting, occupant, q, r) => `L’unité ${drifting} piétine l’unité ${occupant} en (${q}, ${r}).`,
    retreats: (unit) => `L’unité ${unit} recule.`,
    retreatsMakingRoom: (pushed, unit) => `L’unité ${pushed} recule pour faire de la place à l’unité ${unit}.`,
    eliminatedNowhere: (unit) => `L’unité ${unit} n’avait nulle part où reculer et a été éliminée.`,
    mustRetreatRoom: (unit) => `L’unité ${unit} doit reculer pour faire de la place — cliquez sur un hexagone en surbrillance.`,
    mustRetreat: (unit) => `L’unité ${unit} doit reculer — cliquez sur un hexagone en surbrillance.`,
    nowhereToRetreat: (unit, count) =>
      `L’unité ${unit} n’a nulle part où reculer — ${count === 1 ? 'une unité amie voisine peut' : `${count} unités amies voisines peuvent`} faire de la place. Cliquez sur l’une d’elles pour la repousser.`,
    terrainModifier: (value, terrain, q, r) =>
      `${value} ${terrain}${q === null || r === null ? '' : ` en (${q}, ${r})`}`,
    riverModifier: (value) => `${value} traversée de rivière`,
    combatReport: (r) =>
      [
        `ATTAQUANTS (total ${r.attackTotal}) :`,
        ...r.attackers.map((l) => `  ${l.unit} (att ${l.force})`),
        `DÉFENSEURS (total ${r.defenseTotal}) :`,
        ...r.defenders.map((l) => `  ${l.unit} (déf ${l.force})`),
        `Rapport : ${r.ratio} (colonne « ${r.crtColumn} » de la table des résultats, colonne ${r.columnNumber} sur ${r.columnCount}, indice ${r.columnIndex})`,
        (r.modifier !== 0
          ? `Dé : ${r.dieRaw} + ${r.modifier} (${r.modifierParts.join(' + ')}) = ${r.dieModified}`
          : `Dé : ${r.dieRaw}`) + (r.dieUsed !== null ? ` (retenu : ${r.dieUsed})` : ''),
        `Résultat : ${r.result}`,
        ...(r.exchangeThreshold !== null
          ? [
              `Seuil d’échange : l’attaquant doit sacrifier des unités totalisant au moins ${r.exchangeThreshold} d’attaque (la force totale des défenseurs).`,
            ]
          : []),
      ].join('\n'),
    ramReport: (r) =>
      [
        `Éperonnage : ${r.attacker} contre ${r.defender}, bonus +${r.bonus} (${r.unusedMovement} point${r.unusedMovement === 1 ? '' : 's'} de mouvement inutilisé${r.unusedMovement === 1 ? '' : 's'})`,
        `Réussit sur : ${r.successRange}   (ligne imprimée du tableau : ${r.printedRange}${
          r.note === 'everyFace'
            ? ' — le bonus porte la borne haute à la 6e face du d6 : tous les jets réussissent'
            : r.note === 'bonus'
              ? ` — le bonus +${r.bonus} étend la borne haute`
              : ''
        })`,
        `Dé : ${r.die} -> ${r.hit ? 'NAVIRE COULÉ !' : 'raté'}`,
      ].join('\n'),
    boardingReport: (r) =>
      [
        `Abordage : ${r.attacker.unit} (attaque ${r.attacker.forceBefore}) contre ${r.defender.unit} (défense ${r.defender.forceBefore})`,
        `Colonne de la table des résultats : « ${r.column} » (colonne ${r.columnNumber} sur ${r.columnCount}, indice ${r.columnIndex})`,
        r.side !== null
          ? `Dé : ${r.die} -> ${r.side === 'attacker' ? 'l’attaquant' : 'le défenseur'} perd ${r.loss} point${r.loss > 1 ? 's' : ''} d’équipage`
          : `Dé : ${r.die} -> aucun effet décisif`,
        ...(r.attackerSunk ? [`  L’unité ${r.attacker.unit} est COULÉE !`] : []),
        ...(r.defenderSunk ? [`  L’unité ${r.defender.unit} est COULÉE !`] : []),
        `  ${r.attacker.unit} (attaquant) : ${r.attacker.before}/${r.attacker.max} -> ${r.attacker.after}/${r.attacker.max} d’équipage (attaque ${r.attacker.forceBefore} -> ${r.attacker.forceAfter})`,
        `  ${r.defender.unit} (défenseur) : ${r.defender.before}/${r.defender.max} -> ${r.defender.after}/${r.defender.max} d’équipage (défense ${r.defender.forceBefore} -> ${r.defender.forceAfter})`,
      ].join('\n'),
  },

  saves: {
    panelManage: 'Sauvegarder / Charger',
    panelLoad: 'Charger une partie sauvegardée',
    autosave: 'Sauvegarde auto',
    slot: (n) => `Emplacement ${n}`,
    exportFile: 'Exporter vers un fichier',
    importFile: 'Importer un fichier',
    save: 'Sauver',
    load: 'Charger',
    delete: 'Effacer',
    empty: '— vide —',
    summary: (turn, who, phase) => `Tour ${turn} — ${who} (${phase})`,
    summaryUnknown: 'inconnu',
    loading: 'Chargement…',
    unreachable: 'Le serveur du jeu ne répond pas.',
    savingFailed: 'Le serveur du jeu ne répond pas — rien n’a été sauvegardé.',
    loadingFailed: 'Le serveur du jeu ne répond pas — rien n’a été chargé.',
    deletingFailed: 'Le serveur du jeu ne répond pas — rien n’a été effacé.',
    autosaveFailed: 'Échec de la sauvegarde auto : le serveur du jeu ne répond pas.',
    copyBrowserSaves: 'Copier les sauvegardes du navigateur',
    copyStopped: (copied) =>
      `Sauvegardes du navigateur copiées vers des fichiers : ${copied}, puis le serveur du jeu a cessé de répondre.`,
    copiedBrowserSaves: (copied, skipped) =>
      `Sauvegardes du navigateur copiées vers des fichiers : ${copied}, ignorées : ${skipped}.`,
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
