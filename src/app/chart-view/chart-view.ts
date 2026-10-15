import { DatePipe } from '@angular/common';
import { Component, DestroyRef, computed, inject, input, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { ChartService } from '../chart.service';
import { DeleteOrg } from '../delete-org/delete-org';
import { EditableText } from '../editable-text/editable-text';
import { PositionEditor } from '../position-editor/position-editor';
import { addPosition } from '../position-ops';
import { Presidency } from '../models';
import { OrgsService } from '../orgs.service';

const POLL_MS = 10_000;
const CALLINGS_ROW = 3;
const CALLINGS_OPEN_KEY = 'orgchart.callingsOpen';

@Component({
  selector: 'app-chart-view',
  imports: [RouterLink, DatePipe, DeleteOrg, PositionEditor, EditableText],
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
  protected readonly callingGroups = computed(() =>
    this.service.presidencies().filter((p) => p.row === CALLINGS_ROW),
  );
  protected readonly callingsOpen = signal(readFlag(CALLINGS_OPEN_KEY));
  protected readonly archiveError = signal<string | null>(null);
  protected readonly confirmingDelete = signal(false);

  /** Row 3 holds groups of non-presidency callings, shown in the collapsible section. */
  protected readonly rows = computed<Presidency[][]>(() => {
    const byRow = new Map<number, Presidency[]>();
    for (const pres of this.service.presidencies().filter((p) => p.row !== CALLINGS_ROW)) {
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

  protected toggleCallings(): void {
    this.callingsOpen.update((v) => !v);
    try {
      localStorage.setItem(CALLINGS_OPEN_KEY, String(this.callingsOpen()));
    } catch {
      // Storage may be unavailable; the section simply starts collapsed next time.
    }
  }

  // ---- other callings: sections and callings can be added here ----

  protected addCalling(group: Presidency, title: string): void {
    if (title)
      this.service.updatePresidency(this.orgId(), group.id, (pres) => addPosition(pres, title));
  }

  protected addSection(name: string): void {
    if (name) void this.service.addGroup(this.orgId(), name);
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

function readFlag(key: string): boolean {
  try {
    return localStorage.getItem(key) === 'true';
  } catch {
    return false;
  }
}
