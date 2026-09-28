import { Component, inject, output, signal } from '@angular/core';
import { Router } from '@angular/router';
import { PIN_PATTERN } from '../models';
import { OrgsService } from '../orgs.service';

/** Dialog for creating an organization: a name and a five-letter PIN. */
@Component({
  selector: 'app-new-org',
  templateUrl: './new-org.html',
  styleUrl: './new-org.scss',
  host: { '(document:keydown.escape)': 'close.emit()' },
})
export class NewOrg {
  readonly close = output<void>();

  private readonly orgs = inject(OrgsService);
  private readonly router = inject(Router);

  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);

  protected onPinInput(input: HTMLInputElement): void {
    input.value = input.value
      .toUpperCase()
      .replace(/[^A-Z]/g, '')
      .slice(0, 5);
  }

  protected async submit(
    event: Event,
    nameInput: HTMLInputElement,
    pinInput: HTMLInputElement,
  ): Promise<void> {
    event.preventDefault();
    const name = nameInput.value.trim();
    const pin = pinInput.value;
    if (!name) return this.error.set('Enter a name');
    if (!PIN_PATTERN.test(pin)) return this.error.set('The PIN must be exactly five letters');

    this.busy.set(true);
    try {
      const org = await this.orgs.create(name, pin);
      this.close.emit();
      await this.router.navigate(['/o', org.id]);
    } catch (err) {
      this.error.set(err instanceof Error ? err.message : 'Could not create the organization');
    } finally {
      this.busy.set(false);
    }
  }
}
