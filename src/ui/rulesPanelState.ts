import type { RulesTab } from './rulesPanel';

/**
 * Whether the Tables panel is drawn (§55), apart from Phaser: the player's
 * wish, open or closed and which tab. Nothing else changes it (§84 removed the
 * suppression while a decision is pending): the panel is as available during a
 * retreat, push, advance, exchange or drift as outside one.
 */
export class RulesPanelState {
  private wantOpen = false;
  tab: RulesTab | null = null;

  /** True when the panel should be on screen. */
  get shown(): boolean {
    return this.wantOpen;
  }

  /** Opens on `defaultTab` the first time, then the last tab chosen. */
  open(defaultTab: RulesTab): void {
    if (this.wantOpen) return;
    this.wantOpen = true;
    this.tab ??= defaultTab;
  }

  close(): void {
    this.wantOpen = false;
  }

  toggle(defaultTab: RulesTab): void {
    if (this.wantOpen) this.close();
    else this.open(defaultTab);
  }

  setTab(tab: RulesTab): void {
    this.tab = tab;
  }

  reset(): void {
    this.wantOpen = false;
    this.tab = null;
  }
}
