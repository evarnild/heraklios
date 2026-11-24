/**
 * §83: the Board's End-phase warning. Clicking End phase in a human seat's
 * movement phase with units that have not moved (and could) opens this
 * instead: the camera frames those units, each gets a magenta mark, and a
 * prompt over the top of the log offers "End phase anyway" or "Cancel" and a
 * "Don't warn me again this game" box. The rules (which units, the framing
 * math, when it is due) are in `engine/unmoved.ts`, `cameraFraming.ts` and
 * `endMoveWarningLayout.ts`; this file is only the Phaser part.
 *
 * While open the scene's `decisionPending` is held (through `setPending`), so
 * every pending-choice guard covers it (undo, redo, save/load, end game, end
 * phase, board clicks, autosave and the Tables suppression).
 *
 * I5: "switch off" is per seat, in memory only (not in `GameState`, the save
 * file or `localStorage`), and cleared by `reset()`, which the scene runs in
 * `resetSceneState`: a new game, a load or an abandon warns again.
 */
import Phaser from 'phaser';
import type { ActionContext } from '../engine/actions';
import { currentPlayer, type GameState, type Unit } from '../engine/state';
import { isAiSeat } from '../engine/seatControl';
import { unmovedUnits } from '../engine/unmoved';
import { boxAround } from './cameraFraming';
import { MARK, endMoveWarningRect, warningDue } from './endMoveWarningLayout';
import { HEX_SIZE } from './hexRender';
import { messages } from './i18n';
import { logPanelBounds } from './logHistory';
import type { MapView } from './MapView';
import { SIDE_PANEL_WIDTH } from './rulesPanelLayout';
import { seatControlFor } from './session';
import { onKeyOnce } from './shortcutKeys';

const PROMPT_DEPTH = 31;
const TEXT_COLOR = '#e8d9b0';
const FONT = '13px';

export interface EndMoveWarningSnapshot {
  open: boolean;
  flagged: string[];
  marked: string[];
  switchedOff: number[];
}

