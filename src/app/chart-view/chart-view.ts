import { DatePipe } from '@angular/common';
import { Component, DestroyRef, computed, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ChartService } from '../chart.service';
import { EditableText } from '../editable-text/editable-text';
import { Candidate, Position, PositionKey, Presidency, statusLabel } from '../models';
import { addProposed, removeCandidate, renameCandidate } from '../position-ops';

const POLL_MS = 10_000;
const MAX_VISIBLE_PROPOSED = 2;

@Component({
  selector: 'app-chart-view',
  imports: [RouterLink, DatePipe, EditableText],
  templateUrl: './chart-view.html',
  styleUrl: './chart-view.scss',
})
export class ChartView {
  /** Bound from the parent route parameter. */
  readonly orgId = input.required<string>();

  protected readonly service = inject(ChartService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly rows = computed<Presidency[][]>(() => {
    const byRow = new Map<number, Presidency[]>();
    for (const pres of this.service.presidencies()) {
      const list = byRow.get(pres.row) ?? [];
      list.push(pres);
      byRow.set(pres.row, list);
    }
    return [...byRow.entries()].sort(([a], [b]) => a - b).map(([, list]) => list);
  });

  /** Positions whose full proposed list is shown ("presidencyId/key"). */
  private readonly expanded = signal<ReadonlySet<string>>(new Set());

  protected readonly statusLabel = statusLabel;

  constructor() {
    // Keep the office display current with edits made from phones,
    // but never while someone is typing into a name here.
    const refresh = () => {
      if (document.visibilityState !== 'visible') return;
      if (document.activeElement instanceof HTMLInputElement) return;
      void this.service.load(this.orgId());
    };
    const timer = setInterval(refresh, POLL_MS);
    document.addEventListener('visibilitychange', refresh);
    this.destroyRef.onDestroy(() => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', refresh);
    });
  }

  protected visibleProposed(pres: Presidency, pos: Position): Candidate[] {
    return this.isExpanded(pres, pos) ? pos.proposed : pos.proposed.slice(0, MAX_VISIBLE_PROPOSED);
  }

  protected hiddenProposedCount(pres: Presidency, pos: Position): number {
    return this.isExpanded(pres, pos) ? 0 : Math.max(0, pos.proposed.length - MAX_VISIBLE_PROPOSED);
  }

  protected expand(pres: Presidency, pos: Position): void {
    this.expanded.update((set) => new Set(set).add(`${pres.id}/${pos.key}`));
  }

  private isExpanded(pres: Presidency, pos: Position): boolean {
    return this.expanded().has(`${pres.id}/${pos.key}`);
  }

  // ---- inline edits ----

  protected rename(pres: Presidency, key: PositionKey, candidate: Candidate, name: string): void {
    if (!name) {
      if (!confirm(`Remove ${candidate.name}?`)) return;
      this.service.updatePosition(this.orgId(), pres.id, key, (pos) =>
        removeCandidate(pos, candidate.id),
      );
      return;
    }
    this.service.updatePosition(this.orgId(), pres.id, key, (pos) =>
      renameCandidate(pos, candidate.id, name),
    );
  }

  protected add(pres: Presidency, key: PositionKey, name: string): void {
    if (!name) return;
    this.service.updatePosition(this.orgId(), pres.id, key, (pos) => addProposed(pos, name));
  }
}
