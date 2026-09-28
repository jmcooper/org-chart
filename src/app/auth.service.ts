import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';

interface StoredToken {
  token: string;
  /** Epoch milliseconds. */
  exp: number;
}

interface LoginResponse {
  token: string;
  expiresAt: string;
}

const STORAGE_KEY = 'orgchart.tokens';

/**
 * Holds one JWT per organization, remembered on this device until it expires.
 * Every request for an organization's data carries its token (see authInterceptor).
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly tokens = signal<Record<string, StoredToken>>(readStorage());

  readonly authorizedOrgIds = computed(() => Object.keys(this.tokens()));

  tokenFor(orgId: string): string | null {
    const entry = this.tokens()[orgId];
    if (!entry) return null;
    if (entry.exp <= Date.now()) {
      this.clear(orgId);
      return null;
    }
    return entry.token;
  }

  /** Any unexpired token, used for actions that need "some" signed-in organization. */
  anyToken(): string | null {
    for (const id of Object.keys(this.tokens())) {
      const token = this.tokenFor(id);
      if (token) return token;
    }
    return null;
  }

  hasToken(orgId: string): boolean {
    return this.tokenFor(orgId) !== null;
  }

  /** Exchanges a PIN for a token. Throws an Error with a user-facing message on failure. */
  async login(orgId: string, pin: string): Promise<void> {
    try {
      const res = await firstValueFrom(
        this.http.post<LoginResponse>(`/api/orgs/${encodeURIComponent(orgId)}/login`, { pin }),
      );
      this.store(orgId, res.token, res.expiresAt);
    } catch (err) {
      throw new Error(messageFor(err));
    }
  }

  store(orgId: string, token: string, expiresAt: string): void {
    this.tokens.update((all) => ({ ...all, [orgId]: { token, exp: Date.parse(expiresAt) } }));
    writeStorage(this.tokens());
  }

  clear(orgId: string): void {
    this.tokens.update((all) => {
      const { [orgId]: _, ...rest } = all;
      return rest;
    });
    writeStorage(this.tokens());
  }
}

export function messageFor(err: unknown): string {
  if (err instanceof HttpErrorResponse) {
    const body = err.error as { error?: string } | null;
    if (body?.error) return body.error;
    if (err.status === 0) return 'Cannot reach the server';
    return `Server error (${err.status})`;
  }
  return err instanceof Error ? err.message : 'Unknown error';
}

function readStorage(): Record<string, StoredToken> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Record<string, StoredToken>) : {};
  } catch {
    return {};
  }
}

function writeStorage(tokens: Record<string, StoredToken>): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tokens));
  } catch {
    // Private mode or blocked storage: tokens simply live for this page load.
  }
}
