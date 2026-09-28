import { Component, computed, inject, input, output, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Org } from '../models';
import { OrgsService } from '../orgs.service';

/** Confirmation dialog that requires typing the organization's name in capitals. */
@Component({
  selector: 'app-delete-org',
  templateUrl: './delete-org.html',
  styleUrl: './delete-org.scss',
  host: { '(document:keydown.escape)': 'close.emit()' },
})
export class DeleteOrg {
  readonly org = input.required<Org>();
  readonly close = output<void>();

  private readonly orgs = inject(OrgsService);
  private readonly router = inject(Router);

  protected readonly typed = signal('');
  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly required = computed(() => this.org().name.toUpperCase());
  protected readonly matches = computed(() => this.typed() === this.required());

  protected onInput(input: HTMLInputElement): void {
    input.value = input.value.toUpperCase();
    this.typed.set(input.value);
  }

  protected async submit(event: Event): Promise<void> {
    event.preventDefault();
    if (!this.matches() || this.busy()) return;
    this.busy.set(true);
    try {
      const id = this.org().id;
      await this.orgs.delete(id, this.typed());
      this.close.emit();
      const next = this.orgs.active()[0] ?? this.orgs.orgs()[0];
      await this.router.navigate(next ? ['/o', next.id] : ['/']);
    } catch (err) {
      this.error.set(err instanceof Error ? err.message : 'Could not delete the organization');
    } finally {
      this.busy.set(false);
    }
  }
}
