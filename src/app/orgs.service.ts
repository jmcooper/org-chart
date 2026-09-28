import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { AuthService, messageFor } from './auth.service';
import { Org, OrgList } from './models';

interface CreateResponse {
  org: Org;
  token: string;
  expiresAt: string;
}

@Injectable({ providedIn: 'root' })
export class OrgsService {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);

  readonly list = signal<OrgList | null>(null);
  readonly error = signal<string | null>(null);
  readonly orgs = computed(() => this.list()?.orgs ?? []);
  readonly active = computed(() => this.orgs().filter((o) => !o.archived));
  readonly archived = computed(() => this.orgs().filter((o) => o.archived));

  /** The organization the root URL should open: the default unless it is archived. */
  readonly startId = computed(() => {
    const list = this.list();
    if (!list) return null;
    const preferred = list.orgs.find((o) => o.id === list.defaultOrgId);
    return (
      (preferred && !preferred.archived
        ? preferred
        : (this.active()[0] ?? preferred ?? list.orgs[0])
      )?.id ?? null
    );
  });

  private pending: Promise<OrgList> | null = null;

  /** Loads the public list of organizations (names only). Cached after the first call. */
  load(force = false): Promise<OrgList> {
    const cached = this.list();
    if (cached && !force) return Promise.resolve(cached);
    this.pending ??= firstValueFrom(this.http.get<OrgList>('/api/orgs'))
      .then((list) => {
        this.list.set(list);
        this.error.set(null);
        return list;
      })
      .catch((err) => {
        this.error.set(messageFor(err));
        throw err;
      })
      .finally(() => (this.pending = null));
    return this.pending;
  }

  byId(id: string): Org | undefined {
    return this.orgs().find((o) => o.id === id);
  }

  async setArchived(id: string, archived: boolean): Promise<void> {
    const action = archived ? 'archive' : 'unarchive';
    try {
      await firstValueFrom(
        this.http.post<Org>(`/api/orgs/${encodeURIComponent(id)}/${action}`, {}),
      );
      await this.load(true);
    } catch (err) {
      throw new Error(messageFor(err));
    }
  }

  /** Soft-deletes an organization. `confirmation` must be its name (case-insensitive). */
  async delete(id: string, confirmation: string): Promise<void> {
    try {
      await firstValueFrom(
        this.http.delete<void>(`/api/orgs/${encodeURIComponent(id)}`, {
          body: { confirm: confirmation },
        }),
      );
      this.auth.clear(id);
      await this.load(true);
    } catch (err) {
      throw new Error(messageFor(err));
    }
  }

  /** Creates an organization and signs this device into it. Requires being signed into some org. */
  async create(name: string, pin: string): Promise<Org> {
    const token = this.auth.anyToken();
    if (!token) throw new Error('Unlock an organization first');
    try {
      const res = await firstValueFrom(
        this.http.post<CreateResponse>(
          '/api/orgs',
          { name, pin },
          { headers: { Authorization: `Bearer ${token}` } },
        ),
      );
      this.auth.store(res.org.id, res.token, res.expiresAt);
      await this.load(true);
      return res.org;
    } catch (err) {
      throw new Error(messageFor(err));
    }
  }
}
