import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

export const adminGuard: CanActivateFn = () => {
  const router = inject(Router);
  const rawUser = localStorage.getItem('ragyt_user');

  if (!rawUser) {
    router.navigateByUrl('/login');
    return false;
  }

  try {
    const user = JSON.parse(rawUser) as { roles?: string[] };
    const isAdmin = Array.isArray(user.roles) && user.roles.includes('Admin');

    if (isAdmin) {
      return true;
    }
  } catch {
    // ignore invalid localStorage payload and redirect to login
  }

  localStorage.removeItem('ragyt_token');
  localStorage.removeItem('ragyt_user');
  router.navigateByUrl('/login');
  return false;
};
