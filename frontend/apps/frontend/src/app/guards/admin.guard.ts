import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthSessionService } from '../services/auth-session.service';
import { ApiError, AuthService } from '@ragyt/api-client';
import { catchError, map, of } from 'rxjs';

export const adminGuard: CanActivateFn = () => {
  const router = inject(Router);
  const auth = inject(AuthSessionService);
  const api = inject(AuthService);
  const session = auth.syncFromStorage();
  if (!session) return router.parseUrl('/login');
  if (!session.roles.includes('Admin')) return router.parseUrl('/user-rag');
  // The server must confirm the role; localStorage is only a UI hint.
  return api.getApiAuthAdminDashboard().pipe(
    map(() => true),
    catchError(error => {
      if (error instanceof ApiError && error.status === 401) {
        auth.clear();
        return of(router.parseUrl('/login'));
      }
      if (error instanceof ApiError && error.status === 403)
        auth.login(session.token, { email: session.email, roles: session.roles.filter(role => role !== 'Admin') });
      return of(router.parseUrl('/user-rag'));
    }),
  );
};
