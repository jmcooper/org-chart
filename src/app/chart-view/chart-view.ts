import { DatePipe } from '@angular/common';
import { Component, DestroyRef, computed, inject, input, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { ChartService } from '../chart.service';
import { DeleteOrg } from '../delete-org/delete-org';
import { PositionEditor } from '../position-editor/position-editor';
import { Presidency } from '../models';
import { OrgsService } from '../orgs.service';

const POLL_MS = 10_000;

@Component({
  selector: 'app-chart-view',
  imports: [RouterLink, DatePipe, DeleteOrg, PositionEditor],
  templateUrl: './chart-view.html',
  styleUrl: './chart-view.scss',
})
export class ChartView {
  /** Bound from the parent route parameter. */
  readonly orgId = input.required<string>();

  protected readonly service = inject(ChartService);
  protected readonly orgs = inject(OrgsService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly org = computed(() => this.orgs.byId(this.orgId()));
  protected readonly archiveError = signal<string | null>(null);
  protected readonly confirmingDelete = signal(false);

  protected readonly rows = computed<Presidency[][]>(() => {
    const byRow = new Map<number, Presidency[]>();
    for (const pres of this.service.presidencies()) {
      const list = byRow.get(pres.row) ?? [];
      list.push(pres);
      byRow.set(pres.row, list);
    }
    return [...byRow.entries()].sort(([a], [b]) => a - b).map(([, list]) => list);
  });

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

  // ---- archiving ----

  protected async archive(): Promise<void> {
    const org = this.org();
    if (!org) return;
    if (
      !confirm(
        `Archive ${org.name}? It will be hidden from the menu, and can be restored from "Archived" there.`,
      )
    )
      return;
    try {
      await this.orgs.setArchived(org.id, true);
      const next = this.orgs.active()[0];
      if (next) await this.router.navigate(['/o', next.id]);
    } catch (err) {
      this.archiveError.set(err instanceof Error ? err.message : 'Could not archive');
    }
  }

  protected async unarchive(): Promise<void> {
    const org = this.org();
    if (!org) return;
    try {
      await this.orgs.setArchived(org.id, false);
    } catch (err) {
      this.archiveError.set(err instanceof Error ? err.message : 'Could not restore');
    }
  }
}
