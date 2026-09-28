import { Component, ElementRef, computed, inject, input, output, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
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

  protected readonly open = signal(false);
  protected readonly current = computed(() => this.orgs.byId(this.orgId()));
  protected readonly others = computed(() => this.orgs.orgs().filter((o) => o.id !== this.orgId()));

  protected toggle(): void {
    this.open.update((v) => !v);
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
