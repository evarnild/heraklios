/** A drift arrow's parameters, as the scene passes them. */
export interface DriftArrow<H> {
  hex: H;
  facing: number;
  colorHex: string;
}

/**
 * Holds an elephant's drift arrow while a unit animation plays (B9): the arrow
 * waits for the slide to end, and `release` (the queue drained) shows it. A
 * clear removes it at once, held or shown. Shared by both views; pure, no Phaser.
 */
export class HeldDriftArrow<H> {
  private held: DriftArrow<H> | null = null;

  constructor(
    private animating: () => boolean,
    private draw: (arrow: DriftArrow<H>) => void,
    private erase: () => void,
  ) {}

  set(arrow: DriftArrow<H>): void {
    if (this.animating()) {
      this.held = arrow;
      return;
    }
    this.held = null;
    this.draw(arrow);
  }

  clear(): void {
    this.held = null;
    this.erase();
  }

  /** The queue drained: show the held arrow, if any. */
  release(): void {
    const a = this.held;
    this.held = null;
    if (a) this.draw(a);
  }
}
