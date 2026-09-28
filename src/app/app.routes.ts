import { Routes } from '@angular/router';
import { ChartView } from './chart-view/chart-view';
import { OrgEdit } from './org-edit/org-edit';

export const routes: Routes = [
  { path: '', component: ChartView, title: 'Ward Organization' },
  { path: 'org/:id', component: OrgEdit, title: 'Edit Presidency' },
  { path: '**', redirectTo: '' },
];
