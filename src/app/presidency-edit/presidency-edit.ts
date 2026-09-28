import { Component, computed, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ChartService } from '../chart.service';
import { Presidency } from '../models';
import { PositionEditor } from '../position-editor/position-editor';

/** One presidency at a time, in large type for the office screen. */
@Component({
  selector: 'app-presidency-edit',
  imports: [RouterLink, PositionEditor],
  templateUrl: './presidency-edit.html',
  styleUrl: './presidency-edit.scss',
})
export class PresidencyEdit {
  /** Bound from the route parameters by withComponentInputBinding(). */
  readonly orgId = input.required<string>();
  readonly id = input.required<string>();

  protected readonly service = inject(ChartService);

  protected readonly presidency = computed<Presidency | undefined>(() =>
    this.service.presidencies().find((p) => p.id === this.id()),
  );
}
