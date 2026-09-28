import { Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { RouterOutlet } from '@angular/router';
import { AuthService } from '../auth.service';
import { ChartService } from '../chart.service';
import { NewOrg } from '../new-org/new-org';
import { OrgSwitcher } from '../org-switcher/org-switcher';
import { OrgsService } from '../orgs.service';
import { PinGate } from '../pin-gate/pin-gate';

/**
 * Wraps everything shown for one organization: the switcher in the corner,
 * the PIN gate, and (once unlocked) the chart or edit views.
 */
@Component({
  selector: 'app-org-shell',
  imports: [RouterOutlet, OrgSwitcher, PinGate, NewOrg],
  templateUrl: './org-shell.html',
  styleUrl: './org-shell.scss',
})
export class OrgShell {
  /** Bound from the route parameter. */
  readonly orgId = input.required<string>();

  protected readonly orgs = inject(OrgsService);
  protected readonly auth = inject(AuthService);
  private readonly chart = inject(ChartService);
  private readonly title = inject(Title);

  protected readonly org = computed(() => this.orgs.byId(this.orgId()));
  protected readonly unlocked = computed(
    () => this.auth.authorizedOrgIds().includes(this.orgId()) && this.auth.hasToken(this.orgId()),
  );
  protected readonly showNewOrg = signal(false);

  constructor() {
    void this.orgs.load();

    // Load the chart only once this organization's PIN has been entered on this device.
    effect(() => {
      const id = this.orgId();
      const ok = this.unlocked();
      untracked(() => {
        if (ok) void this.chart.load(id);
        else this.chart.reset();
      });
    });

    effect(() => {
      const name = this.org()?.name;
      this.title.setTitle(name ? `${name} · Org Chart` : 'Org Chart');
    });
  }

  protected lock(): void {
    this.auth.clear(this.orgId());
  }
}
