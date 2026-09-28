import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ChartService } from './chart.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  template: `<router-outlet />`,
})
export class App {
  private readonly chart = inject(ChartService);

  constructor() {
    void this.chart.load();
  }
}
