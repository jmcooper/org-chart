import { Component, ElementRef, computed, inject, input, output, signal } from '@angular/core';
import { STATUSES, statusLabel } from '../models';

export interface PillOption {
  value: string;
  label: string;
}

/** Small pill in the corner of a name box; tapping it drops down the choices. */
@Component({
  selector: 'app-status-pill',
  templateUrl: './status-pill.html',
  styleUrl: './status-pill.scss',
  host: {
    '(document:click)': 'onDocumentClick($event)',
    '(document:keydown.escape)': 'open.set(false)',
  },
})
export class StatusPill {
  readonly status = input.required<string>();
  /** The choices offered; defaults to the calling statuses. */
  readonly options = input<readonly PillOption[]>(STATUSES);
  readonly change = output<string>();

  protected readonly open = signal(false);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  protected readonly label = computed(
    () =>
      this.options().find((o) => o.value === this.status())?.label ??
      statusLabel(this.status() as never),
  );

  protected toggle(event: Event): void {
    event.stopPropagation();
    this.open.update((v) => !v);
  }

  protected choose(value: string): void {
    this.open.set(false);
    if (value !== this.status()) this.change.emit(value);
  }

  protected onDocumentClick(event: Event): void {
    if (this.open() && !this.host.nativeElement.contains(event.target as Node))
      this.open.set(false);
  }
}
