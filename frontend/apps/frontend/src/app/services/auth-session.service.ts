import { DestroyRef, Injectable, inject } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router } from '@angular/router';
import { BehaviorSubject, filter, fromEvent } from 'rxjs';

type Session = { token: string; email?: string; roles: string[] };

@Injectable({ providedIn: 'root' })
export class AuthSessionService {
  private readonly router = inject(Router);
  private readonly destroy = inject(DestroyRef);
  private readonly changes = new BehaviorSubject<Session | null>(this.readStorage());
  readonly changes$ = this.changes.asObservable();
  readonly state = toSignal(this.changes$, { requireSync: true });

  constructor() {
    this.router.events.pipe(filter(event => event instanceof NavigationEnd), takeUntilDestroyed(this.destroy))
      .subscribe(() => this.syncFromStorage());
    fromEvent<StorageEvent>(window, 'storage').pipe(
      filter(event => event.key === null || event.key === 'ragyt_token' || event.key === 'ragyt_user'),
      takeUntilDestroyed(this.destroy),
    ).subscribe(() => {
      const session = this.syncFromStorage();
      if (!session) void this.router.navigateByUrl('/login', { replaceUrl: true });
      else if (!session.roles.includes('Admin') && ['/dashboard', '/admin-dashboard'].includes(this.router.url.split(/[?#]/)[0]))
        void this.router.navigateByUrl('/user-rag', { replaceUrl: true });
    });
  }

  login(token: string, user: { email?: string; roles: string[] }): void {
    localStorage.setItem('ragyt_token', token);
    localStorage.setItem('ragyt_user', JSON.stringify(user));
    this.syncFromStorage();
  }

  clear(): void {
    localStorage.removeItem('ragyt_token');
    localStorage.removeItem('ragyt_user');
    this.changes.next(null);
  }

  syncFromStorage(): Session | null {
    const next = this.readStorage();
    if (JSON.stringify(next) !== JSON.stringify(this.changes.value)) this.changes.next(next);
    return next;
  }

  private readStorage(): Session | null {
    try {
      const token = localStorage.getItem('ragyt_token');
      const user = JSON.parse(localStorage.getItem('ragyt_user') ?? 'null');
      if (!token || !user || !Array.isArray(user.roles)) return null;
      return { token, email: user.email, roles: user.roles.filter((role: unknown): role is string => typeof role === 'string') };
    } catch { return null; }
  }
}
