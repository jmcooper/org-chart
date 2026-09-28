import { Component, ElementRef, computed, inject, input, output, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { Org } from '../models';
import { OrgsService } from '../orgs.service';

/** Small text-only menu in the corner for changing organizations. */
@Component({
  selector: 'app-org-switcher',
  imports: [RouterLink],
  templateUrl: './org-switcher.html',
  styleUrl: './org-switcher.scss',
  host: {
    '(document:click)': 'onDocumentClick($event)',
    '(document:keydown.escape)': 'open.set(false)',
  },
})
export class OrgSwitcher {
  readonly orgId = input.required<string>();
  readonly newOrg = output<void>();
  readonly lock = output<void>();

  protected readonly orgs = inject(OrgsService);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  private readonly router = inject(Router);

  protected readonly open = signal(false);
  protected readonly showArchived = signal(false);
  protected readonly current = computed(() => this.orgs.byId(this.orgId()));
  protected readonly others = computed(() =>
    this.orgs.active().filter((o) => o.id !== this.orgId()),
  );
  protected readonly archived = computed(() => this.orgs.archived());

  protected toggle(): void {
    this.open.update((v) => !v);
    this.showArchived.set(false);
  }

  protected async restore(org: Org): Promise<void> {
    if (!confirm(`Un-archive ${org.name} and switch to it?`)) return;
    try {
      await this.orgs.setArchived(org.id, false);
      this.open.set(false);
      await this.router.navigate(['/o', org.id]);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Could not restore the organization');
    }
  }

  protected onDocumentClick(event: Event): void {
    if (this.open() && !this.host.nativeElement.contains(event.target as Node))
      this.open.set(false);
  }

  protected choose(action: 'new' | 'lock'): void {
    this.open.set(false);
    if (action === 'new') this.newOrg.emit();
    else this.lock.emit();
  }
}
