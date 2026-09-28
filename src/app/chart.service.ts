import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { OrgChart, Organization } from './models';

export type SaveState = 'idle' | 'saving' | 'saved' | 'error';

@Injectable({ providedIn: 'root' })
export class ChartService {
  private readonly http = inject(HttpClient);

  readonly chart = signal<OrgChart | null>(null);
  readonly loadError = signal<string | null>(null);
  readonly saveState = signal<SaveState>('idle');
  readonly saveError = signal<string | null>(null);

  readonly organizations = computed(() => this.chart()?.organizations ?? []);

  private saveTimer: ReturnType<typeof setTimeout> | undefined;

  async load(): Promise<void> {
    try {
      const chart = await firstValueFrom(this.http.get<OrgChart>('/api/chart'));
      this.chart.set(chart);
      this.loadError.set(null);
    } catch (err) {
      this.loadError.set(describe(err));
    }
  }

  /**
   * Optimistically applies the organization locally, then persists it.
   * The server returns the whole chart so we pick up anyone else's edits too.
   */
  async saveOrganization(org: Organization): Promise<void> {
    const current = this.chart();
    if (current) {
      this.chart.set({
        ...current,
        organizations: current.organizations.map((o) => (o.id === org.id ? org : o)),
      });
    }

    clearTimeout(this.saveTimer);
    this.saveState.set('saving');
    try {
      const chart = await firstValueFrom(
        this.http.put<OrgChart>(`/api/organizations/${encodeURIComponent(org.id)}`, org),
      );
      this.chart.set(chart);
      this.saveError.set(null);
      this.saveState.set('saved');
      this.saveTimer = setTimeout(() => this.saveState.set('idle'), 1500);
    } catch (err) {
      this.saveError.set(describe(err));
      this.saveState.set('error');
    }
  }
}

function describe(err: unknown): string {
  if (err && typeof err === 'object') {
    const e = err as { status?: number; error?: { error?: string }; message?: string };
    if (e.error?.error) return e.error.error;
    if (e.status === 0) return 'Cannot reach the server';
    if (e.status) return `Server error (${e.status})`;
    if (e.message) return e.message;
  }
  return 'Unknown error';
}
