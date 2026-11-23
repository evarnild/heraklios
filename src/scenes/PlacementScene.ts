import Phaser from 'phaser';
import { MapView, drawFacingArrowhead, unitTooltipFor } from '../ui/MapView';
import { PLAYER_COLORS_HEX } from '../ui/hexRender';
import { legalDeploymentHexes, legalNavalDeploymentHexes } from '../ui/mapBounds';
import { session, buildPlayers, resetToMenu } from '../ui/session';
import { skipAiPlacementSeats } from '../ui/aiSetup';
import { showConfirmDialog } from '../ui/confirmDialog';
import { messages } from '../ui/i18n';
import { edgeName, unitName } from '../ui/i18n/names';
import { createInitialState } from '../engine/turnManager';
import { History } from '../engine/history';
import { unitCategory } from '../engine/movement';
import type { GameState } from '../engine/state';
import { deployUnit } from '../engine/deployment';
import { getUnitType } from '../data/units';
import { canEnterTerrain } from '../data/terrain';
import { MAP_TERRAIN, hexKey } from '../data/map';
import type { HexCoord } from '../data/map';
import { createViewToggle } from '../ui/viewToggle';
import type { FacingShip } from '../ui/boardView';
import { placementFacingShips, placementUnitDrawings, type PendingShip } from '../ui/placementDrawings';
import { bindUndoRedoKeys } from '../ui/shortcutKeys';

interface QueueItem {
  typeId: string;
  remaining: number;
}

/** Everything a placement undo has to put back — the board plus this scene's
 * own placing progress. See engine/history.ts for why this is snapshot-based.
 * Any in-progress ship-facing pick is deliberately NOT part of this: a
 * pending ship is, by definition, not committed to `state` yet — undoing
 * simply cancels it (see `undo`/`redo` below). */
interface PlacementSnapshot {
  state: GameState;
  queue: QueueItem[];
}

export class PlacementScene extends Phaser.Scene {
  private playerIndex = 0;
  private mapView!: MapView;
  /** Hexes this player may currently place a LAND unit on — the full
   * 3-hex-deep band along their edge, minus any hex too close to another
   * army's already-placed units (see `mapBounds.ts`'s `legalDeploymentHexes`).
   * Computed once in `create`: enemy positions don't change again until the
   * next player's turn starts. */
  private legalLandHexes: HexCoord[] = [];
  /** Same idea as `legalLandHexes`, but for ships: the player's assigned
   * named bay (see `mapBounds.ts`'s `legalNavalDeploymentHexes`), not the
   * land band — a fleet deploys in a specific sea zone, never on land. */
  private legalSeaHexes: HexCoord[] = [];
  /** Which domain's legal-hex set is currently highlighted on the map, so
   * `refreshPlacementHighlight` only re-centers the camera when the player's
   * queue actually crosses from land units to ships or back, not on every
   * single placement. */
  private highlightedDomain: 'land' | 'naval' | null = null;
  private queue: QueueItem[] = [];
  private infoText!: Phaser.GameObjects.Text;
  private skipBtn!: Phaser.GameObjects.Text;
  private undoBtn!: Phaser.GameObjects.Text;
  private redoBtn!: Phaser.GameObjects.Text;
  private abandonBtn!: Phaser.GameObjects.Text;
  /** Scoped to the current player: cleared in `create`, which re-runs on each
   * per-player `scene.start('Placement', ...)`. */
  private history = new History<PlacementSnapshot>();

  // --- Ship-facing choice at deployment (Feature C) ---
  /** A ship the player has clicked a hex for but not yet confirmed — lets
   * them pick its initial facing (reusing the Movement phase's rotate
   * buttons and facing-arrow overlay, see BoardScene's `rotateSelectedShip`)
   * before it's actually added to `state.units`. */
  private pendingShip: PendingShip | null = null;
  private rotateCCWBtn!: Phaser.GameObjects.Text;
  private rotateCWBtn!: Phaser.GameObjects.Text;
  /** Post-turn-facing arrowhead icons beside the Turn buttons — same
   * plan.md §17.2 rework as BoardScene's, see its `refreshTurnGlyphs`. */
  private turnCcwGlyph!: Phaser.GameObjects.Graphics;
  private turnCwGlyph!: Phaser.GameObjects.Graphics;
  private confirmShipBtn!: Phaser.GameObjects.Text;
  private cancelShipBtn!: Phaser.GameObjects.Text;

