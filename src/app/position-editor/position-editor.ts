import { Component, computed, inject, input, signal } from '@angular/core';
import { ChartService } from '../chart.service';
import { EditableText } from '../editable-text/editable-text';
import { Candidate, Position, Presidency, Status, statusLabel } from '../models';
import {
  addProposed,
  promote,
  removeCandidate,
  renameCandidate,
  setPrimary,
  setStatus,
} from '../position-ops';
import { StatusPill } from '../status-pill/status-pill';

/**
 * One position: the primary name box with its status pill, the additional
 * names with promote arrows, and the line for adding another name.
 * Used by both the chart and the focused view; the views set the sizes.
 */
@Component({
  selector: 'app-position-editor',
  imports: [EditableText, StatusPill],
  templateUrl: './position-editor.html',
  styleUrl: './position-editor.scss',
})
export class PositionEditor {
  readonly orgId = input.required<string>();
  readonly presidency = input.required<Presidency>();
  readonly pos = input.required<Position>();
  /** How many additional names to show before "+X more…"; null shows all. */
  readonly maxVisible = input<number | null>(2);

  private readonly service = inject(ChartService);
  protected readonly statusLabel = statusLabel;
  private readonly expanded = signal(false);

  protected readonly visible = computed<Candidate[]>(() => {
    const max = this.maxVisible();
    const list = this.pos().proposed;
    return max === null || this.expanded() ? list : list.slice(0, max);
  });

  protected readonly hiddenCount = computed(
    () => this.pos().proposed.length - this.visible().length,
  );

  protected expand(): void {
    this.expanded.set(true);
  }

  protected rename(candidate: Candidate, name: string): void {
    this.update((pos) =>
      name ? renameCandidate(pos, candidate.id, name) : removeCandidate(pos, candidate.id),
    );
  }

  /** Typing into an empty primary box fills it directly as "Consider". */
  protected setPrimary(name: string): void {
    if (name) this.update((pos) => setPrimary(pos, name));
  }

  protected add(name: string): void {
    if (name) this.update((pos) => addProposed(pos, name));
  }

  /** Moves an additional name into the primary spot; the current primary drops to the top of the list. */
  protected promote(candidate: Candidate): void {
    this.update((pos) => promote(pos, candidate));
  }

  protected setStatus(status: Status): void {
    this.update((pos) => setStatus(pos, status));
  }

  private update(fn: (pos: Position) => Position): void {
    this.service.updatePosition(this.orgId(), this.presidency().id, this.pos().key, fn);
  }
}
