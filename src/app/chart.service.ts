import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { AuthService, messageFor } from './auth.service';
import { OrgChart, Presidency } from './models';

export type SaveState = 'idle' | 'saving' | 'saved' | 'error';

/** The chart of the organization currently being viewed. */
@Injectable({ providedIn: 'root' })
export class ChartService {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);

  readonly orgId = signal<string | null>(null);
  readonly chart = signal<OrgChart | null>(null);
  readonly loadError = signal<string | null>(null);
  readonly saveState = signal<SaveState>('idle');
  readonly saveError = signal<string | null>(null);

  readonly presidencies = computed(() => this.chart()?.presidencies ?? []);

  private saveTimer: ReturnType<typeof setTimeout> | undefined;

  /** Forget everything; called when leaving or locking an organization. */
  reset(): void {
    this.orgId.set(null);
    this.chart.set(null);
    this.loadError.set(null);
    this.saveState.set('idle');
    this.saveError.set(null);
  }

  async load(orgId: string): Promise<void> {
    if (this.orgId() !== orgId) {
      this.reset();
      this.orgId.set(orgId);
    }
    try {
      const chart = await firstValueFrom(
        this.http.get<OrgChart>(`/api/orgs/${encodeURIComponent(orgId)}/chart`),
      );
      if (this.orgId() !== orgId) return; // switched away while loading
      this.chart.set(chart);
      this.loadError.set(null);
    } catch (err) {
      if (this.orgId() !== orgId) return;
      this.handleUnauthorized(orgId, err);
      this.loadError.set(messageFor(err));
    }
  }

  /**
   * Optimistically applies the presidency locally, then persists it.
   * The server returns the whole chart so we pick up anyone else's edits too.
   */
  async savePresidency(orgId: string, presidency: Presidency): Promise<void> {
    const current = this.chart();
    if (current && this.orgId() === orgId) {
      this.chart.set({
        ...current,
        presidencies: current.presidencies.map((p) => (p.id === presidency.id ? presidency : p)),
      });
    }

    clearTimeout(this.saveTimer);
    this.saveState.set('saving');
    try {
      const chart = await firstValueFrom(
        this.http.put<OrgChart>(
          `/api/orgs/${encodeURIComponent(orgId)}/presidencies/${encodeURIComponent(presidency.id)}`,
          presidency,
        ),
      );
      if (this.orgId() !== orgId) return;
      this.chart.set(chart);
      this.saveError.set(null);
      this.saveState.set('saved');
      this.saveTimer = setTimeout(() => this.saveState.set('idle'), 1500);
    } catch (err) {
      this.handleUnauthorized(orgId, err);
      this.saveError.set(messageFor(err));
      this.saveState.set('error');
    }
  }

  /** An expired or revoked token sends the user back to the PIN screen. */
  private handleUnauthorized(orgId: string, err: unknown): void {
    if (err instanceof HttpErrorResponse && err.status === 401) this.auth.clear(orgId);
  }
}
