import { Component, computed, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ChartService } from '../chart.service';
import {
  addProposed,
  demote,
  promote,
  removeCandidate,
  renameCandidate,
  setStatus,
} from '../position-ops';
import {
  Candidate,
  Presidency,
  Position,
  PositionKey,
  STATUSES,
  Status,
  statusLabel,
} from '../models';

@Component({
  selector: 'app-presidency-edit',
  imports: [RouterLink],
  templateUrl: './presidency-edit.html',
  styleUrl: './presidency-edit.scss',
})
export class PresidencyEdit {
  /** Bound from the route parameters by withComponentInputBinding(). */
  readonly orgId = input.required<string>();
  readonly id = input.required<string>();

  protected readonly service = inject(ChartService);
  protected readonly statuses = STATUSES;
  protected readonly statusLabel = statusLabel;

  protected readonly presidency = computed<Presidency | undefined>(() =>
    this.service.presidencies().find((p) => p.id === this.id()),
  );

  // ---- mutations (each one saves immediately) ----

  protected addProposed(key: PositionKey, input: HTMLInputElement): void {
    const name = input.value.trim();
    if (!name) return;
    this.update(key, (pos) => addProposed(pos, name));
    input.value = '';
    input.focus();
  }

  protected removeProposed(key: PositionKey, candidate: Candidate): void {
    this.update(key, (pos) => removeCandidate(pos, candidate.id));
  }

  /** Promote a proposed name to the primary spot as "Considered". */
  protected promote(key: PositionKey, candidate: Candidate): void {
    this.update(key, (pos) => promote(pos, candidate));
  }

  protected setStatus(key: PositionKey, status: Status): void {
    this.update(key, (pos) => setStatus(pos, status));
  }

  /** Move the primary name back to the proposed list. */
  protected demote(key: PositionKey): void {
    this.update(key, demote);
  }

  protected removePrimary(key: PositionKey, pos: Position): void {
    if (!pos.primary) return;
    if (!confirm(`Remove ${pos.primary.name} from ${pos.title}?`)) return;
    this.update(key, (p) => (p.primary ? removeCandidate(p, p.primary.id) : p));
  }

  protected rename(key: PositionKey, candidate: Candidate): void {
    const name = prompt('Edit name', candidate.name)?.trim();
    if (!name || name === candidate.name) return;
    this.update(key, (pos) => renameCandidate(pos, candidate.id, name));
  }

  private update(key: PositionKey, fn: (pos: Position) => Position): void {
    this.service.updatePosition(this.orgId(), this.id(), key, fn);
  }
}
