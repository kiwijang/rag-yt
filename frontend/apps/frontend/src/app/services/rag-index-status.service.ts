import { Injectable, inject } from '@angular/core';
import { NavigationEnd, NavigationStart, Router } from '@angular/router';
import { EMPTY, catchError, combineLatest, defer, distinctUntilChanged, exhaustMap, filter, map, of, shareReplay, startWith, switchMap, takeWhile, timer } from 'rxjs';
import { ApiError, RagService, VectorIndexProgress } from '@ragyt/api-client';
import { AuthSessionService } from './auth-session.service';

@Injectable({ providedIn: 'root' })
export class RagIndexStatusService {
  private readonly api = inject(RagService);
  private readonly session = inject(AuthSessionService);
  private readonly router = inject(Router);
  private readonly route$ = this.router.events.pipe(
    filter((event): event is NavigationStart | NavigationEnd => event instanceof NavigationStart || event instanceof NavigationEnd),
    map(event => event instanceof NavigationEnd ? event.urlAfterRedirects : event.url),
    startWith(this.router.url), distinctUntilChanged(),
  );

  // One shared generated-API poll, even while Ionic retains multiple cached pages.
  // switchMap cancels the timer AND an in-flight GET immediately on logout.
  readonly state$ = combineLatest([this.session.changes$, this.route$]).pipe(
    switchMap(([session, url]) => {
      if (!session?.roles.includes('Admin') || !['/dashboard', '/admin-dashboard', '/user-rag'].includes(url.split(/[?#]/)[0]))
        return of({ progress: null as VectorIndexProgress | null, error: '' });
      let denied = false;
      return timer(0, 2500).pipe(
        exhaustMap(() => defer(() => {
          const current = this.session.syncFromStorage();
          if (current?.token !== session.token || !current?.roles.includes('Admin')) return EMPTY;
          return this.api.getApiRagIndexStatus();
        }).pipe(
          map((progress: VectorIndexProgress) => ({ progress: progress as VectorIndexProgress | null, error: '' })),
          catchError(error => {
            if (error instanceof ApiError && [401, 403].includes(error.status)) {
              denied = true;
              if (error.status === 401) {
                this.session.clear();
                void this.router.navigateByUrl('/login', { replaceUrl: true });
              }
            }
            return of({ progress: null as VectorIndexProgress | null, error: '無法讀取索引狀態，請確認服務與管理員登入狀態。' });
          }),
        )),
        takeWhile(() => !denied, true),
      );
    }),
    shareReplay({ bufferSize: 1, refCount: true }),
  );
}
