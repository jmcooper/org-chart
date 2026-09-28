import { Component, inject } from '@angular/core';
import { OrgsService } from '../orgs.service';

/** Shown at the root URL only when redirecting to the default organization failed. */
@Component({
  selector: 'app-root-page',
  template: `
    @if (orgs.error(); as err) {
      <div class="error">Could not load organizations: {{ err }}</div>
      <p class="hint"><a href="/">Try again</a></p>
    } @else {
      <div class="error">
        No organizations exist yet. Start the server with DEFAULT_ORG_NAME and DEFAULT_ORG_PIN set.
      </div>
    }
  `,
})
export class RootPage {
  protected readonly orgs = inject(OrgsService);
}
