import { CdkDragHandle } from '@angular/cdk/drag-drop';
import { Component, computed, inject, input, signal } from '@angular/core';
import { ChartService } from '../chart.service';
import { EditableText } from '../editable-text/editable-text';
import {
  Candidate,
  PROPOSED_NAMES_ENABLED,
  Position,
  Presidency,
  RELEASE_STATUSES,
  ReleaseStatus,
  Status,
  statusLabel,
} from '../models';
import {
  addProposed,
  addRelease,
  promote,
  removeCandidate,
  removePosition,
  renameCandidate,
  renamePosition,
  renameRelease,
  setPrimary,
  setReleaseStatus,
  setStatus,
} from '../position-ops';
import { StatusPill } from '../status-pill/status-pill';

/**
 * One position: the primary name box with its status pill, an optional release
 * joined beneath it, the additional names with promote arrows, and the add lines.
 * Used by both the chart and the focused view; the views set the sizes.
 */
@Component({
  selector: 'app-position-editor',
  imports: [EditableText, StatusPill, CdkDragHandle],
  templateUrl: './position-editor.html',
  styleUrl: './position-editor.scss',
})
export class PositionEditor {
  readonly orgId = input.required<string>();
  readonly presidency = input.required<Presidency>();
  readonly pos = input.required<Position>();
  /** How many additional names to show before "+X more…"; null shows all. */
  readonly maxVisible = input<number | null>(2);
  /** Callings in the "Other callings" section can be retitled. */
  readonly titleEditable = input(false);
  /** Shows a remove control for the calling. */
  readonly removable = input(false);
  /** Shows a grip that starts a drag when the host list is a CDK drop list. */
  readonly draggable = input(false);

  private readonly service = inject(ChartService);
  protected readonly statusLabel = statusLabel;
  protected readonly proposedEnabled = PROPOSED_NAMES_ENABLED;
  protected readonly releaseStatuses = RELEASE_STATUSES;
  private readonly expanded = signal(false);

  protected readonly visible = computed<Candidate[]>(() => {
    const max = this.maxVisible();
    const list = this.pos().proposed;
    return max === null || this.expanded() ? list : list.slice(0, max);
  });

  protected readonly hiddenCount = computed(
    () => this.pos().proposed.length - this.visible().length,
  );

  protected expand(): void {
    this.expanded.set(true);
  }

  protected rename(candidate: Candidate, name: string): void {
    this.update((pos) =>
      name ? renameCandidate(pos, candidate.id, name) : removeCandidate(pos, candidate.id),
    );
  }

  /** Typing into an empty primary box fills it directly as "Consider". */
  protected setPrimary(name: string): void {
    if (name) this.update((pos) => setPrimary(pos, name));
  }

  protected add(name: string): void {
    if (name) this.update((pos) => addProposed(pos, name));
  }

  /** Moves an additional name into the primary spot; the current primary drops to the top of the list. */
  protected promote(candidate: Candidate): void {
    this.update((pos) => promote(pos, candidate));
  }

  protected setStatus(status: string): void {
    this.update((pos) => setStatus(pos, status as Status));
  }

  // ---- release ----

  protected addRelease(name: string): void {
    if (name) this.update((pos) => addRelease(pos, name));
  }

  protected renameRelease(name: string): void {
    // A standalone release is nothing but its name, so clearing it removes the entry.
    if (!name && this.pos().releaseOnly) return this.remove();
    this.update((pos) => renameRelease(pos, name));
  }

  protected setReleaseStatus(status: string): void {
    this.update((pos) => setReleaseStatus(pos, status as ReleaseStatus));
  }

  // ---- the calling itself ----

  protected retitle(title: string): void {
    const key = this.pos().key;
    if (!title) return this.remove();
    this.service.updatePresidency(this.orgId(), this.presidency().id, (pres) =>
      renamePosition(pres, key, title),
    );
  }

  /** Removes the calling. Asks first only when someone is listed for it. */
  protected remove(): void {
    const pos = this.pos();
    const listed = (pos.primary ? 1 : 0) + pos.proposed.length + (pos.release ? 1 : 0);
    if (
      listed > 0 &&
      !confirm(
        `Remove ${pos.title}? ${listed === 1 ? 'The name' : 'The ' + listed + ' names'} listed for it will be removed too.`,
      )
    ) {
      return;
    }
    this.service.updatePresidency(this.orgId(), this.presidency().id, (pres) =>
      removePosition(pres, pos.key),
    );
  }

  private update(fn: (pos: Position) => Position): void {
    this.service.updatePosition(this.orgId(), this.presidency().id, this.pos().key, fn);
  }
}
