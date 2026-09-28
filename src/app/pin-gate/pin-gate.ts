import { Component, ElementRef, inject, input, signal, viewChild } from '@angular/core';
import { AuthService } from '../auth.service';
import { Org, PIN_PATTERN } from '../models';

/** Asks for an organization's five-letter PIN before any of its data is requested. */
@Component({
  selector: 'app-pin-gate',
  templateUrl: './pin-gate.html',
  styleUrl: './pin-gate.scss',
})
export class PinGate {
  readonly org = input.required<Org>();

  private readonly auth = inject(AuthService);
  private readonly pinInput = viewChild.required<ElementRef<HTMLInputElement>>('pinInput');

  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);

  protected onInput(input: HTMLInputElement): void {
    // Letters only, upper-cased as you type.
    input.value = input.value
      .toUpperCase()
      .replace(/[^A-Z]/g, '')
      .slice(0, 5);
    this.error.set(null);
  }

  protected async submit(event: Event, input: HTMLInputElement): Promise<void> {
    event.preventDefault();
    const pin = input.value;
    if (!PIN_PATTERN.test(pin)) {
      this.error.set('Enter five letters');
      return;
    }
    this.busy.set(true);
    try {
      await this.auth.login(this.org().id, pin);
    } catch (err) {
      this.error.set(err instanceof Error ? err.message : 'Could not sign in');
      input.value = '';
      this.pinInput().nativeElement.focus();
    } finally {
      this.busy.set(false);
    }
  }
}
