import type { RulesTab } from './rulesPanel';

/**
 * Whether the Tables panel is drawn (§55), apart from Phaser. The player's
 * wish (open or closed, which tab) is kept separate from a suppression the
 * Board applies while a decision is pending: suppressed, the panel is hidden
 * and its controls do nothing, and when the suppression ends it is back as it
 * was, open or closed, on the same tab.
 */
export class RulesPanelState {
  private wantOpen = false;
  private suppressed = false;
  tab: RulesTab | null = null;

  /** True when the panel should be on screen. */
  get shown(): boolean {
    return this.wantOpen && !this.suppressed;
  }

  /** Opens on `defaultTab` the first time, then the last tab chosen. Ignored while suppressed. */
  open(defaultTab: RulesTab): void {
    if (this.suppressed || this.wantOpen) return;
    this.wantOpen = true;
    this.tab ??= defaultTab;
  }

  close(): void {
    if (this.suppressed) return;
    this.wantOpen = false;
  }

  toggle(defaultTab: RulesTab): void {
    if (this.wantOpen) this.close();
    else this.open(defaultTab);
  }

  setTab(tab: RulesTab): void {
    if (this.suppressed) return;
    this.tab = tab;
  }

  setSuppressed(suppressed: boolean): void {
    this.suppressed = suppressed;
  }

  reset(): void {
    this.wantOpen = false;
    this.suppressed = false;
    this.tab = null;
  }
}
