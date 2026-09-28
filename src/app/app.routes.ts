import { inject } from '@angular/core';
import { CanActivateFn, Router, Routes } from '@angular/router';
import { ChartView } from './chart-view/chart-view';
import { OrgShell } from './org-shell/org-shell';
import { OrgsService } from './orgs.service';
import { RootPage } from './root-page/root-page';
import { PresidencyEdit } from './presidency-edit/presidency-edit';

/** The root URL shows the default organization. */
const redirectToDefaultOrg: CanActivateFn = async () => {
  const router = inject(Router);
  const orgs = inject(OrgsService);
  await orgs.load().catch(() => null);
  const id = orgs.startId();
  return id ? router.createUrlTree(['/o', id]) : true;
};

export const routes: Routes = [
  { path: '', pathMatch: 'full', canActivate: [redirectToDefaultOrg], component: RootPage },
  {
    path: 'o/:orgId',
    component: OrgShell,
    children: [
      { path: '', component: ChartView },
      { path: 'edit/:id', component: PresidencyEdit },
    ],
  },
  { path: '**', redirectTo: '' },
];
