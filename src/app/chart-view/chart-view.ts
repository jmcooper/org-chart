import { DatePipe } from '@angular/common';
import { Component, DestroyRef, computed, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ChartService } from '../chart.service';
import { Candidate, Position, Presidency, statusLabel } from '../models';

const POLL_MS = 10_000;
const MAX_VISIBLE_PROPOSED = 2;

@Component({
  selector: 'app-chart-view',
  imports: [RouterLink, DatePipe],
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

  protected readonly statusLabel = statusLabel;

  constructor() {
    // Keep the office display current with edits made from phones.
    const refresh = () => {
      if (document.visibilityState === 'visible') void this.service.load(this.orgId());
    };
    const timer = setInterval(refresh, POLL_MS);
    const onVisible = refresh;
    document.addEventListener('visibilitychange', onVisible);
    this.destroyRef.onDestroy(() => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    });
  }

  /** Names shown under a position; the rest are summarised as "+X more…". */
  protected visibleProposed(pos: Position): Candidate[] {
    return pos.proposed.slice(0, MAX_VISIBLE_PROPOSED);
  }

  protected hiddenProposedCount(pos: Position): number {
    return Math.max(0, pos.proposed.length - MAX_VISIBLE_PROPOSED);
  }
}
