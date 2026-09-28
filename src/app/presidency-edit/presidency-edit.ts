import { Component, computed, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ChartService } from '../chart.service';
import {
  Candidate,
  Presidency,
  Position,
  PositionKey,
  STATUSES,
  Status,
  newId,
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
    this.update(key, (pos) => ({ ...pos, proposed: [...pos.proposed, { id: newId(), name }] }));
    input.value = '';
    input.focus();
  }

  protected removeProposed(key: PositionKey, candidate: Candidate): void {
    this.update(key, (pos) => ({
      ...pos,
      proposed: pos.proposed.filter((c) => c.id !== candidate.id),
    }));
  }

  /** Promote a proposed name to the primary spot as "Considered". */
  protected promote(key: PositionKey, candidate: Candidate): void {
    this.update(key, (pos) => {
      const proposed = pos.proposed.filter((c) => c.id !== candidate.id);
      // Whoever was in the spot goes back to the top of the proposed list.
      if (pos.primary) proposed.unshift({ id: pos.primary.id, name: pos.primary.name });
      return {
        ...pos,
        primary: { id: candidate.id, name: candidate.name, status: 'considered' },
        proposed,
      };
    });
  }

  protected setStatus(key: PositionKey, status: Status): void {
    this.update(key, (pos) =>
      pos.primary ? { ...pos, primary: { ...pos.primary, status } } : pos,
    );
  }

  /** Move the primary name back to the proposed list. */
  protected demote(key: PositionKey): void {
    this.update(key, (pos) =>
      pos.primary
        ? {
            ...pos,
            primary: null,
            proposed: [{ id: pos.primary.id, name: pos.primary.name }, ...pos.proposed],
          }
        : pos,
    );
  }

  protected removePrimary(key: PositionKey, pos: Position): void {
    if (!pos.primary) return;
    if (!confirm(`Remove ${pos.primary.name} from ${pos.title}?`)) return;
    this.update(key, (p) => ({ ...p, primary: null }));
  }

  protected rename(key: PositionKey, candidate: Candidate, isPrimary: boolean): void {
    const name = prompt('Edit name', candidate.name)?.trim();
    if (!name || name === candidate.name) return;
    this.update(key, (pos) =>
      isPrimary
        ? { ...pos, primary: pos.primary ? { ...pos.primary, name } : null }
        : {
            ...pos,
            proposed: pos.proposed.map((c) => (c.id === candidate.id ? { ...c, name } : c)),
          },
    );
  }

  private update(key: PositionKey, fn: (pos: Position) => Position): void {
    const presidency = this.presidency();
    if (!presidency) return;
    void this.service.savePresidency(this.orgId(), {
      ...presidency,
      positions: presidency.positions.map((p) => (p.key === key ? fn(p) : p)),
    });
  }
}
