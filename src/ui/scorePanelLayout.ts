import { playerScores } from '../engine/score';
import { currentPlayer, type GameState, type PlayerId } from '../engine/state';
import { PLAYER_COLORS_HEX } from './hexRender';
import type { Messages } from './i18n';
import type { Rect } from './rulesPanelLayout';

/**
 * Where the Board's score panel sits and what its rows say (§81). Pure, so a
 * test can pin that it stays clear of the Tables panel, the prompts and the
 * left side panel, and that every figure comes from the engine's
 * `playerScores`. `scorePanel.ts` only draws it.
 */
export const SCORE_PANEL_W = 300;
export const SCORE_ROW_H = 18;
export const SCORE_HEADER_H = 32;
const MARGIN_RIGHT = 12;
const MARGIN_BOTTOM = 8;

/** Bottom right of the game area; grows upward with the player count. */
export function scorePanelRect(canvasWidth: number, canvasHeight: number, playerCount: number): Rect {
  const height = SCORE_HEADER_H + SCORE_ROW_H * playerCount;
  return {
    left: canvasWidth - MARGIN_RIGHT - SCORE_PANEL_W,
    top: canvasHeight - MARGIN_BOTTOM - height,
    width: SCORE_PANEL_W,
    height,
  };
}

export interface ScoreRow {
  playerId: PlayerId;
  color: string;
  name: string;
  points: string;
  /** The naval bonus note, or null when the player does not hold the bonus. */
  atSea: string | null;
  units: string;
  active: boolean;
}

/** One row per player in id order (never sorted), from the engine's figures. */
export function scorePanelRows(state: GameState, t: Messages): ScoreRow[] {
  const activeId = currentPlayer(state).id;
  return playerScores(state).map((s) => ({
    playerId: s.playerId,
    color: PLAYER_COLORS_HEX[s.playerId]!,
    name: state.players.find((p) => p.id === s.playerId)!.name,
    points: t.board.scorePoints(s.score),
    atSea: s.navalBonus > 0 ? t.board.scoreAtSea : null,
    units: t.board.scoreUnits(s.unitsLeft),
    active: s.playerId === activeId,
  }));
}
