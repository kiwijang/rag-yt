import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthSessionService } from '../services/auth-session.service';

export const authGuard: CanActivateFn = () =>
  inject(AuthSessionService).syncFromStorage() ? true : inject(Router).parseUrl('/login');
