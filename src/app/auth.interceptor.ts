import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { AuthService } from './auth.service';

const ORG_URL = /^\/api\/orgs\/([^/]+)\//;

/** Attaches the organization's bearer token to requests for that organization's data. */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const match = ORG_URL.exec(req.url);
  if (!match || req.headers.has('Authorization')) return next(req);
  const token = inject(AuthService).tokenFor(decodeURIComponent(match[1]));
  return next(token ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }) : req);
};