export class EndMoveWarning {
  private readonly switchedOff = new Set<number>();
  private isOpen = false;
  private flagged: Unit[] = [];
  private marks: Phaser.GameObjects.Graphics | null = null;
  private prompt: Phaser.GameObjects.GameObject[] = [];
  private saved: { zoom: number; scrollX: number; scrollY: number } | null = null;
  private ticked = false;
  private onConfirm: (() => void) | null = null;
  private seat = 0;
  private seatName = '';

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly mapView: MapView,
    private readonly setPending: (on: boolean) => void,
    private readonly log: (text: string) => void,
  ) {
    // Both keys are no-ops while closed. A scene that shuts down with the
    // warning open must not leave a stale open state for these listeners.
    onKeyOnce(scene.input.keyboard, 'keydown-ESC', () => this.close(false));
    onKeyOnce(scene.input.keyboard, 'keydown-ENTER', () => this.close(true));
    scene.events.once('shutdown', () => this.reset());
  }

  /**
   * Opens the warning if it is due (B3) and returns true; returns false,
   * doing nothing else, when the phase should simply end. `onOpen` runs only
   * when it opens (the scene clears its movement selection); `onConfirm`
   * runs after "End phase anyway", once the warning is fully closed.
   */
  open(state: GameState, context: ActionContext, onConfirm: () => void, onOpen: () => void): boolean {
    const seat = state.seatOrder[state.activePlayerIndex]!;
    const flagged = unmovedUnits(state, context);
    const due = warningDue({
      human: !isAiSeat(seatControlFor(seat)),
      switchedOff: this.switchedOff.has(seat),
      flaggedCount: flagged.length,
    });
    if (!due || this.isOpen) return false;

    onOpen();
    this.isOpen = true;
    this.setPending(true);
    this.flagged = flagged;
    this.seat = seat;
    this.seatName = currentPlayer(state).name;
    this.onConfirm = onConfirm;
    this.ticked = false;
    this.saved = this.mapView.cameraView();
    const centres = flagged.map((u) => this.mapView.toScreen(u.position));
    this.mapView.frameWorldBox(boxAround(centres, HEX_SIZE));
    this.drawMarks(centres);
    this.drawPrompt(flagged.length);
    return true;
  }

  /** Forgets every switch-off and drops any open warning; never touches the camera. */
  reset(): void {
    this.destroyDrawn();
    this.isOpen = false;
    this.flagged = [];
    this.onConfirm = null;
    this.saved = null;
    this.switchedOff.clear();
  }

  snapshot(): EndMoveWarningSnapshot {
    return {
      open: this.isOpen,
      flagged: this.flagged.map((u) => u.id),
      // One mark per flagged unit, drawn in one Graphics object.
      marked: this.marks ? this.flagged.map((u) => u.id) : [],
      switchedOff: [...this.switchedOff],
    };
  }

  private drawMarks(centres: Array<{ x: number; y: number }>): void {
    const zoom = this.scene.cameras.main.zoom;
    const w = MARK.width / zoom;
    const h = MARK.height / zoom;
    const g = this.scene.add.graphics().setDepth(MARK.depth);
    g.fillStyle(MARK.fill, 1);
    g.lineStyle(MARK.outline / zoom, MARK.line, 1);
    for (const c of centres) {
      g.fillRect(c.x - w / 2, c.y - h / 2, w, h);
      g.strokeRect(c.x - w / 2, c.y - h / 2, w, h);
    }
    this.mapView.keepOffHud([g]);
    this.marks = g;
  }

  private drawPrompt(count: number): void {
    const t = messages();
    const { height } = this.scene.scale;
    const r = endMoveWarningRect(logPanelBounds(height, SIDE_PANEL_WIDTH));
    const pad = 10;
    const add = this.scene.add;
    const bg = add
      .rectangle(r.left, r.top, r.width, r.height, 0x1a1408, 0.98)
      .setOrigin(0, 0)
      .setScrollFactor(0)
      .setDepth(PROMPT_DEPTH)
      .setStrokeStyle(1, 0xe040fb, 1)
      .setInteractive();
    bg.on('pointerdown', () => {
      /* swallow: a click on the prompt never reaches the log beneath */
    });
    const message = add
      .text(r.left + pad, r.top + pad, `${t.board.unmovedCount(count)}\n${t.board.unmovedQuestion}`, {
        fontSize: FONT,
        color: TEXT_COLOR,
        wordWrap: { width: r.width - 2 * pad },
      })
      .setScrollFactor(0)
      .setDepth(PROMPT_DEPTH + 1);
    const tick = add
      .text(r.left + pad, r.top + 62, t.board.warnOff(false), { fontSize: FONT, color: TEXT_COLOR })
      .setScrollFactor(0)
      .setDepth(PROMPT_DEPTH + 1)
      .setInteractive({ useHandCursor: true });
    tick.on('pointerdown', () => {
      this.ticked = !this.ticked;
      tick.setText(messages().board.warnOff(this.ticked));
    });
    const y = r.top + r.height - 12;
    const confirmBtn = this.button(r.left + pad, y, t.board.endPhaseAnyway, '#5a2a2a', 0, () => this.close(true));
    const cancelBtn = this.button(r.left + r.width - pad, y, t.common.cancel, '#2a5a2a', 1, () => this.close(false));
    this.prompt = [bg, message, tick, confirmBtn, cancelBtn];
    this.mapView.excludeFromMainCamera(this.prompt);
  }

  private button(
    x: number,
    y: number,
    label: string,
    background: string,
    originX: number,
    onClick: () => void,
  ): Phaser.GameObjects.Text {
    const btn = this.scene.add
      .text(x, y, label, { fontSize: FONT, color: '#fff', backgroundColor: background, padding: { x: 8, y: 6 } })
      .setOrigin(originX, 1)
      .setScrollFactor(0)
      .setDepth(PROMPT_DEPTH + 1)
      .setInteractive({ useHandCursor: true });
    btn.on('pointerdown', onClick);
    return btn;
  }

  private destroyDrawn(): void {
    this.marks?.destroy();
    this.marks = null;
    for (const o of this.prompt) o.destroy();
    this.prompt = [];
  }

  /**
   * Closes the warning: restores the camera, logs the switch-off if ticked,
   * releases the scene's pending flag (in a `finally`, so a throw can never
   * leave every guard shut), then, if confirmed, ends the phase. The order
   * puts the switch-off line under the ending player's heading and lets the
   * autosave inside the phase change run.
   */
  private close(confirmed: boolean): void {
    if (!this.isOpen) return;
    const onConfirm = this.onConfirm;
    try {
      this.destroyDrawn();
      if (this.saved) this.mapView.setCameraView(this.saved);
      if (this.ticked) {
        this.switchedOff.add(this.seat);
        this.log(messages().log.endMoveWarningOff(this.seatName));
      }
    } finally {
      this.isOpen = false;
      this.flagged = [];
      this.onConfirm = null;
      this.saved = null;
      this.setPending(false);
    }
    if (confirmed) onConfirm?.();
  }
}