  constructor() {
    super('Placement');
  }

  init(data: { playerIndex: number }): void {
    this.playerIndex = data.playerIndex;
  }

  create(): void {
    if (this.playerIndex === 0 || !session.gameState) {
      session.gameState = createInitialState(
        buildPlayers(),
        session.combatMode,
        session.randomizedTurnOrder,
        session.clockLimitMs,
        session.roundLimit,
        session.allowSwaps,
      );
    }
    // An AI seat deploys itself (ui/aiSetup.ts) — same legal hexes, same
    // terrain rule, same unit shape a human's clicks would produce. Done here,
    // after the state exists, so the whole run of AI seats is placed in one
    // pass and this scene only ever renders for a seat a human actually
    // plays; with every seat an AI, the Board is next.
    const firstHumanSeat = skipAiPlacementSeats(session.gameState!, this.playerIndex);
    if (firstHumanSeat === null) {
      this.scene.start('Board');
      return;
    }
    this.playerIndex = firstHumanSeat;

    this.pendingShip = null;
    this.history.clear();

    const { width, height } = this.scale;
    const t = messages();
    const player = session.gameState!.players[this.playerIndex]!;
    const enemyHexes = session.gameState!.units.filter((u) => u.owner !== this.playerIndex).map((u) => u.position);
    this.legalLandHexes = legalDeploymentHexes(player.edge, enemyHexes);
    this.legalSeaHexes = legalNavalDeploymentHexes(player.edge, enemyHexes);
    this.highlightedDomain = null;

    const titleText = this.add
      .text(width / 2, 20, t.placement.title(player.name, edgeName(player.edge)), {
        fontSize: '18px',
        color: '#e8d9b0',
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(30);

    this.mapView = new MapView(this, width, height);
    this.mapView.onHexClick = (hex) => this.handleHexClick(hex);
    this.mapView.unitTooltipAt = (hex) => unitTooltipFor(session.gameState!, hex, { state: false });
    this.infoText = this.add
      .text(20, height - 40, '', {
        fontSize: '15px',
        color: '#ffe08a',
        backgroundColor: '#1a1a1a',
        padding: { x: 8, y: 4 },
      })
      .setScrollFactor(0)
      .setDepth(30);

    this.skipBtn = this.add
      .text(width - 140, height - 40, t.placement.donePlacing, {
        fontSize: '15px',
        color: '#fff',
        backgroundColor: '#2a5a2a',
        padding: { x: 10, y: 6 },
      })
      .setScrollFactor(0)
      .setDepth(30)
      .setInteractive({ useHandCursor: true });
    this.skipBtn.on('pointerdown', () => this.finishPlayer());

    this.abandonBtn = this.add
      .text(width - 20, 20, t.common.abandon, {
        fontSize: '13px',
        color: '#fff',
        backgroundColor: '#5a2a2a',
        padding: { x: 8, y: 4 },
      })
      .setOrigin(1, 0.5)
      .setScrollFactor(0)
      .setDepth(30)
      .setInteractive({ useHandCursor: true });
    this.abandonBtn.on('pointerdown', () => this.confirmAbandon());

    this.undoBtn = this.add
      .text(20, height - 104, t.common.undo, {
        fontSize: '13px',
        color: '#fff',
        backgroundColor: '#3a3a55',
        padding: { x: 8, y: 4 },
      })
      .setScrollFactor(0)
      .setDepth(30)
      .setInteractive({ useHandCursor: true });
    this.undoBtn.on('pointerdown', () => this.undo());

    this.redoBtn = this.add
      .text(20, height - 72, t.common.redo, {
        fontSize: '13px',
        color: '#fff',
        backgroundColor: '#3a3a55',
        padding: { x: 8, y: 4 },
      })
      .setScrollFactor(0)
      .setDepth(30)
      .setInteractive({ useHandCursor: true });
    this.redoBtn.on('pointerdown', () => this.redo());

    // --- Ship-facing controls (hidden except while a ship is pending) ---
    // Plain "Turn" labels (plan.md §17.2, same rework as BoardScene's Turn
    // buttons — see `refreshTurnGlyphs`): the old static ⟲/⟳ glyphs are
    // replaced by `turnCcwGlyph`/`turnCwGlyph`, arrowhead icons showing the
    // facing each button will actually turn the pending ship to.
    // facing + 1 is counter-clockwise on screen (see hexToPixel): the left
    // button sends +1, the right one -1 (§40).
    this.rotateCCWBtn = this.add
      .text(width / 2 - 90, height - 104, t.common.turn, {
        fontSize: '13px',
        color: '#fff',
        backgroundColor: '#3a3a55',
        padding: { x: 8, y: 4 },
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(30)
      .setInteractive({ useHandCursor: true });
    this.rotateCCWBtn.on('pointerdown', () => this.rotatePendingShip(1));

    this.rotateCWBtn = this.add
      .text(width / 2 + 90, height - 104, t.common.turn, {
        fontSize: '13px',
        color: '#fff',
        backgroundColor: '#3a3a55',
        padding: { x: 8, y: 4 },
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(30)
      .setInteractive({ useHandCursor: true });
    this.rotateCWBtn.on('pointerdown', () => this.rotatePendingShip(-1));

    // Depth 31: one above the buttons (30), so the arrowhead icons draw on
    // top of the button backgrounds they sit beside.
    this.turnCcwGlyph = this.add.graphics().setScrollFactor(0).setDepth(31);
    this.turnCwGlyph = this.add.graphics().setScrollFactor(0).setDepth(31);

    this.confirmShipBtn = this.add
      .text(width / 2, height - 104, t.placement.confirmFacing, {
        fontSize: '13px',
        color: '#fff',
        backgroundColor: '#2a5a2a',
        padding: { x: 8, y: 4 },
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(30)
      .setInteractive({ useHandCursor: true });
    this.confirmShipBtn.on('pointerdown', () => this.confirmPendingShip());

    this.cancelShipBtn = this.add
      .text(width / 2, height - 72, t.common.cancel, {
        fontSize: '12px',
        color: '#fff',
        backgroundColor: '#5a2a2a',
        padding: { x: 8, y: 4 },
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(30)
      .setInteractive({ useHandCursor: true });
    this.cancelShipBtn.on('pointerdown', () => this.cancelPendingShip());

    bindUndoRedoKeys(this.input.keyboard, { undo: () => this.undo(), redo: () => this.redo() });

    const viewToggle = createViewToggle(this, 20, height - 136, this.mapView);

    this.mapView.pinUIObjects([
      titleText,
      viewToggle,
      this.infoText,
      this.skipBtn,
      this.abandonBtn,
      this.undoBtn,
      this.redoBtn,
      this.rotateCCWBtn,
      this.rotateCWBtn,
      this.turnCcwGlyph,
      this.turnCwGlyph,
      this.confirmShipBtn,
      this.cancelShipBtn,
    ]);

    const selection = session.armySelections[this.playerIndex]!;
    this.queue = Object.entries(selection)
      .filter(([, count]) => count > 0)
      .map(([typeId, count]) => ({ typeId, remaining: count }));

    this.refreshPlacementHighlight();
    this.updateInfo();
    this.refreshUndoRedoButtons();
    this.refreshShipControls();
    // The first frame already shows the seats that placed before this one (B1, B8).
    this.redrawPlacedUnits();
  }

  private captureSnapshot(): PlacementSnapshot {
    return {
      state: structuredClone(session.gameState!),
      queue: structuredClone(this.queue),
    };
  }

  private restoreSnapshot(snapshot: PlacementSnapshot): void {
    session.gameState = structuredClone(snapshot.state);
    this.queue = structuredClone(snapshot.queue);
    this.redrawPlacedUnits();
    this.refreshPlacementHighlight();
    this.updateInfo();
    this.refreshUndoRedoButtons();
  }

  /** Draws every placed unit from state: this seat's opaque, the other seats' dimmed (a choice of
   * this scene, not a rule: the rules hide nothing, `05-rules-french-original.md:91-96`; §74 spec
   * amendment, §76). A ship carries its facing so the Drawn view turns the galley. */
  private drawPlacedUnits(): void {
    // Placement never animates (§66 B13)
    this.mapView.setUnits(placementUnitDrawings(session.gameState!, this.playerIndex), 'snap');
  }

  /** Rebuilds every seat's units and facing arrows from state (on open, undo, redo). */
  private redrawPlacedUnits(): void {
    this.drawPlacedUnits();
    this.mapView.setFacingIndicators(this.shipArrowList());
  }

  private undo(): void {
    // A pending (unconfirmed) ship isn't part of any snapshot — cancel it
    // rather than leave a stale preview arrow pointing at nothing useful.
    this.cancelPendingShip();
    const entry = this.history.undo(this.captureSnapshot());
    if (!entry) return;
    this.restoreSnapshot(entry.payload);
  }

  private redo(): void {
    this.cancelPendingShip();
    const entry = this.history.redo(this.captureSnapshot());
    if (!entry) return;
    this.restoreSnapshot(entry.payload);
  }

  private refreshUndoRedoButtons(): void {
    const undoLabel = this.history.undoLabel;
    const redoLabel = this.history.redoLabel;
    this.undoBtn.setText(undoLabel ? messages().common.undoWith(undoLabel) : messages().common.undo);
    this.redoBtn.setText(redoLabel ? messages().common.redoWith(redoLabel) : messages().common.redo);
    this.undoBtn.setAlpha(this.history.canUndo ? 1 : 0.4);
    this.redoBtn.setAlpha(this.history.canRedo ? 1 : 0.4);
  }

  private currentItem(): QueueItem | undefined {
    return this.queue.find((q) => q.remaining > 0);
  }

  private updateInfo(): void {
    if (this.pendingShip) {
      this.infoText.setText(messages().placement.placingShip(unitName(this.pendingShip.typeId)));
      return;
    }
    const item = this.currentItem();
    if (!item) {
      this.infoText.setText(messages().placement.allPlaced);
      return;
    }
    this.infoText.setText(messages().placement.placing(unitName(item.typeId), item.remaining));
  }

  /** The legal-hex set for whatever the queue is currently placing — land
   * band or bay, per `legalLandHexes`/`legalSeaHexes` — or the land set as a
   * harmless default once the queue is empty (nothing more to click there).
   * Land units are further filtered by the same terrain-access rule
   * `engine/movement.ts` uses for movement (`data/terrain.ts`'s
   * `canEnterTerrain`): chariots/cavalry can't stand on a flanc-abrupt hex,
   * and chariots/cavalry/elephants can't stand on a marais hex, even at
   * initial deployment. */
  private currentLegalHexes(): HexCoord[] {
    const item = this.currentItem();
    if (!item) return this.legalLandHexes;
    const t = getUnitType(item.typeId);
    if (t.domain === 'naval') return this.legalSeaHexes;
    const category = unitCategory(item.typeId);
    return this.legalLandHexes.filter((h) => {
      const terrain = MAP_TERRAIN.get(hexKey(h.q, h.r));
      return terrain !== undefined && canEnterTerrain(terrain, category);
    });
  }

  /** Re-highlights the map for the current queue item's domain, re-centering
   * the camera only when the domain actually changed since the last call —
   * e.g. once a player's land units are all placed and the queue moves on to
   * ships, the highlight (and camera) jumps from the land band to the bay. */
  private refreshPlacementHighlight(): void {
    const item = this.currentItem();
    const domain: 'land' | 'naval' = item ? getUnitType(item.typeId).domain : 'land';
    const legal = this.currentLegalHexes();
    this.mapView.highlightHexes(legal, 0x30ff30, 0.35);
    if (domain !== this.highlightedDomain && legal[0]) this.mapView.centerOn(legal[0]);
    this.highlightedDomain = domain;
  }

  // --- Hex click routing ---

  private handleHexClick(hex: HexCoord): void {
    this.tryPlace(hex);
  }

  private tryPlace(hex: HexCoord): void {
    const item = this.currentItem();
    if (!item) return;
    const isLegal = this.currentLegalHexes().some((h) => h.q === hex.q && h.r === hex.r);
    if (!isLegal) return;
    const state = session.gameState!;
    const occupied = state.units.some((u) => !u.destroyed && u.position.q === hex.q && u.position.r === hex.r);
    if (occupied) return;

    const t = getUnitType(item.typeId);
    if (t.domain === 'naval') {
      // Ship facing is chosen before the unit is actually placed (Feature C)
      // — clicking a hex just stages it; re-clicking a different hex while
      // one is already pending simply relocates the preview, keeping
      // whatever facing was already picked.
      this.pendingShip = { hex, typeId: item.typeId, facing: this.pendingShip?.facing ?? 0 };
      this.refreshShipControls();
      this.mapView.setFacingIndicators(this.shipArrowList());
      this.updateInfo();
      return;
    }

    // The id comes from the engine (`deployUnit`): `p${seat}u${n}`, n being the
    // units the seat already has - no counter to keep alive across Phaser's
    // scene restarts or to put back on undo.
    const snapshot = this.captureSnapshot();
    if (!deployUnit(state, this.playerIndex, { typeId: item.typeId, hex }).ok) return;
    this.history.push(snapshot, messages().placement.placeAction(unitName(item.typeId)));
    item.remaining -= 1;
    this.drawPlacedUnits();
    this.refreshPlacementHighlight();
    this.updateInfo();
    this.refreshUndoRedoButtons();
  }

  // --- Ship-facing choice (Feature C) ---

  /** Every placed ship plus the staged ship, for one `setFacingIndicators` call
   * (the views draw only the staged one; a placed ship's mark dims with its counter). */
  private shipArrowList(): FacingShip[] {
    return placementFacingShips(session.gameState!, this.playerIndex, this.pendingShip);
  }

  private refreshShipControls(): void {
    const pending = !!this.pendingShip;
    this.rotateCCWBtn.setVisible(pending);
    this.rotateCWBtn.setVisible(pending);
    this.confirmShipBtn.setVisible(pending);
    this.cancelShipBtn.setVisible(pending);
    this.refreshTurnGlyphs();
  }

  /** Draws (or, with no ship pending, clears) the Turn buttons'
   * post-turn-facing arrowhead icons — same plan.md §17.2 rework as
   * BoardScene's `refreshTurnGlyphs`, reusing `drawFacingArrowhead`. */
  private refreshTurnGlyphs(): void {
    this.turnCcwGlyph.clear();
    this.turnCwGlyph.clear();
    const pending = this.pendingShip;
    if (!pending) return;
    const { width, height } = this.scale;
    const colorHex = PLAYER_COLORS_HEX[this.playerIndex] ?? '#ffffff';
    drawFacingArrowhead(this.turnCcwGlyph, { x: width / 2 - 120, y: height - 104 }, (pending.facing + 1) % 6, colorHex, 0.4);
    drawFacingArrowhead(this.turnCwGlyph, { x: width / 2 + 120, y: height - 104 }, (pending.facing + 5) % 6, colorHex, 0.4);
  }

  private rotatePendingShip(direction: 1 | -1): void {
    if (!this.pendingShip) return;
    this.pendingShip.facing = (this.pendingShip.facing + direction + 6) % 6;
    this.mapView.setFacingIndicators(this.shipArrowList());
    this.refreshTurnGlyphs();
  }

  private confirmPendingShip(): void {
    const pending = this.pendingShip;
    const item = this.currentItem();
    if (!pending || !item) return;
    const state = session.gameState!;
    const snapshot = this.captureSnapshot();
    if (!deployUnit(state, this.playerIndex, { typeId: pending.typeId, hex: pending.hex, facing: pending.facing }).ok) return;
    this.history.push(snapshot, messages().placement.placeAction(unitName(pending.typeId)));
    item.remaining -= 1;
    this.drawPlacedUnits();
    this.pendingShip = null;
    this.mapView.setFacingIndicators(this.shipArrowList());
    this.refreshShipControls();
    this.refreshPlacementHighlight();
    this.updateInfo();
    this.refreshUndoRedoButtons();
  }

  private cancelPendingShip(): void {
    if (!this.pendingShip) return;
    this.pendingShip = null;
    this.mapView.setFacingIndicators(this.shipArrowList());
    this.refreshShipControls();
    this.updateInfo();
  }

  private confirmAbandon(): void {
    showConfirmDialog({
      scene: this,
      message: messages().common.abandonMessage(messages().placement.abandonMessage),
      confirmLabel: messages().common.abandon,
      cancelLabel: messages().placement.keepPlacing,
      excludeFromMainCamera: (objects) => this.mapView.excludeFromMainCamera(objects),
      onConfirm: () => {
        resetToMenu();
        this.scene.start('Menu');
      },
    });
  }

  private finishPlayer(): void {
    this.cancelPendingShip();
    const nextIndex = this.playerIndex + 1;
    this.mapView.setUnits([], 'snap');
    if (nextIndex < session.playerCount) {
      this.scene.start('Placement', { playerIndex: nextIndex });
    } else {
      this.scene.start('Board');
    }
  }
}
