import { DatePipe } from '@angular/common';
import { Component, DestroyRef, computed, inject, input, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { ChartService } from '../chart.service';
import { DeleteOrg } from '../delete-org/delete-org';
import { EditableText } from '../editable-text/editable-text';
import { StatusPill } from '../status-pill/status-pill';
import { Candidate, Position, PositionKey, Presidency, Status, statusLabel } from '../models';
import { OrgsService } from '../orgs.service';
import {
  addProposed,
  promote,
  removeCandidate,
  renameCandidate,
  setPrimary,
  setStatus,
} from '../position-ops';

const POLL_MS = 10_000;
const MAX_VISIBLE_PROPOSED = 2;

@Component({
  selector: 'app-chart-view',
  imports: [RouterLink, DatePipe, EditableText, DeleteOrg, StatusPill],
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

  // ---- inline edits ----

  protected rename(pres: Presidency, key: PositionKey, candidate: Candidate, name: string): void {
    if (!name) {
      this.service.updatePosition(this.orgId(), pres.id, key, (pos) =>
        removeCandidate(pos, candidate.id),
      );
      return;
    }
    this.service.updatePosition(this.orgId(), pres.id, key, (pos) =>
      renameCandidate(pos, candidate.id, name),
    );
  }

  protected setStatus(pres: Presidency, key: PositionKey, status: Status): void {
    this.service.updatePosition(this.orgId(), pres.id, key, (pos) => setStatus(pos, status));
  }

  /** Moves a proposed name into the primary spot; the current primary drops to the top of the list. */
  protected promote(pres: Presidency, key: PositionKey, candidate: Candidate): void {
    this.service.updatePosition(this.orgId(), pres.id, key, (pos) => promote(pos, candidate));
  }

  /** Typing into an empty primary box fills it directly as "Considered". */
  protected setPrimary(pres: Presidency, key: PositionKey, name: string): void {
    if (!name) return;
    this.service.updatePosition(this.orgId(), pres.id, key, (pos) => setPrimary(pos, name));
  }

  protected add(pres: Presidency, key: PositionKey, name: string): void {
    if (!name) return;
    this.service.updatePosition(this.orgId(), pres.id, key, (pos) => addProposed(pos, name));
  }
}
