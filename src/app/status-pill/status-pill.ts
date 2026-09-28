import { Component, ElementRef, inject, input, output, signal } from '@angular/core';
import { STATUSES, Status, statusLabel } from '../models';

/** Small pill in the corner of a name box; tapping it drops down the status choices. */
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
  readonly status = input.required<Status>();
  readonly change = output<Status>();

  protected readonly statuses = STATUSES;
  protected readonly statusLabel = statusLabel;
  protected readonly open = signal(false);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  protected toggle(event: Event): void {
    event.stopPropagation();
    this.open.update((v) => !v);
  }

  protected choose(status: Status): void {
    this.open.set(false);
    if (status !== this.status()) this.change.emit(status);
  }

  protected onDocumentClick(event: Event): void {
    if (this.open() && !this.host.nativeElement.contains(event.target as Node))
      this.open.set(false);
  }
}
