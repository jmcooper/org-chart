import { DatePipe } from '@angular/common';
import { Component, DestroyRef, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ChartService } from '../chart.service';
import { Candidate, Organization, Position, statusLabel } from '../models';

const POLL_MS = 10_000;
const MAX_VISIBLE_PROPOSED = 2;

@Component({
  selector: 'app-chart-view',
  imports: [RouterLink, DatePipe],
  templateUrl: './chart-view.html',
  styleUrl: './chart-view.scss',
})
export class ChartView {
  protected readonly service = inject(ChartService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly rows = computed<Organization[][]>(() => {
    const byRow = new Map<number, Organization[]>();
    for (const org of this.service.organizations()) {
      const list = byRow.get(org.row) ?? [];
      list.push(org);
      byRow.set(org.row, list);
    }
    return [...byRow.entries()].sort(([a], [b]) => a - b).map(([, orgs]) => orgs);
  });

  protected readonly statusLabel = statusLabel;

  constructor() {
    // Keep the office display current with edits made from phones.
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') void this.service.load();
    }, POLL_MS);
    const onVisible = () => {
      if (document.visibilityState === 'visible') void this.service.load();
    };
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
