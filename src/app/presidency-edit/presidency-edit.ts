import { CdkDrag, CdkDragDrop, CdkDropList } from '@angular/cdk/drag-drop';
import { Component, computed, inject, input } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { ChartService } from '../chart.service';
import { Presidency } from '../models';
import { EditableText } from '../editable-text/editable-text';
import { PositionEditor } from '../position-editor/position-editor';
import { addPosition, addStandaloneRelease, movePosition } from '../position-ops';

/** One presidency at a time, in large type for the office screen. */
@Component({
  selector: 'app-presidency-edit',
  imports: [RouterLink, PositionEditor, EditableText, CdkDropList, CdkDrag],
  templateUrl: './presidency-edit.html',
  styleUrl: './presidency-edit.scss',
})
export class PresidencyEdit {
  /** Bound from the route parameters by withComponentInputBinding(). */
  readonly orgId = input.required<string>();
  readonly id = input.required<string>();

  protected readonly service = inject(ChartService);
  private readonly router = inject(Router);

  protected readonly presidency = computed<Presidency | undefined>(() =>
    this.service.presidencies().find((p) => p.id === this.id()),
  );

  /** Groups in the "Other callings" section (row 3) can have callings added and retitled. */
  protected readonly isGroup = computed(() => this.presidency()?.row === 3);

  protected reorder(event: CdkDragDrop<unknown>): void {
    this.service.updatePresidency(this.orgId(), this.id(), (pres) =>
      movePosition(pres, event.previousIndex, event.currentIndex),
    );
  }

  protected async removeSection(): Promise<void> {
    const pres = this.presidency();
    if (!pres) return;
    const names = pres.positions.reduce(
      (n, p) => n + (p.primary ? 1 : 0) + p.proposed.length + (p.release ? 1 : 0),
      0,
    );
    const what = `${pres.positions.length} calling${pres.positions.length === 1 ? '' : 's'}`;
    const extra = names > 0 ? ` and the ${names} name${names === 1 ? '' : 's'} listed` : '';
    if (!confirm(`Remove ${pres.name} with its ${what}${extra}?`)) return;
    await this.service.removePresidency(this.orgId(), pres.id);
    await this.router.navigate(['/o', this.orgId()]);
  }

  protected addStandaloneRelease(name: string): void {
    if (name)
      this.service.updatePresidency(this.orgId(), this.id(), (pres) =>
        addStandaloneRelease(pres, name),
      );
  }

  protected addCalling(title: string): void {
    if (title)
      this.service.updatePresidency(this.orgId(), this.id(), (pres) => addPosition(pres, title));
  }
}
